param(
    [ValidateSet('login','certificate','ready','any')]
    [string]$Stage = 'any'
)

$ErrorActionPreference = 'Stop'

Write-Host "=========================================================="
Write-Host " eFriend UI Probe - $Stage"
Write-Host "=========================================================="
Write-Host "Captured : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host ""
Write-Host "주의: 이 도구는 입력값(ValuePattern)을 읽지 않습니다."
Write-Host "      고객 ID/비밀번호/공동인증 비밀번호 값은 출력하지 않습니다."
Write-Host ""

$targetNames = @('efriendexpert','xexpertgate','efexpertmain')
$processes = Get-Process -ErrorAction SilentlyContinue |
    Where-Object { $targetNames -contains $_.ProcessName } |
    Sort-Object ProcessName, Id

if (-not $processes) {
    Write-Host '[WARN] eFriend 관련 프로세스를 찾지 못했습니다.'
    exit 2
}

Write-Host '[PROCESS]'
$processes | Select-Object ProcessName, Id, StartTime | Format-Table -AutoSize

# UI Automation: metadata only. Never request ValuePattern/TextPattern contents.
$uiaAvailable = $true
try {
    Add-Type -AssemblyName UIAutomationClient
    Add-Type -AssemblyName UIAutomationTypes
} catch {
    $uiaAvailable = $false
    Write-Host "[WARN] UIAutomation assembly load failed: $($_.Exception.Message)"
}

if ($uiaAvailable) {
    Write-Host ''
    Write-Host '[UI AUTOMATION METADATA]'
    $root = [System.Windows.Automation.AutomationElement]::RootElement

    foreach ($proc in $processes) {
        Write-Host "--- $($proc.ProcessName).exe PID=$($proc.Id) ---"
        try {
            $condition = New-Object System.Windows.Automation.PropertyCondition(
                [System.Windows.Automation.AutomationElement]::ProcessIdProperty,
                [int]$proc.Id
            )
            $elements = $root.FindAll(
                [System.Windows.Automation.TreeScope]::Descendants,
                $condition
            )

            $rows = foreach ($element in $elements) {
                try {
                    $c = $element.Current
                    $typeName = $c.ControlType.ProgrammaticName -replace '^ControlType\.', ''
                    $rect = $c.BoundingRectangle
                    [PSCustomObject]@{
                        Type        = $typeName
                        Name        = $c.Name
                        AutomationId= $c.AutomationId
                        ClassName   = $c.ClassName
                        Handle      = $c.NativeWindowHandle
                        Enabled     = $c.IsEnabled
                        Focusable   = $c.IsKeyboardFocusable
                        IsPassword  = $c.IsPassword
                        X           = [int]$rect.X
                        Y           = [int]$rect.Y
                        W           = [int]$rect.Width
                        H           = [int]$rect.Height
                    }
                } catch {
                    # A control can disappear while the tree is being enumerated.
                }
            }

            if ($rows) {
                $rows |
                    Where-Object {
                        $_.Type -in @('Window','Pane','Edit','Button','ComboBox','List','ListItem','Tree','TreeItem','Tab','TabItem','Custom','Text') -or
                        $_.AutomationId -or $_.ClassName
                    } |
                    Format-Table Type, Name, AutomationId, ClassName, Handle, Enabled, Focusable, IsPassword, X, Y, W, H -AutoSize
            } else {
                Write-Host '(UI Automation elements: none)'
            }
        } catch {
            Write-Host "[WARN] UI Automation enumeration failed: $($_.Exception.Message)"
        }
    }
}

# Win32 fallback is useful when the broker/login UI exposes little or no UIA tree.
if (-not ('EFriendWin32Probe' -as [type])) {
Add-Type @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public static class EFriendWin32Probe
{
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")]
    static extern bool EnumChildWindows(IntPtr hWndParent, EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")]
    static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")]
    static extern int GetWindowTextLength(IntPtr hWnd);
    [DllImport("user32.dll")]
    static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")]
    static extern bool IsWindowEnabled(IntPtr hWnd);
    [DllImport("user32.dll")]
    static extern int GetDlgCtrlID(IntPtr hWnd);
    [DllImport("user32.dll")]
    static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [StructLayout(LayoutKind.Sequential)]
    struct RECT { public int Left, Top, Right, Bottom; }

    static string ClassName(IntPtr hWnd)
    {
        var sb = new StringBuilder(512);
        GetClassName(hWnd, sb, sb.Capacity);
        return sb.ToString();
    }

    static string WindowText(IntPtr hWnd)
    {
        int len = GetWindowTextLength(hWnd);
        if (len <= 0) return "";
        var sb = new StringBuilder(len + 1);
        GetWindowText(hWnd, sb, sb.Capacity);
        return sb.ToString();
    }

    static string Row(IntPtr hWnd, string kind, bool includeText)
    {
        RECT r;
        GetWindowRect(hWnd, out r);
        string title = includeText ? WindowText(hWnd).Replace("\r", " ").Replace("\n", " ") : "<not-read>";
        return String.Format(
            "{0,-5} HWND=0x{1:X} Class={2} CtrlId={3} Visible={4} Enabled={5} Rect={6},{7},{8},{9} Text={10}",
            kind,
            hWnd.ToInt64(),
            ClassName(hWnd),
            GetDlgCtrlID(hWnd),
            IsWindowVisible(hWnd),
            IsWindowEnabled(hWnd),
            r.Left, r.Top, r.Right - r.Left, r.Bottom - r.Top,
            title
        );
    }

    public static List<string> Dump(int processId)
    {
        var result = new List<string>();
        EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
            uint pid;
            GetWindowThreadProcessId(hWnd, out pid);
            if (pid != (uint)processId) return true;

            // Top-level title is safe/useful for window identification.
            result.Add(Row(hWnd, "TOP", true));
            EnumChildWindows(hWnd, delegate(IntPtr child, IntPtr inner) {
                // Child window text is deliberately not read: it could contain user input.
                result.Add(Row(child, "CHILD", false));
                return true;
            }, IntPtr.Zero);
            return true;
        }, IntPtr.Zero);
        return result;
    }
}
'@
}

Write-Host ''
Write-Host '[WIN32 WINDOW METADATA]'
foreach ($proc in $processes) {
    Write-Host "--- $($proc.ProcessName).exe PID=$($proc.Id) ---"
    $lines = [EFriendWin32Probe]::Dump([int]$proc.Id)
    if ($lines.Count -eq 0) {
        Write-Host '(Win32 windows: none)'
    } else {
        $lines | ForEach-Object { Write-Host $_ }
    }
}

Write-Host ''
Write-Host '[DONE] 위 결과 전체를 그대로 전달해 주세요.'
