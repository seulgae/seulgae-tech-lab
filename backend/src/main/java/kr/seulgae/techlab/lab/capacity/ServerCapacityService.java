package kr.seulgae.techlab.lab.capacity;

import com.sun.management.OperatingSystemMXBean;
import java.lang.management.ManagementFactory;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * 서버실 랙 4개에 나눠 보여 줄 용량 조사.
 * <ol>
 *   <li>1번 랙 CPU: 호스트 실시간 사용률(user·system·iowait), 부하 평균, 코어 수, JVM 프로세스 CPU</li>
 *   <li>2번 랙 메모리: 호스트 사용률, 사용·가용·버퍼캐시·스왑</li>
 *   <li>3번 랙 JVM 힙: 힙 사용·확보·최대, 힙 외 메모리, GC 횟수·누적 시간, 스레드</li>
 *   <li>4번 랙 가동시간: 서버(호스트) 가동시간·부팅 시각, JVM 가동시간·시작 시각, 수집 상태</li>
 * </ol>
 * 호스트 값은 SSH 프로브를 30초마다 한 번 돌려 마지막 결과와 최근 30개(약 15분) 추이만 메모리에 둔다(DB 저장 없음).
 * JVM 값은 요청 때마다 이 프로세스의 MXBean에서 읽는다.
 *
 * @author seulgae
 * @version 1.0, 서버실 랙 용량 조사
 * @see "docs/server-capacity.md"
 */
@Service
public class ServerCapacityService {
    private static final Logger log = LoggerFactory.getLogger(ServerCapacityService.class);
    static final int HISTORY = 30;
    /** 이 값을 넘으면 화면에 경고(블로그 글의 운영 기준과 같은 80%) */
    public static final double WARN_PERCENT = 80;
    private static final long MIB = 1024 * 1024;

    public record Point(String at, double value) {}
    public record Cpu(double usedPercent, double user, double system, double ioWait, double load1, double load5, double load15, int cores,
                      double loadPerCore, double jvmProcessPercent, boolean warning, List<Point> history) {}
    public record Memory(double usedPercent, long totalMb, long usedMb, long availableMb, long buffCacheMb, long swapTotalMb, long swapUsedMb,
                         boolean warning, List<Point> history) {}
    public record Heap(long usedMb, long committedMb, long maxMb, double usedPercent, long nonHeapMb, long gcCount, long gcMillis,
                       int threads, int peakThreads, boolean warning) {}
    public record Uptime(Long hostSeconds, String hostBootAt, long jvmSeconds, String jvmStartAt) {}
    /** 수집 상태: OK, NOT_CONFIGURED(SSH 미설정), 또는 실패 분류(CONNECT·TIMEOUT·EXIT·PARSE…) */
    public record Probe(String state, String collectedAt) {}
    public record Report(Probe probe, Cpu cpu, Memory memory, Heap heap, Uptime uptime, String serverTime) {}

    private final SshProbe ssh;
    private final Supplier<Instant> clock;
    private final Deque<Point> cpuHistory = new ArrayDeque<>();
    private final Deque<Point> memoryHistory = new ArrayDeque<>();
    private volatile HostMetrics last;
    private volatile Instant lastAt;
    private volatile String state = "PENDING";

    @Autowired
    public ServerCapacityService(SshProbe ssh) { this(ssh, Instant::now); }

    ServerCapacityService(SshProbe ssh, Supplier<Instant> clock) { this.ssh = ssh; this.clock = clock; }

    /** 30초마다(첫 수집은 시작 5초 뒤) 호스트 프로브를 돌린다. 실패해도 마지막 성공 값은 지우지 않는다. */
    @Scheduled(initialDelayString = "${lab.capacity.initial-delay-ms:5000}", fixedDelayString = "${lab.capacity.interval-ms:30000}")
    public void collect() {
        if (!ssh.configured()) { state = "NOT_CONFIGURED"; return; }
        try {
            record(HostMetrics.parse(ssh.run()));
        } catch (SshProbe.ProbeException exception) {
            if (!exception.code().equals(state)) log.warn("[capacity] probe failed: {} {}", exception.code(), exception.getMessage());
            state = exception.code();
        } catch (IllegalArgumentException exception) {
            if (!"PARSE".equals(state)) log.warn("[capacity] unreadable probe output: {}", exception.getMessage());
            state = "PARSE";
        }
    }

    /** 성공한 수집을 기록한다(테스트에서 프로브 없이 쓰려고 열어 둔다). */
    synchronized void record(HostMetrics metrics) {
        Instant now = clock.get();
        last = metrics;
        lastAt = now;
        state = "OK";
        push(cpuHistory, new Point(now.toString(), metrics.cpuUsed()));
        push(memoryHistory, new Point(now.toString(), metrics.memoryUsedPercent()));
    }

    private static void push(Deque<Point> history, Point point) {
        history.addLast(point);
        while (history.size() > HISTORY) history.removeFirst();
    }

    public synchronized Report report() {
        HostMetrics host = last;
        double jvmCpu = jvmProcessCpu();
        Cpu cpu = host == null
            ? new Cpu(0, 0, 0, 0, 0, 0, 0, Runtime.getRuntime().availableProcessors(), 0, jvmCpu, false, List.of())
            : new Cpu(host.cpuUsed(), host.cpuUser(), host.cpuSystem(), host.cpuIoWait(), host.load1(), host.load5(), host.load15(), host.cores(),
                host.loadPerCore(), jvmCpu, host.cpuUsed() > WARN_PERCENT, List.copyOf(cpuHistory));
        Memory memory = host == null ? null
            : new Memory(host.memoryUsedPercent(), host.memTotal() / MIB, host.memUsed() / MIB, host.memAvailable() / MIB, host.memBuffCache() / MIB,
                host.swapTotal() / MIB, host.swapUsed() / MIB, host.memoryUsedPercent() > WARN_PERCENT, List.copyOf(memoryHistory));
        var runtime = ManagementFactory.getRuntimeMXBean();
        Instant collected = lastAt;
        Uptime uptime = new Uptime(host == null ? null : host.uptimeSeconds(),
            host == null || collected == null ? null : collected.minusSeconds(host.uptimeSeconds()).toString(),
            runtime.getUptime() / 1000, Instant.ofEpochMilli(runtime.getStartTime()).toString());
        // 첫 수집(시작 5초 뒤) 전이라도 설정이 없으면 바로 알린다.
        String current = ssh.configured() ? state : "NOT_CONFIGURED";
        return new Report(new Probe(current, collected == null ? null : collected.toString()), cpu, memory, heap(), uptime, clock.get().toString());
    }

    static Heap heap() {
        var memory = ManagementFactory.getMemoryMXBean();
        var heap = memory.getHeapMemoryUsage();
        long max = heap.getMax() > 0 ? heap.getMax() : heap.getCommitted();
        long gcCount = 0, gcMillis = 0;
        for (var gc : ManagementFactory.getGarbageCollectorMXBeans()) { gcCount += Math.max(0, gc.getCollectionCount()); gcMillis += Math.max(0, gc.getCollectionTime()); }
        var threads = ManagementFactory.getThreadMXBean();
        double percent = max <= 0 ? 0 : HostMetrics.round1(heap.getUsed() * 100.0 / max);
        return new Heap(heap.getUsed() / MIB, heap.getCommitted() / MIB, max / MIB, percent, memory.getNonHeapMemoryUsage().getUsed() / MIB,
            gcCount, gcMillis, threads.getThreadCount(), threads.getPeakThreadCount(), percent > WARN_PERCENT);
    }

    /** 이 JVM 프로세스의 최근 CPU 사용률(%). 지원하지 않는 JVM이면 0 */
    static double jvmProcessCpu() {
        if (ManagementFactory.getOperatingSystemMXBean() instanceof OperatingSystemMXBean os) {
            double load = os.getProcessCpuLoad();
            return load < 0 ? 0 : HostMetrics.round1(load * 100);
        }
        return 0;
    }
}
