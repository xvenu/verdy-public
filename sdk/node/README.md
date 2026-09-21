# Verdy Node SDK

Global fetch only. Per-call proxies need one package:

```bash
npm install https-proxy-agent
export VERDY_USER=your_proxy_user VERDY_PASS=your_proxy_pass
export VERDY_HOST=rr.usa.proxy.verdy.vernerx.com   # from your dashboard
export VERDY_DASHBOARD=https://verdy.vernerx.com   # for usage()/rotatePassword()
node example.js
```

```js
const { Verdy } = require("./verdy");
const v = new Verdy();
const { HttpsProxyAgent } = require("https-proxy-agent");
const res = await fetch("https://api.ipify.org", { agent: new HttpsProxyAgent(v.proxyUrl("job1")) });
console.log(await v.usage());           // plan, active, expiry, payments
console.log(await v.rotatePassword());  // old password dies at next node sync
```
