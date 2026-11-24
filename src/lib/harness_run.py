# Runs CODE once in a fresh namespace. Captures stdout, and every call to trace(**state) as a JSON snapshot.
# Inputs: CODE. Returns JSON: {"stdout", "error", "trace"}.
import sys, io, ast, json, copy, traceback

_snaps = []

def trace(**state):
    if len(_snaps) >= 200:
        raise RuntimeError("trace() was called more than 200 times")
    _snaps.append(json.loads(json.dumps(copy.deepcopy(state), default=str)))

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
