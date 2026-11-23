import { Suspense, lazy, useState } from 'react'
import { isMastered, recordAttempt } from '../lib/learner.js'
import { ENVIRONMENTS, envFor, nextReviewAt, nextStep } from '../lib/planner.js'
import { makeExercise } from '../lib/exercise.js'
import ExplainBack from '../envs/ExplainBack.jsx'
import RetrievalDrill from '../envs/RetrievalDrill.jsx'
import StepWorkspace from '../envs/StepWorkspace.jsx'

const CodeSandbox = lazy(() => import('../envs/CodeSandbox.jsx'))
const ENV_COMPONENTS = { explain: ExplainBack, steps: StepWorkspace, code: CodeSandbox, drill: RetrievalDrill }
const TYPE_LABEL = { concept: 'Concept', procedure: 'Procedure', skill: 'Skill', recall: 'Recall' }
const fmtDate = (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

export default function TrackView({ track, update, remove, back }) {
  const [picked, setPicked] = useState(null)
  const [envChoice, setEnvChoice] = useState(null)
  const [session, setSession] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const now = Date.now()
  const planned = nextStep(track.concepts, now)
  const pickedConcept = track.concepts.find((c) => c.id === picked)
  const step = pickedConcept ? { concept: pickedConcept, mode: isMastered(pickedConcept) ? 'review' : 'learn' } : planned
  const env = step && (envChoice ?? envFor(step.concept.type))
  const done = track.concepts.filter(isMastered).length

  async function start() {
    setBusy(true)
    setError('')
    try {
      setSession({ ...step, env, exercise: await makeExercise(env, step.concept, track, step.mode), started: Date.now() })
    } catch (e) {
      setError(e.status === 401 ? 'This deployment needs an access code. Add it in Settings on the home page.' : e.message)
    }
    setBusy(false)
  }

  function finish(score) {
    const { concept, env, mode, started } = session
    update({
      ...track,
      concepts: track.concepts.map((c) => (c.id === concept.id ? recordAttempt(c, score, Date.now()) : c)),
      log: [...track.log, { conceptId: concept.id, env, defaultEnv: envFor(concept.type), mode, score, at: Date.now(), ms: Date.now() - started }],
    })
    setSession(null)
    setPicked(null)
    setEnvChoice(null)
  }

  if (session) {
    const Env = ENV_COMPONENTS[session.env]
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-stone-500">{ENVIRONMENTS[session.env].label} · {session.mode}</p>
            <h2 className="text-lg font-semibold">{session.concept.name}</h2>
          </div>
          <button className="btn-ghost" onClick={() => setSession(null)}>Leave</button>
        </div>
        <div className="card">
          <Suspense fallback={<p className="text-sm">Loading editor…</p>}>
            <Env exercise={session.exercise} track={track} onDone={finish} />
          </Suspense>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <button className="text-sm text-stone-500 hover:underline" onClick={back}>← All objectives</button>
          <h2 className="mt-1 text-xl font-semibold">{track.title}</h2>
          <p className="text-sm text-stone-500">{track.objective}</p>
        </div>
        <button className="btn-ghost shrink-0 text-red-600" onClick={() => confirm(`Delete "${track.title}" and its progress?`) && remove()}>Delete</button>
      </div>

      <section className="card space-y-3">
        {step ? (
          <>
            <p className="text-sm text-stone-500">{pickedConcept ? 'You picked' : step.mode === 'review' ? 'Due for review' : 'Up next'}</p>
            <h3 className="text-lg font-semibold">{step.concept.name}</h3>
            <p className="text-sm">{step.concept.summary}</p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm" htmlFor="env">Environment</label>
              <select id="env" className="field w-auto" value={env} onChange={(e) => setEnvChoice(e.target.value)}>
                {Object.entries(ENVIRONMENTS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}{k === envFor(step.concept.type) ? ' (recommended)' : ''}</option>
                ))}
              </select>
              <button className="btn" onClick={start} disabled={busy}>{busy ? 'Building…' : 'Start'}</button>
              {pickedConcept && <button className="btn-ghost" onClick={() => setPicked(null)}>Back to plan</button>}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </>
        ) : (
          <p className="text-sm">Everything is mastered. Next review: {fmtDate(nextReviewAt(track.concepts))}. Pick any concept below to practice anyway.</p>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">Concepts · {done}/{track.concepts.length} mastered</h3>
        <ul className="space-y-2">
          {track.concepts.map((c) => {
            const locked = !c.prereqs.every((id) => isMastered(track.concepts.find((x) => x.id === id)))
            return (
              <li key={c.id}>
                <button
                  className={`card block w-full p-3 text-left hover:border-stone-400 ${picked === c.id ? 'border-stone-900 dark:border-stone-100' : ''}`}
                  onClick={() => { setPicked(c.id); setEnvChoice(null) }}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{c.name}</span>
                    <span className="shrink-0 text-xs text-stone-500">
                      {TYPE_LABEL[c.type]} → {ENVIRONMENTS[envFor(c.type)].label}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-stone-500">
                    <div className="h-1.5 flex-1 rounded bg-stone-200 dark:bg-stone-800">
                      <div className={`h-1.5 rounded ${isMastered(c) ? 'bg-emerald-600' : 'bg-amber-500'}`} style={{ width: `${c.pL * 100}%` }} />
                    </div>
                    <span>{Math.round(c.pL * 100)}%</span>
                    {locked && <span>needs prerequisites</span>}
                    {c.review && <span>review {fmtDate(c.review.due)}</span>}
                    {c.grounded === true && <span title={c.quote}>grounded in source</span>}
                    {c.grounded === false && <span className="text-amber-700 dark:text-amber-400">quote not found in source</span>}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {track.log.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-semibold">Recent practice</h3>
          <ul className="text-sm">
            {track.log.slice(-8).reverse().map((l) => (
              <li key={l.at} className="flex justify-between border-b border-stone-200 py-1 dark:border-stone-800">
                <span>{track.concepts.find((c) => c.id === l.conceptId)?.name} · {ENVIRONMENTS[l.env].label}</span>
                <span className="text-stone-500">{l.score}/100 · {fmtDate(l.at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
