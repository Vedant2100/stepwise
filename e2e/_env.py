# Shared settings for the browser tests. Model calls are mocked in each test; Python (Pyodide) is
# served from node_modules, so the tests need no network and no API key.
#   BASE    the running app (default: the Vite dev server on 5179; run `npm run dev -- --port 5179`)
#   CHROME  optional path to a Chrome binary; otherwise Playwright's bundled Chromium is used
#   OUT     where screenshots go (default: e2e/out)
import os, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get('BASE', 'http://localhost:5179').rstrip('/')
OUT = os.environ.get('OUT', str(ROOT / 'e2e' / 'out'))
PYO = ROOT / 'node_modules' / 'pyodide'
LAUNCH = {'args': ['--no-proxy-server'], **({'executable_path': os.environ['CHROME']} if os.environ.get('CHROME') else {})}
Path(OUT).mkdir(parents=True, exist_ok=True)


def check_errors(errors, allow=()):
    """Fail the test on page errors, except ones it provokes on purpose."""
    real = [e for e in errors if not any(a in e for a in allow)]
    print('page errors:', real or 'none')
    if real:
        raise SystemExit(1)


def route_reply(prompt):
    """Mocked router reply for a typed message: treat it as a new goal. None if this isn't a routing call."""
    m = re.search(r'LEARNER SAYS: """(.*?)"""', prompt, re.S)
    return {"action": "learn", "topic": m.group(1), "say": "", "suggest": []} if m else None
