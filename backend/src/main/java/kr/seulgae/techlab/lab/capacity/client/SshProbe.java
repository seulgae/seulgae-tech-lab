package kr.seulgae.techlab.lab.capacity.client;

import kr.seulgae.techlab.lab.capacity.domain.*;
import jakarta.annotation.PreDestroy;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.EnumSet;
import java.util.Set;
import org.apache.sshd.client.SshClient;
import org.apache.sshd.client.channel.ClientChannel;
import org.apache.sshd.client.channel.ClientChannelEvent;
import org.apache.sshd.client.keyverifier.KnownHostsServerKeyVerifier;
import org.apache.sshd.client.keyverifier.RejectAllServerKeyVerifier;
import org.apache.sshd.client.session.ClientSession;
import org.apache.sshd.common.keyprovider.FileKeyPairProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Apache MINA SSHD로 호스트에 접속해 용량 프로브 한 번을 실행한다.
 * <ul>
 *   <li>키 인증만 쓴다(비밀번호를 환경 변수·코드에 두지 않는다). 호스트 키는 known_hosts로 검증하고 모르는 키는 거절한다.</li>
 *   <li>MINA SSHD는 연결·인증·채널 열기가 모두 비동기라, 단계마다 verify(timeout)으로 상한을 둔다. 한 번 멈춰도 다음 수집은 돈다.</li>
 *   <li>셸이 아니라 EXEC 채널: 명령 하나를 실행하고 채널이 닫히면 끝이다. 표준출력·표준에러를 나눠 받고, 시간 초과와 종료 코드를 검사한다.</li>
 *   <li>try-with-resources로 채널 → 세션 순서로 닫는다. 닫다가 난 예외는 원래 예외에 덧붙어(suppressed) 원인을 가리지 않는다.</li>
 * </ul>
 * 설정(host·user·key·known_hosts)이 하나라도 없으면 꺼진 상태이며 접속하지 않는다.
 *
 * @author seulgae
 * @version 1.0, 서버실 랙 용량 조사
 * @see "docs/server-capacity.md"
 */
@Component
public class SshProbe {
    /** 단계마다 기다리는 상한. 프로브의 vmstat 1초를 포함해 넉넉히 둔다. */
    static final Duration STEP_TIMEOUT = Duration.ofSeconds(10);
    private static final int MAX_OUTPUT = 64 * 1024;

    private final String host;
    private final int port;
    private final String user;
    private final Path key;
    private final Path knownHosts;
    private SshClient client;

    public SshProbe(@Value("${lab.capacity.ssh.host:}") String host, @Value("${lab.capacity.ssh.port:22}") int port,
                    @Value("${lab.capacity.ssh.user:}") String user, @Value("${lab.capacity.ssh.key-path:}") String key,
                    @Value("${lab.capacity.ssh.known-hosts-path:}") String knownHosts) {
        this.host = host == null ? "" : host.trim();
        this.port = port;
        this.user = user == null ? "" : user.trim();
        this.key = key == null || key.isBlank() ? null : Path.of(key.trim());
        this.knownHosts = knownHosts == null || knownHosts.isBlank() ? null : Path.of(knownHosts.trim());
    }

    /** 접속 정보가 모두 있고 키·known_hosts 파일을 읽을 수 있는지 */
    public boolean configured() {
        return !host.isEmpty() && !user.isEmpty() && key != null && knownHosts != null && Files.isReadable(key) && Files.isReadable(knownHosts);
    }

    private synchronized SshClient client() {
        if (client == null) {
            var created = SshClient.setUpDefaultClient();
            created.setServerKeyVerifier(new KnownHostsServerKeyVerifier(RejectAllServerKeyVerifier.INSTANCE, knownHosts));
            created.setKeyIdentityProvider(new FileKeyPairProvider(key));
            created.start();
            client = created;
        }
        return client;
    }

    /**
     * 프로브를 실행하고 표준출력을 돌려준다.
     * @throws ProbeException 접속·인증·시간 초과·0이 아닌 종료 코드(원인은 로그용 메시지에만 담는다)
     */
    public String run() throws ProbeException {
        if (!configured()) throw new ProbeException("NOT_CONFIGURED", "SSH probe is not configured");
        try (ClientSession session = client().connect(user, host, port).verify(STEP_TIMEOUT).getSession()) {
            session.auth().verify(STEP_TIMEOUT);
            var out = new ByteArrayOutputStream();
            var err = new ByteArrayOutputStream();
            try (ClientChannel channel = session.createChannel(ClientChannel.CHANNEL_EXEC, HostMetrics.PROBE)) {
                channel.setOut(out);
                channel.setErr(err);
                channel.open().verify(STEP_TIMEOUT);
                Set<ClientChannelEvent> events = channel.waitFor(EnumSet.of(ClientChannelEvent.CLOSED), STEP_TIMEOUT.toMillis());
                if (events.contains(ClientChannelEvent.TIMEOUT)) throw new ProbeException("TIMEOUT", "Probe did not finish in time");
                Integer exit = channel.getExitStatus();
                if (exit != null && exit != 0) throw new ProbeException("EXIT", "Probe exited with " + exit + ": " + clip(err));
            }
            if (out.size() > MAX_OUTPUT) throw new ProbeException("OUTPUT", "Probe output too large");
            return out.toString(StandardCharsets.UTF_8);
        } catch (ProbeException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new ProbeException("CONNECT", exception.getClass().getSimpleName() + ": " + exception.getMessage(), exception);
        }
    }

    private static String clip(ByteArrayOutputStream stream) {
        String text = stream.toString(StandardCharsets.UTF_8).strip();
        return text.length() > 200 ? text.substring(0, 200) + "…" : text;
    }

    @PreDestroy
    synchronized void stop() { if (client != null) client.stop(); }

    /**
     * 프로브 실패. code는 화면에 보여 줘도 되는 짧은 분류이고, message는 서버 로그에만 남긴다.
     * @author seulgae
     * @version 1.0, 서버실 랙 용량 조사
     * @see "None"
     */
    public static class ProbeException extends Exception {
        private final String code;
        public ProbeException(String code, String message) { super(message); this.code = code; }
        public ProbeException(String code, String message, Throwable cause) { super(message, cause); this.code = code; }
        public String code() { return code; }
    }
}
