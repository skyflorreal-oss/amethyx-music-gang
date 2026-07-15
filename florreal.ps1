Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

[System.Windows.Forms.Application]::SetUnhandledExceptionMode([System.Windows.Forms.UnhandledExceptionMode]::CatchException)
[System.Windows.Forms.Application]::add_ThreadException({
    param($sender, $e)
    [System.Windows.Forms.MessageBox]::Show(
        "Unexpected error:`n$($e.Exception.Message)",
        "FLORREAL SETTING V.1",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
})
$ErrorActionPreference = "SilentlyContinue"

if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $scriptPath = $MyInvocation.MyCommand.Path
    if ($scriptPath) {
        Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`"" -Verb RunAs
    } else {
        [System.Windows.Forms.MessageBox]::Show(
            "Please save this script to a .ps1 file and run it as Administrator.",
            "FLORREAL SETTING V.1",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information
        ) | Out-Null
    }
    exit
}

# ===================== THEME =====================
$TEXT      = [System.Drawing.Color]::FromArgb(233, 245, 255)
$TEXTDIM   = [System.Drawing.Color]::FromArgb(106, 132, 166)
$BG        = [System.Drawing.Color]::FromArgb(5, 8, 18)
$BG2       = [System.Drawing.Color]::FromArgb(9, 15, 28)
$PANEL     = [System.Drawing.Color]::FromArgb(11, 18, 33)
$NEON_A    = [System.Drawing.Color]::FromArgb(0, 255, 224)
$NEON_B    = [System.Drawing.Color]::FromArgb(0, 174, 255)
$NEON_C    = [System.Drawing.Color]::FromArgb(255, 0, 174)
$NEON_D    = [System.Drawing.Color]::FromArgb(114, 255, 74)
$WARN      = [System.Drawing.Color]::FromArgb(255, 196, 0)
$ERR       = [System.Drawing.Color]::FromArgb(255, 72, 118)
$WHITEISH  = [System.Drawing.Color]::FromArgb(246, 250, 255)

$FontTitle = New-Object System.Drawing.Font("Segoe UI", 22, [System.Drawing.FontStyle]::Bold)
$FontBig   = New-Object System.Drawing.Font("Segoe UI", 15, [System.Drawing.FontStyle]::Bold)
$FontSub   = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Regular)
$FontBtn   = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$FontLog   = New-Object System.Drawing.Font("Consolas", 8.5, [System.Drawing.FontStyle]::Regular)
$FontMono  = New-Object System.Drawing.Font("Consolas", 8.5, [System.Drawing.FontStyle]::Bold)
$FontSmall = New-Object System.Drawing.Font("Segoe UI", 8.5, [System.Drawing.FontStyle]::Regular)

# ===================== MAIN FORM =====================
$form = New-Object System.Windows.Forms.Form
$form.Text            = "FLORREAL SETTING V.1"
$form.Size            = New-Object System.Drawing.Size(1200, 800)
$form.StartPosition   = "CenterScreen"
$form.BackColor       = $BG
$form.ForeColor       = $TEXT
$form.FormBorderStyle = "None"
$form.MaximizeBox     = $false
$form.Font            = $FontSub
$form.DoubleBuffered  = $true

$script:_drag = $false
$script:_dragStart = [System.Drawing.Point]::Empty

function Enable-Drag {
    param($control)
    $control.Add_MouseDown({
        param($s, $e)
        if ($e.Button -eq [System.Windows.Forms.MouseButtons]::Left) {
            $script:_drag = $true
            $script:_dragStart = $e.Location
        }
    })
    $control.Add_MouseMove({
        param($s, $e)
        if ($script:_drag) {
            $form.Left += $e.X - $script:_dragStart.X
            $form.Top  += $e.Y - $script:_dragStart.Y
        }
    })
    $control.Add_MouseUp({ $script:_drag = $false })
}
Enable-Drag $form

$form.Add_Paint({
    $g = $_.Graphics
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(45, $NEON_B.R, $NEON_B.G, $NEON_B.B), 1)
    $g.DrawRectangle($pen, 0, 0, $form.Width - 1, $form.Height - 1)
    $pen.Dispose()

    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Point(0, 0)),
        (New-Object System.Drawing.Point($form.Width, 0)),
        $NEON_C,
        $NEON_A
    )
    $g.FillRectangle($brush, 0, 0, $form.Width, 4)
    $brush.Dispose()
})

function New-HudPanel {
    param(
        [int]$x, [int]$y, [int]$w, [int]$h,
        [string]$title,
        [System.Drawing.Color]$accent,
        [int]$cap = 100
    )

    $panel = New-Object System.Windows.Forms.Panel
    $panel.Location = New-Object System.Drawing.Point($x, $y)
    $panel.Size = New-Object System.Drawing.Size($w, $h)
    $panel.BackColor = $PANEL

    $pRef = $panel
    $aRef = $accent
    $capRef = $cap
    $panel.Add_Paint({
        $g = $_.Graphics
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $p = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(90, $aRef.R, $aRef.G, $aRef.B), 1)
        $g.DrawRectangle($p, 0, 0, $pRef.Width - 1, $pRef.Height - 1)
        $g.DrawLine($p, 0, 40, $pRef.Width, 40)
        $g.DrawLine($p, $pRef.Width-22, $pRef.Height-1, $pRef.Width-1, $pRef.Height-1)
        $g.DrawLine($p, $pRef.Width-1, $pRef.Height-22, $pRef.Width-1, $pRef.Height-1)
        $p.Dispose()

        $p2 = New-Object System.Drawing.Pen($aRef, 3)
        $g.DrawLine($p2, 0, 0, $capRef, 0)
        $p2.Dispose()
    }.GetNewClosure())

    $lbl = New-Object System.Windows.Forms.Label
    $lbl.Text = $title
    $lbl.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
    $lbl.ForeColor = $WHITEISH
    $lbl.Location = New-Object System.Drawing.Point(18, 11)
    $lbl.AutoSize = $true
    $panel.Controls.Add($lbl)

    return $panel
}

function New-HudButton {
    param([string]$text, [int]$x, [int]$y, [int]$w, [int]$h, [System.Drawing.Color]$border, [System.Drawing.Color]$fore)
    $b = New-Object System.Windows.Forms.Button
    $b.Text = $text
    $b.Location = New-Object System.Drawing.Point($x, $y)
    $b.Size = New-Object System.Drawing.Size($w, $h)
    $b.FlatStyle = "Flat"
    $b.FlatAppearance.BorderColor = $border
    $b.FlatAppearance.BorderSize = 1
    $b.FlatAppearance.MouseOverBackColor = [System.Drawing.Color]::FromArgb(35, $border.R, $border.G, $border.B)
    $b.FlatAppearance.MouseDownBackColor = [System.Drawing.Color]::FromArgb(55, $border.R, $border.G, $border.B)
    $b.BackColor = $BG2
    $b.ForeColor = $fore
    $b.Font = $FontBtn
    $b.Cursor = [System.Windows.Forms.Cursors]::Hand
    return $b
}

# ===================== HEADER =====================
$header = New-Object System.Windows.Forms.Panel
$header.Location = New-Object System.Drawing.Point(0, 4)
$header.Size = New-Object System.Drawing.Size(1200, 88)
$header.BackColor = $BG2
$form.Controls.Add($header)
Enable-Drag $header

$title = New-Object System.Windows.Forms.Label
$title.Text = "FLORREAL SETTING V.1"
$title.Font = $FontTitle
$title.ForeColor = $WHITEISH
$title.Location = New-Object System.Drawing.Point(22, 10)
$title.AutoSize = $true
$header.Controls.Add($title)

$subtitle = New-Object System.Windows.Forms.Label
$subtitle.Text = "Neon command deck"
$subtitle.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$subtitle.ForeColor = $TEXTDIM
$subtitle.Location = New-Object System.Drawing.Point(26, 54)
$subtitle.AutoSize = $true
$header.Controls.Add($subtitle)

$stateTop = New-Object System.Windows.Forms.Label
$stateTop.Text = "GRID READY"
$stateTop.Font = New-Object System.Drawing.Font("Consolas", 11, [System.Drawing.FontStyle]::Bold)
$stateTop.ForeColor = $NEON_A
$stateTop.Location = New-Object System.Drawing.Point(940, 31)
$stateTop.AutoSize = $true
$header.Controls.Add($stateTop)

$btnMin = New-HudButton "—" 1115 18 28 26 $TEXTDIM $TEXTDIM
$btnClose = New-HudButton "✕" 1150 18 28 26 $ERR $ERR
$btnMin.FlatAppearance.BorderSize = 0
$btnClose.FlatAppearance.BorderSize = 0
$header.Controls.Add($btnMin)
$header.Controls.Add($btnClose)

# ===================== PANELS =====================
$leftPanel   = New-HudPanel 18 108 240 670 "LAUNCH BAY" $NEON_C 85
$topPanel    = New-HudPanel 274 108 908 130 "TACTICAL OVERVIEW" $NEON_A 150
$logPanel    = New-HudPanel 274 254 908 338 "EVENT STREAM" $NEON_B 130
$sysPanel    = New-HudPanel 274 608 430 170 "RIG TELEMETRY" $NEON_C 135
$form.Controls.Add($leftPanel)
$form.Controls.Add($topPanel)
$form.Controls.Add($logPanel)
$form.Controls.Add($sysPanel)

# 6 module cards
$moduleCards = @{}
$moduleTitleLabels = @{}
$moduleIcons = @{}
$moduleAccent = @{
    1 = $NEON_A
    2 = $NEON_C
    3 = $NEON_B
    4 = $NEON_D
    5 = $WARN
    6 = $ERR
}
$moduleMeta = @(
    @{id=1; x=720; y=608; w=145; h=80; title="LINK GRID"; desc="Global TCP tuning"},
    @{id=2; x=879; y=608; w=145; h=80; title="KEY VAULT"; desc="Interface registry set"},
    @{id=3; x=1038; y=608; w=144; h=80; title="LATENCY CORE"; desc="Multimedia / tcp keys"},
    @{id=4; x=720; y=698; w=145; h=80; title="PROCESS AIM"; desc="Priority alignment"},
    @{id=5; x=879; y=698; w=145; h=80; title="POWER VECTOR"; desc="Power / timer hints"},
    @{id=6; x=1038; y=698; w=144; h=80; title="SERVICE GATE"; desc="Background quiet-down"}
)

foreach ($m in $moduleMeta) {
    $card = New-HudPanel $m.x $m.y $m.w $m.h $m.title $moduleAccent[$m.id] 65
    $form.Controls.Add($card)
    $moduleCards[$m.id] = $card
    $moduleTitleLabels[$m.id] = $card.Controls[0]

    $icon = New-Object System.Windows.Forms.Label
    $icon.Text = "[ $($m.id) ]"
    $icon.Font = $FontMono
    $icon.ForeColor = $TEXTDIM
    $icon.Location = New-Object System.Drawing.Point(12, 46)
    $icon.Size = New-Object System.Drawing.Size(48, 18)
    $card.Controls.Add($icon)
    $moduleIcons[$m.id] = $icon

    $desc = New-Object System.Windows.Forms.Label
    $desc.Text = $m.desc
    $desc.Font = New-Object System.Drawing.Font("Segoe UI", 7.3)
    $desc.ForeColor = $TEXTDIM
    $desc.Location = New-Object System.Drawing.Point(56, 44)
    $desc.Size = New-Object System.Drawing.Size($m.w - 62, 26)
    $card.Controls.Add($desc)
}

# ===================== LEFT PANEL =====================
$heroLeft = New-Object System.Windows.Forms.Label
$heroLeft.Text = "PRIME MODE"
$heroLeft.Font = $FontBig
$heroLeft.ForeColor = $NEON_C
$heroLeft.Location = New-Object System.Drawing.Point(16, 54)
$heroLeft.AutoSize = $true
$leftPanel.Controls.Add($heroLeft)

$heroLeftSub = New-Object System.Windows.Forms.Label
$heroLeftSub.Text = "Single-run deployment for network, registry, process, clock, and service layers."
$heroLeftSub.Font = $FontSmall
$heroLeftSub.ForeColor = $TEXTDIM
$heroLeftSub.Location = New-Object System.Drawing.Point(18, 82)
$heroLeftSub.Size = New-Object System.Drawing.Size(194, 42)
$leftPanel.Controls.Add($heroLeftSub)

$mainBar = New-Object System.Windows.Forms.ProgressBar
$mainBar.Minimum = 0
$mainBar.Maximum = 100
$mainBar.Value = 0
$mainBar.Location = New-Object System.Drawing.Point(18, 136)
$mainBar.Size = New-Object System.Drawing.Size(198, 14)
$mainBar.Style = "Continuous"
$leftPanel.Controls.Add($mainBar)

$percent = New-Object System.Windows.Forms.Label
$percent.Text = "0%"
$percent.Font = New-Object System.Drawing.Font("Consolas", 18, [System.Drawing.FontStyle]::Bold)
$percent.ForeColor = $NEON_A
$percent.Location = New-Object System.Drawing.Point(18, 160)
$percent.AutoSize = $true
$leftPanel.Controls.Add($percent)

$btnRun = New-HudButton "ARM FLORREAL" 18 218 198 54 $NEON_A $NEON_A
$btnReset = New-HudButton "RESET DECK" 18 282 198 34 $TEXTDIM $WHITEISH
$btnExit = New-HudButton "SHUTDOWN" 18 324 198 34 $ERR $ERR
$leftPanel.Controls.Add($btnRun)
$leftPanel.Controls.Add($btnReset)
$leftPanel.Controls.Add($btnExit)

$leftNote = New-Object System.Windows.Forms.Label
$leftNote.Text = "Loadout includes TCP stack shifts, interface registry writes, latency profile edits, process priority mapping, power plan alignment, and selected service disable passes."
$leftNote.Font = $FontSmall
$leftNote.ForeColor = $TEXTDIM
$leftNote.Location = New-Object System.Drawing.Point(18, 382)
$leftNote.Size = New-Object System.Drawing.Size(200, 94)
$leftPanel.Controls.Add($leftNote)

$pulse = New-Object System.Windows.Forms.Label
$pulse.Text = "PULSE : IDLE"
$pulse.Font = New-Object System.Drawing.Font("Consolas", 10, [System.Drawing.FontStyle]::Bold)
$pulse.ForeColor = $TEXTDIM
$pulse.Location = New-Object System.Drawing.Point(18, 494)
$pulse.AutoSize = $true
$leftPanel.Controls.Add($pulse)

# Stable live load panel
$monitorPanel = New-HudPanel 12 518 214 150 "LIVE LOAD" $NEON_B 78
$leftPanel.Controls.Add($monitorPanel)

function New-MonitorRow {
    param(
        [System.Windows.Forms.Control]$parent,
        [string]$name,
        [int]$y,
        [System.Drawing.Color]$color
    )
    $lblName = New-Object System.Windows.Forms.Label
    $lblName.Text = $name
    $lblName.Font = $FontMono
    $lblName.ForeColor = $color
    $lblName.Location = New-Object System.Drawing.Point(12, $y)
    $lblName.Size = New-Object System.Drawing.Size(42, 16)
    $parent.Controls.Add($lblName)

    $bar = New-Object System.Windows.Forms.ProgressBar
    $bar.Minimum = 0
    $bar.Maximum = 100
    $bar.Value = 0
    $bar.Location = New-Object System.Drawing.Point(56, $y + 1)
    $bar.Size = New-Object System.Drawing.Size(108, 12)
    $bar.Style = "Continuous"
    $parent.Controls.Add($bar)

    $lblVal = New-Object System.Windows.Forms.Label
    $lblVal.Text = "0%"
    $lblVal.Font = $FontMono
    $lblVal.ForeColor = $WHITEISH
    $lblVal.Location = New-Object System.Drawing.Point(168, $y - 2)
    $lblVal.Size = New-Object System.Drawing.Size(40, 18)
    $parent.Controls.Add($lblVal)

    return @{ Name=$lblName; Bar=$bar; Value=$lblVal }
}

$cpuRow = New-MonitorRow $monitorPanel "CPU" 54 $NEON_A
$gpuRow = New-MonitorRow $monitorPanel "GPU" 86 $NEON_C
$ramRow = New-MonitorRow $monitorPanel "RAM" 118 $NEON_D

# ===================== TOP PANEL =====================
$currentTask = New-Object System.Windows.Forms.Label
$currentTask.Text = "Awaiting ignition..."
$currentTask.Font = New-Object System.Drawing.Font("Segoe UI", 15, [System.Drawing.FontStyle]::Bold)
$currentTask.ForeColor = $WHITEISH
$currentTask.Location = New-Object System.Drawing.Point(18, 54)
$currentTask.Size = New-Object System.Drawing.Size(620, 28)
$topPanel.Controls.Add($currentTask)

$currentSub = New-Object System.Windows.Forms.Label
$currentSub.Text = "Manual trigger required"
$currentSub.Font = $FontSmall
$currentSub.ForeColor = $TEXTDIM
$currentSub.Location = New-Object System.Drawing.Point(20, 88)
$currentSub.Size = New-Object System.Drawing.Size(620, 18)
$topPanel.Controls.Add($currentSub)

$subBar = New-Object System.Windows.Forms.ProgressBar
$subBar.Minimum = 0
$subBar.Maximum = 100
$subBar.Value = 0
$subBar.Location = New-Object System.Drawing.Point(690, 60)
$subBar.Size = New-Object System.Drawing.Size(200, 14)
$subBar.Style = "Continuous"
$topPanel.Controls.Add($subBar)

$status = New-Object System.Windows.Forms.Label
$status.Text = "CORE STATUS : READY"
$status.Font = New-Object System.Drawing.Font("Consolas", 12, [System.Drawing.FontStyle]::Bold)
$status.ForeColor = $NEON_D
$status.Location = New-Object System.Drawing.Point(690, 86)
$status.AutoSize = $true
$topPanel.Controls.Add($status)

# ===================== LOG PANEL =====================
$logBox = New-Object System.Windows.Forms.RichTextBox
$logBox.Location = New-Object System.Drawing.Point(12, 50)
$logBox.Size = New-Object System.Drawing.Size(884, 276)
$logBox.BackColor = [System.Drawing.Color]::FromArgb(4, 8, 17)
$logBox.ForeColor = $TEXT
$logBox.Font = $FontLog
$logBox.ReadOnly = $true
$logBox.BorderStyle = "None"
$logBox.ScrollBars = "Vertical"
$logPanel.Controls.Add($logBox)

# ===================== SYSTEM PANEL =====================
try {
    $osInfo  = (Get-WmiObject Win32_OperatingSystem).Caption
    $cpuInfo = (Get-WmiObject Win32_Processor).Name
    $ramGB   = [math]::Round((Get-WmiObject Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
    $netAdapters = (Get-WmiObject Win32_NetworkAdapter -Filter "NetEnabled=True" | Select-Object -First 1).Name
} catch {
    $osInfo = "Windows"
    $cpuInfo = "Unknown CPU"
    $ramGB = "?"
    $netAdapters = "Unknown"
}

$rigRows = @(
    @{k="RIG";  v=($osInfo.Substring(0, [Math]::Min(33, $osInfo.Length)))},
    @{k="CPU";  v=($cpuInfo.Substring(0, [Math]::Min(33, $cpuInfo.Length)))},
    @{k="RAM";  v="${ramGB} GB"},
    @{k="NET";  v=if ($netAdapters) { $netAdapters.Substring(0, [Math]::Min(33, $netAdapters.Length)) } else { "N/A" }}
)

$ry = 52
foreach ($r in $rigRows) {
    $k = New-Object System.Windows.Forms.Label
    $k.Text = $r.k
    $k.Font = $FontMono
    $k.ForeColor = $NEON_C
    $k.BackColor = $BG2
    $k.Location = New-Object System.Drawing.Point(18, $ry)
    $k.Size = New-Object System.Drawing.Size(58, 18)
    $sysPanel.Controls.Add($k)

    $v = New-Object System.Windows.Forms.Label
    $v.Text = $r.v
    $v.Font = $FontSmall
    $v.ForeColor = $TEXT
    $v.BackColor = $BG2
    $v.Location = New-Object System.Drawing.Point(86, $ry)
    $v.Size = New-Object System.Drawing.Size(320, 18)
    $sysPanel.Controls.Add($v)

    $ry += 28
}

# ===================== STABLE COUNTERS =====================
$script:cpuCounter = $null
$script:memCounter = $null

try {
    $script:cpuCounter = New-Object System.Diagnostics.PerformanceCounter("Processor", "% Processor Time", "_Total")
    [void]$script:cpuCounter.NextValue()
} catch {}

try {
    $script:memCounter = New-Object System.Diagnostics.PerformanceCounter("Memory", "Available MBytes")
} catch {}

function Write-Log {
    param([string]$msg, [string]$type = "info")
    try {
        $col = switch ($type) {
            "ok"    { $NEON_D }
            "warn"  { $WARN }
            "err"   { $ERR }
            "dim"   { $TEXTDIM }
            "hi"    { $NEON_A }
            "step"  { $NEON_C }
            default { $TEXT }
        }
        $ts = (Get-Date).ToString("HH:mm:ss")
        $logBox.SelectionStart = $logBox.TextLength
        $logBox.SelectionLength = 0
        $logBox.SelectionColor = $TEXTDIM
        $logBox.AppendText("[$ts] ")
        $logBox.SelectionColor = $col
        $logBox.AppendText("$msg`n")
        $logBox.ScrollToCaret()
        [System.Windows.Forms.Application]::DoEvents()
    } catch { }
}

function Set-ModuleState {
    param([int]$active)
    foreach ($m in $moduleMeta) {
        $id = $m.id
        if ($id -eq $active) {
            $moduleTitleLabels[$id].ForeColor = $NEON_A
            $moduleIcons[$id].ForeColor = $NEON_A
            $moduleIcons[$id].Text = "[ > ]"
        } elseif ($id -lt $active) {
            $moduleTitleLabels[$id].ForeColor = $NEON_D
            $moduleIcons[$id].ForeColor = $NEON_D
            $moduleIcons[$id].Text = "[ ✓ ]"
        } else {
            $moduleTitleLabels[$id].ForeColor = $WHITEISH
            $moduleIcons[$id].ForeColor = $TEXTDIM
            $moduleIcons[$id].Text = "[ $id ]"
        }
    }
    [System.Windows.Forms.Application]::DoEvents()
}

function Set-Progress {
    param([int]$main, [int]$sub, [string]$task, [string]$mini)
    $mainBar.Value = [Math]::Max(0, [Math]::Min($main, 100))
    $subBar.Value = [Math]::Max(0, [Math]::Min($sub, 100))
    $percent.Text = "$main%"
    $currentTask.Text = $task
    $currentSub.Text = $mini
    [System.Windows.Forms.Application]::DoEvents()
}

function Update-LiveLoad {
    try {
        # CPU (lightweight performance counter)
        $cpuPct = 0
        try {
            if ($script:cpuCounter) {
                $cpuPct = [int][math]::Round($script:cpuCounter.NextValue(), 0)
            }
        } catch { $cpuPct = 0 }
        $cpuPct = [Math]::Max(0, [Math]::Min($cpuPct, 100))
        $cpuRow.Bar.Value = $cpuPct
        $cpuRow.Value.Text = "$cpuPct%"

        # RAM (lightweight performance counter)
        $ramPct = 0
        try {
            $os = Get-CimInstance Win32_OperatingSystem
            $totalMB = [double]$os.TotalVisibleMemorySize / 1024
            $freeMB = if ($script:memCounter) { [double]$script:memCounter.NextValue() } else { [double]$os.FreePhysicalMemory / 1024 }
            $ramPct = [int][math]::Round((($totalMB - $freeMB) / $totalMB) * 100, 0)
        } catch { $ramPct = 0 }
        $ramPct = [Math]::Max(0, [Math]::Min($ramPct, 100))
        $ramRow.Bar.Value = $ramPct
        $ramRow.Value.Text = "$ramPct%"

        # GPU disabled here to prevent UI freeze on some systems/counters
        $gpuRow.Bar.Value = 0
        $gpuRow.Value.Text = "N/A"
    } catch { }
}

# ===================== ACTION =====================
$btnRun.Add_Click({
    $btnRun.Enabled = $false
    $btnRun.ForeColor = $TEXTDIM
    $stateTop.Text = "GRID HOT"
    $stateTop.ForeColor = $WARN
    $status.Text = "CORE STATUS : RUNNING"
    $status.ForeColor = $WARN
    $pulse.Text = "PULSE : ACTIVE"
    $pulse.ForeColor = $WARN
    $heroLeft.Text = "DEPLOYING"

    foreach ($m in $moduleMeta) {
        $moduleTitleLabels[$m.id].ForeColor = $WHITEISH
        $moduleIcons[$m.id].ForeColor = $TEXTDIM
        $moduleIcons[$m.id].Text = "[ $($m.id) ]"
    }

    Write-Log "══════════════════════════════════════════════" "dim"
    Write-Log " FLORREAL SETTING V.1 // NEON COMMAND DECK" "step"
    Write-Log "══════════════════════════════════════════════" "dim"
    Write-Log "Activation timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" "hi"

    # MODULE 1
    Set-ModuleState 1
    Set-Progress 2 0 "Synchronizing link grid..." "Applying TCP stack directives"
    Write-Log "" "dim"
    Write-Log "MODULE 1 // LINK GRID" "step"
    try {
        $tcpCmds = @(
            "netsh int tcp set global rss=enabled",
            "netsh int tcp set global dca=enabled",
            "netsh int tcp set global netdma=enabled",
            "netsh int tcp set global chimney=disabled",
            "netsh int tcp set global rsc=disabled",
            "netsh int tcp set global ecncapability=disabled",
            "netsh int tcp set global timestamps=disabled",
            "netsh int tcp set global nonsackrttresiliency=disabled",
            "netsh int tcp set global autotuninglevel=disabled",
            "netsh int tcp set global fastopen=enabled",
            "netsh int tcp set global fastopenfallback=enabled",
            "netsh int tcp set global maxsynretransmissions=2",
            "netsh int tcp set global initialrto=2000",
            "netsh int tcp set global mincto=0",
            "netsh int tcp set global congestionprovider=ctcp",
            "netsh int tcp set supplemental congestionprovider=ctcp",
            "netsh int tcp set heuristics disabled",
            "netsh int ipv4 set glob defaultcurhoplimit=64",
            "netsh int ipv6 set glob defaultcurhoplimit=64",
            "netsh int ip set global taskoffload=enabled",
            "netsh int ip set global multicastforwarding=disabled",
            "netsh int ip set global reassemblylimit=0",
            "netsh int udp set global uro=disabled",
            "netsh int tcp set global memoryprofile=normal",
            "netsh int ipv6 set global randomizeidentifiers=disabled",
            "netsh int ipv6 set privacy state=disabled"
        )
        $ci = 0
        foreach ($cmd in $tcpCmds) {
            $ci++
            Set-Progress 2 ([int]($ci / $tcpCmds.Count * 100)) "Synchronizing link grid..." "Directive $ci / $($tcpCmds.Count)"
            try { Invoke-Expression "$cmd 2>&1" | Out-Null } catch {}
            Write-Log "  > $cmd" "ok"
            Start-Sleep -Milliseconds 30
        }
        Write-Log "MODULE 1 COMPLETE ($($tcpCmds.Count) directives)" "ok"
    } catch { Write-Log "MODULE 1 ERROR: $_" "err" }
    Set-Progress 17 100 "Link grid synchronized" "Global TCP pass finished"

    # MODULE 2
    Set-ModuleState 2
    Set-Progress 17 0 "Seeding key vault..." "Writing interface registry values"
    Write-Log "" "dim"
    Write-Log "MODULE 2 // KEY VAULT" "step"
    try {
        $ifPath = "HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces"
        $ifVals = [ordered]@{
            "MTU"                        = 1500
            "MSS"                        = 1460
            "TcpWindowSize"              = 65535
            "GlobalMaxTcpWindowSize"     = 65535
            "WorldMaxTcpWindowsSize"     = 65535
            "TcpAckFrequency"            = 1
            "TcpDelAckTicks"             = 0
            "TCPNoDelay"                 = 1
            "TcpMaxDataRetransmissions"  = 3
            "TCPTimedWaitDelay"          = 30
            "TCPInitialRtt"              = 300
            "TcpMaxDupAcks"              = 2
            "Tcp1323Opts"                = 1
            "SackOpts"                   = 1
            "KeepAliveTime"              = 30000
            "KeepAliveInterval"          = 1000
            "MaxConnectionsPerServer"    = 16
            "MaxConnectionsPer1_0Server" = 16
            "DefaultTTL"                 = 64
            "EnablePMTUBHDetect"         = 0
            "EnablePMTUDiscovery"        = 1
            "DisableTaskOffload"         = 0
            "DisableLargeMTU"            = 0
            "IRPStackSize"               = 32
            "NumTcbTablePartitions"      = 4
            "MaxFreeTcbs"                = 65536
            "MaxUserPort"                = 65534
            "TcpMaxSendFree"             = 65535
            "MaxHashTableSize"           = 65536
            "DisableRss"                 = 0
            "DisableTcpChimneyOffload"   = 1
            "EnableICMPRedirect"         = 0
            "EnableDHCP"                 = 1
            "SynAttackProtect"           = 0
        }
        $tot = $ifVals.Count; $done = 0
        foreach ($kv in $ifVals.GetEnumerator()) {
            $done++
            Set-Progress 17 ([int]($done / $tot * 100)) "Seeding key vault..." "Registry item $done / $tot"
            Set-ItemProperty -Path $ifPath -Name $kv.Key -Value $kv.Value -Type DWord -Force -ErrorAction SilentlyContinue
            Write-Log "  $($kv.Key) = $($kv.Value)" "dim"
            Start-Sleep -Milliseconds 15
        }
        Write-Log "MODULE 2 COMPLETE ($tot values)" "ok"
    } catch { Write-Log "MODULE 2 ERROR: $_" "err" }
    Set-Progress 34 100 "Key vault seeded" "Interface registry pass finished"

    # MODULE 3
    Set-ModuleState 3
    Set-Progress 34 0 "Tuning latency core..." "Registry and multimedia profile updates"
    Write-Log "" "dim"
    Write-Log "MODULE 3 // LATENCY CORE" "step"
    try {
        $pPath = "HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters"
        $pVals = [ordered]@{
            "MTU"                        = 1500
            "MSS"                        = 1460
            "TcpAckFrequency"            = 1
            "TcpDelAckTicks"             = 0
            "TCPNoDelay"                 = 1
            "TcpWindowSize"              = 65535
            "GlobalMaxTcpWindowSize"     = 65535
            "SackOpts"                   = 1
            "Tcp1323Opts"                = 1
            "TcpMaxDataRetransmissions"  = 3
            "TCPTimedWaitDelay"          = 30
            "IRPStackSize"               = 32
            "DefaultTTL"                 = 64
            "KeepAliveTime"              = 30000
            "KeepAliveInterval"          = 1000
            "TCPInitialRtt"              = 300
            "TcpMaxDupAcks"              = 2
            "EnablePMTUBHDetect"         = 0
            "EnablePMTUDiscovery"        = 1
            "DisableTaskOffload"         = 0
            "MaxHashTableSize"           = 65536
            "MaxUserPort"                = 65534
            "MaxFreeTcbs"                = 65536
            "TcpMaxSendFree"             = 65535
            "DeadGWDetectDefault"        = 1
            "NumForwardPackets"          = 500
            "MaxNumForwardPackets"       = 500
            "ForwardBufferMemory"        = 196608
            "MaxForwardBufferMemory"     = 196608
            "SynAttackProtect"           = 0
            "EnableICMPRedirect"         = 0
            "NumTcbTablePartitions"      = 4
        }

        Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\PriorityControl" -Name "Win32PrioritySeparation" -Value 38 -Type DWord -Force -ErrorAction SilentlyContinue
        Write-Log "  Win32PrioritySeparation = 38" "ok"

        $mmPath = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile"
        Set-ItemProperty -Path $mmPath -Name "NetworkThrottlingIndex" -Value 0xffffffff -Type DWord -Force -ErrorAction SilentlyContinue
        Set-ItemProperty -Path $mmPath -Name "SystemResponsiveness" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
        Write-Log "  NetworkThrottlingIndex = disabled" "ok"
        Write-Log "  SystemResponsiveness = 0" "ok"

        $gameProfile = "$mmPath\Tasks\Games"
        if (-not (Test-Path $gameProfile)) { New-Item -Path $gameProfile -Force | Out-Null }
        Set-ItemProperty -Path $gameProfile -Name "Affinity" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
        Set-ItemProperty -Path $gameProfile -Name "Background Only" -Value "False" -Type String -Force -ErrorAction SilentlyContinue
        Set-ItemProperty -Path $gameProfile -Name "Clock Rate" -Value 10000 -Type DWord -Force -ErrorAction SilentlyContinue
        Set-ItemProperty -Path $gameProfile -Name "GPU Priority" -Value 8 -Type DWord -Force -ErrorAction SilentlyContinue
        Set-ItemProperty -Path $gameProfile -Name "Priority" -Value 6 -Type DWord -Force -ErrorAction SilentlyContinue
        Set-ItemProperty -Path $gameProfile -Name "Scheduling Category" -Value "High" -Type String -Force -ErrorAction SilentlyContinue
        Set-ItemProperty -Path $gameProfile -Name "SFIO Priority" -Value "High" -Type String -Force -ErrorAction SilentlyContinue
        Write-Log "  Multimedia/Games profile tuned" "ok"

        $tot2 = $pVals.Count; $done2 = 0
        foreach ($kv in $pVals.GetEnumerator()) {
            $done2++
            Set-Progress 34 ([int]($done2 / $tot2 * 100)) "Tuning latency core..." "Registry value $done2 / $tot2"
            Set-ItemProperty -Path $pPath -Name $kv.Key -Value $kv.Value -Type DWord -Force -ErrorAction SilentlyContinue
            Write-Log "  $($kv.Key) = $($kv.Value)" "dim"
            Start-Sleep -Milliseconds 15
        }
        Write-Log "MODULE 3 COMPLETE ($tot2 values)" "ok"
    } catch { Write-Log "MODULE 3 ERROR: $_" "err" }
    Set-Progress 50 100 "Latency core tuned" "Registry and multimedia pass finished"

    # MODULE 4
    Set-ModuleState 4
    Set-Progress 50 0 "Aligning process aim..." "Applying process priority map"
    Write-Log "" "dim"
    Write-Log "MODULE 4 // PROCESS AIM" "step"
    try {
        $highList = @(
            "FiveM_b2545_GTAProcess","FiveM_b2699_GTAProcess","FiveM_b2802_GTAProcess",
            "FiveM_b2944_GTAProcess","FiveM_b3095_GTAProcess","FiveM_GTAProcess",
            "FiveM","FiveM_SteamChild","CitizenFX.Core",
            "VALORANT-Win64-Shipping","VALORANT",
            "cs2","csgo",
            "RainbowSix","RainbowSix_BE","r5apex","r5apex_dx12",
            "EscapeFromTarkov","Rust","RustClient",
            "FortniteClient-Win64-Shipping","PUBG",
            "GenshinImpact","ZZZ",
            "Overwatch","Overwatch_retail"
        )

        $lowList  = @("steam","explorer","Discord","chrome","firefox","SearchApp","SearchHost","Widgets")
        $allList  = $highList + $lowList
        $pi = 0

        foreach ($pn in $highList) {
            $pi++
            Set-Progress 50 ([int]($pi / $allList.Count * 100)) "Aligning process aim..." "Priority item $pi / $($allList.Count)"
            $proc = Get-Process -Name $pn -ErrorAction SilentlyContinue
            if ($proc) {
                try { $proc.PriorityClass = "High"; Write-Log "  [HIGH] $pn - set" "ok" }
                catch { Write-Log "  [HIGH] $pn - failed" "warn" }
            } else {
                Write-Log "  [SKIP] $pn not running" "dim"
            }
            Start-Sleep -Milliseconds 30
        }

        foreach ($pn in $lowList) {
            $pi++
            Set-Progress 50 ([int]($pi / $allList.Count * 100)) "Aligning process aim..." "Priority item $pi / $($allList.Count)"
            $proc = Get-Process -Name $pn -ErrorAction SilentlyContinue
            if ($proc) {
                try { $proc.PriorityClass = "BelowNormal"; Write-Log "  [LOW]  $pn - set" "warn" }
                catch { Write-Log "  [LOW]  $pn - failed" "warn" }
            } else {
                Write-Log "  [SKIP] $pn not running" "dim"
            }
            Start-Sleep -Milliseconds 30
        }
        Write-Log "MODULE 4 COMPLETE" "ok"
    } catch { Write-Log "MODULE 4 ERROR: $_" "err" }
    Set-Progress 67 100 "Process aim aligned" "Priority pass finished"

    # MODULE 5
    Set-ModuleState 5
    Set-Progress 67 0 "Calibrating power vector..." "Power plan and timer hints"
    Write-Log "" "dim"
    Write-Log "MODULE 5 // POWER VECTOR" "step"

    try {
        powercfg -setactive SCHEME_MIN 2>&1 | Out-Null
        Write-Log "  Power scheme: High Performance" "ok"
    } catch { Write-Log "  Power scheme: skipped" "dim" }

    try {
        $cpuPath = "HKLM:\SYSTEM\CurrentControlSet\Control\Power\PowerSettings\54533251-82be-4824-96c1-47b60b740d00\be337238-0d82-4146-a960-4f3749d470c7"
        if (Test-Path $cpuPath) {
            Set-ItemProperty -Path $cpuPath -Name "Attributes" -Value 2 -Type DWord -Force -ErrorAction SilentlyContinue
            Write-Log "  CPU responsiveness unlock: done" "ok"
        }
    } catch { Write-Log "  CPU path: skipped" "dim" }

    try {
        bcdedit /set useplatformclock false 2>&1 | Out-Null
        bcdedit /set disabledynamictick yes 2>&1 | Out-Null
        Write-Log "  Dynamic tick disabled" "ok"
    } catch { Write-Log "  bcdedit: skipped" "dim" }

    try {
        bcdedit /deletevalue useplatformhpet 2>&1 | Out-Null
        Write-Log "  HPET: cleared" "ok"
    } catch { }

    Set-Progress 83 100 "Power vector calibrated" "Power and timer pass finished"
    Write-Log "MODULE 5 COMPLETE" "ok"

    # MODULE 6
    Set-ModuleState 6
    Set-Progress 83 0 "Closing service gate..." "Disabling selected background services"
    Write-Log "" "dim"
    Write-Log "MODULE 6 // SERVICE GATE" "step"
    try {
        $svcs = @(
            @{ name="SysMain";            reason="Prefetch (RAM/IO)" },
            @{ name="DiagTrack";          reason="Telemetry" },
            @{ name="dmwappushservice";   reason="Push telemetry" },
            @{ name="WSearch";            reason="Indexing IO" },
            @{ name="Fax";                reason="Fax service" },
            @{ name="RemoteRegistry";     reason="Remote registry" },
            @{ name="RetailDemo";         reason="Retail demo" },
            @{ name="TabletInputService"; reason="Tablet input" }
        )

        $si2 = 0
        foreach ($svc in $svcs) {
            $si2++
            Set-Progress 83 ([int]($si2 / $svcs.Count * 100)) "Closing service gate..." "Service item $si2 / $($svcs.Count)"
            Stop-Service -Name $svc.name -Force -ErrorAction SilentlyContinue
            Set-Service  -Name $svc.name -StartupType Disabled -ErrorAction SilentlyContinue
            Write-Log "  [OFF] $($svc.name) ($($svc.reason))" "ok"
            Start-Sleep -Milliseconds 200
        }
        Write-Log "MODULE 6 COMPLETE" "ok"
    } catch { Write-Log "MODULE 6 ERROR: $_" "err" }

    foreach ($m in $moduleMeta) {
        $moduleTitleLabels[$m.id].ForeColor = $NEON_D
        $moduleIcons[$m.id].ForeColor = $NEON_D
        $moduleIcons[$m.id].Text = "[ ✓ ]"
    }

    Set-Progress 100 100 "Calibration complete — restart suggested" "Network, registry, priority, power, and service passes finished"
    $stateTop.Text = "GRID LOCKED"
    $stateTop.ForeColor = $NEON_D
    $status.Text = "CORE STATUS : COMPLETE"
    $status.ForeColor = $NEON_D
    $pulse.Text = "PULSE : COMPLETE"
    $pulse.ForeColor = $NEON_D
    $heroLeft.Text = "SEQUENCE COMPLETE"

    Write-Log "" "dim"
    Write-Log "══════════════════════════════════════════════" "dim"
    Write-Log " CALIBRATION COMPLETE " "ok"
    Write-Log "══════════════════════════════════════════════" "dim"

    $btnRun.Enabled = $true
    $btnRun.ForeColor = $NEON_A
    $btnRun.Text = "ARM FLORREAL"
})

$btnReset.Add_Click({
    $logBox.Clear()
    $mainBar.Value = 0
    $subBar.Value = 0
    $percent.Text = "0%"
    $currentTask.Text = "Awaiting ignition..."
    $currentSub.Text = "Manual trigger required"
    $stateTop.Text = "GRID READY"
    $stateTop.ForeColor = $NEON_A
    $status.Text = "CORE STATUS : READY"
    $status.ForeColor = $NEON_D
    $pulse.Text = "PULSE : IDLE"
    $pulse.ForeColor = $TEXTDIM
    $heroLeft.Text = "PRIME MODE"
    $btnRun.Text = "ARM FLORREAL"

    foreach ($m in $moduleMeta) {
        $moduleTitleLabels[$m.id].ForeColor = $WHITEISH
        $moduleIcons[$m.id].ForeColor = $TEXTDIM
        $moduleIcons[$m.id].Text = "[ $($m.id) ]"
    }

    Write-Log "Deck reset." "hi"
})

$btnExit.Add_Click({ $form.Close() })
$btnClose.Add_Click({ $form.Close() })
$btnMin.Add_Click({ $form.WindowState = "Minimized" })

$usageTimer = New-Object System.Windows.Forms.Timer
$usageTimer.Interval = 1500
$usageTimer.Add_Tick({ Update-LiveLoad })

$form.Add_Shown({
    Update-LiveLoad
    $usageTimer.Start()
})

$form.Add_FormClosing({
    try { $usageTimer.Stop() } catch {}
    try { if ($script:cpuCounter) { $script:cpuCounter.Dispose() } } catch {}
    try { if ($script:memCounter) { $script:memCounter.Dispose() } } catch {}
})

Write-Log "deck initialized" "hi"
Write-Log "rig: $osInfo" "dim"
Write-Log "cpu: $cpuInfo" "dim"
Write-Log "ram: $ramGB GB" "dim"
Write-Log "" "dim"
Write-Log "loaded modules:" "step"
Write-Log "  > link grid" "ok"
Write-Log "  > key vault" "ok"
Write-Log "  > latency core" "ok"
Write-Log "  > process aim" "ok"
Write-Log "  > power vector" "ok"
Write-Log "  > service gate" "ok"
Write-Log "" "dim"
Write-Log "Press [ ARM FLORREAL ] to begin." "ok"

try {
    [System.Windows.Forms.Application]::Run($form)
} catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
}
