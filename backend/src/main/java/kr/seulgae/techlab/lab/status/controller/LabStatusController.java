package kr.seulgae.techlab.lab.status.controller;

import kr.seulgae.techlab.lab.status.dto.*;
import java.lang.management.ManagementFactory;
import java.time.Instant;
import kr.seulgae.techlab.multiplayer.lobby.domain.LobbyRoom;
import kr.seulgae.techlab.multiplayer.lobby.domain.LobbyWorld;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.info.BuildProperties;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 서버실·개발 연구실 패널에 공개해도 되는 집계 상태와 빌드 정보만 제공한다.
 * 호스트 이름·IP·DB 상태·환경 변수는 응답에 포함하지 않는다.
 *
 * @author seulgae
 * @version 1.0, 방별 상호작용 패널용 읽기 전용 API
 * @see "None"
 */
@RestController
@RequestMapping("/api/lab")
public class LabStatusController {

    private static final long MIB = 1024 * 1024;
    private final LobbyRoom room;
    private final LobbyWorld world;
    private final BuildInfoDTO build;

    public LabStatusController(LobbyRoom room, LobbyWorld world, ObjectProvider<BuildProperties> buildProperties,
                               @Value("${lab.build.commit:}") String commit) {
        this.room = room;
        this.world = world;
        var properties = buildProperties.getIfAvailable();
        // 빌드 인자에서 온 값은 16진 커밋 형식만 신뢰하고 나머지는 local로 표시한다.
        String safeCommit = commit != null && commit.matches("[0-9a-f]{7,40}") ? commit.substring(0, 7) : "local";
        this.build = new BuildInfoDTO(properties == null ? "dev" : properties.getVersion(), safeCommit,
            properties == null || properties.getTime() == null ? null : properties.getTime().toString(),
            Runtime.version().feature() + "");
    }

    /** @return 접속자·방별 인원·가동 시간·힙 사용량 집계 */
    @GetMapping("/status")
    public ResponseEntity<LabStatusDTO> status() {
        var counts = room.roomCounts();
        var rooms = counts.entrySet().stream().map(entry -> new RoomCountDTO(entry.getKey(), world.roomName(entry.getKey()), entry.getValue())).toList();
        int online = counts.values().stream().mapToInt(Integer::intValue).sum();
        var runtime = Runtime.getRuntime();
        var memory = new JvmMemoryDTO(Math.round((runtime.totalMemory() - runtime.freeMemory()) / (double) MIB), Math.round(runtime.maxMemory() / (double) MIB));
        var body = new LabStatusDTO("UP", ManagementFactory.getRuntimeMXBean().getUptime() / 1000, online, LobbyRoom.MAX_PLAYERS, rooms, memory, Instant.now().toString());
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
    }

    /** @return 실행 중인 백엔드의 버전·짧은 커밋·빌드 시각 */
    @GetMapping("/build")
    public BuildInfoDTO build() { return build; }
}
