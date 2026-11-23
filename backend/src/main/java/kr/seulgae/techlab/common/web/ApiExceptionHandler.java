package kr.seulgae.techlab.common.web;

import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * DB 접근 실패를 내부 정보가 노출되지 않는 공통 HTTP 오류 응답으로 변환한다.
 *
 * @author seulgae
 * @version 1.0, 기존 전역 예외 처리 범위 유지 및 책임 문서화
 * @see "None"
 */
@RestControllerAdvice
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {
    /**
     * DB 접근 실패를 고정된 503 오류 응답으로 바꾼다.
     *
     * @return 내부 DB 정보가 포함되지 않은 오류 상세
     */
    @ExceptionHandler(DataAccessException.class)
    ProblemDetail databaseUnavailable() {
        return ProblemDetail.forStatusAndDetail(HttpStatus.SERVICE_UNAVAILABLE, "Lab data is temporarily unavailable.");
    }
}
