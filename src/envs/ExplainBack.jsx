import { useState } from 'react'
import Md from '../components/Md.jsx'
import { ask } from '../lib/llm.js'
import { gradeExplainPrompt, system } from '../lib/prompts.js'

export default function ExplainBack({ exercise, track, onDone }) {
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function submit() {
    setBusy(true)
    setError('')
    try {
      const r = await ask(system(track), gradeExplainPrompt(exercise, answer))
      setResult({ ...r, score: Math.max(0, Math.min(100, Math.round(Number(r.score) || 0))) })
    } catch (e) {
      setError(e.message)
    }
    setBusy(false)
  }

  return (
    <>
      <Md>{exercise.question}</Md>
      <textarea rows={6} placeholder="Explain it in your own words…" value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={Boolean(result)} aria-label="Your explanation" />
      {!result && (
        <div className="row">
          <button className="btn" onClick={submit} disabled={busy || answer.trim().length < 10}>{busy ? 'Grading…' : 'Submit'}</button>
        </div>
      )}
      {error && <p className="bad">{error}</p>}
      {result && (
        <div className="res">
          <div className="score">{result.score}<small> /100</small></div>
          <p><b>{result.verdict}</b></p>
          {result.covered?.length > 0 && (<><h3>Solid</h3><ul>{result.covered.map((m) => <li key={m}>{m}</li>)}</ul></>)}
          {result.missing?.length > 0 && (<><h3>Gaps</h3><ul>{result.missing.map((m) => <li key={m}>{m}</li>)}</ul></>)}
          <details><summary>Model answer</summary><Md>{exercise.reference}</Md></details>
          {!sent && <button className="btn" onClick={() => { setSent(true); onDone(result.score) }}>Record it</button>}
        </div>
      )}
    </>
  )
}
