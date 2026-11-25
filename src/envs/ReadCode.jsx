import { useState } from 'react'
import Md from '../components/Md.jsx'
import CodeView from './CodeView.jsx'
import CodeWorkspace from './CodeSandbox.jsx'

const norm = (s) => s.replace(/\r/g, '').split('\n').map((l) => l.trimEnd()).join('\n').trim()

export default function ReadCodeWorkspace({ exercise, onDone, active }) {
  const { snippets, debug } = exercise
  const [k, setK] = useState(0)
  const [guess, setGuess] = useState('')
  const [tries, setTries] = useState(0)
  const [result, setResult] = useState(null)
  const [credits, setCredits] = useState([])

  const predicting = k < snippets.length
  const s = snippets[k]
  const predictScore = credits.length ? credits.reduce((a, b) => a + b, 0) / snippets.length : 0

  function check() {
    if (norm(guess) === norm(s.output)) return setResult({ ok: true, credit: tries === 0 ? 1 : 0.5 })
    if (tries === 0) {
      setTries(1)
      return setResult({ ok: false })
    }
    setResult({ ok: false, credit: 0 })
  }

  function nextSnippet() {
    setCredits([...credits, result.credit])
    setK(k + 1)
    setGuess('')
    setTries(0)
    setResult(null)
  }

  if (!predicting && debug) {
    return (
      <div className="stack">
        <p className="why">Predictions: {Math.round(predictScore * 100)}%. Now fix the bug so every test passes.</p>
        <CodeWorkspace
          exercise={{ brief: debug.brief, starter: debug.buggy, reference: debug.reference, tests: debug.tests, hints: [] }}
          active={active}
          onDone={(fix) => onDone(Math.round(predictScore * 60 + fix * 0.4))}
        />
      </div>
    )
  }

  return (
    <div className="panes two">
      <section className="pane">
        <p className="label">{predicting ? `Snippet ${k + 1} of ${snippets.length}` : 'Done'}</p>
        {predicting && <CodeView value={s.code} />}
        {predicting && <Md>{s.ask || 'What does this print?'}</Md>}
      </section>
      <section className="pane">
        {predicting ? (
          <>
            <p className="label">Your prediction of the exact output</p>
            <textarea className="mono" rows={7} value={guess} onChange={(e) => setGuess(e.target.value)} disabled={result?.credit !== undefined} aria-label="Predicted output" />
            {!result || result.credit === undefined ? (
              <div className="row" style={{ margin: 0 }}>
                <button className="btn" onClick={check} disabled={!guess.trim()}>Check</button>
                {result && !result.ok && <span className="bad">Not quite. Trace it once more; one try left.</span>}
              </div>
            ) : (
              <div className="res" style={{ marginTop: 0 }}>
                <p className={result.ok ? 'good' : 'bad'}><b>{result.ok ? 'Correct.' : 'This is what it actually prints:'}</b></p>
                {!result.ok && <pre>{s.output}</pre>}
                <button className="btn" onClick={nextSnippet}>{k + 1 < snippets.length ? 'Next snippet' : debug ? 'On to the bug' : 'See score'}</button>
              </div>
            )}
          </>
        ) : (
          <div className="res" style={{ marginTop: 0 }}>
            <div className="score">{Math.round(predictScore * 100)}<small> /100</small></div>
            <button className="btn" onClick={() => onDone(Math.round(predictScore * 100))}>Record it</button>
          </div>
        )}
      </section>
    </div>
  )
}
