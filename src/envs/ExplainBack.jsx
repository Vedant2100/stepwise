import { useState } from 'react'
import Md from '../components/Md.jsx'
import { ask } from '../lib/llm.js'
import { gradeExplainPrompt, system } from '../lib/prompts.js'

export default function ExplainBack({ exercise, track, onDone }) {
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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
    <div className="space-y-4">
      <Md>{exercise.question}</Md>
      <textarea
        className="field h-40"
        placeholder="Explain it in your own words…"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        disabled={Boolean(result)}
      />
      {!result && (
        <button className="btn" onClick={submit} disabled={busy || answer.trim().length < 10}>
          {busy ? 'Grading…' : 'Submit'}
        </button>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {result && (
        <div className="space-y-3">
          <p className="text-2xl font-semibold">
            {result.score}
            <span className="text-sm font-normal text-stone-500"> /100</span>
          </p>
          <p className="text-sm font-medium">{result.verdict}</p>
          {result.missing?.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold">Missing</h4>
              <ul className="list-disc pl-5 text-sm">{result.missing.map((m) => <li key={m}>{m}</li>)}</ul>
            </div>
          )}
          <details>
            <summary className="cursor-pointer text-sm">Model answer</summary>
            <Md>{exercise.reference}</Md>
          </details>
          <button className="btn" onClick={() => onDone(result.score)}>Continue</button>
        </div>
      )}
    </div>
  )
}
