package kr.seulgae.techlab.office.desk.service.impl;

import java.util.IllegalFormatConversionException;
import java.util.IllegalFormatException;
import java.util.List;
import java.util.Locale;
import java.util.MissingFormatArgumentException;
import java.util.UnknownFormatConversionException;
import java.util.regex.Pattern;
import kr.seulgae.techlab.office.desk.dto.JavaProblemDTO;

/**
 * 자바 printf 기초 문제와 채점. 인자는 서버가 고정하고 연구원은 형식 문자열만 쓴다.
 * 채점은 실제 {@link String#format(Locale, String, Object...)}로 출력을 만들어 기대 출력과 비교한다.
 *
 * @author 길태형
 * @version 1.0, 내 자리 컴퓨터
 * @see "None"
 */
public final class JavaProblems {
    /** 문제 하나: 화면 값과 실제 인자 */
    public record Problem(JavaProblemDTO view, Object[] args) {}

    /* 폭·정밀도가 세 자리 이상이면 출력이 지나치게 길어질 수 있어 막는다. */
    private static final Pattern HUGE = Pattern.compile("%[-#+ 0,(<]*(\\d+\\$)?[-#+ 0,(]*\\d{3,}|\\.\\d{3,}");

    public static final List<Problem> ALL = List.of(
        problem("hello", "인사 출력", "%s로 이름을 넣어 인사 문장을 출력하세요.", "\"슬개\"", "안녕하세요, 슬개 연구원!", List.of("%s는 문자열 자리예요."), "슬개"),
        problem("sum", "덧셈 식", "%d 세 개로 덧셈 식을 출력하세요.", "3, 5, 3 + 5", "3 + 5 = 8", List.of("%d는 정수 자리예요.", "인자 순서대로 채워져요."), 3, 5, 8),
        problem("pi", "소수점 둘째 자리", "원주율을 소수점 둘째 자리까지 출력하세요.", "Math.PI", "원주율: 3.14", List.of("%f에 정밀도를 붙여요: %.2f"), Math.PI),
        problem("width", "폭 맞추기", "숫자를 3칸 폭에 오른쪽 정렬해 대괄호 안에 출력하세요.", "7", "[  7]", List.of("폭은 % 뒤에 숫자로: %3d"), 7),
        problem("zero", "0으로 채우기", "번호를 세 자리로, 빈자리는 0으로 채워 출력하세요.", "5", "No.005", List.of("0 플래그와 폭: %03d"), 5),
        problem("menu", "메뉴판 정렬", "이름은 왼쪽 정렬 6칸, 가격은 오른쪽 정렬 4칸으로 출력하세요.", "\"커피\", 2", "커피    |   2원", List.of("- 플래그는 왼쪽 정렬: %-6s", "가격은 %4d", "\"커피\"와 2는 인자로 들어와요. 형식 문자열에 직접 쓰지 말고 서식 자리로 받아요."), "커피", 2),
        problem("percent", "퍼센트 기호", "진행률을 퍼센트 기호와 함께 출력하세요.", "80", "진행률 80%", List.of("% 기호 자체는 %%로 써요."), 80));

    private JavaProblems() {}

    private static Problem problem(String id, String title, String description, String argsCode, String expected, List<String> hints, Object... args) {
        return new Problem(new JavaProblemDTO(id, title, description, argsCode, expected, hints), args);
    }

    /**
     * 자바 형식 오류를 실제 예외 이름과 함께 쉬운 설명으로 바꾼다(예외 이름은 공부용으로 남긴다).
     *
     * @param exception 형식 오류
     * @param args 이 문제의 인자(순서대로 서식 자리에 들어간다)
     * @return "예외: 메시지" 다음 줄에 설명
     */
    public static String explain(IllegalFormatException exception, Object... args) {
        String raw = exception.getClass().getSimpleName() + ": " + exception.getMessage();
        String order = argsOrder(args);
        String hint;
        if (exception instanceof IllegalFormatConversionException conversion) {
            hint = "%" + conversion.getConversion() + " 자리에 " + typeName(conversion.getArgumentClass()) + " 값이 들어왔어요. 서식은 인자 순서대로 채워져요(" + order + "). "
                + "문자열은 %s, 정수는 %d, 실수는 %f로 받아요.";
        } else if (exception instanceof MissingFormatArgumentException) {
            hint = "서식 자리가 인자보다 많아요. 인자는 " + args.length + "개예요(" + order + ").";
        } else if (exception instanceof UnknownFormatConversionException) {
            hint = "모르는 서식이에요. %s·%d·%f를 쓰고, % 기호 자체를 출력하려면 %%로 써요.";
        } else {
            hint = "서식 모양을 확인해 주세요. 플래그(-·0)와 폭은 % 바로 뒤에 써요(예: %-6s, %03d).";
        }
        return raw + "\n→ " + hint;
    }

    /* 인자 순서 설명: 1번 "커피"(문자열), 2번 2(정수) */
    private static String argsOrder(Object... args) {
        StringBuilder text = new StringBuilder();
        for (int i = 0; i < args.length; i++) {
            if (i > 0) text.append(", ");
            Object arg = args[i];
            text.append(i + 1).append("번 ").append(arg instanceof String ? "\"" + arg + "\"" : String.valueOf(arg)).append("(").append(typeName(arg == null ? Object.class : arg.getClass())).append(")");
        }
        return text.toString();
    }

    private static String typeName(Class<?> type) {
        if (type == String.class) return "문자열";
        if (type == Integer.class || type == Long.class) return "정수";
        if (type == Double.class || type == Float.class) return "실수";
        return type.getSimpleName();
    }

    /**
     * 형식 문자열로 출력을 만든다.
     *
     * @param format 형식 문자열
     * @param args 인자
     * @return 출력
     * @exception IllegalFormatException 형식이 틀리면
     * @exception IllegalArgumentException 폭·정밀도가 너무 크면
     */
    public static String render(String format, Object... args) {
        if (HUGE.matcher(format).find()) throw new IllegalArgumentException("폭·정밀도는 두 자리까지만 쓸 수 있어요.");
        return String.format(Locale.ROOT, format, args);
    }
}
