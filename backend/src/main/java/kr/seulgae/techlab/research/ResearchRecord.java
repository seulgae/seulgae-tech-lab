package kr.seulgae.techlab.research;

import java.time.OffsetDateTime;
import java.util.UUID;

public record ResearchRecord(UUID id, String title, String summary, String content, OffsetDateTime createdAt) {}
