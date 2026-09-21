// Verdy SDK example — run with VERDY_USER/VERDY_PASS/VERDY_HOST set.
const { Verdy } = require("./verdy");

(async () => {
  const v = new Verdy();
  console.log("proxy :", v.proxyUrl());
  console.log("sticky:", v.proxyUrl("job42"));
  console.log("socks5:", v.socks5());
  try {
    console.log("usage :", await v.usage());
  } catch (e) {
    console.log("usage skipped (needs VERDY_DASHBOARD):", e.message);
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
