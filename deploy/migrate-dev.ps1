param([ValidateSet('info', 'validate', 'migrate')][string]$Action = 'info')
$ErrorActionPreference = 'Stop'
$previousUser = $env:DB_USERNAME
$previousPassword = $env:DB_PASSWORD
$previousUrl = $env:DB_URL
try {
    . "$PSScriptRoot/dev-env.ps1" -Migration
    if ($env:DB_URL -ne 'jdbc:postgresql://127.0.0.1:25432/stlab_dev?currentSchema=lab' -or $env:DB_USERNAME -ne 'stlab_dev_migrator') {
        throw 'Development migration target does not match.'
    }
    # JAVA_HOME and Maven must be configured by the caller. Credentials stay in process env.
    $maven = if ($env:STLAB_MAVEN_CMD) { $env:STLAB_MAVEN_CMD } else { 'mvn.cmd' }
    & $maven -B -f "$PSScriptRoot/../backend/pom.xml" "flyway:$Action"
    if ($LASTEXITCODE -ne 0) { throw "Flyway $Action failed." }
} finally {
    $env:DB_USERNAME = $previousUser
    $env:DB_PASSWORD = $previousPassword
    $env:DB_URL = $previousUrl
}
