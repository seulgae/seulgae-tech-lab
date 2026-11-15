package kr.seulgae.techlab.research;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/research-records")
public class ResearchController {
    private final ResearchRepository repository;
    public ResearchController(ResearchRepository repository) { this.repository = repository; }

    public record ResearchPage(List<ResearchRepository.ResearchSummary> items, boolean hasMore) {}

    @GetMapping
    public ResearchPage list(@RequestParam(defaultValue = "20") @Min(1) @Max(50) int limit,
                             @RequestParam(defaultValue = "0") @Min(0) @Max(10000) int offset) {
        var records = repository.list(limit + 1, offset);
        return new ResearchPage(records.stream().limit(limit).toList(), records.size() > limit);
    }

    @GetMapping("/{id}")
    public ResearchRecord find(@PathVariable UUID id) {
        return repository.find(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Research record not found"));
    }
}
