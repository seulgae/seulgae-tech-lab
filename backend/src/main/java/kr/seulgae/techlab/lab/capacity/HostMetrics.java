package kr.seulgae.techlab.lab.capacity;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 호스트(서버 컴퓨터) 한 번의 수집 결과: CPU·메모리·가동시간.
 * SSH로 실행한 프로브 출력({@link #PROBE})을 {@link #parse(String)}가 읽는다. 바이트·퍼센트 단위 그대로 둔다.
 *
 * @author seulgae
 * @version 1.0, 서버실 랙 용량 조사
 * @see "None"
 */
public record HostMetrics(
    int cores, double load1, double load5, double load15,
    double cpuUser, double cpuSystem, double cpuIdle, double cpuIoWait,
    long memTotal, long memUsed, long memFree, long memBuffCache, long memAvailable,
    long swapTotal, long swapUsed,
    long uptimeSeconds) {

    /**
     * 호스트에서 실행하는 명령. 구역마다 "@이름" 줄을 먼저 찍어 파싱이 출력 순서에 기대지 않게 한다.
     * vmstat는 첫 줄이 부팅 이후 평균이라 1초 뒤 두 번째 줄(직전 1초 실측)을 쓴다.
     * 운영에서는 같은 내용의 deploy/capacity-probe.sh를 authorized_keys의 command=로 강제해 이 키로는 이것만 실행되게 한다.
     */
    public static final String PROBE = "LC_ALL=C sh -c 'echo @nproc; nproc; echo @loadavg; cat /proc/loadavg; "
        + "echo @vmstat; vmstat 1 2; echo @free; free -b; echo @uptime; cat /proc/uptime'";

    /** CPU 사용률(%) = 100 - idle */
    public double cpuUsed() { return round1(100 - cpuIdle); }

    /** 메모리 사용률(%) = (전체 - 가용) / 전체. 버퍼·캐시는 필요하면 돌려받을 수 있어 가용으로 본다. */
    public double memoryUsedPercent() { return memTotal <= 0 ? 0 : round1((memTotal - memAvailable) * 100.0 / memTotal); }

    /** 코어당 1분 부하(1.0이면 코어가 꽉 참) */
    public double loadPerCore() { return cores <= 0 ? 0 : Math.round(load1 / cores * 100) / 100.0; }

    static double round1(double value) { return Math.round(value * 10) / 10.0; }

    /**
     * 프로브 출력을 읽는다. 필요한 구역이 없거나 숫자가 아니면 IllegalArgumentException.
     * @param output {@link #PROBE}의 표준출력
     */
    public static HostMetrics parse(String output) {
        var sections = sections(output);
        try {
            int cores = Integer.parseInt(first(sections, "nproc").trim());
            String[] load = first(sections, "loadavg").trim().split("\\s+");
            var cpu = vmstat(lines(sections, "vmstat"));
            var free = free(lines(sections, "free"));
            long uptime = (long) Double.parseDouble(first(sections, "uptime").trim().split("\\s+")[0]);
            long[] mem = free.get("Mem"), swap = free.getOrDefault("Swap", new long[]{0, 0, 0});
            if (mem == null || mem.length < 6) throw new IllegalArgumentException("free: Mem line");
            // free -b Mem: total used free shared buff/cache available
            return new HostMetrics(cores, Double.parseDouble(load[0]), Double.parseDouble(load[1]), Double.parseDouble(load[2]),
                cpu.get("us"), cpu.get("sy"), cpu.get("id"), cpu.getOrDefault("wa", 0.0),
                mem[0], mem[1], mem[2], mem[4], mem[5], swap[0], swap[1], uptime);
        } catch (RuntimeException exception) {
            if (exception instanceof IllegalArgumentException illegal && !(exception instanceof NumberFormatException)) throw illegal;
            throw new IllegalArgumentException("Unreadable probe output", exception);
        }
    }

    private static Map<String, List<String>> sections(String output) {
        Map<String, List<String>> sections = new LinkedHashMap<>();
        List<String> current = null;
        for (String line : (output == null ? "" : output).split("\\R")) {
            if (line.startsWith("@")) { current = new java.util.ArrayList<>(); sections.put(line.substring(1).trim(), current); }
            else if (current != null && !line.isBlank()) current.add(line);
        }
        return sections;
    }

    private static List<String> lines(Map<String, List<String>> sections, String name) {
        var lines = sections.get(name);
        if (lines == null || lines.isEmpty()) throw new IllegalArgumentException("Missing section " + name);
        return lines;
    }

    private static String first(Map<String, List<String>> sections, String name) { return lines(sections, name).get(0); }

    /** vmstat: 두 번째 머리줄(r b swpd ... us sy id wa st)로 열 위치를 찾고, 마지막 줄(직전 1초)을 읽는다. */
    private static Map<String, Double> vmstat(List<String> lines) {
        String[] header = null;
        for (String line : lines) if (line.trim().startsWith("r ")) header = line.trim().split("\\s+");
        if (header == null) throw new IllegalArgumentException("vmstat: header");
        String[] values = lines.get(lines.size() - 1).trim().split("\\s+");
        if (values.length != header.length) throw new IllegalArgumentException("vmstat: columns");
        Map<String, Double> cpu = new HashMap<>();
        for (int i = 0; i < header.length; i++) if (List.of("us", "sy", "id", "wa").contains(header[i])) cpu.put(header[i], Double.parseDouble(values[i]));
        if (!cpu.containsKey("us") || !cpu.containsKey("sy") || !cpu.containsKey("id")) throw new IllegalArgumentException("vmstat: cpu columns");
        return cpu;
    }

    /** free -b: "Mem:"·"Swap:" 줄의 숫자 열 */
    private static Map<String, long[]> free(List<String> lines) {
        Map<String, long[]> rows = new HashMap<>();
        for (String line : lines) {
            String[] parts = line.trim().split("\\s+");
            if (parts.length < 2 || !parts[0].endsWith(":")) continue;
            long[] numbers = new long[parts.length - 1];
            for (int i = 1; i < parts.length; i++) numbers[i - 1] = Long.parseLong(parts[i]);
            rows.put(parts[0].substring(0, parts[0].length() - 1), numbers);
        }
        return rows;
    }
}
