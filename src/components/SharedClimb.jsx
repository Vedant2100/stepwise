import { useEffect, useState } from 'react'
import { ENVIRONMENTS, envFor } from '../lib/planner.js'
import { isMastered } from '../lib/learner.js'
import { PENDING_KEY, fetchClimb } from '../lib/share.js'
import { Mark } from './Icons.jsx'
import { Staircase } from './Sidebar.jsx'

const fmt = (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

export default function SharedClimb({ id }) {
  const [snap, setSnap] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchClimb(id).then((s) => { setSnap(s); document.title = `${s.title} · Stepwise` }, (e) => setError(e.message))
  }, [id])

  function start() {
    localStorage.setItem(PENDING_KEY, JSON.stringify(snap))
    location.href = '/'
  }

  if (error || !snap) {
    return (
      <div className="shared">
        <a className="brand" href="/"><Mark /> Stepwise</a>
        <div className="shared-card">{error ? <><h1>Climb not found</h1><p>{error}</p><a className="btn" href="/">Go to Stepwise</a></> : <p className="why">Loading…</p>}</div>
      </div>
    )
  }

  const done = snap.concepts.filter(isMastered).length
  return (
    <div className="shared">
      <a className="brand" href="/"><Mark /> Stepwise</a>
      <div className="shared-card">
        <p className="why">A shared climb{snap.startedAt ? `, started ${fmt(snap.startedAt)}` : ''}</p>
        <h1>{snap.title}</h1>
        <p className="shared-stat"><b>{done}</b> of {snap.concepts.length} concepts mastered</p>
        <div className="shared-stairs"><Staircase concepts={snap.concepts} onPick={() => {}} /></div>
        <ol className="shared-list">
          {snap.concepts.map((c) => (
            <li key={c.id} className={isMastered(c) ? 'done' : ''}>
              <b>{c.name}</b>
              <small>{ENVIRONMENTS[envFor(c.type)].label}{isMastered(c) ? ', mastered' : ''}</small>
            </li>
          ))}
        </ol>
        <button className="btn gold wide" onClick={start}>Start this climb</button>
        <p className="why center">Stepwise breaks a goal into concepts, picks the right kind of practice for each, and tracks what you’ve mastered. You start from the bottom.</p>
      </div>
    </div>
  )
}
