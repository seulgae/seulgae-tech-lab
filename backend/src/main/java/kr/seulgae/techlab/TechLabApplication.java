package kr.seulgae.techlab;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * 연구소 백엔드의 Spring Boot 애플리케이션을 시작한다.
 *
 * @author seulgae
 * @version 1.0, 애플리케이션 진입점 문서화
 * @see "None"
 */
@SpringBootApplication
public class TechLabApplication {
    /**
     * Spring Boot 서버를 실행한다.
     *
     * @param args 실행 시 전달된 명령행 인자
     */
    public static void main(String[] args) {
        SpringApplication.run(TechLabApplication.class, args);
    }
}
