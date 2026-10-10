#!/usr/bin/env python3
"""
Groq connectivity diagnostic — non-generation request.
Run locally and on Render to compare connectivity.
Does NOT log the API key, prompts, or model output.
"""
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from groq import Groq

# Load project-root .env without overriding existing environment variables.
project_root = Path(__file__).resolve().parent
load_dotenv(dotenv_path=project_root / ".env", override=False)


def main() -> int:
    api_key = os.environ.get("GROQ_API_KEY", "").strip()
    if not api_key:
        print("FAIL: GROQ_API_KEY is not set or is empty.")
        return 1

    proxy_vars = [k for k in os.environ if "proxy" in k.lower()]
    if proxy_vars:
        print(f"WARNING: Proxy environment variables present: {proxy_vars}")

    client_kwargs = {"api_key": api_key, "max_retries": 0}
    env_base_url = os.environ.get("GROQ_BASE_URL")
    if env_base_url:
        client_kwargs["base_url"] = env_base_url
        print(f"Base URL: {env_base_url}")
    else:
        print("Base URL: <SDK default>")

    client = Groq(**client_kwargs)

    try:
        models = client.models.list()
        print(f"SUCCESS: Listed {len(models.data)} models from Groq.")
        return 0
    except Exception as exc:
        exc_type = type(exc).__name__
        print(f"FAIL: {exc_type}")

        cause = getattr(exc, "__cause__", None)
        if cause:
            print(f"  Underlying cause: {type(cause).__name__}")
            cause_msg = str(cause).lower()
            if any(k in cause_msg for k in ("getaddrinfo", "name", "dns", "resolution")):
                print("  Category: dns")
            elif any(k in cause_msg for k in ("ssl", "tls", "certificate", "verify")):
                print("  Category: tls")
            elif "refused" in cause_msg:
                print("  Category: connection_refused")
            elif any(k in cause_msg for k in ("timeout", "timed out")):
                print("  Category: timeout")
            elif any(k in cause_msg for k in ("network", "unreachable")):
                print("  Category: network_unreachable")
            else:
                print("  Category: unknown")
        else:
            print(f"  Details: {exc}")

        return 1


if __name__ == "__main__":
    sys.exit(main())
