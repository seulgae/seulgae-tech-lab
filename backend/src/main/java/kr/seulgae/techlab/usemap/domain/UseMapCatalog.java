package kr.seulgae.techlab.usemap.domain;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/**
 * 유즈맵 목록(shared/usemaps.json). 화면과 서버가 같은 파일을 읽어, 방에서 고를 수 있는 맵과 인원 범위를 맞춘다.
 * 맵 코드 자체는 프론트 정적 파일(/usemaps/맵id/)로 배포되고 서버는 실행하지 않는다.
 *
 * @author 길태형
 * @version 1.0, 유즈맵 플랫폼
 * @see "None"
 */
@Component
public class UseMapCatalog {
    /** 맵 하나: id, 이름, 최소·최대 인원 */
    public record MapInfo(String id, String name, int minPlayers, int maxPlayers) {}

    private final List<MapInfo> maps;

    public UseMapCatalog() {
        var list = new ArrayList<MapInfo>();
        try (var stream = getClass().getResourceAsStream("/shared/usemaps.json")) {
            if (stream == null) throw new IllegalStateException("shared/usemaps.json not found");
            for (var node : JsonMapper.builder().build().readTree(stream).path("maps")) {
                list.add(new MapInfo(node.path("id").stringValue(""), node.path("name").stringValue(""), node.path("minPlayers").asInt(1), node.path("maxPlayers").asInt(8)));
            }
        } catch (IOException exception) { throw new UncheckedIOException(exception); }
        maps = List.copyOf(list);
    }

    public UseMapCatalog(List<MapInfo> maps) { this.maps = List.copyOf(maps); }

    /** @return 모든 맵 */
    public List<MapInfo> maps() { return maps; }

    /**
     * 맵 하나.
     *
     * @param id 맵 id
     * @return 맵(없으면 빈 값)
     */
    public Optional<MapInfo> find(String id) { return maps.stream().filter(map -> map.id().equals(id)).findFirst(); }
}
