package kr.seulgae.techlab.lab.pulls.dto;

/** PR 한 건(화면에 필요한 값만) */
public record PullDTO(int number, String title, String author, boolean draft, String createdAt, String mergedAt, String url) {}
