import { Suspense, lazy } from 'react'
import { ENVIRONMENTS, envFor } from '../lib/planner.js'
import ExplainWorkspace from '../envs/ExplainBack.jsx'
import DrillWorkspace from '../envs/RetrievalDrill.jsx'
import StepWorkspace from '../envs/StepWorkspace.jsx'
import SimWorkspace from '../envs/Simulation.jsx'

const CodeWorkspace = lazy(() => import('../envs/CodeSandbox.jsx'))
const ENV_COMPONENTS = { explain: ExplainWorkspace, steps: StepWorkspace, code: CodeWorkspace, drill: DrillWorkspace, sim: SimWorkspace }

// A full-screen workspace for one exercise. It stays mounted (just hidden) while the learner is back in the chat.
export default function Workspace({ it, track, open, busy, onClose, onSwitch, onDone }) {
  const concept = track.concepts.find((c) => c.id === it.conceptId)
  const Env = ENV_COMPONENTS[it.env]
  const recommended = envFor(concept.type)
  return (
    <div className="ws" hidden={!open} role="dialog" aria-label={`${ENVIRONMENTS[it.env].label}: ${concept.name}`}>
      <header className="ws-head">
        <button className="btn ghost sm" onClick={onClose}>← Chat</button>
        <span className={`chip${it.mode === 'review' ? ' rev' : ''}`}>{it.mode === 'review' ? `Review · ${ENVIRONMENTS[it.env].label}` : ENVIRONMENTS[it.env].label}</span>
        <b>{concept.name}</b>
        <span className="why">{track.title}</span>
        <select value={it.env} onChange={(e) => onSwitch(e.target.value)} disabled={busy} aria-label="Environment">
          {Object.entries(ENVIRONMENTS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}{k === recommended ? ' (recommended)' : ''}</option>
          ))}
        </select>
      </header>
      <div className="ws-body">
        <Suspense fallback={<p className="why">Loading the editor…</p>}>
          <Env exercise={it.exercise} track={track} concept={concept} onDone={onDone} active={open} />
        </Suspense>
      </div>
    </div>
  )
}
