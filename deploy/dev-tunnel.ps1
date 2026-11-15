$ErrorActionPreference = 'Stop'
Write-Host 'Development PostgreSQL: 127.0.0.1:25432; deployed web: http://127.0.0.1:18082. Keep this window open; Ctrl+C closes the tunnel.'
ssh -N -T -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -L 127.0.0.1:25432:127.0.0.1:25432 -L 127.0.0.1:18082:127.0.0.1:18082 invencore-server
exit $LASTEXITCODE
