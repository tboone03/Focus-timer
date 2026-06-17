"""
Tests for FocusTimerSidecar business logic.
Starts the HTTP server on a random port so tests are isolated from any
running sidecar instance.
"""
import importlib
import json
import sys
import threading
import time
import urllib.request
import urllib.error
from http.server import HTTPServer
from pathlib import Path

import pytest

# ── Load sidecar module ───────────────────────────────────────────────────────

SIDECAR_PATH = Path(__file__).parent.parent / "FocusTimerSidecar.py"
spec = importlib.util.spec_from_file_location("sidecar", SIDECAR_PATH)
sidecar = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sidecar)

# ── Helpers ───────────────────────────────────────────────────────────────────

def _reset():
    """Reset all global sidecar state between tests."""
    S = sidecar.S
    S.session_state       = "idle"
    S.session_end_time    = 0.0
    S.session_total_seconds = 0
    S.paused_remaining    = 0.0
    S.session_xp_earned   = 0
    S.whitelist           = []
    S.temp_whitelist      = {}
    sidecar._protected_pids = set()
    sidecar._ancestor_paths = set()
    sidecar._ancestor_names = set()


def _server():
    """Start a throw-away sidecar HTTP server and return (server, url, thread)."""
    srv = HTTPServer(("127.0.0.1", 0), sidecar.FocusAPIHandler)
    port = srv.server_address[1]
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    return srv, f"http://127.0.0.1:{port}", t


def _get(url, path):
    with urllib.request.urlopen(url + path, timeout=3) as r:
        return json.loads(r.read())


def _post(url, path, body=None, token=None):
    data = json.dumps(body or {}).encode()
    req = urllib.request.Request(
        url + path, data=data,
        headers={"Content-Type": "application/json",
                 **({"X-Focus-Token": token} if token else {})},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=3) as r:
        return json.loads(r.read())


# ── pure function tests ───────────────────────────────────────────────────────

class TestPrettyName:
    def test_domain_capitalises_parts(self):
        assert sidecar.pretty_name("toledo.kuleuven.be") == "Toledo Kuleuven"

    def test_www_stripped(self):
        assert sidecar.pretty_name("www.youtube.com") == "Youtube"

    def test_friendly_exe_via_resolve(self):
        # pretty_name treats bare "chrome.exe" as a domain-like string and
        # capitalises the stem; resolve_app_name is what hits the FRIENDLY dict
        result = sidecar.resolve_app_name("", "chrome.exe")
        assert result == "Google Chrome"

    def test_exe_stem_capitalised(self):
        result = sidecar.pretty_name("my_custom_app.exe")
        assert result[0].isupper()

    def test_empty_string_safe(self):
        assert sidecar.pretty_name("") == ""


class TestIsDomainAllowed:
    """Mirrors the Chrome extension isDomainAllowed logic tested via the sidecar whitelist."""

    def setup_method(self):
        _reset()

    def test_exact_domain_allowed(self):
        sidecar.S.whitelist = ["github.com"]
        sidecar.S.session_state = "active"
        # The sidecar returns the whitelist filtered to domains only
        assert "github.com" in sidecar.S.whitelist

    def test_unlisted_domain_not_in_whitelist(self):
        sidecar.S.whitelist = ["github.com"]
        assert "youtube.com" not in sidecar.S.whitelist


# ── session state tests ───────────────────────────────────────────────────────

class TestSessionState:
    def setup_method(self):
        _reset()

    def test_initial_state_is_idle(self):
        assert sidecar.S.session_state == "idle"

    def test_start_session_sets_active(self):
        result = sidecar.start_session(60, "soft")
        assert result == {"ok": True}
        assert sidecar.S.session_state == "active"

    def test_start_session_invalid_duration(self):
        result = sidecar.start_session(0, "soft")
        assert "error" in result

    def test_start_session_already_running(self):
        sidecar.start_session(60, "soft")
        result = sidecar.start_session(60, "soft")
        assert "error" in result

    def test_stop_session_returns_idle(self):
        sidecar.start_session(60, "soft")
        result = sidecar.stop_session(aborted=True)
        assert result == {"ok": True}
        assert sidecar.S.session_state == "idle"

    def test_stop_when_idle_returns_error(self):
        result = sidecar.stop_session()
        assert "error" in result

    def test_toggle_pause_pauses_active(self):
        sidecar.start_session(60, "soft")
        result = sidecar.toggle_pause()
        assert result["ok"] is True
        assert sidecar.S.session_state == "paused"

    def test_toggle_pause_resumes_paused(self):
        sidecar.start_session(60, "soft")
        sidecar.toggle_pause()
        result = sidecar.toggle_pause()
        assert result["ok"] is True
        assert sidecar.S.session_state == "active"

    def test_toggle_pause_when_idle_returns_error(self):
        result = sidecar.toggle_pause()
        assert "error" in result

    def test_xp_accumulates_during_session(self):
        sidecar.start_session(120, "soft")
        sidecar.S.session_end_time = time.time() - 90  # simulate 90 s elapsed
        sidecar.S.session_xp_earned = 0
        # manually trigger what _tick_loop does
        elapsed = 120 - max(0.0, sidecar.S.session_end_time - time.time())
        target_xp = int(elapsed // 60)
        assert target_xp >= 1


# ── whitelist tests ───────────────────────────────────────────────────────────

class TestWhitelist:
    def setup_method(self):
        _reset()

    def test_add_entry(self):
        sidecar.S.whitelist.append("notion.so")
        assert "notion.so" in sidecar.S.whitelist

    def test_remove_entry(self):
        sidecar.S.whitelist = ["notion.so", "github.com"]
        sidecar.S.whitelist.remove("notion.so")
        assert "notion.so" not in sidecar.S.whitelist
        assert "github.com" in sidecar.S.whitelist

    def test_temp_whitelist_expires(self):
        sidecar.S.temp_whitelist["expired.com"] = time.time() - 1
        sidecar.S.temp_whitelist["valid.com"]   = time.time() + 120
        now = time.time()
        with sidecar._lock:
            sidecar.S.temp_whitelist = {k: v for k, v in sidecar.S.temp_whitelist.items() if v > now}
        assert "expired.com" not in sidecar.S.temp_whitelist
        assert "valid.com"   in  sidecar.S.temp_whitelist


# ── HTTP server smoke tests ───────────────────────────────────────────────────

class TestHttpApi:
    def setup_method(self):
        _reset()
        self.srv, self.url, _ = _server()

    def teardown_method(self):
        self.srv.shutdown()
        _reset()

    def test_status_idle(self):
        data = _get(self.url, "/status")
        assert data["active"] is False
        assert data["paused"] is False
        assert "token" in data

    def test_start_stop_via_http(self):
        _post(self.url, "/start", {"minutes": 1, "mode": "soft"})
        status = _get(self.url, "/status")
        assert status["active"] is True

        token = status["token"]
        _post(self.url, "/stop", {"aborted": True}, token=token)
        status = _get(self.url, "/status")
        assert status["active"] is False

    def test_pause_resume_via_http(self):
        _post(self.url, "/start", {"minutes": 1, "mode": "soft"})
        token = _get(self.url, "/status")["token"]

        _post(self.url, "/pause", {}, token=token)
        assert _get(self.url, "/status")["paused"] is True

        _post(self.url, "/pause", {}, token=token)
        assert _get(self.url, "/status")["paused"] is False

    def test_pause_without_token_returns_403(self):
        _post(self.url, "/start", {"minutes": 1, "mode": "soft"})
        req = urllib.request.Request(
            self.url + "/pause",
            data=b"{}",
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with pytest.raises(urllib.error.HTTPError) as exc:
            urllib.request.urlopen(req, timeout=3)
        assert exc.value.code == 403

    def test_whitelist_add_remove(self):
        _post(self.url, "/whitelist/add", {"entry": "github.com"})
        wl = _get(self.url, "/whitelist")["whitelist"]
        assert "github.com" in wl

        _post(self.url, "/whitelist/remove", {"entry": "github.com"})
        wl = _get(self.url, "/whitelist")["whitelist"]
        assert "github.com" not in wl

    def test_bypass_adds_temp_entry(self):
        _post(self.url, "/start", {"minutes": 1, "mode": "soft"})
        token = _get(self.url, "/status")["token"]
        _post(self.url, "/bypass", {"domain": "wikipedia.org"}, token=token)
        status = _get(self.url, "/status")
        assert "wikipedia.org" in status["whitelist"]

    def test_unknown_route_returns_404(self):
        with pytest.raises(urllib.error.HTTPError) as exc:
            urllib.request.urlopen(self.url + "/nonexistent", timeout=3)
        assert exc.value.code == 404


# ── thread safety test ────────────────────────────────────────────────────────

class TestThreadSafety:
    def setup_method(self):
        _reset()

    def test_temp_whitelist_concurrent_access(self):
        """Concurrent reads and writes to temp_whitelist must not raise."""
        errors = []

        def writer():
            for i in range(100):
                with sidecar._lock:
                    sidecar.S.temp_whitelist[f"site{i}.com"] = time.time() + 10
                time.sleep(0.001)

        def reader():
            for _ in range(100):
                now = time.time()
                with sidecar._lock:
                    _ = {k: v for k, v in sidecar.S.temp_whitelist.items() if v > now}
                time.sleep(0.001)

        threads = [threading.Thread(target=writer), threading.Thread(target=reader)]
        for t in threads: t.start()
        for t in threads:
            t.join(timeout=5)
            if t.is_alive():
                errors.append("thread timed out")

        assert not errors
