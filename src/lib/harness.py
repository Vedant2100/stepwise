# Runs the learner's code, then each test in a copy of its namespace.
# Ported from Straight Shot's test_harness.py. Inputs: USER (code), TESTS_JSON.
import sys, io, json, time, traceback

_res = {"setup": None, "tests": [], "stdout": ""}
_ns = {"__name__": "__main__"}
_buf = io.StringIO()
_old = sys.stdout
sys.stdout = _buf
try:
    exec(compile(USER, "solution.py", "exec"), _ns)
except BaseException:
    _res["setup"] = traceback.format_exc()[-1500:]
for _t in json.loads(TESTS_JSON):
    _t0 = time.perf_counter()
    _ms = lambda: round((time.perf_counter() - _t0) * 1000, 1)
    if _res["setup"]:
        _res["tests"].append({"name": _t["name"], "ok": False, "err": "Your code didn't run (see the error above).", "ms": 0})
        continue
    try:
        exec(compile(_t["code"], "test", "exec"), dict(_ns))
        _res["tests"].append({"name": _t["name"], "ok": True, "err": "", "ms": _ms()})
    except AssertionError as e:
        _res["tests"].append({"name": _t["name"], "ok": False, "err": "AssertionError: " + (str(e) or "assert failed"), "ms": _ms()})
    except BaseException:
        _tb = traceback.format_exc().strip().splitlines()
        _res["tests"].append({"name": _t["name"], "ok": False, "err": "\n".join(_tb[-3:])[-700:], "ms": _ms()})
sys.stdout = _old
_res["stdout"] = _buf.getvalue()[-4000:]
json.dumps(_res)
