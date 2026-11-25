import { useState } from 'react'
import Md from '../components/Md.jsx'
import { ask } from '../lib/llm.js'
import { gradeExplainPrompt, system } from '../lib/prompts.js'

function passage(source, quote) {
  const at = quote ? source.toLowerCase().indexOf(quote.toLowerCase()) : -1
  if (at < 0) return ''
  return source.slice(Math.max(0, at - 300), at + quote.length + 300).trim()
}

export default function ExplainWorkspace({ exercise, track, concept, onDone }) {
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const words = answer.trim() ? answer.trim().split(/\s+/).length : 0
  const text = passage(track.source, concept.quote)

  async function submit() {
    setBusy(true)
    setError('')
    try {
      const r = await ask(system(track), gradeExplainPrompt(exercise, answer))
      setResult({ ...r, score: Math.max(0, Math.min(100, Math.round(Number(r.score) || 0))), points: Array.isArray(r.points) ? r.points : [] })
    } catch (e) {
      setError(e.message)
    }
    setBusy(false)
  }

  return (
    <div className="panes two">
      <section className="pane">
        <p className="label">Question</p>
        <Md>{exercise.question}</Md>
        <p className="label">A full answer covers {exercise.rubric.length} points</p>
        <ul className="steps">
          {exercise.rubric.map((point, k) => {
            const p = result?.points[k]
            return (
              <li key={k}>
                <b className={p ? (p.met ? 'good' : 'bad') : ''}>{p ? (p.met ? '✓' : '✗') : k + 1}</b>
                <div className="grow">
                  {result ? point : <span className="why">Revealed after you answer</span>}
                  {p?.note && <div className="why">{p.note}</div>}
                </div>
              </li>
            )
          })}
        </ul>
        {result && text && (
          <>
            <p className="label">From your source</p>
            <blockquote className="primer" style={{ margin: 0 }}>{text}</blockquote>
          </>
        )}
      </section>

      <section className="pane">
        <p className="label">Your explanation ({words} words)</p>
        <textarea
          className="grow"
          style={{ minHeight: 220 }}
          placeholder="Explain it in your own words, as if teaching a classmate…"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && !result && words >= 3 && !busy && submit()}
          disabled={Boolean(result)}
          aria-label="Your explanation"
        />
        {!result && (
          <div className="row" style={{ margin: 0 }}>
            <button className="btn" onClick={submit} disabled={busy || words < 3}>{busy ? 'Grading…' : 'Submit'}</button>
            <span className="kbd">⌘/Ctrl + Enter</span>
          </div>
        )}
        {error && <p className="bad">{error}</p>}
        {result && (
          <div className="res" style={{ marginTop: 0 }}>
            <div className="score">{result.score}<small> /100</small></div>
            <p><b>{result.verdict}</b></p>
            <details><summary>Model answer</summary><Md>{exercise.reference}</Md></details>
            <button className="btn" onClick={() => onDone(result.score)}>Record it</button>
          </div>
        )}
      </section>
    </div>
  )
}
