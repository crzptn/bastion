param([Parameter(ValueFromRemainingArguments = $true)][int[]]$Ports)

foreach ($port in $Ports) {
    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if (-not $conns) { continue }
    foreach ($c in $conns) {
        $procId = $c.OwningProcess
        $name = (Get-Process -Id $procId -ErrorAction SilentlyContinue).ProcessName
        Write-Host "Killing PID $procId ($name) on port $port"
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
}
