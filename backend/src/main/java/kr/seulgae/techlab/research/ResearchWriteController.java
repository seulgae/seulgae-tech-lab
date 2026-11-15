package kr.seulgae.techlab.research;

import jakarta.validation.Valid;
import java.net.URI;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

// No authentication yet: production has no write route. Enable only for localhost development.
@RestController
@RequestMapping("/api/research-records")
@ConditionalOnProperty(name = "lab.research.write-enabled", havingValue = "true")
public class ResearchWriteController {
    private final ResearchRepository repository;
    public ResearchWriteController(ResearchRepository repository) { this.repository = repository; }

    @PostMapping
    public ResponseEntity<ResearchRecord> create(@Valid @RequestBody CreateResearchRequest request) {
        var record = repository.create(request);
        return ResponseEntity.created(URI.create("/api/research-records/" + record.id())).body(record);
    }
}
