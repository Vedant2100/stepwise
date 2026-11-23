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
    <div className="space-y-4">
      <Md>{exercise.problem}</Md>
      <ol className="space-y-2">
        {done.map((d, k) => (
          <li key={k} className="rounded-md border border-stone-200 p-2 text-sm dark:border-stone-800">
            <span className="mr-2 text-stone-500">Step {k + 1}</span>
            <span className="font-mono">{d.answer}</span>
            <span className="ml-2">{d.credit === 1 ? '✓' : d.credit > 0 ? '✓ (with help)' : '(shown)'}</span>
          </li>
        ))}
      </ol>
      {!finished ? (
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="step">Step {i + 1} of {exercise.steps.length}</label>
          <textarea id="step" className="field h-20 font-mono" value={input} onChange={(e) => setInput(e.target.value)} />
          {hinted && <p className="text-sm text-amber-700 dark:text-amber-400">Hint: {exercise.steps[i].hint}</p>}
          {feedback && <p className="text-sm text-red-600">{feedback}</p>}
          <div className="flex gap-2">
            <button className="btn" onClick={check} disabled={busy || !input.trim()}>{busy ? 'Checking…' : 'Check step'}</button>
            <button className="btn-ghost" onClick={() => setHinted(true)} disabled={hinted || !exercise.steps[i].hint}>Hint</button>
            <button className="btn-ghost" onClick={() => advance(exercise.steps[i].expected, 0)} disabled={tries === 0}>
              Show this step
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-2xl font-semibold">{score}<span className="text-sm font-normal text-stone-500"> /100</span></p>
          <button className="btn" onClick={() => onDone(score)}>Continue</button>
        </div>
      )}
    </div>
  )
}
