package kr.seulgae.techlab.lab.capacity.service.impl;

import kr.seulgae.techlab.lab.capacity.client.*;
import kr.seulgae.techlab.lab.capacity.domain.*;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

/**
 * 서버실 랙 용량 조사: 프로브 출력 파싱(nproc·loadavg·vmstat 두 번째 줄·free -b·uptime), 경고 기준, 추이 개수, SSH 미설정.
 * @author seulgae
 * @version 1.0, 서버실 랙 용량 조사
 * @see "None"
 */
public class ServerCapacityTest {
    public static final String SAMPLE = String.join("\n",
        "@nproc", "4",
        "@loadavg", "0.52 0.48 0.40 2/311 12345",
        "@vmstat",
        "procs -----------memory---------- ---swap-- -----io---- -system-- ------cpu-----",
        " r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st",
        " 1  0      0 812340  52344 2201840    0    0    12    20  150  300  5  2 92  1  0",
        " 2  0      0 810000  52344 2201900    0    0     0    48  420  910 12  4 83  1  0",
        "@free",
        "               total        used        free      shared  buff/cache   available",
        "Mem:      8000000000  3000000000  1000000000   100000000  4000000000  4600000000",
        "Swap:     2000000000   200000000  1800000000",
        "@uptime", "93784.12 350000.00", "");

    @Test void parsesTheProbeOutputUsingTheLastVmstatSample() {
        var host = HostMetrics.parse(SAMPLE);
        assertEquals(4, host.cores());
        assertEquals(0.52, host.load1());
        assertEquals(12, host.cpuUser(), "첫 줄(부팅 이후 평균)이 아니라 직전 1초 줄");
        assertEquals(17.0, host.cpuUsed(), "100 - idle 83");
        assertEquals(1, host.cpuIoWait());
        assertEquals(0.13, host.loadPerCore());
        assertEquals(42.5, host.memoryUsedPercent(), "(전체 - 가용) / 전체");
        assertEquals(4000000000L, host.memBuffCache());
        assertEquals(200000000L, host.swapUsed());
        assertEquals(93784, host.uptimeSeconds());
    }

    @Test void rejectsBrokenOutput() {
        assertThrows(IllegalArgumentException.class, () -> HostMetrics.parse(""));
        assertThrows(IllegalArgumentException.class, () -> HostMetrics.parse(SAMPLE.replace("@free", "@nothing")));
        assertThrows(IllegalArgumentException.class, () -> HostMetrics.parse(SAMPLE.replace("93784.12", "soon")));
    }

    @Test void reportsWarningsHistoryAndMissingSshConfiguration() {
        var unconfigured = new SshProbe("", 22, "", "", "");
        assertFalse(unconfigured.configured());
        var tick = new AtomicLong();
        var service = new ServerCapacityServiceImpl(unconfigured, () -> Instant.parse("2026-11-23T00:00:00Z").plusSeconds(30 * tick.incrementAndGet()));
        service.collect();
        var empty = service.report();
        assertEquals("NOT_CONFIGURED", empty.probe().state());
        assertNull(empty.memory(), "호스트 값이 없으면 메모리 랙은 비운다");
        assertTrue(empty.heap().maxMb() > 0, "JVM 힙은 SSH 없이도 보인다");
        assertTrue(empty.uptime().jvmSeconds() >= 0);
        assertNull(empty.uptime().hostSeconds());

        // 설정된 프로브(접속은 하지 않고 수집 결과만 넣는다)
        var configured = new SshProbe("", 22, "", "", "") { @Override public boolean configured() { return true; } };
        service = new ServerCapacityServiceImpl(configured, () -> Instant.parse("2026-11-23T00:00:00Z").plusSeconds(30 * tick.incrementAndGet()));
        var busy = HostMetrics.parse(SAMPLE.replace("12  4 83  1  0\n@free", "70 15 10  5  0\n@free"));
        for (int i = 0; i < ServerCapacityServiceImpl.HISTORY + 5; i++) service.record(busy);
        var report = service.report();
        assertEquals("OK", report.probe().state());
        assertEquals(90.0, report.cpu().usedPercent());
        assertTrue(report.cpu().warning(), "80% 초과는 경고");
        assertFalse(report.memory().warning());
        assertEquals(ServerCapacityServiceImpl.HISTORY, report.cpu().history().size(), "추이는 최근 30개(약 15분)만");
        assertEquals(7629, report.memory().totalMb());
        assertNotNull(report.uptime().hostBootAt());
    }
}
