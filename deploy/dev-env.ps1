param([switch]$Migration)
$ErrorActionPreference = 'Stop'
$credentialDirectory = Join-Path $env:USERPROFILE '.config\seulgae-tech-lab'
if ($Migration) {
    $env:DB_USERNAME = 'stlab_dev_migrator'
    $passwordFile = Join-Path $credentialDirectory 'dev-migrator-password'
} else {
    $env:DB_USERNAME = 'stlab_dev_app'
    $passwordFile = Join-Path $credentialDirectory 'dev-app-password'
}
$env:DB_URL = 'jdbc:postgresql://127.0.0.1:25432/stlab_dev?currentSchema=lab'
$env:DB_PASSWORD = [IO.File]::ReadAllText($passwordFile).Trim()
$env:SERVER_ADDRESS = '127.0.0.1'
Write-Host "Loaded development environment for $env:DB_USERNAME. Password is not printed."
