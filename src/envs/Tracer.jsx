import { useState } from 'react'
import Md from '../components/Md.jsx'
import CodeView from './CodeView.jsx'

// Accepts Python-ish literals: single quotes, True/False/None, tuples written with ().
function parse(text) {
  const t = text.trim().replace(/'/g, '"').replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false').replace(/\bNone\b/g, 'null').replace(/\(/g, '[').replace(/\)/g, ']')
  try {
    return JSON.parse(t)
  } catch {
    return text.trim()
  }
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const show = (v) => (typeof v === 'string' ? v : JSON.stringify(v))

// Arrays draw as boxes (changed boxes highlighted), 2D arrays as a grid, anything else as text.
function Value({ v, prev }) {
  if (Array.isArray(v) && v.every((x) => Array.isArray(x))) {
    return <div className="grid2d">{v.map((row, r) => <div key={r} className="boxes">{row.map((x, c) => <span key={c} className={`box${prev?.[r]?.[c] !== undefined && prev[r][c] !== x ? ' changed' : ''}`}>{show(x)}</span>)}</div>)}</div>
  }
  if (Array.isArray(v)) {
    return <div className="boxes">{v.length ? v.map((x, i) => <span key={i} className={`box${Array.isArray(prev) && !same(prev[i], x) ? ' changed' : ''}`}>{show(x)}</span>) : <span className="why">empty</span>}</div>
  }
  return <code>{show(v)}</code>
}

function State({ state, prev, title }) {
  return (
    <div className="state">
      <p className="label">{title}</p>
      {Object.entries(state).map(([k, v]) => (
        <div key={k} className="var"><span className="mono">{k}</span><Value v={v} prev={prev?.[k]} /></div>
      ))}
    </div>
  )
}

// Predict the traced state after each step; checked against the real run. Then complexity questions.
// Credit per step: 1 first try, 0.5 second try, 0 if revealed. Score: steps 70%, questions 30%.
export default function TracerWorkspace({ exercise, onDone }) {
  const { steps, questions } = exercise
  const [k, setK] = useState(0)
  const [fields, setFields] = useState(() => Object.fromEntries(Object.keys(steps[0]).map((n) => [n, ''])))
  const [tries, setTries] = useState(0)
  const [verdict, setVerdict] = useState(null)
  const [credits, setCredits] = useState([])
  const [answers, setAnswers] = useState({})
  const tracing = k < steps.length
  const truth = steps[k]

  function check() {
    const wrong = Object.keys(truth).filter((n) => !same(parse(fields[n] ?? ''), truth[n]))
    if (!wrong.length) return setVerdict({ ok: true, credit: tries === 0 ? 1 : 0.5 })
    if (tries === 0) {
      setTries(1)
      return setVerdict({ ok: false, wrong })
    }
    setVerdict({ ok: false, wrong, credit: 0 })
  }

  function advance() {
    setCredits([...credits, verdict.credit])
    const next = steps[k + 1]
    if (next) setFields(Object.fromEntries(Object.keys(next).map((n) => [n, show(truth[n] ?? '')])))
    setK(k + 1)
    setTries(0)
    setVerdict(null)
  }

  const stepScore = credits.reduce((a, b) => a + b, 0) / steps.length
  const qScore = questions.length ? questions.filter((q, i) => answers[i] === q.answer).length / questions.length : 1
  const allAnswered = questions.every((_, i) => answers[i] !== undefined)

  return (
    <div className="panes two">
      <section className="pane">
        <Md>{exercise.brief}</Md>
        <CodeView value={exercise.code} />
      </section>
      <section className="pane">
        {tracing ? (
          <>
            <div className="dots-row">{steps.map((_, i) => <i key={i} className={i < credits.length ? (credits[i] === 1 ? 'ok' : credits[i] > 0 ? 'now' : 'no') : i === k ? 'now' : ''} />)}</div>
            <p className="label">Step {k + 1} of {steps.length}: what does the state look like at the next trace() call?</p>
            {k > 0 ? <State state={steps[k - 1]} prev={steps[k - 2]} title="State at the previous step" /> : <p className="why">Start from the input in the code.</p>}
            {Object.keys(truth).map((n) => (
              <label key={n} className="var">
                <span className="mono">{n}</span>
                <input className="mono" value={fields[n] ?? ''} onChange={(e) => setFields({ ...fields, [n]: e.target.value })} disabled={verdict?.credit !== undefined}
                  onKeyDown={(e) => e.key === 'Enter' && verdict?.credit === undefined && check()} placeholder="e.g. [1, 3, 2]" aria-label={`Value of ${n}`} />
              </label>
            ))}
            {verdict?.credit === undefined ? (
              <div className="row" style={{ margin: 0 }}>
                <button className="btn" onClick={check}>Check step</button>
                {verdict && <span className="bad">Not quite: {verdict.wrong.join(', ')}. One more try.</span>}
              </div>
            ) : (
              <div className="res" style={{ marginTop: 0 }}>
                <p className={verdict.ok ? 'good' : 'bad'}><b>{verdict.ok ? 'Right.' : 'Here’s what actually happened:'}</b></p>
                <State state={truth} prev={steps[k - 1]} title="Actual state" />
                <button className="btn" onClick={advance}>{k + 1 < steps.length ? 'Next step' : questions.length ? 'On to the questions' : 'See score'}</button>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="label">You traced {Math.round(stepScore * 100)}% of the steps correctly.</p>
            {questions.map((q, i) => (
              <fieldset key={i} className="choices">
                <legend><Md>{q.ask}</Md></legend>
                {q.choices.map((c, j) => (
                  <label key={j} className={answers[i] !== undefined ? (j === q.answer ? 'right' : answers[i] === j ? 'wrong' : '') : ''}>
                    <input type="radio" name={`q${i}`} checked={answers[i] === j} disabled={answers[i] !== undefined} onChange={() => setAnswers({ ...answers, [i]: j })} />
                    <Md>{c}</Md>
                  </label>
                ))}
                {answers[i] !== undefined && q.why && <p className="why">{q.why}</p>}
              </fieldset>
            ))}
            {allAnswered && (
              <div className="res" style={{ marginTop: 0 }}>
                <div className="score">{Math.round(stepScore * 70 + qScore * 30)}<small> /100</small></div>
                <button className="btn" onClick={() => onDone(Math.round(stepScore * 70 + qScore * 30))}>Record it</button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
