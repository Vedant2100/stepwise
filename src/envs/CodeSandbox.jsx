import { useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { python } from '@codemirror/lang-python'
import Md from '../components/Md.jsx'
import { runTests } from '../lib/runner.js'

const extensions = [python()]
const isDark = () => {
  const t = document.documentElement.dataset.theme
  return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
}

// The solution unlocks only after a run, and revealing it caps the score at 50.
export default function CodeSandbox({ exercise, onDone }) {
  const [code, setCode] = useState(exercise.starter || '')
  const [result, setResult] = useState(null)
  const [runs, setRuns] = useState(0)
  const [hints, setHints] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const passed = result ? result.tests.filter((t) => t.ok).length : 0
  const total = exercise.tests.length
  const score = Math.round((passed / total) * (revealed ? 50 : 100))

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
    <>
      <Md>{exercise.brief}</Md>
      <div className="ide">
        <CodeMirror value={code} minHeight="260px" maxHeight="70vh" extensions={extensions} theme={isDark() ? 'dark' : 'light'} onChange={setCode} readOnly={sent} />
        <div className="tbar">
          <span className={`sum ${result ? (passed === total ? 'good' : 'bad') : ''}`}>{result ? `${passed}/${total} passing` : `${total} tests ready`}</span>
          <span className="why">checked against a reference solution</span>
          <span className="row" style={{ margin: '0 0 0 auto' }}>
            <button className="btn sm" onClick={run} disabled={busy || sent}>{busy ? (runs ? 'Running…' : 'Loading Python…') : 'Run tests'}</button>
            <button className="btn ghost sm" onClick={() => setHints(hints + 1)} disabled={hints >= (exercise.hints?.length ?? 0)}>Hint</button>
            <button className="btn ghost sm" onClick={() => setRevealed(true)} disabled={runs === 0 || revealed}>Solution</button>
            {!sent && <button className="btn ghost sm" onClick={() => { setSent(true); onDone(score) }} disabled={runs === 0}>Record {score}/100</button>}
          </span>
        </div>
      </div>
      {exercise.dropped > 0 && <p className="why">{exercise.dropped} generated test(s) disagreed with the reference solution and were removed.</p>}
      {exercise.hints?.slice(0, hints).map((h) => <p key={h} className="nudge">{h}</p>)}
      {error && <p className="bad">{error}</p>}
      {result?.setup && <pre className="bad">{result.setup}</pre>}
      {result && (
        <div className="tests">
          {result.tests.map((t) => (
            <div key={t.name} className={`tt ${t.ok ? 'pass' : 'fail'}`}>
              <b>{t.ok ? 'pass' : 'fail'}</b>{t.name}
              {!t.ok && <pre>{t.err}</pre>}
            </div>
          ))}
        </div>
      )}
      {result?.stdout && <pre>{result.stdout}</pre>}
      {revealed && <Md>{'```python\n' + exercise.reference + '\n```'}</Md>}
    </>
  )
}
