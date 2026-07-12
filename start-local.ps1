<#
.SYNOPSIS
Starts the full ClinixAI local development stack: AI service, backend, and frontend.

.DESCRIPTION
This script launches the three services required for local development in separate PowerShell jobs.
It validates required environment files, ensures required ports are free,
and starts the AI service using the dedicated Python 3.11 virtual environment.

USAGE
.\start-local.ps1
#>

$ErrorActionPreference = 'Stop'

function Ensure-EnvFile {
    param(
        [string]$ServicePath,
        [string]$EnvExample = '.env.example',
        [string]$EnvFile = '.env'
    )

    $examplePath = Join-Path $ServicePath $EnvExample
    $envPath = Join-Path $ServicePath $EnvFile

    if (-not (Test-Path $envPath)) {
        if (Test-Path $examplePath) {
            Write-Host "Copying $EnvExample to $EnvFile for $ServicePath"
            Copy-Item $examplePath $envPath
        }
        else {
            Write-Warning "Missing $EnvExample in $ServicePath. Create $EnvFile manually."
        }
    }
}

function Stop-ExistingJob {
    param(
        [string]$Name
    )

    $existingJobs = Get-Job -Name $Name -ErrorAction SilentlyContinue
    if ($existingJobs) {
        foreach ($job in $existingJobs) {
            try {
                if ($job.State -eq 'Running' -or $job.State -eq 'NotStarted') {
                    Write-Host "Stopping existing job: $Name (Id: $($job.Id), State: $($job.State))"
                    Stop-Job -Job $job -Force -ErrorAction SilentlyContinue
                }
                Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
            }
            catch {
                Write-Warning "Unable to clean up existing job ${Name}: $($_.Exception.Message)"
            }
        }
    }
}

function Start-ServiceJob {
    param(
        [string]$Name,
        [string]$WorkingDirectory,
        [string]$Command
    )

    Stop-ExistingJob -Name $Name

    Write-Host ""
    Write-Host "========================================="
    Write-Host "Starting $Name"
    Write-Host "Working Directory: $WorkingDirectory"
    Write-Host "========================================="
    Write-Host ""

    $logDir = Join-Path $WorkingDirectory 'logs'
    if (-not (Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir | Out-Null
    }

    $safeName = $Name -replace '[^A-Za-z0-9._-]', '_'
    $stdoutLog = Join-Path $logDir "$safeName.stdout.log"
    $stderrLog = Join-Path $logDir "$safeName.stderr.log"

    Start-Process -FilePath 'cmd.exe' `
        -WorkingDirectory $WorkingDirectory `
        -ArgumentList @('/c', $Command) `
        -RedirectStandardOutput $stdoutLog `
        -RedirectStandardError $stderrLog `
        -WindowStyle Hidden | Out-Null
}

function Test-HealthEndpoint {
    param(
        [string]$Url
    )

    try {
        $uri = [System.Uri]$Url
        # Use a simple TCP connect to avoid any web-parsing prompts from Invoke-WebRequest
        $tcpOk = Test-NetConnection -ComputerName $uri.Host -Port $uri.Port -WarningAction SilentlyContinue -InformationLevel Quiet
        return [bool]$tcpOk
    }
    catch {
        return $false
    }
}

function Get-PIDsByPort {
    param(
        [int]$Port
    )

    $pids = @()
    try {
        $lines = & netstat -ano 2>$null | Select-String -Pattern ":$Port\b"
        foreach ($line in $lines) {
            $text = $line.ToString().Trim()
            $parts = ($text -split '\s+') -ne ''
            if ($parts.Length -gt 0) {
                $processId = $parts[-1]
                if ($processId -and ($processId -match '^[0-9]+$')) {
                    $pids += [int]$processId
                }
            }
        }
    }
    catch {
        # netstat may not be available in some constrained environments; ignore
    }

    return $pids | Select-Object -Unique
}

function Ensure-PortAvailable {
    param(
        [int]$Port,
        [string]$ServiceName
    )

    $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
        Where-Object { $_.State -eq 'Listen' }

    if ($connections) {

        $pids = $connections |
            Select-Object -ExpandProperty OwningProcess -Unique

        Write-Host ""
        Write-Host "Port $Port is already in use."
        Write-Host "Attempting to stop process(es) before starting $ServiceName..."
        Write-Host ""

        foreach ($proc_id in $pids) {
            try {
                $proc = Get-Process -Id $proc_id -ErrorAction Stop

                Write-Host "Stopping PID $proc_id ($($proc.ProcessName)) using port $Port..."

                Stop-Process -Id $proc_id -Force -ErrorAction Stop

                Write-Host "Stopped PID $proc_id and freed port $Port."
            }
            catch {
                Write-Warning ("Unable to stop PID {0} for port {1}: {2}" -f $proc_id, $Port, $PSItem.Exception.Message)
            }
        }

        Start-Sleep -Seconds 3

        $stillOpen = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
            Where-Object { $_.State -eq 'Listen' }

        $validConnections = @()
        foreach ($conn in $stillOpen) {
            if (-not $conn.OwningProcess) {
                continue
            }

            $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
            if ($null -eq $proc) {
                continue
            }

            $validConnections += $conn
        }

        if (-not $validConnections) {
            Write-Host "Port verification passed"
            return
        }

        Write-Host "Port appears still in use after attempting cleanup; attempting fallback PID lookup (netstat)."
        $fallbackPids = Get-PIDsByPort -Port $Port
        if ($fallbackPids) {
            foreach ($fallbackProcessId in $fallbackPids) {
                try {
                    $proc = Get-Process -Id $fallbackProcessId -ErrorAction SilentlyContinue
                    if ($null -ne $proc) {
                        Write-Host "Stopping PID $fallbackProcessId ($($proc.ProcessName)) found via netstat..."
                        Stop-Process -Id $fallbackProcessId -Force -ErrorAction Stop
                        Write-Host "Stopped PID $fallbackProcessId."
                    }
                    else {
                        Write-Host "No process object for PID $fallbackProcessId; attempting taskkill fallback..."
                        try {
                            & cmd /c "taskkill /PID $fallbackProcessId /F" | Write-Host
                        }
                        catch {
                            Write-Warning ("taskkill fallback failed for PID {0}: {1}" -f $fallbackProcessId, $_.Exception.Message)
                        }
                    }
                }
                catch {
                    Write-Warning ("Fallback unable to stop PID {0}: {1}" -f $fallbackProcessId, $_.Exception.Message)
                }
            }

            Start-Sleep -Seconds 2

            $stillOpen = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
                Where-Object { $_.State -eq 'Listen' }

            if (-not $stillOpen) {
                Write-Host "Port verification passed (fallback)"
                return
            }
        }

        foreach ($conn in $validConnections) {
            Write-Host ""
            Write-Host "Remaining connection:"
            Write-Host "Port: $($conn.LocalPort)"
            Write-Host "State: $($conn.State)"
            Write-Host "OwningProcess: $($conn.OwningProcess)"
        }

        throw "Port ${Port} is still in use after attempting cleanup. Please stop the process manually and rerun the script."
    }
}

function Resolve-FFmpegBinPath {
    $candidates = @(
        "$env:LOCALAPPDATA\Microsoft\WinGet\Links",
        "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin",
        'C:\ffmpeg\bin',
        'C:\Program Files\ffmpeg\bin',
        'C:\ProgramData\chocolatey\bin',
        "$env:USERPROFILE\scoop\shims"
    ) | Where-Object { $_ -and (Test-Path $_) }

    foreach ($candidate in $candidates) {
        $ffmpegPath = Join-Path $candidate 'ffmpeg.exe'
        $ffprobePath = Join-Path $candidate 'ffprobe.exe'
        if ((Test-Path $ffmpegPath) -and (Test-Path $ffprobePath)) {
            return $candidate
        }
    }

    try {
        $ffmpegCommand = Get-Command ffmpeg -ErrorAction Stop
        $ffprobeCommand = Get-Command ffprobe -ErrorAction Stop
        if ($ffmpegCommand.Path -and $ffprobeCommand.Path) {
            $ffmpegDir = Split-Path -Parent $ffmpegCommand.Path
            $ffprobeDir = Split-Path -Parent $ffprobeCommand.Path
            if ($ffmpegDir -eq $ffprobeDir) {
                return $ffmpegDir
            }
        }
    }
    catch {
        # Leave unresolved if ffmpeg is not available in current shell.
    }

    return $null
}

Write-Host ""
Write-Host "========================================="
Write-Host "Starting ClinixAI Local Development Stack"
Write-Host "========================================="
Write-Host ""

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$frontendPath = Join-Path $root 'frontend'
$backendPath = Join-Path $root 'backend-node'
$aiServicePath = Join-Path $root 'ai-service'

$venvPython = Join-Path $aiServicePath '.venv\Scripts\python.exe'

# Validate environment files
Ensure-EnvFile -ServicePath $backendPath
Ensure-EnvFile -ServicePath $frontendPath
Ensure-EnvFile -ServicePath $aiServicePath

# Validate AI virtual environment
if (-not (Test-Path $venvPython)) {
    throw @"
Python virtual environment not found for AI service.

Expected:
$venvPython

Please create the venv first:

cd ai-service
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
"@
}

Write-Host ""
Write-Host "Validating required ports..."
Write-Host ""

Ensure-PortAvailable -Port 8001 -ServiceName 'AI Service'
Ensure-PortAvailable -Port 5000 -ServiceName 'Backend'
Ensure-PortAvailable -Port 3000 -ServiceName 'Frontend'

Write-Host ""
Write-Host "All required ports are available."
Write-Host ""

$ffmpegBinPath = Resolve-FFmpegBinPath
if ($ffmpegBinPath) {
    Write-Host "FFmpeg detected at: $ffmpegBinPath"
}
else {
    Write-Warning "FFmpeg/ffprobe were not auto-detected. AI service startup may fail if PATH is incomplete in background jobs."
}

# Start AI Service
$aiHealthUrl = 'http://localhost:8001/health'
if (Test-HealthEndpoint -Url $aiHealthUrl) {
    Write-Host "AI service already running, skipping startup."
}
else {
    $aiCommand = "& `"$venvPython`" -m uvicorn app.main:app --host 0.0.0.0 --port 8001"
    if ($ffmpegBinPath) {
        $escapedBinPath = $ffmpegBinPath.Replace("'", "''")
        $aiCommand = "`$env:Path = '$escapedBinPath;' + `$env:Path; $aiCommand"
    }

    Start-ServiceJob `
        -Name 'ClinixAI-AIService' `
        -WorkingDirectory $aiServicePath `
        -Command $aiCommand
}

# Start Backend
Start-ServiceJob `
    -Name 'ClinixAI-Backend' `
    -WorkingDirectory $backendPath `
    -Command 'cmd /c "npm run dev"'

# Start Frontend
Start-ServiceJob `
    -Name 'ClinixAI-Frontend' `
    -WorkingDirectory $frontendPath `
    -Command 'cmd /c "npm run dev"'

Write-Host ""
Write-Host "========================================="
Write-Host "ClinixAI services started successfully"
Write-Host "========================================="
Write-Host ""

Write-Host "Frontend:"
Write-Host "http://localhost:3000"

Write-Host ""
Write-Host "Backend API:"
Write-Host "http://localhost:5000"

Write-Host ""
Write-Host "AI Service:"
Write-Host "http://localhost:8001/health"

Write-Host ""
Write-Host "Useful Commands:"
Write-Host "-----------------------------------------"
Write-Host "Get-Job"
Write-Host "Receive-Job -Name ClinixAI-AIService"
Write-Host "Receive-Job -Name ClinixAI-Backend"
Write-Host "Receive-Job -Name ClinixAI-Frontend"
Write-Host "Stop-Job -Name ClinixAI-AIService"
Write-Host "Stop-Job -Name ClinixAI-Backend"
Write-Host "Stop-Job -Name ClinixAI-Frontend"
Write-Host ""