from __future__ import annotations

import csv
import ctypes
from ctypes import wintypes
import os
from pathlib import Path
import queue
import subprocess
import sys
import threading
import time
import tkinter as tk
from tkinter import ttk
import urllib.request
import webbrowser


APP_TITLE = "Investment Local Suite"
DASHBOARD_PORT = 8000
MARKET_AI_PORT = 8001
EFRIEND_EXE = Path(r"C:\eFriend Expert\efriendexpert\efriendexpert.exe")
EFRIEND_BOOTSTRAP_PROCESS = "efriendexpert.exe"
EFRIEND_GATE_PROCESS = "xexpertgate.exe"
EFRIEND_READY_PROCESS = "efexpertmain.exe"
BRIDGE_PROCESS = "KisKospi200Bridge.exe"

CREATE_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)
DETACHED_PROCESS = getattr(subprocess, "DETACHED_PROCESS", 0)
CREATE_NEW_PROCESS_GROUP = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)


class StartupCancelled(Exception):
    """Internal control-flow signal for a user-requested shutdown during startup."""


def _is_admin() -> bool:
    """Return True when the current launcher already has an elevated token."""
    if os.name != "nt":
        return False
    try:
        return bool(ctypes.windll.shell32.IsUserAnAdmin())
    except Exception:
        return False


def _elevation_python() -> Path:
    """Prefer pythonw.exe so the elevated launcher never opens a console window."""
    exe = Path(sys.executable).resolve()
    if exe.name.lower() == "python.exe":
        candidate = exe.with_name("pythonw.exe")
        if candidate.exists():
            return candidate
    return exe


def _request_launcher_elevation() -> bool:
    """Relaunch this .pyw once with UAC; all child apps then inherit elevation."""
    if os.name != "nt":
        return False
    if _is_admin():
        return True

    pythonw = _elevation_python()
    script = Path(__file__).resolve()
    parameters = subprocess.list2cmdline([str(script), *sys.argv[1:]])
    try:
        shell32 = ctypes.windll.shell32
        shell32.ShellExecuteW.restype = ctypes.c_void_p
        result = shell32.ShellExecuteW(
            None,
            "runas",
            str(pythonw),
            parameters,
            str(script.parent),
            1,
        )
        return int(result or 0) > 32
    except Exception:
        return False


def _show_elevation_error():
    root_dir = Path(__file__).resolve().parent
    log_path = root_dir / "start-local-server.log"
    try:
        with log_path.open("a", encoding="utf-8") as handle:
            handle.write("\n[FATAL] Launcher administrator approval was cancelled or failed.\n")
    except Exception:
        pass
    try:
        ctypes.windll.user32.MessageBoxW(
            None,
            f"{APP_TITLE}을 시작하려면 관리자 권한 승인이 필요합니다.\n\n"
            "처음 표시되는 사용자 계정 컨트롤에서 '예'를 눌러 주세요.",
            APP_TITLE,
            0x00000030,  # MB_ICONWARNING
        )
    except Exception:
        pass


def _hidden_startupinfo():
    if os.name != "nt":
        return None
    info = subprocess.STARTUPINFO()
    info.dwFlags |= subprocess.STARTF_USESHOWWINDOW
    info.wShowWindow = 0
    return info


class _GUID(ctypes.Structure):
    _fields_ = [
        ("Data1", wintypes.DWORD),
        ("Data2", wintypes.WORD),
        ("Data3", wintypes.WORD),
        ("Data4", ctypes.c_ubyte * 8),
    ]


class TrayIcon:
    """Small Windows tray icon implemented with Win32 only (no extra packages)."""

    WM_APP = 0x8000
    WM_TRAY = WM_APP + 20
    WM_DESTROY = 0x0002
    WM_COMMAND = 0x0111
    WM_LBUTTONDBLCLK = 0x0203
    WM_RBUTTONUP = 0x0205
    WM_CONTEXTMENU = 0x007B

    NIM_ADD = 0x00000000
    NIM_DELETE = 0x00000002
    NIF_MESSAGE = 0x00000001
    NIF_ICON = 0x00000002
    NIF_TIP = 0x00000004

    MF_STRING = 0x00000000
    MF_SEPARATOR = 0x00000800
    TPM_RIGHTBUTTON = 0x0002
    TPM_RETURNCMD = 0x0100

    ID_VIEW = 1001
    ID_EXIT = 1002
    IDI_APPLICATION = 32512

    class NOTIFYICONDATAW(ctypes.Structure):
        _fields_ = [
            ("cbSize", wintypes.DWORD),
            ("hWnd", wintypes.HWND),
            ("uID", wintypes.UINT),
            ("uFlags", wintypes.UINT),
            ("uCallbackMessage", wintypes.UINT),
            ("hIcon", wintypes.HICON),
            ("szTip", wintypes.WCHAR * 128),
            ("dwState", wintypes.DWORD),
            ("dwStateMask", wintypes.DWORD),
            ("szInfo", wintypes.WCHAR * 256),
            ("uTimeoutOrVersion", wintypes.UINT),
            ("szInfoTitle", wintypes.WCHAR * 64),
            ("dwInfoFlags", wintypes.DWORD),
            ("guidItem", _GUID),
            ("hBalloonIcon", wintypes.HICON),
        ]

    def __init__(self, action_queue: queue.Queue[str]):
        self.action_queue = action_queue
        self.hwnd = None
        self.nid = None
        self._thread = None
        self._wndproc_ref = None
        self._class_name = f"InvestmentLocalSuiteTray_{os.getpid()}"

    def start(self):
        if os.name != "nt":
            return
        self._thread = threading.Thread(target=self._run, name="tray-icon", daemon=True)
        self._thread.start()

    def stop(self):
        if os.name != "nt" or not self.hwnd:
            return
        ctypes.windll.user32.PostMessageW(self.hwnd, 0x0010, 0, 0)  # WM_CLOSE

    def _run(self):
        user32 = ctypes.windll.user32
        shell32 = ctypes.windll.shell32
        kernel32 = ctypes.windll.kernel32

        # Explicit Win32 return types are required on 64-bit Python; otherwise
        # pointer-sized HWND/HMENU/HINSTANCE values can be truncated to c_int.
        kernel32.GetModuleHandleW.restype = wintypes.HMODULE
        user32.LoadIconW.restype = wintypes.HICON
        user32.CreateWindowExW.restype = wintypes.HWND
        user32.CreatePopupMenu.restype = wintypes.HMENU
        user32.TrackPopupMenu.restype = wintypes.UINT
        user32.DefWindowProcW.restype = ctypes.c_ssize_t

        WNDPROCTYPE = ctypes.WINFUNCTYPE(
            ctypes.c_ssize_t,
            wintypes.HWND,
            wintypes.UINT,
            wintypes.WPARAM,
            wintypes.LPARAM,
        )

        class WNDCLASSW(ctypes.Structure):
            _fields_ = [
                ("style", wintypes.UINT),
                ("lpfnWndProc", WNDPROCTYPE),
                ("cbClsExtra", ctypes.c_int),
                ("cbWndExtra", ctypes.c_int),
                ("hInstance", wintypes.HINSTANCE),
                ("hIcon", wintypes.HICON),
                ("hCursor", wintypes.HANDLE),
                ("hbrBackground", wintypes.HBRUSH),
                ("lpszMenuName", wintypes.LPCWSTR),
                ("lpszClassName", wintypes.LPCWSTR),
            ]

        def wndproc(hwnd, msg, wparam, lparam):
            if msg == self.WM_TRAY:
                event = int(lparam) & 0xFFFF
                if event == self.WM_LBUTTONDBLCLK:
                    self.action_queue.put("view")
                    return 0
                if event in (self.WM_RBUTTONUP, self.WM_CONTEXTMENU):
                    self._show_menu(hwnd)
                    return 0
            elif msg == self.WM_COMMAND:
                command = int(wparam) & 0xFFFF
                if command == self.ID_VIEW:
                    self.action_queue.put("view")
                    return 0
                if command == self.ID_EXIT:
                    self.action_queue.put("exit")
                    return 0
            elif msg == self.WM_DESTROY:
                if self.nid is not None:
                    shell32.Shell_NotifyIconW(self.NIM_DELETE, ctypes.byref(self.nid))
                user32.PostQuitMessage(0)
                return 0
            return user32.DefWindowProcW(hwnd, msg, wparam, lparam)

        self._wndproc_ref = WNDPROCTYPE(wndproc)
        hinstance = kernel32.GetModuleHandleW(None)

        wc = WNDCLASSW()
        wc.lpfnWndProc = self._wndproc_ref
        wc.hInstance = hinstance
        wc.lpszClassName = self._class_name
        wc.hIcon = user32.LoadIconW(None, self.IDI_APPLICATION)
        user32.RegisterClassW(ctypes.byref(wc))

        hwnd = user32.CreateWindowExW(
            0,
            self._class_name,
            APP_TITLE,
            0,
            0,
            0,
            0,
            0,
            None,
            None,
            hinstance,
            None,
        )
        self.hwnd = hwnd

        nid = self.NOTIFYICONDATAW()
        nid.cbSize = ctypes.sizeof(self.NOTIFYICONDATAW)
        nid.hWnd = hwnd
        nid.uID = 1
        nid.uFlags = self.NIF_MESSAGE | self.NIF_ICON | self.NIF_TIP
        nid.uCallbackMessage = self.WM_TRAY
        nid.hIcon = user32.LoadIconW(None, self.IDI_APPLICATION)
        nid.szTip = APP_TITLE
        self.nid = nid
        shell32.Shell_NotifyIconW(self.NIM_ADD, ctypes.byref(nid))

        msg = wintypes.MSG()
        while user32.GetMessageW(ctypes.byref(msg), None, 0, 0) != 0:
            user32.TranslateMessage(ctypes.byref(msg))
            user32.DispatchMessageW(ctypes.byref(msg))

    def _show_menu(self, hwnd):
        user32 = ctypes.windll.user32
        menu = user32.CreatePopupMenu()
        if not menu:
            return
        try:
            user32.AppendMenuW(menu, self.MF_STRING, self.ID_VIEW, "View")
            user32.AppendMenuW(menu, self.MF_SEPARATOR, 0, None)
            user32.AppendMenuW(menu, self.MF_STRING, self.ID_EXIT, "종료")
            point = wintypes.POINT()
            user32.GetCursorPos(ctypes.byref(point))
            user32.SetForegroundWindow(hwnd)
            command = user32.TrackPopupMenu(
                menu,
                self.TPM_RIGHTBUTTON | self.TPM_RETURNCMD,
                point.x,
                point.y,
                0,
                hwnd,
                None,
            )
            if command == self.ID_VIEW:
                self.action_queue.put("view")
            elif command == self.ID_EXIT:
                self.action_queue.put("exit")
        finally:
            user32.DestroyMenu(menu)


class LocalSuiteLauncher:
    def __init__(self):
        self.root_dir = Path(__file__).resolve().parent
        self.log_path = self.root_dir / "start-local-server.log"
        self.action_queue: queue.Queue[str] = queue.Queue()
        self.tray = TrayIcon(self.action_queue)
        self.stop_event = threading.Event()
        self.lifecycle_lock = threading.RLock()
        self.started_processes: dict[str, subprocess.Popen] = {}
        self.startup_thread = None
        self.log_handle = None
        self.log_lock = threading.Lock()
        self.status = "시작 준비"
        self.status_lock = threading.Lock()

        self.root = tk.Tk()
        self.root.withdraw()
        self.root.title(APP_TITLE)
        self.root.protocol("WM_DELETE_WINDOW", self.hide_view)

        self.view_window = None
        self.status_var = tk.StringVar(value=self.status)
        self.log_text = None
        self.last_log_snapshot = ""

    def run(self):
        self._reset_log()
        self.tray.start()
        self.root.after(150, self._process_actions)
        self.root.after(800, self._refresh_view)
        self.startup_thread = threading.Thread(target=self._startup, name="local-suite-startup", daemon=True)
        self.startup_thread.start()
        self.root.mainloop()

    def _reset_log(self):
        self.log_path.write_text("", encoding="utf-8")
        self.log_handle = self.log_path.open("a", encoding="utf-8", buffering=1)
        self.log("=" * 58)
        self.log("  Investment Dashboard + Market AI Local Suite")
        self.log("=" * 58)
        self.log(f"Started   : {time.strftime('%Y-%m-%d %H:%M:%S')}")
        self.log(f"Log file  : {self.log_path}")

    def log(self, message: str = ""):
        line = message.rstrip("\r\n")
        with self.log_lock:
            handle = self.log_handle
            if handle is None or handle.closed:
                return
            try:
                handle.write(line + "\n")
                handle.flush()
            except (OSError, ValueError):
                # Shutdown may close the log while the daemon startup thread is
                # returning from a long build/dependency check. Never let that
                # race surface as a second launcher error.
                return

    def _cancel_gate(self):
        """Abort startup cleanly once tray Exit has requested shutdown."""
        if self.stop_event.is_set():
            raise StartupCancelled()

    def set_status(self, value: str):
        # Worker threads only update Python state. Tk state is refreshed on the
        # main thread from _process_actions() to avoid cross-thread Tcl calls.
        with self.status_lock:
            self.status = value

    def _startup(self):
        try:
            if os.name != "nt":
                raise RuntimeError("이 런처는 Windows 전용입니다.")
            if not _is_admin():
                raise RuntimeError("런처 관리자 권한이 확인되지 않았습니다.")
            self._cancel_gate()

            self.log("[OK]    Launcher administrator token confirmed (single UAC mode).")
            python_exe = self._console_python()
            market_ai_dir = self._find_market_ai_dir()
            if market_ai_dir is None:
                raise RuntimeError("market-ai 폴더를 찾지 못했습니다. 대시보드와 같은 상위 폴더에 배치해 주세요.")
            self._cancel_gate()

            self.log(f"Dashboard : http://localhost:{DASHBOARD_PORT}/")
            self.log(f"Market AI : http://127.0.0.1:{MARKET_AI_PORT}/")
            self.log(f"Python    : {python_exe}")
            self.log(f"Market AI : {market_ai_dir}")
            self.log(f"eFriend   : {EFRIEND_EXE}")
            self.log()

            # Always clear stale suite runtimes first. This guarantees that API/Dashboard
            # from a previous run cannot remain alive when the eFriend gate fails.
            self.set_status("기존 로컬 프로세스 정리 중")
            if not self._stop_image(BRIDGE_PROCESS, reason="새 시작 순서 적용"):
                raise RuntimeError("기존 KIS Bridge를 종료하지 못해 시작을 중단했습니다.")
            self._stop_port_listener(MARKET_AI_PORT)
            self._stop_port_listener(DASHBOARD_PORT)
            self._cancel_gate()

            # Runtime dependency gate 1: eFriend Expert must be genuinely running.
            self.set_status("eFriend Expert 확인 중")
            if not self._ensure_efriend():
                if self.stop_event.is_set():
                    raise StartupCancelled()
                raise RuntimeError("eFriend Expert 실행을 확인하지 못해 시작을 중단했습니다.")
            self._cancel_gate()

            # Prepare Bridge and API before runtime startup. The tray-capable
            # source must actually be present before we build/launch the Bridge.
            self.set_status("KIS Bridge 트레이 소스 확인 중")
            if not self._bridge_tray_source_ready(market_ai_dir):
                raise RuntimeError("KIS Bridge 트레이 수정 소스가 없어 시작을 중단했습니다.")
            self._cancel_gate()

            self.set_status("KIS Bridge 빌드 확인 중")
            if not self._ensure_bridge_build(market_ai_dir):
                if self.stop_event.is_set():
                    raise StartupCancelled()
                raise RuntimeError("KIS Bridge 빌드/배포에 실패해 시작을 중단했습니다.")
            self._cancel_gate()

            self.set_status("Market AI 의존성 확인 중")
            if not self._ensure_market_ai_deps(python_exe, market_ai_dir):
                if self.stop_event.is_set():
                    raise StartupCancelled()
                raise RuntimeError("Market AI Python 패키지 준비에 실패해 시작을 중단했습니다.")
            self._cancel_gate()

            # Runtime dependency gate 2: Bridge process first.
            self.set_status("KIS Bridge 시작 중")
            if not self._start_bridge(market_ai_dir):
                if self.stop_event.is_set():
                    raise StartupCancelled()
                raise RuntimeError("KIS Bridge 프로세스 실행을 확인하지 못해 시작을 중단했습니다.")
            self._cancel_gate()

            # Only after Bridge is confirmed do API and dashboard start.
            self.set_status("Market AI API 시작 중")
            if not self._start_market_ai_api(python_exe, market_ai_dir):
                if self.stop_event.is_set():
                    raise StartupCancelled()
                raise RuntimeError("Market AI API가 준비되지 않아 대시보드를 시작하지 않았습니다.")
            self._cancel_gate()

            self.set_status("대시보드 시작 중")
            if not self._start_dashboard(python_exe):
                if self.stop_event.is_set():
                    raise StartupCancelled()
                raise RuntimeError("대시보드 HTTP 서버가 준비되지 않았습니다.")
            self._cancel_gate()

            # Commit the final ready state and browser launch under the same
            # lifecycle gate used by shutdown/runtime spawning. If tray Exit
            # wins this lock, StartupCancelled prevents a dead localhost tab
            # from opening after the suite has already been stopped.
            with self.lifecycle_lock:
                self._cancel_gate()
                self.set_status("실행 중")
                self.log()
                self.log("[OK] Startup sequence complete.")
                self.log("     eFriend Expert -> KIS Bridge -> Market AI API -> Dashboard")
                self.log("     Tray icon: right-click View / 종료")
                try:
                    webbrowser.open(f"http://localhost:{DASHBOARD_PORT}/")
                except Exception as exc:
                    self.log(f"[WARN] Browser open failed: {exc}")
        except StartupCancelled:
            # Tray Exit owns shutdown logging/cleanup. Startup simply stops.
            return
        except Exception as exc:
            self.set_status("시작 실패")
            self.log()
            self.log(f"[ERROR] {exc}")
            self.log("        시스템 트레이 아이콘 우클릭 > View에서 로그를 확인하세요.")

    def _console_python(self) -> Path:
        exe = Path(sys.executable)
        if exe.name.lower() == "pythonw.exe":
            candidate = exe.with_name("python.exe")
            if candidate.exists():
                return candidate
        return exe

    def _find_market_ai_dir(self) -> Path | None:
        override = os.environ.get("MARKET_AI_HOME")
        candidates = []
        if override:
            candidates.append(Path(override))
        candidates.extend([self.root_dir.parent / "market-ai", self.root_dir / "market-ai"])
        for candidate in candidates:
            if (candidate / "app.py").exists():
                return candidate.resolve()
        return None

    def _run_hidden(self, args, cwd=None, timeout=None):
        return subprocess.run(
            [str(x) for x in args],
            cwd=str(cwd) if cwd else None,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            creationflags=CREATE_NO_WINDOW,
            startupinfo=_hidden_startupinfo(),
        )

    def _process_running(self, image_name: str) -> bool:
        try:
            result = self._run_hidden(
                ["tasklist", "/FI", f"IMAGENAME eq {image_name}", "/FO", "CSV", "/NH"],
                timeout=5,
            )
            for row in csv.reader(result.stdout.splitlines()):
                if row and row[0].strip().lower() == image_name.lower():
                    return True
        except Exception:
            pass
        return False

    def _window_title_contains(self, needle: str) -> bool:
        """Return True when any visible top-level Windows window contains needle."""
        if os.name != "nt":
            return False
        try:
            user32 = ctypes.windll.user32
            needle_lower = needle.lower()
            found = ctypes.c_bool(False)

            WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)

            def enum_proc(hwnd, _lparam):
                if not user32.IsWindowVisible(hwnd):
                    return True
                length = user32.GetWindowTextLengthW(hwnd)
                if length <= 0:
                    return True
                buffer = ctypes.create_unicode_buffer(length + 1)
                user32.GetWindowTextW(hwnd, buffer, length + 1)
                if needle_lower in buffer.value.lower():
                    found.value = True
                    return False
                return True

            callback = WNDENUMPROC(enum_proc)
            user32.EnumWindows(callback, 0)
            return bool(found.value)
        except Exception:
            return False

    def _efriend_ready(self) -> bool:
        """Return True only when the logged-in eFriend Expert main process is ready."""
        return self._process_running(EFRIEND_READY_PROCESS)

    def _efriend_login_in_progress(self) -> bool:
        """Return True when eFriend has already been launched but login is not ready yet."""
        return (
            self._process_running(EFRIEND_GATE_PROCESS)
            or self._process_running(EFRIEND_BOOTSTRAP_PROCESS)
        )

    def _wait_efriend_ready(self, launch_grace_seconds: int = 15) -> bool:
        """Wait for the real logged-in Expert runtime, not merely the login launcher.

        Observed eFriend state transition on this installation:
          efriendexpert.exe                  -> ID/password login
          efriendexpert.exe + xexpertgate.exe -> certificate approval flow
          efexpertmain.exe                  -> login/certificate approval complete

        Human login has no arbitrary timeout. If the login flow is closed before
        efexpertmain.exe appears, abort after a short disappearance grace period.
        """
        started_at = time.monotonic()
        ready_seen_at = None
        login_process_seen = self._efriend_login_in_progress()
        login_gone_at = None

        while not self.stop_event.is_set():
            if self._efriend_ready():
                if ready_seen_at is None:
                    ready_seen_at = time.monotonic()
                if time.monotonic() - ready_seen_at >= 1.5:
                    return True
            else:
                ready_seen_at = None

            if self._efriend_login_in_progress():
                login_process_seen = True
                login_gone_at = None
            elif login_process_seen:
                # A very short hand-off gap can occur between the certificate
                # helper and efexpertmain.exe, so do not fail immediately.
                if login_gone_at is None:
                    login_gone_at = time.monotonic()
                elif time.monotonic() - login_gone_at >= 8.0:
                    return False
            elif time.monotonic() - started_at >= launch_grace_seconds:
                # ShellExecute succeeded but no eFriend login process appeared.
                return False

            time.sleep(0.5)

        return False

    def _wait_process(self, image_name: str, timeout_seconds: int, stable_seconds: float = 1.5) -> bool:
        deadline = time.monotonic() + timeout_seconds
        first_seen = None
        while time.monotonic() < deadline and not self.stop_event.is_set():
            if self._process_running(image_name):
                if first_seen is None:
                    first_seen = time.monotonic()
                if time.monotonic() - first_seen >= stable_seconds:
                    return True
            else:
                first_seen = None
            time.sleep(0.5)
        return False

    def _ensure_efriend(self) -> bool:
        if not EFRIEND_EXE.exists():
            self.log(f"[WARN] eFriend Expert executable not found: {EFRIEND_EXE}")
            return False

        # The actual logged-in runtime is efexpertmain.exe. The launcher
        # executable hands off to xexpertgate.exe / efexpertmain.exe, so the
        # bootstrap image name must never be used as the readiness criterion.
        if self._efriend_ready():
            self.log(f"[OK]    eFriend Expert already logged in ({EFRIEND_READY_PROCESS}); launch skipped.")
            return True

        # If the login/gate process is already alive, do not launch a duplicate
        # eFriend instance. Wait for the user to complete login, then continue.
        if self._efriend_login_in_progress():
            if self._process_running(EFRIEND_GATE_PROCESS):
                self.log("[WAIT]  eFriend Expert 인증서 선택/승인 진행 중.")
            else:
                self.log("[WAIT]  eFriend Expert 아이디/비밀번호 로그인 진행 중.")
            self.log(f"        최종 로그인 완료 프로세스 대기: {EFRIEND_READY_PROCESS}")
            if self._wait_efriend_ready():
                self.log(f"[OK]    eFriend Expert login/certificate ready ({EFRIEND_READY_PROCESS}).")
                return True
            self.log("[WARN] eFriend Expert 로그인 흐름이 완료 전에 종료되었습니다.")
            return False

        self.log("[START] eFriend Expert")
        self.log("        관리자 권한 런처에서 실행하므로 추가 UAC는 표시되지 않습니다.")
        try:
            with self.lifecycle_lock:
                self._cancel_gate()
                subprocess.Popen(
                    [str(EFRIEND_EXE)],
                    cwd=str(EFRIEND_EXE.parent),
                    creationflags=CREATE_NEW_PROCESS_GROUP,
                )
        except StartupCancelled:
            return False
        except Exception as exc:
            self.log(f"[WARN] eFriend Expert launch failed: {exc}")
            return False

        self.log("[WAIT]  eFriend Expert 로그인 + 공인인증서 승인 완료를 기다립니다.")
        self.log(f"        최종 Ready 기준: {EFRIEND_READY_PROCESS}")
        if self._wait_efriend_ready():
            self.log(f"[OK]    eFriend Expert login/certificate ready ({EFRIEND_READY_PROCESS}).")
            return True

        self.log("[WARN] eFriend Expert 로그인 흐름이 완료 전에 종료되었습니다.")
        return False

    def _stop_image(self, image_name: str, reason: str = "") -> bool:
        if not self._process_running(image_name):
            return True

        suffix = f" ({reason})" if reason else ""
        self.log(f"[STOP]  {image_name}{suffix}")
        try:
            result = self._run_hidden(["taskkill", "/IM", image_name, "/T"], timeout=8)
            if result.returncode != 0 and self._process_running(image_name):
                self._run_hidden(["taskkill", "/F", "/IM", image_name, "/T"], timeout=8)
        except Exception as exc:
            self.log(f"[WARN] Normal stop failed for {image_name}: {exc}")

        if not self._process_running(image_name):
            return True

        # The launcher itself is elevated once at startup, so a second UAC prompt
        # must never be needed for Bridge cleanup.
        self.log(f"[WARN] Normal stop did not remove {image_name}; forcing termination.")
        try:
            self._run_hidden(["taskkill", "/F", "/IM", image_name, "/T"], timeout=8)
        except Exception as exc:
            self.log(f"[WARN] Forced stop failed for {image_name}: {exc}")

        time.sleep(0.5)
        if self._process_running(image_name):
            self.log(f"[ERROR] {image_name} is still running.")
            return False

        self.log(f"[OK]    {image_name} stopped.")
        return True

    def _pids_listening_on_port(self, port: int) -> set[int]:
        pids: set[int] = set()
        try:
            result = self._run_hidden(["netstat", "-ano", "-p", "tcp"], timeout=8)
            target = f":{port}"
            for raw in result.stdout.splitlines():
                parts = raw.split()
                if len(parts) < 5 or parts[0].upper() != "TCP":
                    continue
                local_addr, state, pid_text = parts[1], parts[3].upper(), parts[4]
                if state == "LISTENING" and local_addr.endswith(target) and pid_text.isdigit():
                    pids.add(int(pid_text))
        except Exception as exc:
            self.log(f"[WARN] Could not inspect port {port}: {exc}")
        return pids

    def _stop_port_listener(self, port: int) -> bool:
        initial_pids = self._pids_listening_on_port(port)
        targets = {pid for pid in initial_pids if pid != os.getpid()}
        if not targets:
            return True

        for pid in sorted(targets):
            self.log(f"[STOP]  Existing listener on port {port} (PID {pid})")
            try:
                self._run_hidden(["taskkill", "/PID", str(pid), "/T"], timeout=8)
                time.sleep(0.3)
                if pid in self._pids_listening_on_port(port):
                    self._run_hidden(["taskkill", "/F", "/PID", str(pid), "/T"], timeout=8)
            except Exception as exc:
                self.log(f"[WARN] Could not stop PID {pid}: {exc}")

        time.sleep(0.4)
        remaining = {pid for pid in self._pids_listening_on_port(port) if pid != os.getpid()}
        if remaining:
            self.log(f"[ERROR] Port {port} is still listening (PID {', '.join(map(str, sorted(remaining)))}).")
            return False

        self.log(f"[OK]    Port {port} listener stopped.")
        return True

    def _bridge_tray_source_ready(self, market_ai_dir: Path) -> bool:
        source = market_ai_dir / "KisKospi200Bridge" / "MainForm.cs"
        if not source.exists():
            self.log(f"[ERROR] KIS Bridge source not found: {source}")
            return False

        try:
            text = source.read_text(encoding="utf-8-sig", errors="replace")
        except Exception as exc:
            self.log(f"[ERROR] KIS Bridge source read failed: {exc}")
            return False

        required_tokens = (
            "NotifyIcon",
            "ShowInTaskbar = false",
            "TrayViewMenuItem_Click",
            "MainForm_FormClosing",
        )
        missing = [token for token in required_tokens if token not in text]
        if missing:
            self.log("[ERROR] KIS Bridge tray source is not applied to the current market-ai checkout.")
            self.log(f"        Source: {source}")
            self.log("        Missing: " + ", ".join(missing))
            self.log("        KisKospi200Bridge/MainForm.cs를 트레이 수정본으로 교체해야 합니다.")
            return False

        self.log("[OK]    KIS Bridge tray source confirmed.")
        return True

    def _ensure_bridge_build(self, market_ai_dir: Path) -> bool:
        build_bat = market_ai_dir / "build-kis-bridge-release.bat"
        bridge_exe = market_ai_dir / BRIDGE_PROCESS
        if not build_bat.exists():
            self.log(f"[WARN] {build_bat.name} was not found.")
            return bridge_exe.exists()

        self.log("[CHECK] KIS Bridge Release/x86 build")
        try:
            result = self._run_hidden(["cmd.exe", "/d", "/s", "/c", str(build_bat), "--ensure"], cwd=market_ai_dir, timeout=180)
            if result.stdout:
                for line in result.stdout.splitlines():
                    self.log("        " + line)
            if result.stderr:
                for line in result.stderr.splitlines():
                    self.log("        " + line)
            if result.returncode != 0:
                self.log(f"[WARN] KIS Bridge build returned {result.returncode}.")
                return False
        except Exception as exc:
            self.log(f"[WARN] KIS Bridge build failed: {exc}")
            return False
        return bridge_exe.exists()

    def _check_market_ai_deps(self, python_exe: Path, market_ai_dir: Path) -> bool:
        imports = "import fastapi, uvicorn, sqlalchemy, dotenv, yfinance, pandas, httpx, pydantic, exchange_calendars, korean_lunar_calendar"
        try:
            result = self._run_hidden([python_exe, "-c", imports], cwd=market_ai_dir, timeout=30)
            return result.returncode == 0
        except Exception:
            return False

    def _ensure_market_ai_deps(self, python_exe: Path, market_ai_dir: Path) -> bool:
        if self._check_market_ai_deps(python_exe, market_ai_dir):
            self.log("[OK]    Market AI core Python packages ready.")
            return True

        requirements = market_ai_dir / "requirements.txt"
        if not requirements.exists():
            self.log("[WARN] Market AI requirements.txt was not found.")
            return False

        self.log("[SETUP] Installing Market AI requirements.txt")
        try:
            result = self._run_hidden([python_exe, "-m", "pip", "install", "-r", requirements], cwd=market_ai_dir, timeout=600)
            if result.stdout:
                for line in result.stdout.splitlines():
                    self.log("        " + line)
            if result.stderr:
                for line in result.stderr.splitlines():
                    self.log("        " + line)
            if result.returncode != 0:
                return False
        except Exception as exc:
            self.log(f"[WARN] Market AI dependency install failed: {exc}")
            return False
        return self._check_market_ai_deps(python_exe, market_ai_dir)

    def _start_bridge(self, market_ai_dir: Path) -> bool:
        bridge_exe = market_ai_dir / BRIDGE_PROCESS
        if not bridge_exe.exists():
            self.log(f"[WARN] Bridge executable not found: {bridge_exe}")
            return False

        self.log("[START] KIS KOSPI200 Bridge")
        self.log("        관리자 권한 런처에서 실행하므로 추가 UAC는 표시되지 않습니다.")
        try:
            with self.lifecycle_lock:
                self._cancel_gate()
                proc = subprocess.Popen(
                    [str(bridge_exe)],
                    cwd=str(market_ai_dir),
                    creationflags=CREATE_NEW_PROCESS_GROUP,
                )
                self.started_processes["bridge"] = proc
        except StartupCancelled:
            return False
        except Exception as exc:
            self.log(f"[WARN] KIS Bridge launch failed: {exc}")
            return False

        # Verify the actual Bridge process by image name. The WinForms app itself
        # starts hidden and exposes View / 종료 through its system-tray icon.
        if not self._wait_process(BRIDGE_PROCESS, 20, stable_seconds=2.0):
            self.log("[WARN] KIS Bridge process did not become stable within 20 seconds.")
            return False

        self.log("[OK]    KIS KOSPI200 Bridge process ready.")
        self.log("        Market AI API will start next; Bridge AUTO route retries until API is ready.")
        return True

    def _url_ready(self, url: str, timeout: float = 1.0) -> bool:
        try:
            with urllib.request.urlopen(url, timeout=timeout) as response:
                return 200 <= response.status < 500
        except Exception:
            return False

    def _wait_url(self, url: str, seconds: int) -> bool:
        deadline = time.monotonic() + seconds
        while time.monotonic() < deadline and not self.stop_event.is_set():
            if self._url_ready(url):
                return True
            time.sleep(1)
        return False

    def _spawn_server(self, name: str, args, cwd: Path):
        with self.lifecycle_lock:
            self._cancel_gate()
            if self.log_handle is None or self.log_handle.closed:
                raise RuntimeError("log file is not open")
            proc = subprocess.Popen(
                [str(x) for x in args],
                cwd=str(cwd),
                stdout=self.log_handle,
                stderr=subprocess.STDOUT,
                creationflags=CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP,
                startupinfo=_hidden_startupinfo(),
            )
            self.started_processes[name] = proc
            return proc

    def _start_market_ai_api(self, python_exe: Path, market_ai_dir: Path) -> bool:
        health = f"http://127.0.0.1:{MARKET_AI_PORT}/api/health"
        self.log(f"[START] Market AI API :{MARKET_AI_PORT}")
        try:
            self._spawn_server(
                "market_ai",
                [python_exe, "-m", "uvicorn", "app:app", "--host", "127.0.0.1", "--port", str(MARKET_AI_PORT)],
                market_ai_dir,
            )
        except StartupCancelled:
            return False
        except Exception as exc:
            self.log(f"[WARN] Market AI API launch failed: {exc}")
            return False
        if not self._wait_url(health, 30):
            self.log("[WARN] Market AI API did not become ready within 30 seconds.")
            return False
        self.log("[OK]    Market AI API ready.")
        return True

    def _start_dashboard(self, python_exe: Path) -> bool:
        url = f"http://127.0.0.1:{DASHBOARD_PORT}/"
        self.log(f"[START] Investment Dashboard :{DASHBOARD_PORT}")
        try:
            self._spawn_server(
                "dashboard",
                [python_exe, "-m", "http.server", str(DASHBOARD_PORT), "--bind", "127.0.0.1"],
                self.root_dir,
            )
        except StartupCancelled:
            return False
        except Exception as exc:
            self.log(f"[WARN] Dashboard launch failed: {exc}")
            return False
        if not self._wait_url(url, 15):
            self.log("[WARN] Dashboard HTTP server did not become ready within 15 seconds.")
            return False
        self.log("[OK]    Investment Dashboard ready.")
        return True

    def _process_actions(self):
        with self.status_lock:
            current_status = self.status
        if self.status_var.get() != current_status:
            self.status_var.set(current_status)

        try:
            while True:
                action = self.action_queue.get_nowait()
                if action == "view":
                    self.show_view()
                elif action == "exit":
                    self.shutdown()
                    return
        except queue.Empty:
            pass
        if not self.stop_event.is_set():
            self.root.after(150, self._process_actions)

    def show_view(self):
        if self.view_window is None or not self.view_window.winfo_exists():
            win = tk.Toplevel(self.root)
            win.title(APP_TITLE)
            win.geometry("820x540")
            win.minsize(680, 420)
            win.protocol("WM_DELETE_WINDOW", self.hide_view)

            header = ttk.Frame(win, padding=(12, 10))
            header.pack(fill="x")
            ttk.Label(header, text="상태:").pack(side="left")
            ttk.Label(header, textvariable=self.status_var).pack(side="left", padx=(6, 0))
            ttk.Button(header, text="브라우저 열기", command=lambda: webbrowser.open(f"http://localhost:{DASHBOARD_PORT}/")).pack(side="right")

            frame = ttk.Frame(win, padding=(12, 0, 12, 12))
            frame.pack(fill="both", expand=True)
            text = tk.Text(frame, wrap="none", state="disabled", font=("Consolas", 9))
            yscroll = ttk.Scrollbar(frame, orient="vertical", command=text.yview)
            xscroll = ttk.Scrollbar(frame, orient="horizontal", command=text.xview)
            text.configure(yscrollcommand=yscroll.set, xscrollcommand=xscroll.set)
            text.grid(row=0, column=0, sticky="nsew")
            yscroll.grid(row=0, column=1, sticky="ns")
            xscroll.grid(row=1, column=0, sticky="ew")
            frame.rowconfigure(0, weight=1)
            frame.columnconfigure(0, weight=1)

            self.view_window = win
            self.log_text = text
            self.last_log_snapshot = ""
        else:
            self.view_window.deiconify()
            self.view_window.lift()
            self.view_window.focus_force()
        self._refresh_view(force=True)

    def hide_view(self):
        if self.view_window is not None and self.view_window.winfo_exists():
            self.view_window.withdraw()

    def _refresh_view(self, force: bool = False):
        if self.log_text is not None and self.log_text.winfo_exists():
            try:
                snapshot = self.log_path.read_text(encoding="utf-8", errors="replace")
                if force or snapshot != self.last_log_snapshot:
                    self.log_text.configure(state="normal")
                    self.log_text.delete("1.0", "end")
                    self.log_text.insert("1.0", snapshot)
                    self.log_text.see("end")
                    self.log_text.configure(state="disabled")
                    self.last_log_snapshot = snapshot
            except Exception:
                pass
        if not self.stop_event.is_set():
            self.root.after(800, self._refresh_view)

    def shutdown(self):
        with self.lifecycle_lock:
            if self.stop_event.is_set():
                return
            # Setting this while holding the same lifecycle lock used by every
            # runtime spawn makes shutdown and new-process creation mutually
            # exclusive: after this point Bridge/API/Dashboard cannot appear.
            self.stop_event.set()
        self.set_status("종료 중")
        self.log()
        self.log("[STOP] Local Suite shutdown requested.")

        # First ask child processes started by this launcher to exit normally.
        # The final gate below verifies the actual ports/process image, so stale
        # handles or processes inherited from an earlier launcher cannot survive.
        for name in ("dashboard", "market_ai"):
            proc = self.started_processes.get(name)
            if proc is None or proc.poll() is not None:
                continue
            try:
                proc.terminate()
                proc.wait(timeout=5)
            except Exception:
                try:
                    proc.kill()
                except Exception:
                    pass

        dashboard_stopped = self._stop_port_listener(DASHBOARD_PORT)
        market_ai_stopped = self._stop_port_listener(MARKET_AI_PORT)
        bridge_stopped = self._stop_image(BRIDGE_PROCESS, reason="Local Suite 종료")

        if dashboard_stopped and market_ai_stopped and bridge_stopped:
            self.log("[OK]    Local Suite stopped. eFriend Expert remains open.")
        else:
            self.log("[WARN] Local Suite 종료 후 일부 런타임이 남아 있습니다. 위 ERROR 로그를 확인해 주세요.")
            self.log("       eFriend Expert는 종료 대상이 아니므로 계속 실행됩니다.")

        try:
            with self.log_lock:
                if self.log_handle is not None:
                    self.log_handle.flush()
                    self.log_handle.close()
                    self.log_handle = None
        except Exception:
            pass
        self.tray.stop()
        self.root.after(50, self.root.destroy)


def _report_fatal_error(exc: BaseException):
    """Make .pyw startup failures visible instead of failing silently."""
    root_dir = Path(__file__).resolve().parent
    log_path = root_dir / "start-local-server.log"
    detail = f"{type(exc).__name__}: {exc}"
    try:
        with log_path.open("a", encoding="utf-8") as handle:
            handle.write("\n[FATAL] Launcher initialization failed.\n")
            handle.write(f"        {detail}\n")
    except Exception:
        pass

    if os.name == "nt":
        try:
            ctypes.windll.user32.MessageBoxW(
                None,
                f"{APP_TITLE}을 시작하지 못했습니다.\n\n{detail}\n\n"
                f"로그: {log_path}",
                APP_TITLE,
                0x00000010,  # MB_ICONERROR
            )
        except Exception:
            pass


if __name__ == "__main__":
    try:
        if os.name == "nt" and not _is_admin():
            if _request_launcher_elevation():
                # The elevated pythonw.exe instance continues startup. This
                # original non-elevated process must exit immediately.
                sys.exit(0)
            _show_elevation_error()
            sys.exit(1)

        launcher = LocalSuiteLauncher()
        launcher.run()
    except Exception as exc:
        _report_fatal_error(exc)
        sys.exit(1)
