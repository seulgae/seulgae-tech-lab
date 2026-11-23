package kr.seulgae.techlab.lab.capacity;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PublicKey;
import java.util.concurrent.atomic.AtomicReference;
import org.apache.sshd.common.config.keys.PublicKeyEntry;
import org.apache.sshd.common.config.keys.writer.openssh.OpenSSHKeyPairResourceWriter;
import org.apache.sshd.server.Environment;
import org.apache.sshd.server.ExitCallback;
import org.apache.sshd.server.SshServer;
import org.apache.sshd.server.channel.ChannelSession;
import org.apache.sshd.server.command.Command;
import org.apache.sshd.server.keyprovider.SimpleGeneratorHostKeyProvider;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import static org.junit.jupiter.api.Assertions.*;

/**
 * SSH 프로브 전체 경로: 같은 MINA SSHD로 띄운 테스트 SSH 서버에 키로 로그인해 EXEC 명령 출력을 받고,
 * known_hosts에 없는 호스트 키·0이 아닌 종료 코드는 실패로 본다.
 * @author seulgae
 * @version 1.0, 서버실 랙 용량 조사
 * @see "None"
 */
class SshProbeTest {
    @TempDir Path dir;
    private SshServer server;
    private KeyPair clientKey;
    private final AtomicReference<String> received = new AtomicReference<>();
    private volatile int exitCode = 0;

    @BeforeEach void startServer() throws Exception {
        var generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        clientKey = generator.generateKeyPair();
        server = SshServer.setUpDefaultServer();
        server.setHost("127.0.0.1");
        server.setPort(0);
        server.setKeyPairProvider(new SimpleGeneratorHostKeyProvider(dir.resolve("host.ser")));
        PublicKey allowed = clientKey.getPublic();
        server.setPublickeyAuthenticator((user, key, session) -> "probe".equals(user) && allowed.equals(key));
        server.setCommandFactory((channel, command) -> new Command() {
            private OutputStream out;
            private ExitCallback exit;
            @Override public void setInputStream(java.io.InputStream in) {}
            @Override public void setOutputStream(OutputStream out) { this.out = out; }
            @Override public void setErrorStream(OutputStream err) {}
            @Override public void setExitCallback(ExitCallback callback) { this.exit = callback; }
            @Override public void start(ChannelSession session, Environment env) throws IOException {
                received.set(command);
                out.write(ServerCapacityTest.SAMPLE.getBytes(StandardCharsets.UTF_8));
                out.flush();
                exit.onExit(exitCode);
            }
            @Override public void destroy(ChannelSession session) {}
        });
        server.start();
    }

    @AfterEach void stopServer() throws IOException { server.stop(true); }

    private SshProbe probe(PublicKey trustedHostKey) throws Exception {
        Path key = dir.resolve("id_rsa");
        try (var out = Files.newOutputStream(key)) { OpenSSHKeyPairResourceWriter.INSTANCE.writePrivateKey(clientKey, "probe", null, out); }
        Path knownHosts = dir.resolve("known_hosts");
        Files.writeString(knownHosts, "[127.0.0.1]:" + server.getPort() + " " + PublicKeyEntry.toString(trustedHostKey) + "\n");
        return new SshProbe("127.0.0.1", server.getPort(), "probe", key.toString(), knownHosts.toString());
    }

    private PublicKey hostKey() throws Exception { return server.getKeyPairProvider().loadKeys(null).iterator().next().getPublic(); }

    @Test void runsTheProbeOverExecWithKeyAuthAndKnownHosts() throws Exception {
        var probe = probe(hostKey());
        try {
            assertTrue(probe.configured());
            var host = HostMetrics.parse(probe.run());
            assertEquals(HostMetrics.PROBE, received.get(), "셸이 아니라 EXEC로 프로브 한 줄을 보낸다");
            assertEquals(17.0, host.cpuUsed());
            assertEquals(93784, host.uptimeSeconds());
        } finally { probe.stop(); }
    }

    @Test void rejectsUnknownHostKeysAndFailedCommands() throws Exception {
        var other = KeyPairGenerator.getInstance("RSA");
        other.initialize(2048);
        var stranger = probe(other.generateKeyPair().getPublic());
        try {
            assertEquals("CONNECT", assertThrows(SshProbe.ProbeException.class, stranger::run).code(), "known_hosts와 다른 호스트 키는 거절");
            assertNull(received.get(), "명령은 실행되지 않았다");
        } finally { stranger.stop(); }

        exitCode = 2;
        var failing = probe(hostKey());
        try {
            assertEquals("EXIT", assertThrows(SshProbe.ProbeException.class, failing::run).code(), "종료 코드가 0이 아니면 실패");
        } finally { failing.stop(); }
    }
}
