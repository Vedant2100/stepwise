import { loadPyodide, version } from 'pyodide'
import TESTS from './harness.py?raw'
import RUN from './harness_run.py?raw'
import CELL from './harness_cell.py?raw'

let py

// op "tests": code against tests; "run": code once with trace(); "cell": a notebook cell (mode run/check/reset).
onmessage = async ({ data: { id, op, code, tests = [], nb, mode } }) => {
  try {
    py ??= await loadPyodide({ indexURL: `https://cdn.jsdelivr.net/pyodide/v${version}/full/` })
    await py.loadPackagesFromImports([code, ...tests.map((t) => t.code)].join('\n'))
    let harness
    if (op === 'tests') {
      py.globals.set('USER', code)
      py.globals.set('TESTS_JSON', JSON.stringify(tests))
      harness = TESTS
    } else if (op === 'run') {
      py.globals.set('CODE', code)
      harness = RUN
    } else {
      py.globals.set('CODE', code)
      py.globals.set('NB', nb)
      py.globals.set('MODE', mode)
      harness = CELL
    }
    postMessage({ id, result: JSON.parse(py.runPython(harness)) })
  } catch (e) {
    postMessage({ id, error: String(e.message ?? e) })
  }
}
