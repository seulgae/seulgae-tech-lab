param([Parameter(Mandatory = $true)][string]$SshHost)
$ErrorActionPreference = 'Stop'
# 홈 서버의 PostgreSQL(127.0.0.1:25432)을 로컬 같은 포트로 연결한다. SshHost는 각자 ~/.ssh/config의 별칭이다.
Write-Host "Development PostgreSQL: 127.0.0.1:25432 via $SshHost. Keep this window open; Ctrl+C closes the tunnel."
ssh -N -T -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -L 127.0.0.1:25432:127.0.0.1:25432 $SshHost
exit $LASTEXITCODE
