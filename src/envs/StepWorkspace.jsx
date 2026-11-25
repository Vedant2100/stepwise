import { useState } from 'react'
import Md from '../components/Md.jsx'
import { ask } from '../lib/llm.js'
import { checkStepPrompt, system } from '../lib/prompts.js'
import { sameStep } from '../lib/stepcheck.js'

export default function StepWorkspace({ exercise, track, onDone }) {
  const [done, setDone] = useState([])
  const [input, setInput] = useState('')
  const [scratch, setScratch] = useState('')
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
    const credit = tries === 0 && !hinted ? 1 : 0.5
    if (sameStep(input, exercise.steps[i].expected)) return advance(input, credit)
    setBusy(true)
    try {
      const r = await ask(system(track), checkStepPrompt(exercise, i, done.map((d) => d.answer), input))
      if (r.ok) advance(input, credit)
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
    <div className="panes two">
      <section className="pane">
        <p className="label">Problem</p>
        <Md>{exercise.problem}</Md>
        <p className="label">Your derivation, {i} of {exercise.steps.length} steps</p>
        <ol className="steps">
          {done.map((d, k) => (
            <li key={k}>
              <b>Step {k + 1}</b>
              <div className="grow"><Md>{d.answer}</Md></div>
              <span className={d.credit === 1 ? 'good' : 'why'}>{d.credit === 1 ? '✓' : d.credit > 0 ? '✓ with help' : 'shown'}</span>
            </li>
          ))}
        </ol>
        {finished && (
          <div className="res">
            <div className="score">{score}<small> /100</small></div>
            <button className="btn" onClick={() => onDone(score)}>Record it</button>
          </div>
        )}
      </section>

      <section className="pane">
        {!finished && (
          <>
            <p className="label">Step {i + 1}</p>
            <textarea
              id="step"
              className="mono"
              rows={4}
              value={input}
              placeholder="Write this step. Use $...$ for math, e.g. $\frac{e^{x_i}}{\sum_j e^{x_j}}$"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && input.trim() && !busy && check()}
              aria-label="Current step"
            />
            {input.trim() && <div className="res" style={{ marginTop: 0 }}><p className="label">Preview</p><Md>{input}</Md></div>}
            {hinted && <p className="nudge">{exercise.steps[i].hint}</p>}
            {feedback && <p className="bad">{feedback}</p>}
            <div className="row" style={{ margin: 0 }}>
              <button className="btn" onClick={check} disabled={busy || !input.trim()}>{busy ? 'Checking…' : 'Check step'}</button>
              <span className="kbd">⌘/Ctrl + Enter</span>
              <button className="btn ghost sm" onClick={() => setHinted(true)} disabled={hinted || !exercise.steps[i].hint}>Hint</button>
              <button className="btn ghost sm" onClick={() => advance(exercise.steps[i].expected, 0)} disabled={tries === 0} title={tries ? '' : 'Try it first'}>
                Show this step
              </button>
            </div>
          </>
        )}
        <p className="label">Scratchpad</p>
        <textarea className="mono grow" style={{ minHeight: 140 }} value={scratch} onChange={(e) => setScratch(e.target.value)} placeholder="Work things out here. Not graded." aria-label="Scratchpad" />
      </section>
    </div>
  )
}
