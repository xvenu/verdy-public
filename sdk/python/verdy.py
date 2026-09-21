"""Verdy Proxy Python client — stdlib only, no dependencies.

Credentials come from arguments or VERDY_* environment variables.
Never hardcode passwords: read them from env or a secrets manager.

    from verdy import Verdy

    v = Verdy()  # VERDY_USER, VERDY_PASS, VERDY_HOST(, VERDY_PORT)
    print(v.check_ip())
    print(v.usage())
"""

import base64
import json
import os
import urllib.error
import urllib.parse
import urllib.request

DEFAULT_PORT = 8899


class VerdyError(Exception):
    pass


class Verdy:
    """Thin client over proxy traffic + the use-only developer API."""

    def __init__(self, user=None, password=None, host=None, port=None, dashboard=None, timeout=20):
        self.user = user or os.environ.get("VERDY_USER", "")
        self.password = password or os.environ.get("VERDY_PASS", "")
        self.host = host or os.environ.get("VERDY_HOST", "")
        self.port = int(port or os.environ.get("VERDY_PORT", DEFAULT_PORT))
        self.dashboard = (dashboard or os.environ.get("VERDY_DASHBOARD", "")).rstrip("/")
        self.timeout = timeout
        if not (self.user and self.password and self.host):
            raise VerdyError("missing credentials: pass user/password/host or set VERDY_USER/VERDY_PASS/VERDY_HOST")

    # ---------------- proxy traffic ----------------

    def proxies(self, session=None):
        """Requests-style proxies dict. session pins a sticky IP."""
        user = f"{self.user}_sess-{session}" if session else self.user
        auth = f"{user}:{self.password}"
        base = f"http://{auth}@{self.host}:{self.port}"
        return {"http": base, "https": base}

    def socks5(self, session=None):
        user = f"{self.user}_sess-{session}" if session else self.user
        return f"socks5://{user}:{self.password}@{self.host}:{self.port}"

    def check_ip(self, session=None, target="https://api.ipify.org"):
        """Returns (status, exit_ip) through the proxy. Raises VerdyError with guidance."""
        proxy = self.proxies(session)["https"]
        opener = urllib.request.build_opener(
            urllib.request.ProxyHandler({"http": proxy, "https": proxy}))
        try:
            with opener.open(target, timeout=self.timeout) as r:
                return r.status, r.read().decode().strip()
        except urllib.error.HTTPError as e:
            if e.code == 407:
                raise VerdyError("407: unknown/expired login — check dashboard, renew, wait ≤5 min")
            if e.code == 429:
                raise VerdyError("429: rate limited — back off exponentially")
            raise VerdyError(f"HTTP {e.code}")

    # ---------------- developer API ----------------

    def _api(self, path, method="GET", data=None):
        if not self.dashboard:
            raise VerdyError("set VERDY_DASHBOARD (e.g. https://verdy.vernerx.com) to use the API")
        cred = base64.b64encode(f"{self.user}:{self.password}".encode()).decode()
        body = urllib.parse.urlencode(data or {}).encode() if data else None
        req = urllib.request.Request(self.dashboard + path, data=body, method=method,
                                     headers={"Authorization": f"Basic {cred}"})
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            hint = {401: "bad proxy login", 429: "rate limited — back off"}.get(e.code, f"HTTP {e.code}")
            raise VerdyError(hint)

    def endpoints(self):
        """All proxy-type endpoints for your country."""
        return self._api("/api/dev/endpoints")

    def creds(self):
        """Your username + per-type endpoints."""
        return self._api("/api/dev/creds")

    def usage(self):
        """Plan, active flag, expiry, payment history."""
        return self._api("/api/dev/usage")

    def rotate_password(self):
        """Rotate proxy password. Old value dies at the next node sync (~5 min)."""
        return self._api("/api/dev/rotate", method="POST")

    def is_active(self):
        """True when the subscription is currently active."""
        try:
            return bool(self.usage().get("active"))
        except VerdyError:
            return False
