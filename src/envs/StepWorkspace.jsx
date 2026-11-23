import { useState } from 'react'
import Md from '../components/Md.jsx'
import { ask } from '../lib/llm.js'
import { checkStepPrompt, system } from '../lib/prompts.js'

// Credit per step: 1 if right on the first try with no hint, 0.5 if right after a hint or retry, 0 if revealed.
export default function StepWorkspace({ exercise, track, onDone }) {
  const [done, setDone] = useState([])
  const [input, setInput] = useState('')
  const [tries, setTries] = useState(0)
  const [hinted, setHinted] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const i = done.length
  const finished = i === exercise.steps.length
  const score = finished ? Math.round((done.reduce((s, d) => s + d.credit, 0) / done.length) * 100) : 0

  function advance(answer, credit) {
    setDone([...done, { answer, credit }])
    setInput('')
    setTries(0)
    setHinted(false)
    setFeedback('')
  }

  async function check() {
    setBusy(true)
    try {
      const r = await ask(system(track), checkStepPrompt(exercise, i, done.map((d) => d.answer), input))
      if (r.ok) advance(input, tries === 0 && !hinted ? 1 : 0.5)
      else {
        setTries(tries + 1)
        setFeedback(r.feedback || 'Not quite.')
      }
    } catch (e) {
      setFeedback(e.message)
    }
    setBusy(false)
  }

  return (
    <>
      <Md>{exercise.problem}</Md>
      <ol className="steps">
        {done.map((d, k) => (
          <li key={k}>
            <b>Step {k + 1}</b>
            <span className="mono">{d.answer}</span>
            <span className={d.credit === 1 ? 'good' : 'why'}>{d.credit === 1 ? '✓' : d.credit > 0 ? '✓ with help' : 'shown'}</span>
          </li>
        ))}
      </ol>
      {!finished ? (
        <>
          <label className="why" htmlFor="step">Step {i + 1} of {exercise.steps.length}</label>
          <textarea id="step" className="mono" rows={3} value={input} onChange={(e) => setInput(e.target.value)} />
          {hinted && <p className="nudge">{exercise.steps[i].hint}</p>}
          {feedback && <p className="bad">{feedback}</p>}
          <div className="row">
            <button className="btn" onClick={check} disabled={busy || !input.trim()}>{busy ? 'Checking…' : 'Check step'}</button>
            <button className="btn ghost sm" onClick={() => setHinted(true)} disabled={hinted || !exercise.steps[i].hint}>Hint</button>
            <button className="btn ghost sm" onClick={() => advance(exercise.steps[i].expected, 0)} disabled={tries === 0}>Show this step</button>
          </div>
        </>
      ) : (
        <div className="res">
          <div className="score">{score}<small> /100</small></div>
          {!sent && <button className="btn" onClick={() => { setSent(true); onDone(score) }}>Record it</button>}
        </div>
      )}
    </>
  )
}
