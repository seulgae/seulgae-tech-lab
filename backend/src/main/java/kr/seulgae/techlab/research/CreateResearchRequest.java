package kr.seulgae.techlab.research;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateResearchRequest(
    @NotBlank @Size(max = 120) String title,
    @NotBlank @Size(max = 500) String summary,
    @NotBlank @Size(max = 20000) String content
) {}
