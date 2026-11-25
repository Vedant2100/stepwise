import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { ENVIRONMENTS, alternativesFor, envFor } from '../lib/planner.js'
import { EnvIcon } from './Icons.jsx'
import ExplainWorkspace from '../envs/ExplainBack.jsx'
import DrillWorkspace from '../envs/RetrievalDrill.jsx'
import StepWorkspace from '../envs/StepWorkspace.jsx'
import SimWorkspace from '../envs/Simulation.jsx'

const CodeWorkspace = lazy(() => import('../envs/CodeSandbox.jsx'))
const ReadCodeWorkspace = lazy(() => import('../envs/ReadCode.jsx'))
const NotebookWorkspace = lazy(() => import('../envs/Notebook.jsx'))
const TracerWorkspace = lazy(() => import('../envs/Tracer.jsx'))
const SortWorkspace = lazy(() => import('../envs/SortWorkspace.jsx'))
const InterviewRoom = lazy(() => import('../envs/InterviewRoom.jsx'))
const ReadRetain = lazy(() => import('../envs/ReadRetain.jsx'))
const ENV_COMPONENTS = {
  explain: ExplainWorkspace, steps: StepWorkspace, code: CodeWorkspace, drill: DrillWorkspace, sim: SimWorkspace,
  readcode: ReadCodeWorkspace, sort: SortWorkspace, notebook: NotebookWorkspace, trace: TracerWorkspace, interview: InterviewRoom, absorb: ReadRetain,
}

const IDLE_MS = 75_000

function nudgeReason(concept, track) {
  if ((concept.misses ?? 0) > 0) return 'stuck'
  const last = track.log.slice(-3)
  if (last.length === 3 && last.every((l) => l.env === last[0].env && l.score >= 85)) return 'bored'
  return null
}

const NUDGE = {
  stuck: 'Not clicking yet? The same idea from a different angle often helps.',
  idle: 'Stuck? Try this concept another way.',
  bored: 'On a roll. Mix it up with a different kind of practice.',
}

export default function Workspace({ it, track, open, busy, onClose, onSwitch, onDone }) {
  const concept = track.concepts.find((c) => c.id === it.conceptId)
  const Env = ENV_COMPONENTS[it.env]
  const recommended = envFor(concept.type)
  const tabs = [...new Set([it.env, recommended, ...alternativesFor(it.env, [track])])].slice(0, 4)
  const more = Object.keys(ENVIRONMENTS).filter((k) => !tabs.includes(k))
  const [nudge, setNudge] = useState(null)
  const [pending, setPending] = useState(null)
  const seen = useRef(false)
  const idle = useRef(null)

  const show = (why) => { if (!seen.current) { seen.current = true; setNudge(why) } }

  useEffect(() => {
    if (!open) return
    const why = nudgeReason(concept, track)
    const t = why && setTimeout(() => show(why), 1500)
    const reset = () => { clearTimeout(idle.current); idle.current = setTimeout(() => show('idle'), IDLE_MS) }
    reset()
    window.addEventListener('keydown', reset)
    window.addEventListener('pointerdown', reset)
    return () => { clearTimeout(t); clearTimeout(idle.current); window.removeEventListener('keydown', reset); window.removeEventListener('pointerdown', reset) }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  function pick(env) {
    if (env === it.env || busy) return
    setPending(env)
    setNudge(null)
    onSwitch(env)
  }

  const suggestions = alternativesFor(it.env, [track]).slice(0, 2)
  return (
    <div className={`ws${open ? ' open' : ''}`} inert={!open} aria-hidden={!open} role="dialog" aria-label={`${ENVIRONMENTS[it.env].label}: ${concept.name}`}>
      <header className="ws-head">
        <button className="btn ghost sm" onClick={onClose}>Back to chat</button>
        {it.mode === 'review' && <span className="chip">Review</span>}
        <span className="title"><b>{concept.name}</b><small>{track.title}</small></span>
        <nav className="env-tabs" aria-label="Practice this concept as">
          {tabs.map((k) => {
            const Icon = EnvIcon[k]
            return (
              <button key={k} className={`tab${k === it.env ? ' on' : ''}${k === pending && busy ? ' loading' : ''}`} aria-current={k === it.env} disabled={busy && k !== it.env} onClick={() => pick(k)} title={k === recommended ? 'Recommended for this concept' : `Practice as ${ENVIRONMENTS[k].label.toLowerCase()}`}>
                <Icon /> {ENVIRONMENTS[k].label}{k === recommended && k !== it.env && <i className="rec" aria-label="recommended" />}
              </button>
            )
          })}
          <details className="more">
            <summary aria-label="More workspaces">More</summary>
            <div className="menu">
              {more.map((k) => {
                const Icon = EnvIcon[k]
                return <button key={k} disabled={busy} onClick={(e) => { e.currentTarget.closest('details').open = false; pick(k) }}><Icon /> {ENVIRONMENTS[k].label}</button>
              })}
            </div>
          </details>
        </nav>
      </header>
      <div className="ws-body">
        <Suspense fallback={<p className="why">Loading the editor…</p>}>
          <Env exercise={it.exercise} track={track} concept={concept} onDone={onDone} active={open} />
        </Suspense>
      </div>
      {nudge && open && (
        <aside className="nudge" role="status">
          <p>{NUDGE[nudge]}</p>
          <div className="row">
            {suggestions.map((k) => {
              const Icon = EnvIcon[k]
              return <button key={k} className="btn sm" disabled={busy} onClick={() => pick(k)}><Icon /> {ENVIRONMENTS[k].label}</button>
            })}
            <button className="btn ghost sm" onClick={() => setNudge(null)}>Keep going</button>
          </div>
        </aside>
      )}
    </div>
  )
}
