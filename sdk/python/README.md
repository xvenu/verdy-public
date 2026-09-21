# Verdy Python SDK

Stdlib only. No install needed — vendor `verdy.py` or add `sdk/python` to `sys.path`.

```bash
export VERDY_USER=your_proxy_user VERDY_PASS=your_proxy_pass
export VERDY_HOST=rr.usa.proxy.verdy.vernerx.com   # from your dashboard
export VERDY_DASHBOARD=https://verdy.vernerx.com   # for usage()/rotate_password()
python3 example.py
```

With requests:

```python
import requests
from verdy import Verdy
v = Verdy()
print(requests.get("https://api.ipify.org", proxies=v.proxies(session="job1"), timeout=20).text)
print(v.usage())            # plan, active, expiry, payments
print(v.rotate_password())  # old password dies at next node sync
```
