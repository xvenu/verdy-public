// Verdy Proxy Node.js client — global fetch only, plus the optional
// https-proxy-agent package for per-call proxies (else HTTP(S)_PROXY env).
//
// Credentials from arguments or VERDY_* environment variables.
// Never hardcode passwords: read them from env or a secrets manager.
//
//   const { Verdy } = require("./verdy");
//   const v = new Verdy(); // VERDY_USER, VERDY_PASS, VERDY_HOST(, VERDY_PORT)
//   console.log(await v.checkIp());

const DEFAULT_PORT = 8899;

class VerdyError extends Error {}

class Verdy {
  constructor(opts = {}) {
    this.user = opts.user || process.env.VERDY_USER || "";
    this.password = opts.password || process.env.VERDY_PASS || "";
    this.host = opts.host || process.env.VERDY_HOST || "";
    this.port = Number(opts.port || process.env.VERDY_PORT || DEFAULT_PORT);
    this.dashboard = (opts.dashboard || process.env.VERDY_DASHBOARD || "").replace(/\/$/, "");
    this.timeoutMs = opts.timeoutMs || 20000;
    if (!this.user || !this.password || !this.host) {
      throw new VerdyError("missing credentials: pass user/password/host or set VERDY_USER/VERDY_PASS/VERDY_HOST");
    }
  }

  // Proxy agent URL for use with https-proxy-agent / fetch options.
  proxyUrl(session = null) {
    const user = session ? `${this.user}_sess-${session}` : this.user;
    return `http://${user}:${this.password}@${this.host}:${this.port}`;
  }

  socks5(session = null) {
    const user = session ? `${this.user}_sess-${session}` : this.user;
    return `socks5://${user}:${this.password}@${this.host}:${this.port}`;
  }

  // Direct check through the proxy (Node >= 18 global fetch).
  async checkIp(session = null, target = "https://api.ipify.org") {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      // NOTE: global fetch honors HTTP(S)_PROXY env, not per-call proxies.
      // Export them from proxyUrl(), or use the https-proxy-agent package:
      //   const { HttpsProxyAgent } = require("https-proxy-agent");
      //   fetch(target, { agent: new HttpsProxyAgent(v.proxyUrl()), signal: ctrl.signal })
      const { HttpsProxyAgent } = require("https-proxy-agent");
      const res = await fetch(target, { agent: new HttpsProxyAgent(this.proxyUrl(session)), signal: ctrl.signal });
      if (res.status === 407) throw new VerdyError("407: unknown/expired login — check dashboard, renew, wait ≤5 min");
      if (res.status === 429) throw new VerdyError("429: rate limited — back off exponentially");
      if (!res.ok) throw new VerdyError(`HTTP ${res.status}`);
      return { status: res.status, ip: (await res.text()).trim() };
    } catch (e) {
      if (e.code === "MODULE_NOT_FOUND") {
        throw new VerdyError("npm install https-proxy-agent (or set HTTP_PROXY/HTTPS_PROXY env and use plain fetch)");
      }
      throw e;
    } finally {
      clearTimeout(t);
    }
  }

  async _api(path, method = "GET", data = null) {
    if (!this.dashboard) {
      throw new VerdyError("set VERDY_DASHBOARD (e.g. https://verdy.vernerx.com) to use the API");
    }
    const cred = Buffer.from(`${this.user}:${this.password}`).toString("base64");
    const res = await fetch(this.dashboard + path, {
      method,
      headers: { Authorization: `Basic ${cred}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: data ? new URLSearchParams(data).toString() : undefined,
    });
    if (res.status === 401) throw new VerdyError("bad proxy login");
    if (res.status === 429) throw new VerdyError("rate limited — back off");
    if (!res.ok) throw new VerdyError(`HTTP ${res.status}`);
    return res.json();
  }

  endpoints() { return this._api("/api/dev/endpoints"); }
  creds() { return this._api("/api/dev/creds"); }
  usage() { return this._api("/api/dev/usage"); }

  // Rotate proxy password. Old value dies at the next node sync (~5 min).
  rotatePassword() { return this._api("/api/dev/rotate", "POST"); }

  async isActive() {
    try { return !!(await this.usage()).active; }
    catch { return false; }
  }
}

module.exports = { Verdy, VerdyError, DEFAULT_PORT };
