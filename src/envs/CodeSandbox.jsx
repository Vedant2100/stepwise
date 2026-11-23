import { useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { python } from '@codemirror/lang-python'
import Md from '../components/Md.jsx'
import { runTests } from '../lib/runner.js'

const extensions = [python()]

// The solution unlocks only after a run, and revealing it caps the score at 50.
export default function CodeSandbox({ exercise, onDone }) {
  const [code, setCode] = useState(exercise.starter || '')
  const [result, setResult] = useState(null)
  const [runs, setRuns] = useState(0)
  const [hints, setHints] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const passed = result ? result.tests.filter((t) => t.ok).length : 0
  const score = Math.round((passed / exercise.tests.length) * (revealed ? 50 : 100))

  async function run() {
    setBusy(true)
    setError('')
    try {
      setResult(await runTests(code, exercise.tests))
      setRuns(runs + 1)
    } catch (e) {
      setError(e.message)
    }
    setBusy(false)
  }

  return (
    <div className="space-y-4">
      <Md>{exercise.brief}</Md>
      <div className="overflow-hidden rounded-md border border-stone-300 text-sm dark:border-stone-700">
        <CodeMirror value={code} height="260px" extensions={extensions} onChange={setCode} />
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn" onClick={run} disabled={busy}>{busy ? (runs ? 'Running…' : 'Loading Python…') : 'Run tests'}</button>
        <button className="btn-ghost" onClick={() => setHints(hints + 1)} disabled={hints >= (exercise.hints?.length ?? 0)}>Hint</button>
        <button className="btn-ghost" onClick={() => setRevealed(true)} disabled={runs === 0 || revealed}>Show solution</button>
        <button className="btn-ghost" onClick={() => onDone(score)} disabled={runs === 0}>Finish ({score}/100)</button>
      </div>
      {exercise.dropped > 0 && <p className="text-xs text-stone-500">{exercise.dropped} generated test(s) disagreed with the reference solution and were removed.</p>}
      {exercise.hints?.slice(0, hints).map((h) => <p key={h} className="text-sm text-amber-700 dark:text-amber-400">Hint: {h}</p>)}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {result?.setup && <pre className="overflow-x-auto rounded bg-red-50 p-3 text-xs text-red-800 dark:bg-red-950 dark:text-red-200">{result.setup}</pre>}
      {result && (
        <ul className="space-y-1 text-sm">
          <li className="font-medium">{passed}/{exercise.tests.length} tests passing</li>
          {result.tests.map((t) => (
            <li key={t.name}>
              <span className={t.ok ? 'text-green-700 dark:text-green-400' : 'text-red-600'}>{t.ok ? '✓' : '✗'}</span> {t.name}
              {!t.ok && <pre className="ml-5 whitespace-pre-wrap text-xs text-stone-500">{t.err}</pre>}
            </li>
          ))}
        </ul>
      )}
      {result?.stdout && <pre className="overflow-x-auto rounded bg-stone-100 p-3 text-xs dark:bg-stone-800">{result.stdout}</pre>}
      {revealed && <Md>{'```python\n' + exercise.reference + '\n```'}</Md>}
    </div>
  )
}
