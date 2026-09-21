"""Verdy SDK examples — each runs with VERDY_USER/VERDY_PASS/VERDY_HOST set."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from verdy import Verdy, VerdyError  # noqa: E402


def main():
    v = Verdy()
    print("proxies:", v.proxies())
    print("sticky :", v.proxies(session="job42"))
    print("socks5 :", v.socks5())
    try:
        print("usage  :", v.usage())
    except VerdyError as e:
        print("usage skipped (needs VERDY_DASHBOARD):", e)


if __name__ == "__main__":
    main()
