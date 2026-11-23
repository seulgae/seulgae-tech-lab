#!/bin/sh
# 서버실 랙 용량 조사 프로브(읽기 전용). 백엔드가 SSH로 접속하면 authorized_keys의 command=로 이 스크립트만 실행된다.
# 출력 형식은 backend/.../lab/capacity/HostMetrics.PROBE와 같다(구역마다 "@이름" 줄 다음에 명령 출력).
export LC_ALL=C
echo @nproc; nproc
echo @loadavg; cat /proc/loadavg
echo @vmstat; vmstat 1 2
echo @free; free -b
echo @uptime; cat /proc/uptime
