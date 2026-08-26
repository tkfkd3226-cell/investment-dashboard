from __future__ import annotations

import csv
import ctypes
import json
from ctypes import wintypes
import os
from pathlib import Path
import queue
import subprocess
import sys
import threading
import time
import tkinter as tk
from tkinter import ttk, messagebox
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

# eFriend Expert UI contract verified on the current installation.  These are
# Win32 dialog/control IDs, not screen coordinates, so automation remains
# stable when the window moves or the display resolution changes.
EFRIEND_LOGIN_WINDOW_TITLE = "eFriend Expert 로그인"
EFRIEND_CERT_WINDOW_TOKEN = "인증서 선택"
EFRIEND_CTRL_CUSTOMER_ID = 1000
EFRIEND_CTRL_ID_PASSWORD = 1001
EFRIEND_CTRL_CERT_PASSWORD = 1002
EFRIEND_CTRL_LOGIN = 1003
EFRIEND_CTRL_CERT_CONFIRM = 1
WM_SETTEXT = 0x000C
BM_CLICK = 0x00F5
SMTO_ABORTIFHUNG = 0x0002

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


class _CREDENTIALW(ctypes.Structure):
    _fields_ = [
        ("Flags", wintypes.DWORD),
        ("Type", wintypes.DWORD),
        ("TargetName", wintypes.LPWSTR),
        ("Comment", wintypes.LPWSTR),
        ("LastWritten", wintypes.FILETIME),
        ("CredentialBlobSize", wintypes.DWORD),
        ("CredentialBlob", ctypes.POINTER(ctypes.c_ubyte)),
        ("Persist", wintypes.DWORD),
        ("AttributeCount", wintypes.DWORD),
        ("Attributes", ctypes.c_void_p),
        ("TargetAlias", wintypes.LPWSTR),
        ("UserName", wintypes.LPWSTR),
    ]


class WindowsCredentialStore:
    """Windows Credential Manager wrapper for eFriend auto-login secrets.

    Secrets are consumed only in memory by the local eFriend UI automation path
    and are never written to logs or repository files.
    """

    CRED_TYPE_GENERIC = 1
    CRED_PERSIST_LOCAL_MACHINE = 2
    ERROR_NOT_FOUND = 1168
    TARGET = "InvestmentLocalSuite/eFriendExpert"

    def __init__(self, target: str | None = None):
        self.target = target or self.TARGET

    @staticmethod
    def _encode_payload(id_password: str, certificate_password: str) -> bytes:
        payload = {
            "version": 1,
            "id_password": id_password,
            "certificate_password": certificate_password,
        }
        return json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")

    @staticmethod
    def _decode_payload(blob: bytes) -> dict[str, str]:
        payload = json.loads(blob.decode("utf-8"))
        if payload.get("version") != 1:
            raise ValueError("지원하지 않는 eFriend 자격 증명 형식입니다.")
        return {
            "id_password": str(payload.get("id_password", "")),
            "certificate_password": str(payload.get("certificate_password", "")),
        }

    def _api(self):
        if os.name != "nt":
            raise RuntimeError("Windows Credential Manager는 Windows에서만 사용할 수 있습니다.")
        advapi32 = ctypes.WinDLL("Advapi32.dll", use_last_error=True)
        advapi32.CredWriteW.argtypes = [ctypes.POINTER(_CREDENTIALW), wintypes.DWORD]
        advapi32.CredWriteW.restype = wintypes.BOOL
        advapi32.CredReadW.argtypes = [
            wintypes.LPCWSTR,
            wintypes.DWORD,
            wintypes.DWORD,
            ctypes.POINTER(ctypes.POINTER(_CREDENTIALW)),
        ]
        advapi32.CredReadW.restype = wintypes.BOOL
        advapi32.CredDeleteW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD]
        advapi32.CredDeleteW.restype = wintypes.BOOL
        advapi32.CredFree.argtypes = [ctypes.c_void_p]
        advapi32.CredFree.restype = None
        return advapi32

    def exists(self) -> bool:
        api = self._api()
        pointer = ctypes.POINTER(_CREDENTIALW)()
        ctypes.set_last_error(0)
        if not api.CredReadW(self.target, self.CRED_TYPE_GENERIC, 0, ctypes.byref(pointer)):
            error = ctypes.get_last_error()
            if error == self.ERROR_NOT_FOUND:
                return False
            raise ctypes.WinError(error)
        try:
            return True
        finally:
            api.CredFree(pointer)

    def username(self) -> str:
        api = self._api()
        pointer = ctypes.POINTER(_CREDENTIALW)()
        ctypes.set_last_error(0)
        if not api.CredReadW(self.target, self.CRED_TYPE_GENERIC, 0, ctypes.byref(pointer)):
            error = ctypes.get_last_error()
            if error == self.ERROR_NOT_FOUND:
                return ""
            raise ctypes.WinError(error)
        try:
            return pointer.contents.UserName or ""
        finally:
            api.CredFree(pointer)

    def read(self) -> dict[str, str] | None:
        api = self._api()
        pointer = ctypes.POINTER(_CREDENTIALW)()
        ctypes.set_last_error(0)
        if not api.CredReadW(self.target, self.CRED_TYPE_GENERIC, 0, ctypes.byref(pointer)):
            error = ctypes.get_last_error()
            if error == self.ERROR_NOT_FOUND:
                return None
            raise ctypes.WinError(error)
        try:
            credential = pointer.contents
            blob = ctypes.string_at(credential.CredentialBlob, credential.CredentialBlobSize)
            payload = self._decode_payload(blob)
            payload["customer_id"] = credential.UserName or ""
            return payload
        finally:
            api.CredFree(pointer)

    def write(self, customer_id: str, id_password: str, certificate_password: str):
        if not customer_id or not id_password or not certificate_password:
            raise ValueError("고객 ID와 두 비밀번호를 모두 입력해 주세요.")

        api = self._api()
        blob_bytes = self._encode_payload(id_password, certificate_password)
        blob = ctypes.create_string_buffer(blob_bytes, len(blob_bytes))
        credential = _CREDENTIALW()
        credential.Type = self.CRED_TYPE_GENERIC
        credential.TargetName = self.target
        credential.CredentialBlobSize = len(blob_bytes)
        credential.CredentialBlob = ctypes.cast(blob, ctypes.POINTER(ctypes.c_ubyte))
        credential.Persist = self.CRED_PERSIST_LOCAL_MACHINE
        credential.UserName = customer_id
        credential.Comment = "Investment Local Suite eFriend auto-login"

        try:
            ctypes.set_last_error(0)
            if not api.CredWriteW(ctypes.byref(credential), 0):
                raise ctypes.WinError(ctypes.get_last_error())
        finally:
            ctypes.memset(ctypes.addressof(blob), 0, ctypes.sizeof(blob))

    def delete(self) -> bool:
        api = self._api()
        ctypes.set_last_error(0)
        if api.CredDeleteW(self.target, self.CRED_TYPE_GENERIC, 0):
            return True
        error = ctypes.get_last_error()
        if error == self.ERROR_NOT_FOUND:
            return False
        raise ctypes.WinError(error)


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
    ID_CREDENTIALS = 1002
    ID_EXIT = 1003
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

    def __init__(self, action_queue: queue.Queue[str], shutdown_requested: threading.Event):
        self.action_queue = action_queue
        self.shutdown_requested = shutdown_requested
        self.hwnd = None
        self.nid = None
        self._thread = None
        self._wndproc_ref = None
        self._class_name = f"InvestmentLocalSuiteTray_{os.getpid()}"

    def _request_exit(self):
        # Set the shutdown intent immediately on the tray thread. The Tk main
        # loop may process the queued action slightly later, so this event is
        # the authoritative early gate for startup/browser completion races.
        self.shutdown_requested.set()
        self.action_queue.put("exit")

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
                if command == self.ID_CREDENTIALS:
                    self.action_queue.put("credentials")
                    return 0
                if command == self.ID_EXIT:
                    self._request_exit()
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
            user32.AppendMenuW(menu, self.MF_STRING, self.ID_CREDENTIALS, "eFriend 자동 로그인 설정")
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
            elif command == self.ID_CREDENTIALS:
                self.action_queue.put("credentials")
            elif command == self.ID_EXIT:
                self._request_exit()
        finally:
            user32.DestroyMenu(menu)


class LocalSuiteLauncher:
    def __init__(self):
        self.root_dir = Path(__file__).resolve().parent
        self.log_path = self.root_dir / "start-local-server.log"
        self.action_queue: queue.Queue[str] = queue.Queue()
        self.shutdown_requested = threading.Event()
        self.tray = TrayIcon(self.action_queue, self.shutdown_requested)
        self.credential_store = WindowsCredentialStore()
        self.stop_event = threading.Event()
        self.lifecycle_lock = threading.RLock()
        self.started_processes: dict[str, subprocess.Popen] = {}
        self.startup_thread = None
        self.log_handle = None
        self.log_lock = threading.Lock()
        self.status = "시작 준비"
        self.status_lock = threading.Lock()

        # Phase 2: startup progress is event-driven. Worker threads only mutate
        # plain Python state; Tk variables are refreshed on the main thread.
        self.progress_lock = threading.Lock()
        self.progress_percent = 0
        self.progress_message = "초기화 중"
        self.progress_failed = False
        self.step_states = {
            "efriend": "대기",
            "bridge": "대기",
            "market_ai": "대기",
            "dashboard": "대기",
        }

        self.root = tk.Tk()
        self.root.withdraw()
        self.root.title(APP_TITLE)
        self.root.resizable(False, False)
        self.root.protocol("WM_DELETE_WINDOW", self._hide_loading)

        self.view_window = None
        self.credential_window = None
        self.status_var = tk.StringVar(value=self.status)
        self.progress_var = tk.DoubleVar(value=0)
        self.progress_percent_var = tk.StringVar(value="0%")
        self.progress_message_var = tk.StringVar(value=self.progress_message)
        self.step_vars = {key: tk.StringVar(value="○ 대기") for key in self.step_states}
        self.log_text = None
        self.last_log_snapshot = ""
        self._build_loading_ui()

    def _build_loading_ui(self):
        outer = ttk.Frame(self.root, padding=(24, 22, 24, 20))
        outer.pack(fill="both", expand=True)

        ttk.Label(outer, text=APP_TITLE, font=("Segoe UI", 15, "bold")).pack(anchor="w")
        ttk.Label(outer, text="로컬 투자 환경을 준비하고 있습니다.").pack(anchor="w", pady=(4, 18))

        progress_row = ttk.Frame(outer)
        progress_row.pack(fill="x")
        ttk.Progressbar(progress_row, variable=self.progress_var, maximum=100, length=390).pack(side="left", fill="x", expand=True)
        ttk.Label(progress_row, textvariable=self.progress_percent_var, width=5, anchor="e").pack(side="right", padx=(12, 0))

        ttk.Label(outer, textvariable=self.progress_message_var, font=("Segoe UI", 10, "bold")).pack(anchor="w", pady=(10, 18))

        steps = ttk.Frame(outer)
        steps.pack(fill="x")
        labels = (
            ("efriend", "eFriend Expert"),
            ("bridge", "KIS KOSPI200 Bridge"),
            ("market_ai", "Market AI API"),
            ("dashboard", "Investment Dashboard"),
        )
        for row, (key, label) in enumerate(labels):
            ttk.Label(steps, text=label).grid(row=row, column=0, sticky="w", pady=3)
            ttk.Label(steps, textvariable=self.step_vars[key], width=10, anchor="e").grid(row=row, column=1, sticky="e", pady=3, padx=(24, 0))
        steps.columnconfigure(0, weight=1)

        footer = ttk.Frame(outer)
        footer.pack(fill="x", pady=(18, 0))
        ttk.Button(footer, text="로그 보기", command=self.show_view).pack(side="right")

        self.root.update_idletasks()
        width = max(self.root.winfo_reqwidth(), 470)
        height = max(self.root.winfo_reqheight(), 330)
        x = max((self.root.winfo_screenwidth() - width) // 2, 0)
        y = max((self.root.winfo_screenheight() - height) // 2, 0)
        self.root.geometry(f"{width}x{height}+{x}+{y}")
        self.root.deiconify()
        self.root.lift()

    def _hide_loading(self):
        # Closing the progress window only hides it; the Local Suite remains
        # controllable from its tray icon and View window.
        try:
            self.root.withdraw()
        except Exception:
            pass

    def set_progress(self, percent: int, message: str, *, active: str | None = None, complete: tuple[str, ...] = (), failed: bool = False):
        with self.progress_lock:
            requested_percent = max(0, min(100, int(percent)))
            # Progress represents completed startup work, so transient eFriend
            # process hand-offs must never make the UI move backwards.
            self.progress_percent = max(self.progress_percent, requested_percent)
            self.progress_message = message
            self.progress_failed = bool(failed)
            for key in complete:
                if key in self.step_states:
                    self.step_states[key] = "완료"
            if active in self.step_states and self.step_states[active] != "완료":
                self.step_states[active] = "진행"

    def _refresh_loading_state(self):
        with self.progress_lock:
            percent = self.progress_percent
            message = self.progress_message
            failed = self.progress_failed
            states = dict(self.step_states)

        self.progress_var.set(percent)
        self.progress_percent_var.set(f"{percent}%")
        self.progress_message_var.set(("실패: " if failed else "") + message)
        symbols = {"대기": "○ 대기", "진행": "● 진행", "완료": "✓ 완료"}
        for key, state in states.items():
            value = symbols.get(state, state)
            if self.step_vars[key].get() != value:
                self.step_vars[key].set(value)

    def _queue_startup_complete(self):
        # Give the main thread enough time to paint the real 100% state before
        # hiding the loader and opening the dashboard.
        self.root.after(650, self._finish_startup_ui)

    def _finish_startup_ui(self):
        try:
            with self.lifecycle_lock:
                self._cancel_gate()
                self.root.withdraw()
                webbrowser.open(f"http://localhost:{DASHBOARD_PORT}/")
        except StartupCancelled:
            return
        except Exception as exc:
            self.log(f"[WARN] Browser open failed: {exc}")

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
        if self.shutdown_requested.is_set() or self.stop_event.is_set():
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
            try:
                credential_state = "configured" if self.credential_store.exists() else "not configured"
                self.log(f"Credential: eFriend auto-login {credential_state} (Windows Credential Manager)")
            except Exception as exc:
                self.log(f"[WARN] eFriend credential status check failed: {type(exc).__name__}")
            self.log()

            # Always clear stale suite runtimes first. This guarantees that API/Dashboard
            # from a previous run cannot remain alive when the eFriend gate fails.
            self.set_status("기존 로컬 프로세스 정리 중")
            self.set_progress(5, "기존 로컬 프로세스를 정리하고 있습니다.")
            if not self._stop_image(BRIDGE_PROCESS, reason="새 시작 순서 적용"):
                raise RuntimeError("기존 KIS Bridge를 종료하지 못해 시작을 중단했습니다.")
            self._stop_port_listener(MARKET_AI_PORT)
            self._stop_port_listener(DASHBOARD_PORT)
            self._cancel_gate()

            # Runtime dependency gate 1: eFriend Expert must be genuinely running.
            self.set_status("eFriend Expert 확인 중")
            self.set_progress(15, "eFriend Expert 실행 상태를 확인하고 있습니다.", active="efriend")
            if not self._ensure_efriend():
                if self.stop_event.is_set():
                    raise StartupCancelled()
                raise RuntimeError("eFriend Expert 실행을 확인하지 못해 시작을 중단했습니다.")
            self._cancel_gate()

            # Prepare Bridge and API before runtime startup. The tray-capable
            # source must actually be present before we build/launch the Bridge.
            self.set_status("KIS Bridge 트레이 소스 확인 중")
            self.set_progress(60, "KIS Bridge 실행 준비를 확인하고 있습니다.", active="bridge", complete=("efriend",))
            if not self._bridge_tray_source_ready(market_ai_dir):
                raise RuntimeError("KIS Bridge 트레이 수정 소스가 없어 시작을 중단했습니다.")
            self._cancel_gate()

            self.set_status("KIS Bridge 빌드 확인 중")
            self.set_progress(63, "KIS Bridge Release/x86 빌드를 확인하고 있습니다.", active="bridge", complete=("efriend",))
            if not self._ensure_bridge_build(market_ai_dir):
                if self.stop_event.is_set():
                    raise StartupCancelled()
                raise RuntimeError("KIS Bridge 빌드/배포에 실패해 시작을 중단했습니다.")
            self._cancel_gate()

            self.set_status("Market AI 의존성 확인 중")
            self.set_progress(67, "Market AI 실행 환경을 확인하고 있습니다.", active="bridge", complete=("efriend",))
            if not self._ensure_market_ai_deps(python_exe, market_ai_dir):
                if self.stop_event.is_set():
                    raise StartupCancelled()
                raise RuntimeError("Market AI Python 패키지 준비에 실패해 시작을 중단했습니다.")
            self._cancel_gate()

            # Runtime dependency gate 2: Bridge process first.
            self.set_status("KIS Bridge 시작 중")
            self.set_progress(70, "KIS KOSPI200 Bridge를 시작하고 있습니다.", active="bridge", complete=("efriend",))
            if not self._start_bridge(market_ai_dir):
                if self.stop_event.is_set():
                    raise StartupCancelled()
                raise RuntimeError("KIS Bridge 프로세스 실행을 확인하지 못해 시작을 중단했습니다.")
            self._cancel_gate()

            # Only after Bridge is confirmed do API and dashboard start.
            self.set_status("Market AI API 시작 중")
            self.set_progress(80, "Market AI API를 시작하고 있습니다.", active="market_ai", complete=("efriend", "bridge"))
            if not self._start_market_ai_api(python_exe, market_ai_dir):
                if self.stop_event.is_set():
                    raise StartupCancelled()
                raise RuntimeError("Market AI API가 준비되지 않아 대시보드를 시작하지 않았습니다.")
            self._cancel_gate()

            self.set_status("대시보드 시작 중")
            self.set_progress(93, "Investment Dashboard를 시작하고 있습니다.", active="dashboard", complete=("efriend", "bridge", "market_ai"))
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
                self.set_progress(100, "모든 서비스가 준비되었습니다.", complete=("efriend", "bridge", "market_ai", "dashboard"))
                self.log()
                self.log("[OK] Startup sequence complete.")
                self.log("     eFriend Expert -> KIS Bridge -> Market AI API -> Dashboard")
                self.log("     Tray icon: right-click View / 종료")
                self.action_queue.put("startup_complete")
        except StartupCancelled:
            # Tray Exit owns shutdown logging/cleanup. Startup simply stops.
            return
        except Exception as exc:
            self.set_status("시작 실패")
            with self.progress_lock:
                current_percent = self.progress_percent
            self.set_progress(current_percent, str(exc), failed=True)
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

    def _window_process_name(self, hwnd: int) -> str:
        """Return the executable name that owns hwnd, or an empty string."""
        if os.name != "nt" or not hwnd:
            return ""
        try:
            user32 = ctypes.windll.user32
            kernel32 = ctypes.windll.kernel32
            pid = wintypes.DWORD(0)
            user32.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
            user32.GetWindowThreadProcessId.restype = wintypes.DWORD
            user32.GetWindowThreadProcessId(wintypes.HWND(hwnd), ctypes.byref(pid))
            if not pid.value:
                return ""

            PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
            kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
            kernel32.OpenProcess.restype = wintypes.HANDLE
            handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid.value)
            if not handle:
                return ""
            try:
                size = wintypes.DWORD(32768)
                buffer = ctypes.create_unicode_buffer(size.value)
                kernel32.QueryFullProcessImageNameW.argtypes = [
                    wintypes.HANDLE,
                    wintypes.DWORD,
                    wintypes.LPWSTR,
                    ctypes.POINTER(wintypes.DWORD),
                ]
                kernel32.QueryFullProcessImageNameW.restype = wintypes.BOOL
                if not kernel32.QueryFullProcessImageNameW(handle, 0, buffer, ctypes.byref(size)):
                    return ""
                return Path(buffer.value).name.lower()
            finally:
                kernel32.CloseHandle(handle)
        except Exception:
            return ""

    def _control_class_matches(self, dialog_hwnd: int, control_id: int, expected_class: str) -> bool:
        """Verify that one dialog child has the expected Win32 class."""
        if os.name != "nt" or not dialog_hwnd:
            return False
        try:
            user32 = ctypes.windll.user32
            user32.GetDlgItem.argtypes = [wintypes.HWND, ctypes.c_int]
            user32.GetDlgItem.restype = wintypes.HWND
            user32.GetClassNameW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
            user32.GetClassNameW.restype = ctypes.c_int
            child = user32.GetDlgItem(wintypes.HWND(dialog_hwnd), int(control_id))
            if not child:
                return False
            class_buffer = ctypes.create_unicode_buffer(128)
            if not user32.GetClassNameW(child, class_buffer, len(class_buffer)):
                return False
            return class_buffer.value.lower() == expected_class.lower()
        except Exception:
            return False

    def _find_efriend_dialog(
        self,
        *,
        exact_title: str | None = None,
        title_contains: str | None = None,
        required_controls: tuple[int, ...] = (),
        required_control_classes: tuple[tuple[int, str], ...] = (),
    ) -> int:
        """Find a verified visible dialog owned by efriendexpert.exe.

        Automation is intentionally fail-closed: title, process ownership, required
        CtrlIds and expected child classes must all match before a window is used.
        """
        if os.name != "nt":
            return 0

        user32 = ctypes.windll.user32
        user32.GetDlgItem.argtypes = [wintypes.HWND, ctypes.c_int]
        user32.GetDlgItem.restype = wintypes.HWND
        user32.GetWindowTextLengthW.argtypes = [wintypes.HWND]
        user32.GetWindowTextLengthW.restype = ctypes.c_int
        user32.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
        user32.GetWindowTextW.restype = ctypes.c_int
        user32.GetClassNameW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
        user32.GetClassNameW.restype = ctypes.c_int
        user32.IsWindowVisible.argtypes = [wintypes.HWND]
        user32.IsWindowVisible.restype = wintypes.BOOL
        found = [0]
        exact_lower = exact_title.lower() if exact_title else None
        contains_lower = title_contains.lower() if title_contains else None
        WNDENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

        def enum_proc(hwnd, _lparam):
            if not user32.IsWindowVisible(hwnd):
                return True

            class_buffer = ctypes.create_unicode_buffer(128)
            user32.GetClassNameW(hwnd, class_buffer, len(class_buffer))
            if class_buffer.value != "#32770":
                return True

            # Never automate a similarly named dialog from another application.
            if self._window_process_name(int(hwnd)) != EFRIEND_BOOTSTRAP_PROCESS.lower():
                return True

            length = user32.GetWindowTextLengthW(hwnd)
            title_buffer = ctypes.create_unicode_buffer(max(length + 1, 2))
            user32.GetWindowTextW(hwnd, title_buffer, len(title_buffer))
            title = title_buffer.value
            title_lower = title.lower()
            if exact_lower is not None and title_lower != exact_lower:
                return True
            if contains_lower is not None and contains_lower not in title_lower:
                return True

            for control_id in required_controls:
                if not user32.GetDlgItem(hwnd, int(control_id)):
                    return True
            for control_id, expected_class in required_control_classes:
                if not self._control_class_matches(int(hwnd), int(control_id), expected_class):
                    return True

            found[0] = int(hwnd)
            return False

        callback = WNDENUMPROC(enum_proc)
        user32.EnumWindows(callback, 0)
        return found[0]

    def _wait_efriend_dialog(
        self,
        *,
        exact_title: str | None = None,
        title_contains: str | None = None,
        required_controls: tuple[int, ...] = (),
        required_control_classes: tuple[tuple[int, str], ...] = (),
        timeout_seconds: float = 20.0,
    ) -> int:
        """Wait for one of the verified eFriend dialogs without blocking shutdown."""
        deadline = time.monotonic() + timeout_seconds
        while time.monotonic() < deadline:
            self._cancel_gate()
            if self._efriend_ready():
                return 0
            hwnd = self._find_efriend_dialog(
                exact_title=exact_title,
                title_contains=title_contains,
                required_controls=required_controls,
                required_control_classes=required_control_classes,
            )
            if hwnd:
                return hwnd
            time.sleep(0.25)
        return 0

    def _set_dialog_edit(self, dialog_hwnd: int, control_id: int, value: str) -> bool:
        """Set a verified Win32 Edit control through WM_SETTEXT without reading it back."""
        if os.name != "nt" or not dialog_hwnd:
            return False
        if self._window_process_name(dialog_hwnd) != EFRIEND_BOOTSTRAP_PROCESS.lower():
            return False
        if not self._control_class_matches(dialog_hwnd, control_id, "Edit"):
            return False
        user32 = ctypes.windll.user32
        user32.GetDlgItem.argtypes = [wintypes.HWND, ctypes.c_int]
        user32.GetDlgItem.restype = wintypes.HWND
        user32.IsWindowEnabled.argtypes = [wintypes.HWND]
        user32.IsWindowEnabled.restype = wintypes.BOOL
        user32.SendMessageTimeoutW.argtypes = [
            wintypes.HWND,
            wintypes.UINT,
            ctypes.c_size_t,
            ctypes.c_ssize_t,
            wintypes.UINT,
            wintypes.UINT,
            ctypes.POINTER(ctypes.c_size_t),
        ]
        user32.SendMessageTimeoutW.restype = ctypes.c_ssize_t
        child = user32.GetDlgItem(wintypes.HWND(dialog_hwnd), int(control_id))
        if not child or not user32.IsWindowEnabled(child):
            return False

        # Keep the secret in a temporary writable buffer only for the synchronous
        # cross-process WM_SETTEXT call.  We deliberately never read control text.
        buffer = ctypes.create_unicode_buffer(value)
        message_result = ctypes.c_size_t(0)
        try:
            sent = user32.SendMessageTimeoutW(
                child,
                WM_SETTEXT,
                0,
                ctypes.cast(buffer, ctypes.c_void_p).value,
                SMTO_ABORTIFHUNG,
                2000,
                ctypes.byref(message_result),
            )
            return bool(sent) and bool(message_result.value)
        finally:
            ctypes.memset(ctypes.addressof(buffer), 0, ctypes.sizeof(buffer))

    def _click_dialog_button(self, dialog_hwnd: int, control_id: int) -> bool:
        """Invoke a verified eFriend Button by CtrlId; no mouse coordinates are used."""
        if os.name != "nt" or not dialog_hwnd:
            return False
        if self._window_process_name(dialog_hwnd) != EFRIEND_BOOTSTRAP_PROCESS.lower():
            return False
        if not self._control_class_matches(dialog_hwnd, control_id, "Button"):
            return False
        user32 = ctypes.windll.user32
        user32.GetDlgItem.argtypes = [wintypes.HWND, ctypes.c_int]
        user32.GetDlgItem.restype = wintypes.HWND
        user32.IsWindowEnabled.argtypes = [wintypes.HWND]
        user32.IsWindowEnabled.restype = wintypes.BOOL
        user32.SendMessageTimeoutW.argtypes = [
            wintypes.HWND,
            wintypes.UINT,
            ctypes.c_size_t,
            ctypes.c_ssize_t,
            wintypes.UINT,
            wintypes.UINT,
            ctypes.POINTER(ctypes.c_size_t),
        ]
        user32.SendMessageTimeoutW.restype = ctypes.c_ssize_t
        child = user32.GetDlgItem(wintypes.HWND(dialog_hwnd), int(control_id))
        if not child or not user32.IsWindowEnabled(child):
            return False
        message_result = ctypes.c_size_t(0)
        sent = user32.SendMessageTimeoutW(
            child,
            BM_CLICK,
            0,
            0,
            SMTO_ABORTIFHUNG,
            2000,
            ctypes.byref(message_result),
        )
        return bool(sent)

    def _read_efriend_auto_login_credentials(self) -> dict[str, str] | None:
        """Read the three local secrets once; never log their values."""
        try:
            credentials = self.credential_store.read()
        except Exception as exc:
            self.log(f"[WARN] eFriend auto-login credential read failed: {type(exc).__name__}")
            return None
        if not credentials:
            self.log("[INFO]  eFriend auto-login credentials are not configured; manual login mode.")
            return None

        required = ("customer_id", "id_password", "certificate_password")
        if not all(str(credentials.get(key, "")) for key in required):
            self.log("[WARN] eFriend auto-login credentials are incomplete; manual login mode.")
            for key in required:
                credentials[key] = ""
            return None
        return credentials

    def _attempt_efriend_auto_login(self) -> bool:
        """Attempt one eFriend login/certificate approval cycle, then fall back safely.

        No credential is retried automatically.  A failed/changed eFriend UI simply
        returns False so the existing human-login readiness loop can continue.
        """
        credentials = self._read_efriend_auto_login_credentials()
        if credentials is None:
            return False

        try:
            self._cancel_gate()
            self.log("[AUTO]  eFriend auto-login started (stored credential values are not logged).")
            self.set_progress(25, "eFriend Expert 자동 로그인을 준비하고 있습니다.", active="efriend")

            # If the certificate dialog is already open (for example after the
            # user manually pressed Login), continue from that stage only.
            cert_hwnd = self._find_efriend_dialog(
                title_contains=EFRIEND_CERT_WINDOW_TOKEN,
                required_controls=(EFRIEND_CTRL_CERT_CONFIRM,),
                required_control_classes=((EFRIEND_CTRL_CERT_CONFIRM, "Button"),),
            )
            if not cert_hwnd:
                login_hwnd = self._wait_efriend_dialog(
                    exact_title=EFRIEND_LOGIN_WINDOW_TITLE,
                    required_controls=(
                        EFRIEND_CTRL_CUSTOMER_ID,
                        EFRIEND_CTRL_ID_PASSWORD,
                        EFRIEND_CTRL_CERT_PASSWORD,
                        EFRIEND_CTRL_LOGIN,
                    ),
                    required_control_classes=(
                        (EFRIEND_CTRL_CUSTOMER_ID, "Edit"),
                        (EFRIEND_CTRL_ID_PASSWORD, "Edit"),
                        (EFRIEND_CTRL_CERT_PASSWORD, "Edit"),
                        (EFRIEND_CTRL_LOGIN, "Button"),
                    ),
                    timeout_seconds=20.0,
                )
                if self._efriend_ready():
                    return True
                if not login_hwnd:
                    self.log("[WARN] eFriend login dialog was not detected; switching to manual login.")
                    return False

                self.set_progress(28, "저장된 eFriend 로그인 정보를 입력하고 있습니다.", active="efriend")
                fields = (
                    (EFRIEND_CTRL_CUSTOMER_ID, credentials["customer_id"]),
                    (EFRIEND_CTRL_ID_PASSWORD, credentials["id_password"]),
                    (EFRIEND_CTRL_CERT_PASSWORD, credentials["certificate_password"]),
                )
                for control_id, value in fields:
                    if not self._set_dialog_edit(login_hwnd, control_id, value):
                        self.log(f"[WARN] eFriend login CtrlId {control_id} 입력에 실패해 수동 로그인으로 전환합니다.")
                        return False

                if not self._click_dialog_button(login_hwnd, EFRIEND_CTRL_LOGIN):
                    self.log("[WARN] eFriend 로그인 버튼 실행에 실패해 수동 로그인으로 전환합니다.")
                    return False
                self.log("[AUTO]  eFriend login form submitted.")
                self.set_progress(32, "eFriend 로그인 요청을 처리하고 있습니다.", active="efriend")

                # One submission only.  If the certificate dialog never appears,
                # do not retry passwords; hand control back to the user.
                cert_hwnd = self._wait_efriend_dialog(
                    title_contains=EFRIEND_CERT_WINDOW_TOKEN,
                    required_controls=(EFRIEND_CTRL_CERT_CONFIRM,),
                    required_control_classes=((EFRIEND_CTRL_CERT_CONFIRM, "Button"),),
                    timeout_seconds=45.0,
                )
                if self._efriend_ready():
                    return True
                if not cert_hwnd:
                    self.log("[WARN] eFriend certificate dialog was not detected after one auto-login attempt; manual login fallback.")
                    return False

            self.set_progress(42, "eFriend 인증서 선택을 자동 승인하고 있습니다.", active="efriend")
            if not self._click_dialog_button(cert_hwnd, EFRIEND_CTRL_CERT_CONFIRM):
                self.log("[WARN] eFriend 인증서 선택(확인) 실행에 실패해 수동 처리로 전환합니다.")
                return False
            self.log("[AUTO]  eFriend certificate selection confirmed.")
            self.set_progress(48, "eFriend 로그인/인증 완료를 확인하고 있습니다.", active="efriend")

            if self._wait_process(EFRIEND_READY_PROCESS, 30, stable_seconds=1.5):
                return True

            self.log("[WARN] eFriend main process was not ready after auto approval; manual login fallback.")
            return False
        except StartupCancelled:
            raise
        except Exception as exc:
            self.log(f"[WARN] eFriend auto-login automation failed ({type(exc).__name__}); manual login fallback.")
            return False
        finally:
            # Drop references as soon as the single attempt ends.  Python strings
            # cannot be reliably zeroed, but they are never persisted/logged here.
            for key in ("customer_id", "id_password", "certificate_password"):
                if key in credentials:
                    credentials[key] = ""
            del credentials

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
        last_login_ui_stage = None

        while not self.stop_event.is_set():
            if self._process_running(EFRIEND_GATE_PROCESS):
                if last_login_ui_stage != "certificate":
                    self.set_progress(35, "eFriend 공동인증서 승인을 완료해 주세요.", active="efriend")
                    last_login_ui_stage = "certificate"
            elif self._process_running(EFRIEND_BOOTSTRAP_PROCESS):
                if last_login_ui_stage != "login":
                    self.set_progress(25, "eFriend Expert 로그인을 완료해 주세요.", active="efriend")
                    last_login_ui_stage = "login"

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

        # The actual logged-in runtime is efexpertmain.exe.  If it is already
        # present, auto-login is never entered and the user's existing session is
        # left untouched.
        if self._efriend_ready():
            self.log(f"[OK]    eFriend Expert already logged in ({EFRIEND_READY_PROCESS}); launch skipped.")
            self.set_progress(55, "eFriend Expert 로그인/인증이 완료되었습니다.", complete=("efriend",))
            return True

        # Never start a duplicate login launcher.  If a login/certificate flow is
        # already open, attempt the configured automation once from its current
        # stage; otherwise fall back to the existing manual wait loop.
        if self._efriend_login_in_progress():
            if self._attempt_efriend_auto_login():
                self.log(f"[OK]    eFriend Expert auto-login ready ({EFRIEND_READY_PROCESS}).")
                self.set_progress(55, "eFriend Expert 자동 로그인/인증이 완료되었습니다.", complete=("efriend",))
                return True

            if self._process_running(EFRIEND_GATE_PROCESS):
                self.log("[WAIT]  eFriend Expert 인증서 선택/승인을 수동으로 완료해 주세요.")
                self.set_progress(35, "eFriend 공동인증서 승인을 완료해 주세요.", active="efriend")
            else:
                self.log("[WAIT]  eFriend Expert 아이디/비밀번호 로그인을 수동으로 완료해 주세요.")
                self.set_progress(25, "eFriend Expert 로그인을 완료해 주세요.", active="efriend")
            self.log(f"        최종 로그인 완료 프로세스 대기: {EFRIEND_READY_PROCESS}")
            if self._wait_efriend_ready():
                self.log(f"[OK]    eFriend Expert login/certificate ready ({EFRIEND_READY_PROCESS}).")
                self.set_progress(55, "eFriend Expert 로그인/인증이 완료되었습니다.", complete=("efriend",))
                return True
            self.log("[WARN] eFriend Expert 로그인 흐름이 완료 전에 종료되었습니다.")
            return False

        self.log("[START] eFriend Expert")
        self.log("        관리자 권한 런처에서 실행하므로 추가 UAC는 표시되지 않습니다.")
        self.set_progress(20, "eFriend Expert를 실행하고 있습니다.", active="efriend")
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

        if self._attempt_efriend_auto_login():
            self.log(f"[OK]    eFriend Expert auto-login ready ({EFRIEND_READY_PROCESS}).")
            self.set_progress(55, "eFriend Expert 자동 로그인/인증이 완료되었습니다.", complete=("efriend",))
            return True

        self.log("[WAIT]  eFriend Expert 수동 로그인 + 공동인증서 승인을 기다립니다.")
        self.log(f"        최종 Ready 기준: {EFRIEND_READY_PROCESS}")
        self.set_progress(25, "eFriend 로그인과 공동인증서 승인을 완료해 주세요.", active="efriend")
        if self._wait_efriend_ready():
            self.log(f"[OK]    eFriend Expert login/certificate ready ({EFRIEND_READY_PROCESS}).")
            self.set_progress(55, "eFriend Expert 로그인/인증이 완료되었습니다.", complete=("efriend",))
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
        self.set_progress(75, "KIS KOSPI200 Bridge가 준비되었습니다.", complete=("efriend", "bridge"))
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
        self.set_progress(90, "Market AI API가 준비되었습니다.", complete=("efriend", "bridge", "market_ai"))
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
        self.set_progress(100, "Investment Dashboard가 준비되었습니다.", complete=("efriend", "bridge", "market_ai", "dashboard"))
        return True

    def _process_actions(self):
        with self.status_lock:
            current_status = self.status
        if self.status_var.get() != current_status:
            self.status_var.set(current_status)
        self._refresh_loading_state()

        try:
            while True:
                action = self.action_queue.get_nowait()
                if action == "view":
                    self.show_view()
                elif action == "credentials":
                    self.show_credential_setup()
                elif action == "startup_complete":
                    self._queue_startup_complete()
                elif action == "exit":
                    self.shutdown()
                    return
        except queue.Empty:
            pass
        if not self.stop_event.is_set():
            self.root.after(150, self._process_actions)

    def show_credential_setup(self):
        """Local-only credential setup; values never enter logs or repository files."""
        if self.credential_window is not None and self.credential_window.winfo_exists():
            self.credential_window.deiconify()
            self.credential_window.lift()
            self.credential_window.focus_force()
            return

        win = tk.Toplevel(self.root)
        win.title("eFriend 자동 로그인 설정")
        win.resizable(False, False)
        win.transient(self.root)
        self.credential_window = win

        outer = ttk.Frame(win, padding=(20, 18, 20, 18))
        outer.pack(fill="both", expand=True)
        ttk.Label(outer, text="eFriend 자동 로그인 자격 증명", font=("Segoe UI", 12, "bold")).grid(row=0, column=0, columnspan=2, sticky="w")
        ttk.Label(
            outer,
            text="Windows 자격 증명 관리자에 저장되며 다음 실행부터 eFriend 자동 로그인에 사용됩니다.\n코드·로그·Git 파일에는 기록하지 않습니다.",
            justify="left",
        ).grid(row=1, column=0, columnspan=2, sticky="w", pady=(5, 14))

        customer_var = tk.StringVar()
        id_password_var = tk.StringVar()
        cert_password_var = tk.StringVar()
        status_var = tk.StringVar(value="")

        try:
            customer_var.set(self.credential_store.username())
            configured = self.credential_store.exists()
            status_var.set("현재 상태: 저장됨" if configured else "현재 상태: 저장되지 않음")
        except Exception as exc:
            status_var.set(f"현재 상태 확인 실패: {type(exc).__name__}")

        fields = (
            ("고객 ID", customer_var, False),
            ("ID 비밀번호", id_password_var, True),
            ("공동인증 비밀번호", cert_password_var, True),
        )
        first_entry = None
        for row, (label, variable, secret) in enumerate(fields, start=2):
            ttk.Label(outer, text=label).grid(row=row, column=0, sticky="w", pady=5)
            entry = ttk.Entry(outer, textvariable=variable, width=34, show="●" if secret else "")
            entry.grid(row=row, column=1, sticky="ew", padx=(14, 0), pady=5)
            if first_entry is None:
                first_entry = entry

        ttk.Label(outer, textvariable=status_var).grid(row=5, column=0, columnspan=2, sticky="w", pady=(10, 0))

        def clear_secret_entries():
            id_password_var.set("")
            cert_password_var.set("")

        def save_credentials():
            try:
                self.credential_store.write(customer_var.get().strip(), id_password_var.get(), cert_password_var.get())
                clear_secret_entries()
                status_var.set("현재 상태: 저장됨")
                messagebox.showinfo(APP_TITLE, "eFriend 자격 증명을 Windows 자격 증명 관리자에 저장했습니다.", parent=win)
            except Exception as exc:
                clear_secret_entries()
                messagebox.showerror(APP_TITLE, f"자격 증명을 저장하지 못했습니다.\n\n{type(exc).__name__}: {exc}", parent=win)

        def delete_credentials():
            if not messagebox.askyesno(APP_TITLE, "저장된 eFriend 자동 로그인 자격 증명을 삭제할까요?", parent=win):
                return
            try:
                self.credential_store.delete()
                customer_var.set("")
                clear_secret_entries()
                status_var.set("현재 상태: 저장되지 않음")
            except Exception as exc:
                messagebox.showerror(APP_TITLE, f"자격 증명을 삭제하지 못했습니다.\n\n{type(exc).__name__}: {exc}", parent=win)

        buttons = ttk.Frame(outer)
        buttons.grid(row=6, column=0, columnspan=2, sticky="e", pady=(16, 0))
        ttk.Button(buttons, text="저장 정보 삭제", command=delete_credentials).pack(side="left")
        ttk.Button(buttons, text="닫기", command=win.destroy).pack(side="left", padx=(8, 0))
        ttk.Button(buttons, text="저장", command=save_credentials).pack(side="left", padx=(8, 0))
        outer.columnconfigure(1, weight=1)

        win.update_idletasks()
        width = max(win.winfo_reqwidth(), 500)
        height = max(win.winfo_reqheight(), 290)
        x = max((win.winfo_screenwidth() - width) // 2, 0)
        y = max((win.winfo_screenheight() - height) // 2, 0)
        win.geometry(f"{width}x{height}+{x}+{y}")
        if first_entry is not None:
            first_entry.focus_set()

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
        self.shutdown_requested.set()
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
