$ErrorActionPreference = 'Stop'

if (-not $env:KHOA_SERVICE_KEY) {
  Write-Host 'KHOA_SERVICE_KEY 환경변수를 먼저 설정하세요.' -ForegroundColor Yellow
  Write-Host "예: `$env:KHOA_SERVICE_KEY='발급받은 서비스키'"
  exit 1
}

$bundledNode = 'C:\Users\안녕하세요\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
if (Get-Command node -ErrorAction SilentlyContinue) {
  node server.mjs
} elseif (Test-Path $bundledNode) {
  & $bundledNode server.mjs
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
  py server.py
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
  python server.py
} else {
  throw 'Node.js와 Python을 찾을 수 없습니다. Node.js LTS 또는 Python 3을 설치한 뒤 다시 실행하세요.'
}
