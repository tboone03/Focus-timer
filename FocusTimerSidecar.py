"""
FocusTimer Headless Sidecar
Runs a local HTTP server on 127.0.0.1:54321 that the Electron UI and Chrome
extension both use. No GUI — all state is managed in memory and persisted to
~/.focus_timer_config.json.
"""
import ctypes
import json
import os
import subprocess
import sys
import threading
import time
import secrets
from datetime import date
from pathlib import Path
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

try:
    import psutil
except ImportError:
    print("psutil required:  pip install psutil")
    sys.exit(1)

try:
    import requests as _requests
    _REQUESTS_AVAILABLE = True
except ImportError:
    _REQUESTS_AVAILABLE = False

try:
    import win32api, win32gui, win32con, win32process
    _WIN32_AVAILABLE = True
except ImportError:
    _WIN32_AVAILABLE = False

# ─────────────────────────── constants ────────────────────────────────────────

CONFIG_FILE = Path.home() / ".focus_timer_config.json"
API_PORT    = 54321
_API_TOKEN  = secrets.token_hex(16)

SYSTEM_WHITELIST = {
    "system", "system idle process", "registry", "memory compression",
    "smss.exe", "csrss.exe", "wininit.exe", "services.exe", "lsass.exe",
    "svchost.exe", "winlogon.exe", "fontdrvhost.exe", "dwm.exe",
    "explorer.exe", "searchindexer.exe", "searchapp.exe",
    "taskhostw.exe", "runtimebroker.exe", "sihost.exe", "ctfmon.exe",
    "startmenuexperiencehost.exe", "shellexperiencehost.exe",
    "applicationframehost.exe", "textinputhost.exe", "conhost.exe",
    "wmiprvse.exe", "audiodg.exe", "spoolsv.exe", "lockapp.exe",
    "useroobebroker.exe", "widgets.exe", "widgetservice.exe",
    "securityhealthsystray.exe", "securityhealthservice.exe",
    # Focus Timer Electron app — development and packaged variants
    "focutimerapp.exe", "electron.exe",
    "focustimer.exe",
    "focustimer helper.exe",
    "focustimer helper (renderer).exe",
    "focustimer helper (gpu).exe",
    "focustimer helper (plugin).exe",
}

BROWSER_EXES = frozenset({
    "chrome.exe", "msedge.exe", "firefox.exe", "brave.exe",
    "opera.exe", "vivaldi.exe", "waterfox.exe", "librewolf.exe",
})

def _detect_running_browser() -> str | None:
    """Return the exe name (lowercase) of the first running browser found."""
    try:
        for proc in psutil.process_iter(["name"]):
            try:
                name = (proc.info.get("name") or "").lower()
                if name in BROWSER_EXES:
                    return name
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
    except Exception:
        pass
    return None

# ─────────────────────────── friendly app names ───────────────────────────────

FRIENDLY: dict[str, str] = {
    # Microsoft Office
    "winword.exe": "Microsoft Word", "excel.exe": "Microsoft Excel",
    "powerpnt.exe": "Microsoft PowerPoint", "outlook.exe": "Microsoft Outlook",
    "onenote.exe": "Microsoft OneNote", "msaccess.exe": "Microsoft Access",
    "mspub.exe": "Microsoft Publisher", "visio.exe": "Microsoft Visio",
    # Dev tools
    "code.exe": "Visual Studio Code", "devenv.exe": "Visual Studio",
    "idea64.exe": "IntelliJ IDEA", "idea.exe": "IntelliJ IDEA",
    "pycharm64.exe": "PyCharm", "pycharm.exe": "PyCharm",
    "webstorm64.exe": "WebStorm", "clion64.exe": "CLion",
    "datagrip64.exe": "DataGrip", "rider64.exe": "Rider",
    "goland64.exe": "GoLand", "phpstorm64.exe": "PhpStorm",
    "android studio.exe": "Android Studio", "androidstudio64.exe": "Android Studio",
    "eclipse.exe": "Eclipse", "notepad++.exe": "Notepad++",
    "notepad.exe": "Notepad", "sublime_text.exe": "Sublime Text",
    "atom.exe": "Atom", "vim.exe": "Vim", "nvim.exe": "Neovim",
    "emacs.exe": "Emacs", "cursor.exe": "Cursor", "windsurf.exe": "Windsurf",
    # Browsers
    "chrome.exe": "Google Chrome", "firefox.exe": "Mozilla Firefox",
    "msedge.exe": "Microsoft Edge", "brave.exe": "Brave",
    "opera.exe": "Opera", "vivaldi.exe": "Vivaldi",
    "waterfox.exe": "Waterfox", "librewolf.exe": "LibreWolf",
    # Communication
    "discord.exe": "Discord", "slack.exe": "Slack",
    "teams.exe": "Microsoft Teams", "ms-teams.exe": "Microsoft Teams",
    "zoom.exe": "Zoom", "telegram.exe": "Telegram",
    "whatsapp.exe": "WhatsApp", "signal.exe": "Signal",
    "skype.exe": "Skype", "mattermost.exe": "Mattermost",
    "thunderbird.exe": "Thunderbird",
    # Media & creativity
    "spotify.exe": "Spotify", "vlc.exe": "VLC",
    "obs64.exe": "OBS Studio", "obs32.exe": "OBS Studio",
    "photoshop.exe": "Adobe Photoshop", "illustrator.exe": "Adobe Illustrator",
    "premiere.exe": "Adobe Premiere", "afterfx.exe": "Adobe After Effects",
    "indesign.exe": "Adobe InDesign", "lightroom.exe": "Adobe Lightroom",
    "acrord32.exe": "Adobe Reader", "acrobat.exe": "Adobe Acrobat",
    "figma.exe": "Figma", "blender.exe": "Blender",
    "gimp-2.10.exe": "GIMP", "gimp.exe": "GIMP",
    "inkscape.exe": "Inkscape", "audacity.exe": "Audacity",
    "mpv.exe": "MPV Player", "mpc-hc64.exe": "MPC-HC",
    # Productivity & notes
    "notion.exe": "Notion", "obsidian.exe": "Obsidian",
    "zotero.exe": "Zotero", "anki.exe": "Anki",
    "logseq.exe": "Logseq", "evernote.exe": "Evernote",
    "typora.exe": "Typora", "marktext.exe": "Mark Text",
    # Terminals & utilities
    "windowsterminal.exe": "Windows Terminal", "wt.exe": "Windows Terminal",
    "powershell.exe": "PowerShell", "pwsh.exe": "PowerShell",
    "cmd.exe": "Command Prompt", "bash.exe": "Bash",
    "wsl.exe": "WSL", "ubuntu.exe": "Ubuntu (WSL)",
    "putty.exe": "PuTTY", "winscp.exe": "WinSCP",
    "filezilla.exe": "FileZilla", "winrar.exe": "WinRAR",
    "7zfm.exe": "7-Zip",
    # Games & launchers
    "steam.exe": "Steam", "epicgameslauncher.exe": "Epic Games Launcher",
    "goggalaxy.exe": "GOG Galaxy", "battle.net.exe": "Battle.net",
    "leagueclient.exe": "League of Legends",
    "riotclientservices.exe": "Riot Client",
    # Dev utilities
    "postman.exe": "Postman", "insomnia.exe": "Insomnia",
    "docker desktop.exe": "Docker Desktop",
    "virtualbox.exe": "VirtualBox", "vmware.exe": "VMware",
}

_name_cache: dict[str, str] = {}


def pretty_name(path_or_name: str) -> str:
    if not path_or_name:
        return ""
    if "\\" not in path_or_name and "/" not in path_or_name and "." in path_or_name:
        parts = path_or_name.split(".")
        if len(parts) >= 2:
            if parts[0] == "www":
                parts.pop(0)
            main_parts = parts[:-1] if len(parts) > 1 else parts
            return " ".join(p.capitalize() for p in main_parts)
        return path_or_name.lower()
    base = Path(path_or_name).name.lower()
    if base in FRIENDLY:
        return FRIENDLY[base]
    stem = Path(path_or_name).stem.replace("_", " ").replace("-", " ")
    return (stem[:1].upper() + stem[1:]) if stem else path_or_name


def resolve_app_name(exe_path: str, fallback_name: str) -> str:
    """Return the best human-readable name for an executable.

    Priority: FRIENDLY dict → Win32 FileVersionInfo (ProductName / FileDescription)
    → capitalized fallback stem.
    """
    key = exe_path.lower() if exe_path else fallback_name.lower()
    if key in _name_cache:
        return _name_cache[key]

    base = Path(exe_path).name.lower() if exe_path else fallback_name.lower()
    stem = Path(base).stem
    if base in FRIENDLY:
        result = FRIENDLY[base]
        _name_cache[key] = result
        return result

    if _WIN32_AVAILABLE and exe_path and Path(exe_path).exists():
        for field in ("\\StringFileInfo\\040904B0\\ProductName",
                      "\\StringFileInfo\\040904B0\\FileDescription"):
            try:
                info = win32api.GetFileVersionInfo(exe_path, field)
                if info and info.strip() and info.strip().lower() not in ("", stem):
                    result = info.strip()
                    _name_cache[key] = result
                    return result
            except Exception:
                pass

    result = pretty_name(fallback_name)
    _name_cache[key] = result
    return result


def get_window_title(exe_path: str) -> str | None:
    """Return the title of the foreground window belonging to the given exe, or None."""
    if not _WIN32_AVAILABLE or not exe_path:
        return None
    try:
        target_exe = exe_path.lower()
        result: list[str] = []

        def _cb(hwnd, _):
            if not win32gui.IsWindowVisible(hwnd):
                return
            title = win32gui.GetWindowText(hwnd)
            if not title:
                return
            try:
                _, pid = win32process.GetWindowThreadProcessId(hwnd)
                h = win32api.OpenProcess(win32con.PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
                path = win32process.GetModuleFileNameEx(h, 0).lower()
                win32api.CloseHandle(h)
                if path == target_exe and title not in result:
                    result.append(title)
            except Exception:
                pass

        win32gui.EnumWindows(_cb, None)
        titles = [t for t in result if len(t) > 3]
        return min(titles, key=len) if titles else None
    except Exception:
        return None

# ─────────────────────────── session state ────────────────────────────────────

_lock = threading.Lock()
_protected_pids: set[int] = set()
_minimized_hwnds: set[int] = set()
_reset_tabs_at: float = 0.0

class State:
    session_state: str        = "idle"   # idle | active | paused
    session_end_time: float   = 0.0
    session_total_seconds: int = 0
    paused_remaining: float   = 0.0
    session_xp_earned: int    = 0
    xp_total: int             = 0
    streak: int               = 0
    last_session_date: date | None = None
    mode: str                 = "strict"  # strict | soft
    whitelist: list[str]      = []
    temp_whitelist: dict[str, float] = {}
    backend_url: str          = "https://focustimer-backend.onrender.com"
    backend_username: str     = ""
    backend_password: str     = ""

S = State()
own_pid = os.getpid()
_ancestor_paths: set[str] = set()
_ancestor_names: set[str] = set()

# ─────────────────────────── config ───────────────────────────────────────────

def load_config() -> None:
    if not CONFIG_FILE.exists():
        return
    try:
        with open(CONFIG_FILE) as f:
            data = json.load(f)
        S.whitelist      = [p.lower() for p in data.get("whitelist", [])]
        S.mode           = data.get("mode", "strict")
        S.streak         = int(data.get("streak", 0))
        S.xp_total       = int(data.get("xp_total", 0))
        S.backend_url    = data.get("backend_url", "https://focustimer-backend.onrender.com")
        S.backend_username = data.get("backend_username", "")
        S.backend_password = data.get("backend_password", "")
        lsd = data.get("last_session_date")
        if lsd:
            try: S.last_session_date = date.fromisoformat(lsd)
            except Exception: pass
    except Exception as e:
        print(f"[config] load error: {e}")
    if S.last_session_date and (date.today() - S.last_session_date).days > 1:
        S.streak = 0


def save_config() -> None:
    try:
        with open(CONFIG_FILE, "w") as f:
            json.dump({
                "whitelist": S.whitelist,
                "mode": S.mode,
                "streak": S.streak,
                "xp_total": S.xp_total,
                "last_session_date": S.last_session_date.isoformat() if S.last_session_date else None,
                "backend_url": S.backend_url,
                "backend_username": S.backend_username,
                "backend_password": S.backend_password,
            }, f, indent=2)
    except Exception as e:
        print(f"[config] save error: {e}")

# ─────────────────────────── session management ───────────────────────────────

def start_session(total_seconds: int, mode: str) -> dict:
    with _lock:
        if S.session_state != "idle":
            return {"error": "session already running"}
        if total_seconds <= 0:
            return {"error": "invalid duration"}
        S.session_state        = "active"
        S.session_total_seconds = total_seconds
        S.session_end_time     = time.time() + total_seconds
        S.session_xp_earned    = 0
        S.mode                 = mode
        _capture_ancestors()
    threading.Thread(target=_tick_loop, daemon=True).start()
    threading.Thread(target=_monitor_loop, daemon=True).start()
    backend_push()
    print(f"[session] started  {total_seconds}s  mode={mode}")
    return {"ok": True}


def stop_session(aborted: bool = False) -> dict:
    global _reset_tabs_at
    with _lock:
        if S.session_state == "idle":
            return {"error": "no active session"}
        S.session_state = "idle"
    _reset_tabs_at = time.time()
    _restore_minimized_windows()

    if not aborted and S.session_total_seconds >= 10 * 60:
        today = date.today()
        if S.last_session_date == today:
            pass
        elif S.last_session_date and (today - S.last_session_date).days == 1:
            S.streak += 1
        else:
            S.streak = 1
        S.last_session_date = today

    save_config()
    backend_push()
    print("[session] stopped")
    return {"ok": True}


def toggle_pause() -> dict:
    global _reset_tabs_at
    going_to_pause = False
    with _lock:
        if S.session_state == "active":
            S.session_state    = "paused"
            S.paused_remaining = max(0.0, S.session_end_time - time.time())
            going_to_pause = True
        elif S.session_state == "paused":
            S.session_state    = "active"
            S.session_end_time = time.time() + S.paused_remaining
            S.paused_remaining = 0.0
            threading.Thread(target=_tick_loop, daemon=True).start()
        else:
            return {"error": "no active session"}
    if going_to_pause:
        _reset_tabs_at = time.time()
        _restore_minimized_windows()
    backend_push()
    return {"ok": True, "state": S.session_state}

# ─────────────────────────── background loops ─────────────────────────────────

def _tick_loop() -> None:
    while True:
        with _lock:
            if S.session_state != "active":
                break
            remaining = max(0.0, S.session_end_time - time.time())
            elapsed   = S.session_total_seconds - remaining
            target_xp = int(elapsed // 60)
            if target_xp > S.session_xp_earned:
                delta = target_xp - S.session_xp_earned
                S.session_xp_earned = target_xp
                S.xp_total         += delta
            if remaining <= 0:
                pass  # let monitor loop handle completion check
        if remaining <= 0:
            stop_session(aborted=False)
            break
        time.sleep(0.5)


def _monitor_loop() -> None:
    while S.session_state in ("active", "paused"):
        if S.session_state == "paused":
            time.sleep(0.5)
            continue
        if S.mode == "strict":
            _strict_pass()
            time.sleep(2)
        else:
            _soft_pass()
            time.sleep(0.4)


def _capture_ancestors() -> None:
    global _ancestor_paths, _ancestor_names, _protected_pids
    paths, names = set(), set()
    try:
        p = psutil.Process(own_pid)
        while p:
            try: names.add(p.name().lower())
            except Exception: pass
            try: paths.add(p.exe().lower().replace("/", "\\"))
            except Exception: pass
            try: p = p.parent()
            except Exception: break
    except Exception: pass
    _ancestor_paths, _ancestor_names = paths, names
    _protected_pids = _find_protected_pids()


def _find_protected_pids() -> set[int]:
    """Return PIDs that strict mode must never kill: backend server + any FocusTimer process."""
    protected: set[int] = set()
    backend_port = _parse_backend_port()
    for proc in psutil.process_iter(["pid", "name"]):
        try:
            pid  = proc.info["pid"]
            name = (proc.info["name"] or "").lower()
            if "focustimer" in name:
                protected.add(pid)
                continue
            if backend_port:
                for conn in proc.connections(kind="tcp"):
                    if conn.laddr.port == backend_port and conn.status == "LISTEN":
                        protected.add(pid)
                        break
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
        except Exception:
            continue
    return protected


def _parse_backend_port() -> int | None:
    try:
        parsed = urlparse(S.backend_url)
        return parsed.port or (8080 if parsed.scheme == "http" else 443)
    except Exception:
        return None


def _is_allowed(name_lower: str, exe_lower: str | None, pid: int | None = None) -> bool:
    if pid and pid in _protected_pids:
        return True
    if not name_lower or name_lower in SYSTEM_WHITELIST:
        return True
    if name_lower in _ancestor_names or (exe_lower and exe_lower in _ancestor_paths):
        return True
    if exe_lower and exe_lower in S.whitelist:
        return True
    if name_lower in S.whitelist:
        return True
    # Auto-allow any browser when at least one domain is in the whitelist
    if name_lower in BROWSER_EXES and any(
        "\\" not in e and "/" not in e and "." in e for e in S.whitelist
    ):
        return True
    return False


def _minimize_proc_windows(pid: int) -> None:
    """Minimize all visible top-level windows owned by pid and track them for later restore."""
    global _minimized_hwnds
    if not _WIN32_AVAILABLE:
        return
    try:
        user32 = ctypes.windll.user32
        def _cb(hwnd, _):
            if not win32gui.IsWindowVisible(hwnd):
                return
            try:
                _, wpid = win32process.GetWindowThreadProcessId(hwnd)
                if wpid == pid:
                    user32.ShowWindow(hwnd, 6)  # SW_MINIMIZE
                    _minimized_hwnds.add(hwnd)
            except Exception:
                pass
        win32gui.EnumWindows(_cb, None)
    except Exception:
        pass


def _restore_minimized_windows() -> None:
    """Restore all windows that were minimized by the focus shield."""
    global _minimized_hwnds
    if not _WIN32_AVAILABLE or not _minimized_hwnds:
        _minimized_hwnds.clear()
        return
    user32 = ctypes.windll.user32
    for hwnd in list(_minimized_hwnds):
        try:
            if win32gui.IsWindow(hwnd):
                user32.ShowWindow(hwnd, 9)  # SW_RESTORE
        except Exception:
            pass
    _minimized_hwnds.clear()


def _strict_pass() -> None:
    for proc in psutil.process_iter(["pid", "name", "exe"]):
        try:
            info = proc.info
            if info["pid"] == own_pid:
                continue
            name = (info.get("name") or "").lower()
            exe  = info.get("exe")
            exe_lower = exe.lower().replace("/", "\\") if exe else None
            if _is_allowed(name, exe_lower, info["pid"]):
                continue
            _minimize_proc_windows(info["pid"])
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
        except Exception:
            continue


def _soft_pass() -> None:
    global _minimized_hwnds
    if not _WIN32_AVAILABLE:
        return
    try:
        user32 = ctypes.windll.user32
        hwnd   = user32.GetForegroundWindow()
        if not hwnd:
            return
        pid = ctypes.c_ulong()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        p    = psutil.Process(pid.value)
        name = (p.name() or "").lower()
        try: exe = p.exe()
        except Exception: exe = None
        exe_lower = exe.lower().replace("/", "\\") if exe else None
        if pid.value == own_pid or _is_allowed(name, exe_lower):
            return
        user32.ShowWindow(hwnd, 6)  # SW_MINIMIZE
        _minimized_hwnds.add(hwnd)
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        pass

# ─────────────────────────── backend sync ─────────────────────────────────────

_backend_token: str | None = None


def _backend_auth() -> bool:
    global _backend_token
    if not _REQUESTS_AVAILABLE or not S.backend_username:
        return False
    try:
        r = _requests.post(f"{S.backend_url}/api/auth/login",
                           json={"username": S.backend_username,
                                 "password": S.backend_password},
                           timeout=5)
        if r.status_code == 200:
            _backend_token = r.json().get("token")
            return True
    except Exception as e:
        print(f"[backend] auth failed: {e}")
    return False


def backend_push() -> None:
    if not _REQUESTS_AVAILABLE:
        return
    state = S.session_state
    if state == "active":
        remaining = max(0, int(S.session_end_time - time.time()))
    elif state == "paused":
        remaining = int(S.paused_remaining)
    else:
        remaining = 0

    def _push():
        global _backend_token
        if not _backend_token and not _backend_auth():
            return
        try:
            r = _requests.post(
                f"{S.backend_url}/api/focus/status",
                headers={"Authorization": f"Bearer {_backend_token}"},
                json={"sessionState": state, "remainingSeconds": remaining,
                      "totalSeconds": S.session_total_seconds, "xpTotal": S.xp_total},
                timeout=5)
            if r.status_code == 401:
                _backend_token = None
        except Exception as e:
            print(f"[backend] push failed: {e}")

    threading.Thread(target=_push, daemon=True).start()


def _backend_heartbeat_loop() -> None:
    while True:
        time.sleep(30)
        backend_push()

# ─────────────────────────── HTTP API ─────────────────────────────────────────

class FocusAPIHandler(BaseHTTPRequestHandler):
    def log_message(self, *_): pass  # silence access log

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Focus-Token")

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path == "/status":
            now = time.time()
            with _lock:
                S.temp_whitelist = {k: v for k, v in S.temp_whitelist.items() if v > now}

            state = S.session_state
            if state in ("active", "paused"):
                remaining = max(0, int(S.session_end_time - now)) if state == "active" else int(S.paused_remaining)
                allowed = [e for e in S.whitelist if "\\" not in e and "/" not in e and "." in e]
                allowed.extend(S.temp_whitelist.keys())
                payload = {
                    "active": True, "paused": state == "paused",
                    "remaining_seconds": remaining,
                    "total_seconds": S.session_total_seconds,
                    "mode": S.mode, "streak": S.streak,
                    "xp_total": S.xp_total, "session_xp": S.session_xp_earned,
                    "whitelist": allowed, "token": _API_TOKEN,
                    "reset_tabs": (now - _reset_tabs_at) < 10,
                }
            else:
                payload = {
                    "active": False, "paused": False,
                    "remaining_seconds": 0, "total_seconds": 0,
                    "mode": S.mode, "streak": S.streak,
                    "xp_total": S.xp_total, "session_xp": 0,
                    "whitelist": [], "token": _API_TOKEN,
                    "reset_tabs": (now - _reset_tabs_at) < 10,
                }

            body = json.dumps(payload).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self._cors()
            self.end_headers()
            self.wfile.write(body)

        elif self.path == "/whitelist":
            self._json_response({"whitelist": S.whitelist})

        elif self.path == "/running-apps":
            apps: list[dict] = []
            seen: set[str] = set()
            for proc in psutil.process_iter(["pid", "name", "exe"]):
                try:
                    info = proc.info
                    if info["pid"] == own_pid:
                        continue
                    name = info.get("name")
                    if not name or name.lower() in SYSTEM_WHITELIST:
                        continue
                    exe = info.get("exe")
                    key = exe.lower().replace("/", "\\") if exe else name.lower()
                    if key in seen:
                        continue
                    seen.add(key)
                    display = resolve_app_name(exe or "", name)
                    win_title = get_window_title(exe) if exe else None
                    if win_title:
                        suffix = win_title
                        if display.lower() in win_title.lower():
                            pos = win_title.lower().rfind(display.lower())
                            suffix = win_title[pos + len(display):].strip(" –-|·")
                        if suffix and len(suffix) > 2:
                            display = f"{display}  —  {suffix[:40]}"
                    apps.append({"name": display, "key": key, "exe": exe or ""})
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
                except Exception:
                    continue
            apps.sort(key=lambda x: x["name"].lower())
            self._json_response({"apps": apps})

        else:
            self.send_response(404); self.end_headers()

    def _read_body(self) -> dict:
        length = int(self.headers.get("Content-Length", 0))
        if length > 0:
            try: return json.loads(self.rfile.read(length).decode())
            except Exception: pass
        return {}

    def _check_token(self) -> bool:
        return secrets.compare_digest(self.headers.get("X-Focus-Token", ""), _API_TOKEN)

    def _json_response(self, data: dict, status: int = 200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        body = self._read_body()

        if self.path == "/start":
            minutes = int(body.get("minutes", 25))
            mode    = body.get("mode", "strict")
            result  = start_session(minutes * 60, mode)
            self._json_response(result)

        elif self.path == "/stop":
            result = stop_session(aborted=body.get("aborted", False))
            self._json_response(result)

        elif self.path == "/pause":
            if not self._check_token():
                self._json_response({"error": "forbidden"}, 403); return
            result = toggle_pause()
            self._json_response(result)

        elif self.path == "/bypass":
            if not self._check_token():
                self._json_response({"error": "forbidden"}, 403); return
            domain = body.get("domain", "").lower().strip()
            if domain:
                with _lock:
                    S.temp_whitelist[domain] = time.time() + 120
            self._json_response({"ok": True})

        elif self.path == "/whitelist/add":
            entry = body.get("entry", "").lower().strip()
            if entry and entry not in S.whitelist:
                S.whitelist.append(entry)
                # Auto-add the running browser when a domain is whitelisted
                if "\\" not in entry and "/" not in entry and "." in entry:
                    browser = _detect_running_browser()
                    if browser and browser not in S.whitelist:
                        S.whitelist.append(browser)
                save_config()
            self._json_response({"ok": True, "whitelist": S.whitelist})

        elif self.path == "/whitelist/remove":
            entry = body.get("entry", "").lower().strip()
            if entry in S.whitelist:
                S.whitelist.remove(entry)
                save_config()
            self._json_response({"ok": True, "whitelist": S.whitelist})

        else:
            self.send_response(404); self.end_headers()

# ─────────────────────────── entry point ──────────────────────────────────────

def main() -> None:
    load_config()
    print(f"[sidecar] config loaded — xp={S.xp_total}  streak={S.streak}")

    if S.backend_username:
        _backend_auth()
        threading.Thread(target=_backend_heartbeat_loop, daemon=True).start()

    server = HTTPServer(("127.0.0.1", API_PORT), FocusAPIHandler)
    print(f"[sidecar] listening on http://127.0.0.1:{API_PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("[sidecar] shutting down")
        server.shutdown()


if __name__ == "__main__":
    main()
