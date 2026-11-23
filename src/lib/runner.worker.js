import { loadPyodide, version } from 'pyodide'
import HARNESS from './harness.py?raw'

let py

onmessage = async ({ data: { id, code, tests } }) => {
  try {
    py ??= await loadPyodide({ indexURL: `https://cdn.jsdelivr.net/pyodide/v${version}/full/` })
    await py.loadPackagesFromImports([code, ...tests.map((t) => t.code)].join('\n'))
    py.globals.set('USER', code)
    py.globals.set('TESTS_JSON', JSON.stringify(tests))
    postMessage({ id, result: JSON.parse(py.runPython(HARNESS)) })
  } catch (e) {
    postMessage({ id, error: String(e.message ?? e) })
  }
}
