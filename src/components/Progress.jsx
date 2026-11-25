import { isMastered } from '../lib/learner.js'
import { ENVIRONMENTS, envFor } from '../lib/planner.js'

const fmtDate = (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

export default function Progress({ tracks, actions, busy }) {
  if (!tracks.length) return <p>Nothing yet. Tell me what you want to learn.</p>
  return tracks.map((t) => {
    const done = t.concepts.filter(isMastered).length
    return (
      <details key={t.id} className="tr">
        <summary>
          <b>{t.title}</b>
          <span className="why">{done} of {t.concepts.length} mastered · {t.log.length} {t.log.length === 1 ? 'session' : 'sessions'}</span>
          <div className="bar"><i className={done === t.concepts.length ? 'ok' : ''} style={{ width: `${(done / t.concepts.length) * 100}%` }} /></div>
        </summary>
        <ul className="plan" style={{ listStyle: 'none', paddingLeft: 0 }}>
          {t.concepts.map((c) => {
            const locked = !c.prereqs.every((id) => isMastered(t.concepts.find((x) => x.id === id)))
            return (
              <li key={c.id}>
                {c.name}{' '}
                <span className="why">
                  {ENVIRONMENTS[envFor(c.type)].label}, {Math.round(c.pL * 100)}%
                  {locked && ', needs prerequisites'}
                  {c.review && `, review ${fmtDate(c.review.due)}`}
                </span>
                <div className="bar"><i className={isMastered(c) ? 'ok' : ''} style={{ width: `${c.pL * 100}%` }} /></div>
              </li>
            )
          })}
        </ul>
        <div className="row">
          <button className="btn sm" onClick={() => actions.next(t.id)} disabled={busy}>Practice this</button>
          <button className="btn ghost sm danger" onClick={() => confirm(`Delete "${t.title}" and its progress?`) && actions.remove(t.id)}>Delete</button>
        </div>
      </details>
    )
  })
}
