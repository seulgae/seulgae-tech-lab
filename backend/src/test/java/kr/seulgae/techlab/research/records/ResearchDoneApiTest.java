package kr.seulgae.techlab.research.records;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;
import kr.seulgae.techlab.multiplayer.lobby.LocalLobbyTestApplication;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import tools.jackson.databind.json.JsonMapper;
import static org.junit.jupiter.api.Assertions.*;

/**
 * 아이디어 일지 완료 체크 API를 실제 HTTP로 검증한다. 로그인·수정 키 없이 누구나 바꿀 수 있어야 한다.
 *
 * @author seulgae
 * @version 1.0, 완료 체크(V4)
 * @see "None"
 */
@SpringBootTest(classes = LocalLobbyTestApplication.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ResearchDoneApiTest {
    private static final JsonMapper JSON = JsonMapper.builder().build();
    @Autowired Environment environment;
    private final HttpClient http = HttpClient.newHttpClient();

    private String base() { return "http://127.0.0.1:" + environment.getProperty("local.server.port") + "/api/research-records"; }

    private HttpResponse<String> put(UUID id, String body) throws Exception {
        return http.send(HttpRequest.newBuilder(URI.create(base() + "/" + id + "/done")).header("Content-Type", "application/json")
            .PUT(HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
    }

    private boolean listedDone() throws Exception {
        var list = http.send(HttpRequest.newBuilder(URI.create(base() + "?limit=10")).GET().build(), HttpResponse.BodyHandlers.ofString());
        return JSON.readTree(list.body()).get("items").get(0).get("done").asBoolean();
    }

    /** 체크하면 목록에 done=true로 보이고, 다시 해제할 수 있다. 수정 키·로그인이 필요 없다. */
    @Test void anyoneCanCheckAndUncheckAnIdea() throws Exception {
        assertFalse(listedDone(), "새 기록은 완료되지 않은 상태로 시작한다");
        var checked = put(LocalLobbyTestApplication.RECORD_ID, "{\"done\":true}");
        assertEquals(200, checked.statusCode());
        assertTrue(JSON.readTree(checked.body()).get("done").asBoolean());
        assertTrue(listedDone());
        assertEquals(200, put(LocalLobbyTestApplication.RECORD_ID, "{\"done\":false}").statusCode());
        assertFalse(listedDone());
    }

    /** 값이 없거나 불리언이 아니면 400, 없는 기록은 404다. */
    @Test void rejectsInvalidBodyAndUnknownRecord() throws Exception {
        assertEquals(400, put(LocalLobbyTestApplication.RECORD_ID, "{}").statusCode());
        assertEquals(400, put(LocalLobbyTestApplication.RECORD_ID, "{\"done\":\"yes\"}").statusCode());
        assertEquals(404, put(UUID.fromString("00000000-0000-4000-8000-0000000000ff"), "{\"done\":true}").statusCode());
    }

    @AfterEach void reset() throws Exception { put(LocalLobbyTestApplication.RECORD_ID, "{\"done\":false}"); }
}
