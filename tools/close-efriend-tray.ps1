param(
    [string]$TrayName = 'e-Friend Expert',
    [string]$ExitName = '종료',
    [int]$TimeoutSeconds = 6
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms

$utf8 = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $utf8
$OutputEncoding = $utf8

Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class TrayMouseNative {
    [DllImport("user32.dll", SetLastError=true)]
    public static extern bool SetCursorPos(int X, int Y);

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);
}
"@

$MOUSEEVENTF_LEFTDOWN  = 0x0002
$MOUSEEVENTF_LEFTUP    = 0x0004
$MOUSEEVENTF_RIGHTDOWN = 0x0008
$MOUSEEVENTF_RIGHTUP   = 0x0010

function Get-VisibleElementByName {
    param(
        [Parameter(Mandatory=$true)][string]$Name,
        [string]$ControlTypeName = ''
    )

    $root = [System.Windows.Automation.AutomationElement]::RootElement
    $condition = [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::NameProperty,
        $Name
    )
    $items = $root.FindAll(
        [System.Windows.Automation.TreeScope]::Descendants,
        $condition
    )

    $best = $null
    $bestArea = [double]::MaxValue
    foreach ($item in $items) {
        try {
            if ($item.Current.IsOffscreen) { continue }
            $rect = $item.Current.BoundingRectangle
            if ($rect.Width -le 0 -or $rect.Height -le 0) { continue }
            if ($ControlTypeName) {
                $programmatic = $item.Current.ControlType.ProgrammaticName
                if ($programmatic -ne $ControlTypeName) { continue }
            }
            $area = $rect.Width * $rect.Height
            if ($area -lt $bestArea) {
                $best = $item
                $bestArea = $area
            }
        } catch {
            continue
        }
    }
    return $best
}

function Click-Element {
    param(
        [Parameter(Mandatory=$true)]$Element,
        [switch]$Right
    )

    $rect = $Element.Current.BoundingRectangle
    if ($rect.Width -le 0 -or $rect.Height -le 0) {
        throw 'Target element has no visible bounding rectangle.'
    }

    $x = [int][Math]::Round($rect.Left + ($rect.Width / 2.0))
    $y = [int][Math]::Round($rect.Top  + ($rect.Height / 2.0))
    if (-not [TrayMouseNative]::SetCursorPos($x, $y)) {
        throw "SetCursorPos failed for $x,$y"
    }
    Start-Sleep -Milliseconds 120

    if ($Right) {
        [TrayMouseNative]::mouse_event($MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, [UIntPtr]::Zero)
        [TrayMouseNative]::mouse_event($MOUSEEVENTF_RIGHTUP,   0, 0, 0, [UIntPtr]::Zero)
    } else {
        [TrayMouseNative]::mouse_event($MOUSEEVENTF_LEFTDOWN, 0, 0, 0, [UIntPtr]::Zero)
        [TrayMouseNative]::mouse_event($MOUSEEVENTF_LEFTUP,   0, 0, 0, [UIntPtr]::Zero)
    }
}

$tray = Get-VisibleElementByName -Name $TrayName
if ($null -eq $tray) {
    Write-Output "TRAY_NOT_FOUND:$TrayName"
    exit 2
}

Click-Element -Element $tray -Right

$deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
$exitItem = $null
while ([DateTime]::UtcNow -lt $deadline) {
    Start-Sleep -Milliseconds 100
    $exitItem = Get-VisibleElementByName -Name $ExitName -ControlTypeName 'ControlType.MenuItem'
    if ($null -ne $exitItem) { break }
}

if ($null -eq $exitItem) {
    # Close any popup menu without choosing an item.
    [System.Windows.Forms.SendKeys]::SendWait('{ESC}') 2>$null
    Write-Output "EXIT_MENU_NOT_FOUND:$ExitName"
    exit 3
}

$invoked = $false
try {
    $pattern = $exitItem.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
    if ($null -ne $pattern) {
        $pattern.Invoke()
        $invoked = $true
    }
} catch {
    $invoked = $false
}

if (-not $invoked) {
    Click-Element -Element $exitItem
}

Write-Output 'EXIT_INVOKED'
exit 0
