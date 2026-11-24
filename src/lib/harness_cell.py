# Runs one notebook cell (CODE) in the persistent namespace of notebook NB, or a hidden check (MODE == "check")
# against a copy of it. Returns JSON: {"stdout", "value", "error", "images"}; images are base64 PNGs.
import sys, io, os, ast, json, base64, traceback
os.environ.setdefault("MPLBACKEND", "Agg")

if "_NOTEBOOKS" not in globals():
    _NOTEBOOKS = {}
if MODE == "reset":
    _NOTEBOOKS.pop(NB, None)
_ns = _NOTEBOOKS.setdefault(NB, {"__name__": "__main__"})
_scope = dict(_ns) if MODE == "check" else _ns

_buf = io.StringIO()
_old = sys.stdout
sys.stdout = _buf
_value = _err = None
try:
    _tree = ast.parse(CODE, "cell.py")
    _last = _tree.body.pop() if _tree.body and isinstance(_tree.body[-1], ast.Expr) else None
    exec(compile(_tree, "cell.py", "exec"), _scope)
    if _last is not None:
        _v = eval(compile(ast.Expression(_last.value), "cell.py", "eval"), _scope)
        if _v is not None:
            _value = repr(_v)[:4000]
except BaseException as _e:
    _err = ("AssertionError: " + (str(_e) or "check failed")) if isinstance(_e, AssertionError) else "\n".join(traceback.format_exc().strip().splitlines()[-3:])[-800:]
sys.stdout = _old

_images = []
if "matplotlib.pyplot" in sys.modules:
    _plt = sys.modules["matplotlib.pyplot"]
    for _n in _plt.get_fignums():
        _b = io.BytesIO()
        _plt.figure(_n).savefig(_b, format="png", dpi=110, bbox_inches="tight")
        _images.append(base64.b64encode(_b.getvalue()).decode())
    _plt.close("all")
json.dumps({"stdout": _buf.getvalue()[-6000:], "value": _value, "error": _err, "images": _images})
