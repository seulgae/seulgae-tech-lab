package kr.seulgae.techlab.lab.capacity;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 서버실 랙 패널용 용량 조사 API. 퍼센트·MiB·초 같은 집계값만 공개하고,
 * 호스트 이름·IP·계정·명령 출력·오류 원문은 응답에 넣지 않는다(오류는 짧은 분류 코드만).
 *
 * @author seulgae
 * @version 1.0, 서버실 랙 용량 조사
 * @see "docs/server-capacity.md"
 */
@RestController
@RequestMapping("/api/lab")
public class ServerCapacityController {
    private final ServerCapacityService service;

    public ServerCapacityController(ServerCapacityService service) { this.service = service; }

    /** @return CPU·메모리·JVM 힙·가동시간과 수집 상태 */
    @GetMapping("/capacity")
    public ResponseEntity<ServerCapacityService.Report> capacity() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.report());
    }
}
