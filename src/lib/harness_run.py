# Runs CODE once in a fresh namespace. Captures stdout, and every call to trace(**state) as a JSON snapshot.
# Inputs: CODE. Returns JSON: {"stdout", "error", "trace"}.
import sys, io, ast, json, copy, traceback

_snaps = []

def _plain(v):
    # JSON has no Infinity/NaN; show them the way Python prints them.
    if isinstance(v, float) and (v != v or v in (float("inf"), float("-inf"))):
        return "nan" if v != v else ("inf" if v > 0 else "-inf")
    if isinstance(v, dict):
        return {str(k): _plain(x) for k, x in v.items()}
    if isinstance(v, (list, tuple, set)):
        return [_plain(x) for x in (sorted(v, key=str) if isinstance(v, set) else v)]
    return v

def trace(**state):
    if len(_snaps) >= 200:
        raise RuntimeError("trace() was called more than 200 times")
    _snaps.append(json.loads(json.dumps(_plain(copy.deepcopy(state)), default=str)))

_buf = io.StringIO()
_old = sys.stdout
sys.stdout = _buf
_err = None
try:
    _tree = ast.parse(CODE, "snippet.py")
    # Generated code sometimes defines its own trace(); drop it so ours records the state.
    _tree.body = [n for n in _tree.body if not (
        (isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name == "trace")
        or (isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "trace" for t in n.targets)))]
    exec(compile(_tree, "snippet.py", "exec"), {"__name__": "__main__", "trace": trace})
except BaseException:
    _err = "\n".join(traceback.format_exc().strip().splitlines()[-3:])[-800:]
sys.stdout = _old
json.dumps({"stdout": _buf.getvalue()[-6000:], "error": _err, "trace": _snaps})
