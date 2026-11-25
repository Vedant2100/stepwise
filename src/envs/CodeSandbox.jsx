import { useEffect, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { python } from '@codemirror/lang-python'
import Md from '../components/Md.jsx'
import { runTests } from '../lib/runner.js'

const extensions = [python()]
const isDark = () => {
  const t = document.documentElement.dataset.theme
  return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
}

export default function CodeWorkspace({ exercise, onDone, active }) {
  const [code, setCode] = useState(exercise.starter || '')
  const [result, setResult] = useState(null)
  const [runs, setRuns] = useState(0)
  const [hints, setHints] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const latest = useRef(code)
  latest.current = code

  const passed = result ? result.tests.filter((t) => t.ok).length : 0
  const total = exercise.tests.length
  const score = Math.round((passed / total) * (revealed ? 50 : 100))

  async function run() {
    setBusy(true)
    setError('')
    try {
      setResult(await runTests(latest.current, exercise.tests))
      setRuns((n) => n + 1)
    } catch (e) {
      setError(e.message)
    }
    setBusy(false)
  }

  useEffect(() => {
    if (!runs || !active) return
    const t = setTimeout(run, 1200)
    return () => clearTimeout(t)
  }, [code]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="panes three">
      <section className="pane">
        <p className="label">Task</p>
        <Md>{exercise.brief}</Md>
        <p className="label">Hints</p>
        {exercise.hints?.slice(0, hints).map((h) => <p key={h} className="nudge">{h}</p>)}
        <div className="row" style={{ margin: 0 }}>
          <button className="btn ghost sm" onClick={() => setHints(hints + 1)} disabled={hints >= (exercise.hints?.length ?? 0)}>
            {hints ? 'Another hint' : 'Show a hint'}
          </button>
          <button className="btn ghost sm" onClick={() => setRevealed(true)} disabled={runs === 0 || revealed} title={runs ? '' : 'Run your code first'}>
            Solution (caps score at 50)
          </button>
        </div>
        {revealed && <Md>{'```python\n' + exercise.reference + '\n```'}</Md>}
      </section>

      <section
        className="pane flush"
        onKeyDownCapture={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault()
            run()
          }
        }}
      >
        <div className="grow" style={{ overflow: 'auto' }}>
          <CodeMirror value={code} height="100%" style={{ height: '100%' }} extensions={extensions} theme={isDark() ? 'dark' : 'light'} onChange={setCode} />
        </div>
        <div className="tbar">
          <button className="btn sm" title="⌘/Ctrl + Enter" onClick={run} disabled={busy}>{busy ? (runs ? 'Running…' : 'Loading Python…') : 'Run tests'}</button>
          <span className="why">{runs ? 'reruns as you type' : 'first run loads Python (a few seconds)'}</span>
        </div>
      </section>

      <section className="pane">
        <p className="label">Tests</p>
        <p className={`score ${result ? (passed === total ? 'good' : 'bad') : ''}`} style={{ fontSize: 26 }}>
          {passed}/{total} <small>passing</small>
        </p>
        <p className="why">Checked against a hidden reference solution{exercise.dropped ? `; ${exercise.dropped} disagreeing test(s) removed` : ''}.</p>
        {error && <p className="bad">{error}</p>}
        {result?.setup && <pre className="bad">{result.setup}</pre>}
        <div className="tests">
          {(result?.tests ?? exercise.tests.map((t) => ({ name: t.name }))).map((t) => (
            <div key={t.name} className={`tt ${t.ok === undefined ? 'wait' : t.ok ? 'pass' : 'fail'}`}>
              <b>{t.ok === undefined ? '…' : t.ok ? 'pass' : 'fail'}</b>
              {t.name}
              {t.ok === false && <pre>{t.err}</pre>}
            </div>
          ))}
        </div>
        <p className="label">Console</p>
        <pre className="grow" style={{ minHeight: 60 }}>{result?.stdout || ' '}</pre>
        <button className="btn" onClick={() => onDone(score)} disabled={runs === 0}>Record {score}/100</button>
      </section>
    </div>
  )
}
