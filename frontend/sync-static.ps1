# PowerShell static sync script
# 在 Windows CMD/PowerShell 里运行（不要在 WSL 里运行）

$SrcStatic = "D:\软件项目\Videos\course-distribute\frontend\static"
$DstStatic = "D:\软件项目\Videos\course-distribute\frontend\dist\dev\mp-weixin\static"

function Sync-Static {
    if (Test-Path $SrcStatic) {
        Get-ChildItem $SrcStatic -Recurse | ForEach-Object {
            if (-not $_.PSIsContainer) {
                $DstPath = $_.FullName.Replace($SrcStatic, $DstStatic)
                $DstDir = Split-Path $DstPath -Parent
                if (-not (Test-Path $DstDir)) { New-Item -ItemType Directory -Path $DstDir -Force | Out-Null }
                try { Copy-Item $_.FullName $DstPath -Force -ErrorAction SilentlyContinue } catch {}
            }
        }
        Write-Host "[sync] done at $(Get-Date -Format 'HH:mm:ss')"
    }
}

# 首次同步
Sync-Static

# 监听 dist static 目录，500ms 后恢复
$Watcher = New-Object System.IO.FileSystemWatcher
$Watcher.Path = $DstStatic
$Watcher.IncludeSubdirectories = $true
$Watcher.EnableRaisingEvents = $true
$Watcher.NotifyFilter = [System.IO.NotifyFilters]::FileName, [System.IO.NotifyFilters]::DirectoryName

Write-Host "[sync] watching $DstStatic ..."

while ($true) {
    $Changed = $Watcher.WaitForChanged([System.IO.WatcherChangeTypes]::Changed, [System.IO.WatcherChangeTypes]::Deleted), 5000)
    if ($Changed.TimedOut) { continue }
    Write-Host "[sync] detected change: $($Changed.ChangeType) $($Changed.Name)"
    Start-Sleep -Milliseconds 500
    Sync-Static
}
