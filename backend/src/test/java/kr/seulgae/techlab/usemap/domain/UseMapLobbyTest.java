package kr.seulgae.techlab.usemap.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * 유즈맵 대기실: 방 만들기·입장·비밀번호·인원, 방장 넘기기, 준비와 시작 조건, 게임 중 중계 대상, 맵 목록 파일.
 *
 * @author 길태형
 * @version 1.0, 유즈맵 플랫폼
 * @see None
 */
class UseMapLobbyTest {
    private final UseMapCatalog catalog = new UseMapCatalog(List.of(new UseMapCatalog.MapInfo("bug-squash", "협동 버그 잡기", 1, 8), new UseMapCatalog.MapInfo("duo", "둘이서", 2, 2)));
    private final UseMapLobby lobby = new UseMapLobby(catalog);

    @Test
    void createJoinAndLeave() {
        lobby.connect("a", "가"); lobby.connect("b", "나"); lobby.connect("c", "다");
        String room = lobby.create("a", " 버그 사냥 ", "bug-squash", 2, "1234");
        assertThat(lobby.rooms()).singleElement().satisfies(view -> { assertThat(view.name()).isEqualTo("버그 사냥"); assertThat(view.locked()).isTrue(); });
        assertThatThrownBy(() -> lobby.enter("b", room, "0000")).hasMessageContaining("비밀번호");
        lobby.enter("b", room, "1234");
        assertThatThrownBy(() -> lobby.enter("c", room, "1234")).hasMessageContaining("가득");
        assertThatThrownBy(() -> lobby.create("b", "또", "bug-squash", 2, "")).hasMessageContaining("이미 방");
        lobby.exit("a");
        assertThat(lobby.room(room).orElseThrow().hostId()).isEqualTo("b");
        lobby.disconnect("b");
        assertThat(lobby.rooms()).isEmpty();
    }

    @Test
    void validatesRoomSettings() {
        lobby.connect("a", "가");
        assertThatThrownBy(() -> lobby.create("a", "", "bug-squash", 4, "")).hasMessageContaining("1~20자");
        assertThatThrownBy(() -> lobby.create("a", "방", "nope", 4, "")).hasMessageContaining("없는 맵");
        assertThatThrownBy(() -> lobby.create("a", "방", "bug-squash", 9, "")).hasMessageContaining("2~8");
        assertThatThrownBy(() -> lobby.create("a", "방", "duo", 3, "")).hasMessageContaining("2~2");
    }

    @Test
    void startNeedsEveryoneReadyAndRelaysOnlyWhilePlaying() {
        lobby.connect("a", "가"); lobby.connect("b", "나");
        String room = lobby.create("a", "방", "bug-squash", 4, "");
        lobby.enter("b", room, "");
        assertThatThrownBy(() -> lobby.start("b")).hasMessageContaining("방장만");
        assertThatThrownBy(() -> lobby.start("a")).hasMessageContaining("준비");
        assertThat(lobby.relayTargets("a")).isEmpty();
        lobby.ready("b", true);
        var start = lobby.start("a");
        assertThat(start.players()).extracting(UseMapLobby.Player::nickname).containsExactly("가", "나");
        assertThat(lobby.relayTargets("a")).containsExactly("b");
        assertThat(lobby.relayTargets("b")).containsExactly("a");
        assertThatThrownBy(() -> lobby.enter("b", room, "")).hasMessageContaining("이미 방");
        lobby.end("a");
        assertThat(lobby.room(room).orElseThrow().ready()).isEmpty();
        assertThat(lobby.relayTargets("a")).isEmpty();
    }

    @Test
    void catalogFileListsBugSquash() {
        assertThat(new UseMapCatalog().find("bug-squash")).hasValueSatisfying(map -> assertThat(map.maxPlayers()).isEqualTo(8));
    }
}
