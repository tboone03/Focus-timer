import ctypes
import json
import math
import os
import subprocess
import sys
import threading
import time
from datetime import datetime, date
from pathlib import Path
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

import tkinter as tk
from tkinter import filedialog, messagebox

try:
    import customtkinter as ctk
except ImportError:
    print("This app requires customtkinter. Install:  pip install customtkinter")
    sys.exit(1)

import psutil



_TIMER_INSTANCE = None

class FocusAPIHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        return 
        
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path == "/status":
            global _TIMER_INSTANCE
            if _TIMER_INSTANCE:
                _TIMER_INSTANCE.last_ext_sync = time.time()

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()

            if _TIMER_INSTANCE and _TIMER_INSTANCE.session_state == "active":
                allowed_domains = [
                    entry.strip().lower() for entry in _TIMER_INSTANCE.whitelist 
                    if "\\" not in entry and "/" not in entry and "." in entry
                ]
                
                allowed_domains.extend(["toledo", "login", "microsoftonline", "google", "kuleuven"])
                
                now = time.time()
                _TIMER_INSTANCE.temp_whitelist = {k: v for k, v in _TIMER_INSTANCE.temp_whitelist.items() if v > now}
                allowed_domains.extend(_TIMER_INSTANCE.temp_whitelist.keys())

                response_data = {
                    "active": True,
                    "whitelist": allowed_domains
                }
            else:
                response_data = {"active": False, "whitelist": []}

            self.wfile.write(json.dumps(response_data).encode("utf-8"))

    def do_POST(self):
        if self.path == "/bypass":
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > 0:
                try:
                    post_data = self.rfile.read(content_length)
                    data = json.loads(post_data.decode("utf-8"))
                    domain = data.get("domain", "").lower()
                    global _TIMER_INSTANCE
                    if _TIMER_INSTANCE and domain:
                        _TIMER_INSTANCE.temp_whitelist[domain] = time.time() + 120
                except Exception as e:
                    print("Bypass error:", e)

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"success": True}).encode("utf-8"))

def start_local_api_server():
    try:
        server = HTTPServer(("127.0.0.1", 54321), FocusAPIHandler)
        server.serve_forever()
    except Exception as e:
        print(f"API Server failed to start: {e}")


BG          = "#2a1f15"
BG_DARK     = "#1f1610"
CARD        = "#3a2c1e"
CARD_HOVER  = "#4a3826"
CARD_SOFT   = "#473627"
BORDER      = "#4a3a2a"
TEXT        = "#f5e7d3"
TEXT_DIM    = "#b89e7c"
TEXT_MUTED  = "#8a7560"
AMBER       = "#e8b855"
AMBER_HOVER = "#f0c570"
AMBER_DEEP  = "#a87a2c"
AMBER_GLOW  = "#d4a043"
FLAME       = "#e88b3a"
DANGER      = "#c95450"
DANGER_HOV  = "#b04643"

AVATAR_COLORS = ["#4a8edb", "#8b5cf6", "#e25a5a", "#10b981",
                 "#f59e0b", "#ec4899", "#06b6d4", "#84cc16"]

LEVEL_NAMES = ["Beginner", "Apprentice", "Student", "Scholar",
               "Sage", "Master", "Grandmaster", "Luminary", "Legend"]
XP_PER_LEVEL = 500

CONFIG_FILE = Path.home() / ".focus_timer_config.json"

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
}

FRIENDLY = {
    "winword.exe": "Microsoft Word", "excel.exe": "Microsoft Excel",
    "powerpnt.exe": "Microsoft PowerPoint", "outlook.exe": "Microsoft Outlook",
    "onenote.exe": "Microsoft OneNote", "code.exe": "VS Code",
    "devenv.exe": "Visual Studio", "chrome.exe": "Google Chrome",
    "firefox.exe": "Mozilla Firefox", "msedge.exe": "Microsoft Edge",
    "brave.exe": "Brave", "discord.exe": "Discord", "spotify.exe": "Spotify",
    "steam.exe": "Steam", "vlc.exe": "VLC", "notepad.exe": "Notepad",
    "notepad++.exe": "Notepad++", "obs64.exe": "OBS Studio",
    "teams.exe": "Microsoft Teams", "ms-teams.exe": "Microsoft Teams",
    "slack.exe": "Slack", "zoom.exe": "Zoom", "winrar.exe": "WinRAR",
    "acrord32.exe": "Adobe Reader", "acrobat.exe": "Adobe Acrobat",
    "photoshop.exe": "Photoshop", "illustrator.exe": "Illustrator",
    "figma.exe": "Figma", "notion.exe": "Notion", "obsidian.exe": "Obsidian",
    "zotero.exe": "Zotero", "telegram.exe": "Telegram",
    "whatsapp.exe": "WhatsApp",
}

ABORT_HOLD_SECONDS = 3.0
NOTIFY_COOLDOWN_SECONDS = 30
TOAST_DURATION_MS = 4000


def pretty_name(path_or_name):
    if not path_or_name:
        return ""
    if "\\" not in path_or_name and "/" not in path_or_name and "." in path_or_name:
        parts = path_or_name.split('.')
        if len(parts) >= 2:
            if parts[0] == "www":
                parts.pop(0)
            main_parts = parts[:-1] if len(parts) > 1 else parts
            return " ".join([p.capitalize() for p in main_parts])
        return path_or_name.lower()
        
    base = Path(path_or_name).name.lower()
    if base in FRIENDLY:
        return FRIENDLY[base]
    stem = Path(path_or_name).stem.replace("_", " ").replace("-", " ")
    return (stem[:1].upper() + stem[1:]) if stem else path_or_name


def avatar_color_for(text):
    if not text:
        return AVATAR_COLORS[0]
    return AVATAR_COLORS[ord(text[0].lower()) % len(AVATAR_COLORS)]


def time_of_day():
    h = datetime.now().hour
    if 5 <= h < 8:   return "early light"
    if 8 <= h < 12:  return "morning"
    if 12 <= h < 14: return "midday"
    if 14 <= h < 17: return "afternoon"
    if 17 <= h < 19: return "golden hour"
    if 19 <= h < 22: return "evening"
    return "night"


def level_info(total_xp):
    lvl = total_xp // XP_PER_LEVEL + 1
    cur = total_xp % XP_PER_LEVEL
    name = LEVEL_NAMES[min(lvl - 1, len(LEVEL_NAMES) - 1)]
    return lvl, cur, XP_PER_LEVEL, name


def make_avatar(parent, letter, color, bg, size=30):
    c = tk.Canvas(parent, width=size, height=size, bg=bg,
                  highlightthickness=0, borderwidth=0)
    c.create_oval(2, 2, size - 2, size - 2, fill=color, outline="")
    c.create_text(size / 2, size / 2 + 1, text=(letter or "?").upper(),
                  fill="white",
                  font=("Segoe UI", int(size * 0.46), "bold"))
    return c


def draw_window(canvas, w, h, label):
    canvas.delete("all")
    sky_top, sky_mid = "#f0d4a8", "#f5e5b5"
    canvas.create_rectangle(0, 0, w, h * 0.55, fill=sky_top, outline="")
    canvas.create_rectangle(0, h * 0.45, w, h * 0.72, fill=sky_mid, outline="")
    sun_r = h * 0.12
    canvas.create_oval(w * 0.62 - sun_r, h * 0.18 - sun_r,
                       w * 0.62 + sun_r, h * 0.18 + sun_r,
                       fill="#fff5d0", outline="")
    canvas.create_oval(-w * 0.2, h * 0.45, w * 0.6, h * 0.95,
                       fill="#7a9560", outline="")
    canvas.create_oval(w * 0.35, h * 0.5, w * 1.15, h * 0.95,
                       fill="#8eaa6c", outline="")
    canvas.create_rectangle(0, h * 0.72, w, h, fill="#7a9560", outline="")
    fc = "#5a4530"
    canvas.create_rectangle(0, 0, w, h, outline=fc, width=3)
    canvas.create_line(w / 2, 0, w / 2, h, fill=fc, width=2)
    canvas.create_line(0, h / 2, w, h / 2, fill=fc, width=2)


def draw_lamp(canvas, cx, top_y):
    canvas.delete("all")
    canvas.create_line(cx, top_y, cx, top_y + 22, fill="#5a4530", width=2)
    sw1, sw2, sh = 18, 42, 20
    sy = top_y + 22
    canvas.create_polygon(
        cx - sw1 / 2, sy, cx + sw1 / 2, sy,
        cx + sw2 / 2, sy + sh, cx - sw2 / 2, sy + sh,
        fill="#5a4530", outline="")
    by = sy + sh - 1
    canvas.create_oval(cx - 7, by - 2, cx + 7, by + 10,
                       fill="#ffd87a", outline="")
    canvas.create_oval(cx - 3, by, cx + 3, by + 6,
                       fill="#ffe9a8", outline="")


class CircularProgress(tk.Canvas):
    def __init__(self, parent, size=300, bg=BG):
        super().__init__(parent, width=size, height=size, bg=bg,
                         highlightthickness=0, borderwidth=0)
        self.size = size
        self.progress = 0.0
        self._draw()

    def set_progress(self, p):
        self.progress = max(0.0, min(1.0, p))
        self._draw()

    def _draw(self):
        self.delete("all")
        s, pad = self.size, 14
        self.create_oval(pad, pad, s - pad, s - pad,
                         outline=BORDER, width=2)
        if self.progress <= 0:
            return
        extent = -self.progress * 359.999
        self.create_arc(pad, pad, s - pad, s - pad,
                        start=90, extent=extent,
                        outline=AMBER, width=6, style="arc")
        ang = math.radians(90 + extent)
        r_ring = (s - 2 * pad) / 2
        cx = s / 2 + r_ring * math.cos(ang)
        cy = s / 2 - r_ring * math.sin(ang)
        r = 9
        self.create_oval(cx - r, cy - r, cx + r, cy + r,
                         fill=AMBER_HOVER, outline="")



class FocusTimer:
    def __init__(self):
        ctk.set_appearance_mode("dark")
        self.root = ctk.CTk()
        self.root.title("Focus Timer")
        self.root.geometry("900x600")
        self.root.minsize(860, 580)
        self.root.configure(fg_color=BG)

        global _TIMER_INSTANCE
        _TIMER_INSTANCE = self
        threading.Thread(target=start_local_api_server, daemon=True).start()

        self.whitelist = []
        self.mode = "strict"
        self.streak = 0
        self.last_session_date = None
        self.xp_total = 0
        self.presets = [["25m", "pomodoro", 0, 25],
                        ["1h", "deep work", 1, 0],
                        ["2h", "marathon", 2, 0]]

        self.session_state = "idle" 
        self.session_end_time = None
        self.session_total_seconds = 0
        self.session_xp_earned = 0
        self.session_xp_baseline = 0
        self.paused_remaining = None
        
        self.temp_whitelist = {}
        self.last_ext_sync = 0

        self.own_pid = os.getpid()
        self._ancestor_paths = set()
        self._ancestor_names = set()
        self._abort_hold_start = None
        self._abort_after_id = None
        self._last_notified = {}
        self._active_toasts = []

        self.load_config()
        self._build_root_ui()
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)

    def load_config(self):
        if CONFIG_FILE.exists():
            try:
                with open(CONFIG_FILE) as f:
                    data = json.load(f)
                self.whitelist = [p.lower() for p in data.get("whitelist", [])]
                self.mode = data.get("mode", "strict")
                if self.mode not in ("strict", "soft"):
                    self.mode = "strict"
                self.streak = int(data.get("streak", 0))
                self.xp_total = int(data.get("xp_total", 0))
                if "presets" in data:
                    self.presets = data["presets"]
                lsd = data.get("last_session_date")
                if lsd:
                    try:
                        self.last_session_date = date.fromisoformat(lsd)
                    except Exception:
                        self.last_session_date = None
            except Exception:
                pass
        if self.last_session_date is not None:
            gap = (date.today() - self.last_session_date).days
            if gap > 1:
                self.streak = 0

    def save_config(self):
        try:
            with open(CONFIG_FILE, "w") as f:
                json.dump({
                    "whitelist": self.whitelist,
                    "mode": self.mode,
                    "streak": self.streak,
                    "xp_total": self.xp_total,
                    "presets": self.presets,
                    "last_session_date":
                        self.last_session_date.isoformat()
                        if self.last_session_date else None,
                }, f, indent=2)
        except Exception as e:
            messagebox.showerror("Config error", f"Could not save config:\n{e}")

    def _build_root_ui(self):
        self.setup_frame = ctk.CTkFrame(self.root, fg_color=BG)
        self.session_frame = ctk.CTkFrame(self.root, fg_color=BG)
        self._build_setup_ui()
        self._build_session_ui()
        self._show_setup()

    def _show_setup(self):
        self.session_frame.pack_forget()
        self.setup_frame.pack(fill="both", expand=True)
        self._refresh_setup_dynamic()

    def _show_session(self):
        self.setup_frame.pack_forget()
        self.session_frame.pack(fill="both", expand=True)
        self._refresh_session_dynamic()

    def _build_setup_ui(self):
        root = self.setup_frame

        sidebar = ctk.CTkFrame(root, fg_color="transparent", width=330)
        sidebar.pack(side="left", fill="both", padx=(22, 8), pady=20)
        sidebar.pack_propagate(False)

        main = ctk.CTkFrame(root, fg_color="transparent")
        main.pack(side="left", fill="both", expand=True, padx=(8, 22), pady=20)

        ctk.CTkLabel(sidebar, text="Focus Timer",
                     font=("Segoe UI Variable Display", 22, "bold"),
                     text_color=TEXT, anchor="w").pack(fill="x")
        ctk.CTkLabel(sidebar, text="Pull up a chair. Light's on.",
                     font=("Segoe UI", 11, "italic"),
                     text_color=TEXT_DIM, anchor="w").pack(fill="x")
                     
        self.ext_status_frame = ctk.CTkFrame(sidebar, fg_color="transparent")
        self.ext_status_frame.pack(fill="x", pady=(0, 14))
        self.ext_dot = tk.Canvas(self.ext_status_frame, width=10, height=10, bg=BG, highlightthickness=0, borderwidth=0)
        self.ext_dot.pack(side="left", padx=(0, 6))
        self.ext_dot.create_oval(1, 1, 9, 9, fill=DANGER, outline="", tags="dot")
        self.ext_label = ctk.CTkLabel(self.ext_status_frame, text="Extension Disconnected", font=("Segoe UI", 10, "italic"), text_color=TEXT_MUTED)
        self.ext_label.pack(side="left")
        self._check_connection_loop()

        apps_header = ctk.CTkFrame(sidebar, fg_color="transparent")
        apps_header.pack(fill="x")
        ctk.CTkLabel(apps_header, text="ALLOWED APPS & SITES",
                     font=("Segoe UI", 10, "bold"),
                     text_color=TEXT_MUTED, anchor="w").pack(side="left")
        self.lit_label = ctk.CTkLabel(
            apps_header, text="", font=("Segoe UI", 10),
            text_color=TEXT_MUTED, anchor="e")
        self.lit_label.pack(side="right")

        self.apps_scroll = ctk.CTkScrollableFrame(
            sidebar, fg_color="transparent", corner_radius=0, height=160,
            scrollbar_button_color=AMBER_DEEP,
            scrollbar_button_hover_color=AMBER,
        )
        self.apps_scroll.pack(fill="both", expand=True, pady=(8, 8))

        btn_row = ctk.CTkFrame(sidebar, fg_color="transparent")
        btn_row.pack(fill="x", pady=(0, 16))
        
        self.btn_add = ctk.CTkButton(
            btn_row, text="📄 File", command=self.add_app,
            fg_color=CARD, hover_color=CARD_HOVER, text_color=TEXT,
            font=("Segoe UI", 11, "bold"), height=34, corner_radius=8,
            border_width=1, border_color=BORDER, width=80
        )
        self.btn_add.pack(side="left", padx=(0, 4), fill="x", expand=True)
        
        self.btn_add_running = ctk.CTkButton(
            btn_row, text="📋 App", command=self.add_running_app,
            fg_color=CARD, hover_color=CARD_HOVER, text_color=TEXT,
            font=("Segoe UI", 11, "bold"), height=34, corner_radius=8,
            border_width=1, border_color=BORDER, width=80
        )
        self.btn_add_running.pack(side="left", padx=(0, 4), fill="x", expand=True)

        self.btn_add_web = ctk.CTkButton(
            btn_row, text="🌐 Web", command=self.add_web,
            fg_color=CARD, hover_color=CARD_HOVER, text_color=TEXT,
            font=("Segoe UI", 11, "bold"), height=34, corner_radius=8,
            border_width=1, border_color=BORDER, width=80
        )
        self.btn_add_web.pack(side="left", fill="x", expand=True)

        ctk.CTkLabel(sidebar, text="MODE",
                     font=("Segoe UI", 10, "bold"),
                     text_color=TEXT_MUTED, anchor="w").pack(fill="x")
        mode_row = ctk.CTkFrame(sidebar, fg_color="transparent")
        mode_row.pack(fill="x", pady=(6, 16))
        self.mode_strict_btn = ctk.CTkButton(
            mode_row, text="🔒  Strict",
            command=lambda: self._set_mode("strict"),
            font=("Segoe UI", 11, "bold"), height=36, corner_radius=8,
        )
        self.mode_strict_btn.pack(side="left", padx=(0, 6), fill="x", expand=True)
        self.mode_soft_btn = ctk.CTkButton(
            mode_row, text="🔔  Soft",
            command=lambda: self._set_mode("soft"),
            font=("Segoe UI", 11, "bold"), height=36, corner_radius=8,
        )
        self.mode_soft_btn.pack(side="left", fill="x", expand=True)

        ctk.CTkLabel(sidebar, text="DURATION",
                     font=("Segoe UI", 10, "bold"),
                     text_color=TEXT_MUTED, anchor="w").pack(fill="x")
        preset_row = ctk.CTkFrame(sidebar, fg_color="transparent")
        preset_row.pack(fill="x", pady=(6, 0))
        self.preset_buttons = []
        for i, (label, sub, h, m) in enumerate(self.presets):
            card = ctk.CTkFrame(
                preset_row, fg_color=CARD, border_width=1,
                border_color=BORDER, corner_radius=8, height=70,
                cursor="hand2",
            )
            card.pack(side="left",
                      padx=(0, 6) if i < len(self.presets) - 1 else 0,
                      fill="x", expand=True)
            card.pack_propagate(False)

            top_l = ctk.CTkLabel(card, text=label,
                                 font=("Segoe UI", 16, "bold"),
                                 text_color=TEXT)
            top_l.pack(pady=(8, 0))
            sub_l = ctk.CTkLabel(card, text=sub,
                                 font=("Segoe UI", 9, "italic"),
                                 text_color=TEXT_DIM)
            sub_l.pack()

            for w in (card, top_l, sub_l):
                w.bind("<Button-1>", lambda e, h=h, m=m, c=card: self._set_preset(h, m, c))
                w.bind("<Button-3>", lambda e, idx=i: self._save_preset(idx))
                w.bind("<Button-2>", lambda e, idx=i: self._save_preset(idx))

            self.preset_buttons.append((card, top_l, sub_l, h, m))

        custom_row = ctk.CTkFrame(sidebar, fg_color="transparent")
        custom_row.pack(fill="x", pady=(8, 0))
        ctk.CTkLabel(custom_row, text="or", font=("Segoe UI", 10, "italic"),
                     text_color=TEXT_MUTED).pack(side="left", padx=(0, 6))
        self.hours_var = tk.StringVar(value="0")
        self.minutes_var = tk.StringVar(value="25")
        self.hours_entry = ctk.CTkEntry(
            custom_row, textvariable=self.hours_var, width=36, height=26,
            font=("Segoe UI", 10), justify="center",
            fg_color=BG_DARK, border_color=BORDER, text_color=TEXT,
        )
        self.hours_entry.pack(side="left")
        ctk.CTkLabel(custom_row, text="h", font=("Segoe UI", 10),
                     text_color=TEXT_DIM).pack(side="left", padx=(3, 8))
        self.minutes_entry = ctk.CTkEntry(
            custom_row, textvariable=self.minutes_var, width=36, height=26,
            font=("Segoe UI", 10), justify="center",
            fg_color=BG_DARK, border_color=BORDER, text_color=TEXT,
        )
        self.minutes_entry.pack(side="left")
        ctk.CTkLabel(custom_row, text="m", font=("Segoe UI", 10),
                     text_color=TEXT_DIM).pack(side="left", padx=(3, 0))

        top_row = ctk.CTkFrame(main, fg_color="transparent")
        top_row.pack(fill="x")

        self.streak_pill = self._make_pill(top_row, "🔥  0 day streak", color=FLAME)
        self.streak_pill.pack(side="left")

        self.window_canvas = tk.Canvas(top_row, width=120, height=80, bg=BG,
                                       highlightthickness=0, borderwidth=0)
        self.window_canvas.pack(side="right")
        self.window_caption = ctk.CTkLabel(top_row, text="",
                                           font=("Segoe UI", 10, "italic"),
                                           text_color=TEXT_DIM)
        self.window_caption.pack(side="right", padx=(0, 6))

        center = ctk.CTkFrame(main, fg_color="transparent")
        center.pack(fill="both", expand=True, pady=(8, 0))

        self.lamp_canvas = tk.Canvas(center, width=60, height=70, bg=BG,
                                     highlightthickness=0, borderwidth=0)
        self.lamp_canvas.pack(pady=(6, 0))

        self.setup_time = ctk.CTkLabel(center, text="00:25:00",
                                       font=("Consolas", 56, "bold"),
                                       text_color=TEXT)
        self.setup_time.pack(pady=(2, 0))

        self.setup_tagline = ctk.CTkLabel(center, text="ready when you are",
                                          font=("Segoe UI", 12, "italic"),
                                          text_color=TEXT_DIM)
        self.setup_tagline.pack(pady=(2, 14))

        self.start_button = ctk.CTkButton(
            center, text="▶  Start focus session", command=self.start_session,
            fg_color=AMBER, hover_color=AMBER_HOVER, text_color="#3a2410",
            font=("Segoe UI", 14, "bold"), height=48, corner_radius=24,
            width=260,
        )
        self.start_button.pack()

        bottom = ctk.CTkFrame(main, fg_color="transparent")
        bottom.pack(fill="x", side="bottom", pady=(8, 0))

        info_row = ctk.CTkFrame(bottom, fg_color="transparent")
        info_row.pack(fill="x")
        self.level_label = ctk.CTkLabel(
            info_row, text="", font=("Segoe UI", 11, "italic"),
            text_color=TEXT_DIM, anchor="w")
        self.level_label.pack(side="left")
        self.xp_label = ctk.CTkLabel(
            info_row, text="", font=("Segoe UI", 10),
            text_color=TEXT_MUTED, anchor="e")
        self.xp_label.pack(side="right")

        self.xp_bar = ctk.CTkProgressBar(
            bottom, height=6, fg_color=CARD,
            progress_color=AMBER, corner_radius=3)
        self.xp_bar.pack(fill="x", pady=(4, 0))

        self.hours_var.trace_add("write", lambda *_: self._update_idle_countdown())
        self.minutes_var.trace_add("write", lambda *_: self._update_idle_countdown())

        self._select_preset_card(self.preset_buttons[0][0])
        self._refresh_apps_list_sidebar()
        self._refresh_mode_ui()

    def _check_connection_loop(self):
        is_connected = (time.time() - self.last_ext_sync) < 3.0
        self.ext_dot.delete("all")
        color = "#10b981" if is_connected else DANGER
        text = "Extension Connected" if is_connected else "Extension Disconnected"
        self.ext_dot.create_oval(1, 1, 9, 9, fill=color, outline="")
        self.ext_label.configure(text=text)
        self.root.after(1500, self._check_connection_loop)

    def _make_pill(self, parent, text, color):
        f = ctk.CTkFrame(parent, fg_color=CARD, corner_radius=14,
                         border_width=1, border_color=BORDER, height=30)
        f.pack_propagate(False)
        ctk.CTkLabel(f, text=text, font=("Segoe UI", 11, "bold"),
                     text_color=color).pack(padx=14, pady=4)
        return f

    def _refresh_setup_dynamic(self):
        for w in self.streak_pill.winfo_children():
            w.destroy()
        ctk.CTkLabel(self.streak_pill,
                     text=f"🔥  {self.streak} day streak",
                     font=("Segoe UI", 11, "bold"),
                     text_color=FLAME).pack(padx=14, pady=4)

        draw_window(self.window_canvas, 120, 80, time_of_day())
        self.window_caption.configure(text=time_of_day())
        draw_lamp(self.lamp_canvas, 30, 4)

        lvl, cur, full, name = level_info(self.xp_total)
        self.level_label.configure(text=f"Level {lvl} · Focus {name}")
        self.xp_label.configure(text=f"{cur}/{full} XP")
        self.xp_bar.set(cur / full)

        self._refresh_apps_list_sidebar()
        self._update_idle_countdown()
        self._refresh_mode_ui()

    def _refresh_apps_list_sidebar(self):
        for w in self.apps_scroll.winfo_children():
            w.destroy()
        n = len(self.whitelist)
        self.lit_label.configure(
            text=f"{n} lit · rest dark" if n else "all dark")

        if not self.whitelist:
            ctk.CTkLabel(self.apps_scroll,
                         text="No apps or sites yet.\nAdd some below.",
                         font=("Segoe UI", 10, "italic"),
                         text_color=TEXT_MUTED).pack(pady=18)
            return

        for entry in self.whitelist:
            name = pretty_name(entry)
            row = ctk.CTkFrame(self.apps_scroll, fg_color=CARD_SOFT,
                               corner_radius=8, height=40)
            row.pack(fill="x", pady=3, padx=2)
            row.pack_propagate(False)

            av = make_avatar(row, name[:1], avatar_color_for(name),
                             bg=CARD_SOFT, size=26)
            av.pack(side="left", padx=(10, 10))

            ctk.CTkLabel(row, text=name, font=("Segoe UI", 11, "bold"),
                         text_color=TEXT, anchor="w").pack(
                side="left", fill="x", expand=True)

            dot = tk.Canvas(row, width=12, height=12, bg=CARD_SOFT,
                            highlightthickness=0, borderwidth=0)
            dot.create_oval(2, 2, 10, 10, fill=AMBER, outline="")
            dot.pack(side="right", padx=(0, 8))

            del_btn = ctk.CTkButton(
                row, text="✕", width=22, height=20, corner_radius=4,
                fg_color="transparent", hover_color=DANGER,
                text_color=TEXT_MUTED, font=("Segoe UI", 10, "bold"),
                command=lambda e=entry: self._remove_entry(e),
            )
            del_btn.pack(side="right", padx=(0, 4))

    def _build_session_ui(self):
        root = self.session_frame

        top = ctk.CTkFrame(root, fg_color="transparent")
        top.pack(fill="x", padx=22, pady=(18, 0))

        left_pills = ctk.CTkFrame(top, fg_color="transparent")
        left_pills.pack(side="left")
        self.sess_streak_pill = self._make_pill(left_pills, "🔥  0 day streak", FLAME)
        self.sess_streak_pill.pack(anchor="w")
        self.sess_xp_pill = self._make_pill(left_pills, "⭐  +0 XP earned", AMBER)
        self.sess_xp_pill.pack(anchor="w", pady=(6, 0))

        right_win = ctk.CTkFrame(top, fg_color="transparent")
        right_win.pack(side="right")
        self.sess_window_canvas = tk.Canvas(right_win, width=120, height=80,
                                            bg=BG, highlightthickness=0,
                                            borderwidth=0)
        self.sess_window_canvas.pack()
        self.sess_window_caption = ctk.CTkLabel(
            right_win, text="", font=("Segoe UI", 10, "italic"),
            text_color=TEXT_DIM)
        self.sess_window_caption.pack()

        center = ctk.CTkFrame(root, fg_color="transparent")
        center.pack(fill="both", expand=True)

        ring_holder = ctk.CTkFrame(center, fg_color="transparent")
        ring_holder.pack(pady=(4, 0))
        self.ring = CircularProgress(ring_holder, size=290, bg=BG)
        self.ring.grid(row=0, column=0)
        inner = ctk.CTkFrame(ring_holder, fg_color="transparent")
        inner.grid(row=0, column=0)
        self.sess_time = ctk.CTkLabel(inner, text="00:00:00",
                                      font=("Consolas", 38, "bold"),
                                      text_color=TEXT)
        self.sess_time.pack(pady=(96, 0))
        self.sess_pct = ctk.CTkLabel(inner, text="",
                                     font=("Segoe UI", 10, "bold"),
                                     text_color=TEXT_DIM)
        self.sess_pct.pack()

        self.sess_status = ctk.CTkLabel(
            center, text="you're in the zone — keep going",
            font=("Segoe UI", 13, "italic"),
            text_color=TEXT_DIM)
        self.sess_status.pack(pady=(10, 8))

        btn_row = ctk.CTkFrame(center, fg_color="transparent")
        btn_row.pack(pady=(0, 8))
        self.pause_button = ctk.CTkButton(
            btn_row, text="❚❚  Pause", command=self._toggle_pause,
            fg_color=AMBER, hover_color=AMBER_HOVER, text_color="#3a2410",
            font=("Segoe UI", 12, "bold"), height=38, corner_radius=19,
            width=130,
        )
        self.pause_button.pack(side="left", padx=(0, 10))

        self.giveup_button = ctk.CTkButton(
            btn_row, text="Give up",
            fg_color=CARD, hover_color=CARD_HOVER, text_color=TEXT_DIM,
            font=("Segoe UI", 12, "bold"), height=38, corner_radius=19,
            width=130, border_width=1, border_color=BORDER,
            command=lambda: None,
        )
        self.giveup_button.pack(side="left")
        self.giveup_button.bind("<ButtonPress-1>", self._abort_press)
        self.giveup_button.bind("<ButtonRelease-1>", self._abort_release)
        self.giveup_button.bind("<Leave>", self._abort_release)

        bottom = ctk.CTkFrame(root, fg_color="transparent")
        bottom.pack(fill="x", side="bottom", padx=22, pady=(0, 22))
        ctk.CTkLabel(bottom,
                     text="STILL LIT  ·  EVERYTHING ELSE IS DARK",
                     font=("Segoe UI", 9, "bold"),
                     text_color=TEXT_MUTED).pack(pady=(0, 6))
        self.lit_row = ctk.CTkFrame(bottom, fg_color="transparent")
        self.lit_row.pack()

    def _refresh_session_dynamic(self):
        for w in self.sess_streak_pill.winfo_children():
            w.destroy()
        ctk.CTkLabel(self.sess_streak_pill,
                     text=f"🔥  {self.streak} day streak",
                     font=("Segoe UI", 11, "bold"),
                     text_color=FLAME).pack(padx=14, pady=4)
        for w in self.sess_xp_pill.winfo_children():
            w.destroy()
        ctk.CTkLabel(self.sess_xp_pill,
                     text=f"⭐  +{self.session_xp_earned} XP earned",
                     font=("Segoe UI", 11, "bold"),
                     text_color=AMBER).pack(padx=14, pady=4)

        draw_window(self.sess_window_canvas, 120, 80, time_of_day())
        self.sess_window_caption.configure(text=time_of_day())

        for w in self.lit_row.winfo_children():
            w.destroy()
        for entry in self.whitelist[:6]:
            name = pretty_name(entry)
            pill = ctk.CTkFrame(self.lit_row, fg_color=CARD,
                                corner_radius=14, height=30,
                                border_width=1, border_color=BORDER)
            pill.pack(side="left", padx=4)
            pill.pack_propagate(False)
            av = make_avatar(pill, name[:1], avatar_color_for(name),
                             bg=CARD, size=22)
            av.pack(side="left", padx=(6, 6), pady=4)
            ctk.CTkLabel(pill, text=name, font=("Segoe UI", 10, "bold"),
                         text_color=TEXT).pack(side="left", pady=4)
            dot = tk.Canvas(pill, width=10, height=10, bg=CARD,
                            highlightthickness=0, borderwidth=0)
            dot.create_oval(1, 1, 9, 9, fill=AMBER, outline="")
            dot.pack(side="left", padx=(6, 10), pady=4)

    def _set_mode(self, mode):
        if self.session_state != "idle":
            return
        self.mode = mode
        self.save_config()
        self._refresh_mode_ui()

    def _refresh_mode_ui(self):
        if self.mode == "strict":
            self.mode_strict_btn.configure(
                fg_color=AMBER_DEEP, hover_color=AMBER, text_color=TEXT,
                border_width=0)
            self.mode_soft_btn.configure(
                fg_color=CARD, hover_color=CARD_HOVER, text_color=TEXT_DIM,
                border_width=1, border_color=BORDER)
        else:
            self.mode_strict_btn.configure(
                fg_color=CARD, hover_color=CARD_HOVER, text_color=TEXT_DIM,
                border_width=1, border_color=BORDER)
            self.mode_soft_btn.configure(
                fg_color=AMBER_DEEP, hover_color=AMBER, text_color=TEXT,
                border_width=0)

    def _set_preset(self, hours, minutes, card_widget=None):
        if self.session_state != "idle":
            return
        self.hours_var.set(str(hours))
        self.minutes_var.set(str(minutes))
        if card_widget is not None:
            self._select_preset_card(card_widget)

    def _save_preset(self, index):
        if self.session_state != "idle": return
        h = max(0, min(24, self._parse_int(self.hours_var)))
        m = max(0, min(59, self._parse_int(self.minutes_var)))
        if h == 0 and m == 0:
            messagebox.showwarning("Invalid", "Duration must be greater than 0 to save.")
            return

        dialog = ctk.CTkInputDialog(text="Name this preset (e.g., 'Study'):", title="Save Preset")
        name = dialog.get_input()
        if not name: return

        label = f"{h}h" if h > 0 and m == 0 else f"{m}m" if h == 0 else f"{h}h {m}m"
        
        self.presets[index] = [label, name[:12], h, m]
        self.save_config()
        
        _card, top_l, sub_l, _old_h, _old_m = self.preset_buttons[index]
        top_l.configure(text=label)
        sub_l.configure(text=name[:12])
        self.preset_buttons[index] = (_card, top_l, sub_l, h, m)
        for w in (_card, top_l, sub_l):
            w.bind("<Button-1>", lambda e, nh=h, nm=m, c=_card: self._set_preset(nh, nm, c))

    def _select_preset_card(self, selected_card):
        for card, top_l, sub_l, _h, _m in self.preset_buttons:
            if card is selected_card:
                card.configure(fg_color=CARD_HOVER, border_color=AMBER)
                top_l.configure(text_color=AMBER)
            else:
                card.configure(fg_color=CARD, border_color=BORDER)
                top_l.configure(text_color=TEXT)

    def _parse_int(self, var, default=0):
        try:
            v = var.get().strip()
            return int(v) if v else default
        except (ValueError, tk.TclError):
            return default

    def _update_idle_countdown(self):
        if self.session_state != "idle":
            return
        h = max(0, min(24, self._parse_int(self.hours_var)))
        m = max(0, min(59, self._parse_int(self.minutes_var)))
        self.setup_time.configure(text=f"{h:02d}:{m:02d}:00", text_color=TEXT)
        if not any((h == ph and m == pm) for _c, _t, _s, ph, pm in self.preset_buttons):
            for card, _t, _s, _h, _m in self.preset_buttons:
                card.configure(fg_color=CARD, border_color=BORDER)
                _t.configure(text_color=TEXT)

    def _remove_entry(self, entry):
        if self.session_state != "idle":
            return
        if entry in self.whitelist:
            self.whitelist.remove(entry)
            self.save_config()
            self._refresh_apps_list_sidebar()

    def add_app(self):
        file = filedialog.askopenfilename(
            title="Pick an application to allow",
            filetypes=[("Executable files", "*.exe"), ("All files", "*.*")])
        if not file:
            return
        normalized = file.lower().replace("/", "\\")
        if normalized in self.whitelist:
            messagebox.showinfo("Already added", "That app is already on the list.")
            return
        self.whitelist.append(normalized)
        self.save_config()
        self._refresh_apps_list_sidebar()

    def add_web(self):
        dialog = ctk.CTkInputDialog(
            text="Enter a website domain or paste a full URL\n(e.g., toledo.kuleuven.be):", 
            title="Allow Website"
        )
        domain_input = dialog.get_input()
        if not domain_input:
            return
            
        domain_input = domain_input.strip().lower()
        
        if not domain_input.startswith(('http://', 'https://')):
            domain_input = 'http://' + domain_input
            
        parsed_url = urlparse(domain_input)
        clean_domain = parsed_url.netloc.replace("www.", "")
        
        if clean_domain in self.whitelist:
            messagebox.showinfo("Already added", "That website is already on the list.")
            return
            
        self.whitelist.append(clean_domain)

        if "chrome.exe" not in self.whitelist:
            self.whitelist.append("chrome.exe")
            messagebox.showinfo(
                "Browser Auto-Added", 
                "Google Chrome was automatically allowed so you can view this website."
            )
            
        self.save_config()
        self._refresh_apps_list_sidebar()

    def add_running_app(self):
        running = {}
        for proc in psutil.process_iter(["pid", "name", "exe"]):
            try:
                info = proc.info
                if info["pid"] == self.own_pid:
                    continue
                name = info.get("name")
                if not name:
                    continue
                if name.lower() in SYSTEM_WHITELIST:
                    continue
                exe = info.get("exe")
                if exe:
                    store = exe.lower().replace("/", "\\")
                    key = store
                else:
                    store = name.lower()
                    key = name.lower()
                running[key] = (pretty_name(name), store)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
            except Exception:
                continue
        if not running:
            messagebox.showinfo("Nothing found", "No user-launched apps detected right now.")
            return
        self._show_running_picker(running)

    def _show_running_picker(self, running):
        items = sorted(running.values(), key=lambda v: v[0].lower())
        win = ctk.CTkToplevel(self.root)
        win.title("Running apps")
        win.geometry("440x540")
        win.configure(fg_color=BG)
        win.transient(self.root)
        win.after(50, lambda: win.grab_set())

        ctk.CTkLabel(win, text="Running apps",
                     font=("Segoe UI", 16, "bold"),
                     text_color=TEXT, anchor="w").pack(
            fill="x", padx=20, pady=(16, 4))
        ctk.CTkLabel(win, text="Click an app to light it up.",
                     font=("Segoe UI", 10, "italic"), text_color=TEXT_DIM,
                     anchor="w").pack(fill="x", padx=20)
        search_var = tk.StringVar()
        search_entry = ctk.CTkEntry(
            win, textvariable=search_var, placeholder_text="Search…",
            fg_color=CARD, border_color=BORDER, text_color=TEXT,
            height=34, font=("Segoe UI", 11), corner_radius=8)
        search_entry.pack(fill="x", padx=20, pady=10)
        scroll = ctk.CTkScrollableFrame(
            win, fg_color="transparent",
            scrollbar_button_color=AMBER_DEEP,
            scrollbar_button_hover_color=AMBER)
        scroll.pack(fill="both", expand=True, padx=14, pady=(0, 16))

        def render(ft=""):
            for c in scroll.winfo_children():
                c.destroy()
            ft = ft.strip().lower()
            shown = 0
            for display_name, store_value in items:
                if ft and ft not in display_name.lower() \
                       and ft not in store_value.lower():
                    continue
                shown += 1
                row = ctk.CTkFrame(scroll, fg_color=CARD,
                                   corner_radius=8, height=40)
                row.pack(fill="x", pady=3, padx=4)
                row.pack_propagate(False)
                av = make_avatar(row, display_name[:1],
                                 avatar_color_for(display_name),
                                 bg=CARD, size=24)
                av.pack(side="left", padx=(10, 10))
                lbl = ctk.CTkLabel(row, text=display_name,
                                   font=("Segoe UI", 11), text_color=TEXT,
                                   anchor="w")
                lbl.pack(side="left", fill="x", expand=True)
                for w in (row, lbl, av):
                    w.bind("<Button-1>", lambda e, sv=store_value: pick(sv))
                row.bind("<Enter>", lambda e, r=row: r.configure(fg_color=CARD_HOVER))
                row.bind("<Leave>", lambda e, r=row: r.configure(fg_color=CARD))
            if shown == 0:
                ctk.CTkLabel(scroll, text="No matches.",
                             font=("Segoe UI", 11),
                             text_color=TEXT_DIM).pack(pady=20)

        def pick(sv):
            if sv not in self.whitelist:
                self.whitelist.append(sv)
                self.save_config()
                self._refresh_apps_list_sidebar()
            win.destroy()

        search_var.trace_add("write", lambda *_: render(search_var.get()))
        render()
        win.after(100, search_entry.focus_set)

    def _set_controls_state(self, enabled):
        state = "normal" if enabled else "disabled"
        for w in (self.btn_add, self.btn_add_running, self.btn_add_web,
                  self.hours_entry, self.minutes_entry,
                  self.mode_strict_btn, self.mode_soft_btn,
                  self.start_button):
            try:
                w.configure(state=state)
            except Exception:
                pass

    def _capture_ancestors(self):
        paths, names = set(), set()
        try:
            p = psutil.Process(self.own_pid)
            while p:
                try:
                    n = p.name()
                    if n: names.add(n.lower())
                except Exception: pass
                try:
                    e = p.exe()
                    if e: paths.add(e.lower().replace("/", "\\"))
                except Exception: pass
                try:
                    p = p.parent()
                except Exception: break
        except Exception:
            pass
        self._ancestor_paths, self._ancestor_names = paths, names

    def _auto_launch_allowed(self):
        running_exes, running_names = set(), set()
        for p in psutil.process_iter(["exe", "name"]):
            try:
                info = p.info
                if info.get("exe"):
                    running_exes.add(info["exe"].lower().replace("/", "\\"))
                if info.get("name"):
                    running_names.add(info["name"].lower())
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        for entry in self.whitelist:
            if "\\" not in entry and "/" not in entry:
                continue
            el = entry.lower().replace("/", "\\")
            nm = Path(entry).name.lower()
            if el in running_exes or nm in running_names:
                continue
            try:
                if Path(entry).exists():
                    subprocess.Popen([entry], shell=False)
                    time.sleep(0.15)
            except Exception:
                continue

    def start_session(self):
        if self.session_state != "idle":
            return
        hours = max(0, self._parse_int(self.hours_var))
        minutes = max(0, self._parse_int(self.minutes_var))
        total = hours * 3600 + minutes * 60
        if total <= 0:
            messagebox.showwarning("Invalid time", "Duration must be greater than 0.")
            return
        if not self.whitelist:
            warn = ("EVERY non-system app you open will be closed."
                    if self.mode == "strict"
                    else "EVERY non-system app you focus will be minimized.")
            if not messagebox.askyesno(
                "All dark",
                f"You haven't lit any apps or sites. {warn}\n\nStart anyway?"):
                return
        mode_warning = (
            "Non-allowed apps will be FORCE-CLOSED. Save work first."
            if self.mode == "strict"
            else "Non-allowed apps you try to focus will be minimized."
        )
        if not messagebox.askyesno(
            "Ready?",
            f"{hours}h {minutes}m in {self.mode.upper()} mode.\n\n"
            f"{mode_warning}\n\nProceed?"):
            return

        self.session_state = "active"
        self.session_total_seconds = total
        self.session_end_time = time.time() + total
        self.session_xp_baseline = self.xp_total
        self.session_xp_earned = 0
        self._last_notified.clear()
        self._capture_ancestors()
        self._set_controls_state(False)

        self._show_session()
        self._auto_launch_allowed()
        threading.Thread(target=self._monitor_loop, daemon=True).start()
        self._tick_session()

    def _toggle_pause(self):
        if self.session_state == "active":
            self.session_state = "paused"
            self.paused_remaining = max(0, self.session_end_time - time.time())
            self.pause_button.configure(text="▶  Resume")
            self.sess_status.configure(
                text="paused — take a breath", text_color=TEXT_DIM)
        elif self.session_state == "paused":
            self.session_state = "active"
            self.session_end_time = time.time() + (self.paused_remaining or 0)
            self.paused_remaining = None
            self.pause_button.configure(text="❚❚  Pause")
            self.sess_status.configure(
                text="you're in the zone — keep going", text_color=TEXT_DIM)
            self._tick_session()

    def _abort_press(self, _event=None):
        if self.session_state not in ("active", "paused"): return
        self._abort_hold_start = time.time()
        self._abort_tick()

    def _abort_tick(self):
        if self._abort_hold_start is None: return
        if self.session_state not in ("active", "paused"): return
        held = time.time() - self._abort_hold_start
        remaining = ABORT_HOLD_SECONDS - held
        if remaining <= 0:
            self.giveup_button.configure(text="Giving up…")
            self._abort_hold_start = None
            self._abort_after_id = None
            self._end_session(aborted=True)
            return
        self.giveup_button.configure(text=f"Hold… {remaining:.1f}s")
        self._abort_after_id = self.root.after(80, self._abort_tick)

    def _abort_release(self, _event=None):
        if self._abort_hold_start is None: return
        self._abort_hold_start = None
        if self._abort_after_id is not None:
            try: self.root.after_cancel(self._abort_after_id)
            except Exception: pass
            self._abort_after_id = None
        if self.session_state in ("active", "paused"):
            self.giveup_button.configure(text="Give up")

    def _tick_session(self):
        if self.session_state not in ("active", "paused"): return
        if self.session_state == "paused": return
        
        total = self.session_total_seconds
        remaining = max(0, self.session_end_time - time.time())
        elapsed = total - remaining
        if remaining <= 0:
            self._end_session(aborted=False)
            return
            
        h = int(remaining // 3600)
        m = int((remaining % 3600) // 60)
        s = int(remaining % 60)
        self.sess_time.configure(text=f"{h:02d}:{m:02d}:{s:02d}")
        
        pct_done = elapsed / total if total > 0 else 0
        elapsed_min = int(elapsed // 60)
        total_min = int(round(total / 60))
        self.sess_pct.configure(text=f"{int(pct_done * 100)}%  OF  {total_min} MIN")
        self.ring.set_progress(pct_done)

        target_xp = elapsed_min
        if target_xp > self.session_xp_earned:
            delta = target_xp - self.session_xp_earned
            self.session_xp_earned = target_xp
            self.xp_total += delta
            for w in self.sess_xp_pill.winfo_children(): w.destroy()
            ctk.CTkLabel(self.sess_xp_pill,
                         text=f"⭐  +{self.session_xp_earned} XP earned",
                         font=("Segoe UI", 11, "bold"),
                         text_color=AMBER).pack(padx=14, pady=4)

        self.root.after(500, self._tick_session)

    def _monitor_loop(self):
        while self.session_state in ("active", "paused"):
            if self.session_state == "paused":
                time.sleep(0.5)
                continue
            if self.mode == "strict":
                self._strict_pass()
                time.sleep(2)
            else:
                self._soft_pass()
                time.sleep(0.4)

    def _is_allowed(self, name_lower, exe_lower):
        if not name_lower or name_lower in SYSTEM_WHITELIST:
            return True
        if name_lower in self._ancestor_names:
            return True
        if exe_lower and exe_lower in self._ancestor_paths:
            return True
        if exe_lower and exe_lower in self.whitelist:
            return True
        if name_lower in self.whitelist:
            return True
        return False

    def _strict_pass(self):
        for proc in psutil.process_iter(["pid", "name", "exe"]):
            try:
                info = proc.info
                if info["pid"] == self.own_pid: continue
                name = (info.get("name") or "").lower()
                exe = info.get("exe")
                exe_lower = exe.lower().replace("/", "\\") if exe else None
                if self._is_allowed(name, exe_lower): continue
                proc.kill()
                self._notify(f"Closed {pretty_name(name)}", key=name)
            except (psutil.NoSuchProcess, psutil.AccessDenied): continue
            except Exception: continue

    def _soft_pass(self):
        try:
            user32 = ctypes.windll.user32
        except Exception: return
        hwnd = user32.GetForegroundWindow()
        if not hwnd: return
        pid = ctypes.c_ulong()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        try:
            p = psutil.Process(pid.value)
            name = (p.name() or "").lower()
            try: exe = p.exe()
            except Exception: exe = None
            exe_lower = exe.lower().replace("/", "\\") if exe else None
            if pid.value == self.own_pid: return
            if self._is_allowed(name, exe_lower): return
            user32.ShowWindow(hwnd, 6)
            self._notify(f"{pretty_name(name)} minimized — come back to focus", key=name)
        except (psutil.NoSuchProcess, psutil.AccessDenied): return

    def _notify(self, message, key):
        now = time.time()
        if now - self._last_notified.get(key, 0) < NOTIFY_COOLDOWN_SECONDS: return
        self._last_notified[key] = now
        self.root.after(0, lambda: self._show_toast(message))

    def _show_toast(self, message):
        toast = ctk.CTkToplevel(self.root)
        toast.overrideredirect(True)
        toast.attributes("-topmost", True)
        toast.configure(fg_color=CARD)
        w, h = 340, 72
        sw = toast.winfo_screenwidth()
        sh = toast.winfo_screenheight()
        stack = len(self._active_toasts) * (h + 8)
        x = sw - w - 24
        y = sh - h - 60 - stack
        toast.geometry(f"{w}x{h}+{x}+{y}")
        accent = AMBER if self.mode == "strict" else FLAME
        frame = ctk.CTkFrame(toast, fg_color=CARD, border_width=1,
                             border_color=accent, corner_radius=10)
        frame.pack(fill="both", expand=True)
        ctk.CTkLabel(frame, text="🪔  Focus Timer",
                     font=("Segoe UI", 10, "bold"),
                     text_color=accent, anchor="w").pack(
            fill="x", padx=12, pady=(6, 0))
        ctk.CTkLabel(frame, text=message, font=("Segoe UI", 10),
                     text_color=TEXT, anchor="w").pack(
            fill="x", padx=12, pady=(0, 6))
        self._active_toasts.append(toast)

        def dismiss():
            try:
                if toast in self._active_toasts:
                    self._active_toasts.remove(toast)
                toast.destroy()
            except Exception: pass

        toast.after(TOAST_DURATION_MS, dismiss)

    def _end_session(self, aborted=False):
        was_active = self.session_state in ("active", "paused")
        self.session_state = "idle"
        self.session_end_time = None
        self._abort_hold_start = None

        if was_active and not aborted and self.session_total_seconds >= 10 * 60:
            today = date.today()
            if self.last_session_date == today:
                pass
            elif self.last_session_date and (today - self.last_session_date).days == 1:
                self.streak += 1
            else:
                self.streak = 1 if self.streak == 0 else max(1, self.streak)
                if not self.last_session_date or (today - self.last_session_date).days != 0:
                    self.streak = (self.streak
                                   if self.last_session_date and
                                   (today - self.last_session_date).days <= 1
                                   else 1)
            self.last_session_date = today

        self.save_config()
        self._set_controls_state(True)
        self._show_setup()
        if not aborted:
            messagebox.showinfo("Session complete", f"Nice work — you earned {self.session_xp_earned} XP.")
        self.session_xp_earned = 0
        self.giveup_button.configure(text="Give up")
        self.pause_button.configure(text="❚❚  Pause")

    def _on_close(self):
        if self.session_state in ("active", "paused"):
            messagebox.showinfo(
                "Session running",
                "Hold the Give up button to end your session — "
                "closing the window won't end it.")
            return
        for t in list(self._active_toasts):
            try: t.destroy()
            except Exception: pass
        self.root.destroy()

    def run(self):
        self.root.mainloop()


if __name__ == "__main__":
    FocusTimer().run()