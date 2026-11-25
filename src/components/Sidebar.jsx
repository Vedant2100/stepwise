import { useState } from 'react'
import { BKT, MASTERED, isMastered } from '../lib/learner.js'
import { ENVIRONMENTS, envFor, nextStep } from '../lib/planner.js'
import { GearIcon, Mark, PanelIcon } from './Icons.jsx'
import { STARTERS } from '../lib/starters.js'

export function Staircase({ concepts, here, onPick, now = Date.now() }) {
  const n = concepts.length
  const W = 264, H = 120, gap = 3
  const w = (W - gap * (n - 1)) / n
  const geo = (i) => ({ x: i * (w + gap), h: ((i + 1) / n) * H })
  const at = concepts.findIndex((c) => c.id === here)
  return (
    <svg className="staircase" viewBox={`0 0 ${W} ${H + 18}`} role="img" aria-label="Progress up the climb">
      {concepts.map((c, i) => {
        const { x, h } = geo(i)
        const level = Math.max(0, Math.min(1, (c.pL - BKT.init) / (MASTERED - BKT.init)))
        const fading = c.review && c.review.due <= now
        return (
          <g key={c.id} className={`step${isMastered(c) ? ' mastered' : ''}${fading ? ' fading' : ''}`} onClick={() => onPick(c)}>
            <title>{`${c.name}: ${Math.round(c.pL * 100)}%${fading ? ', review due' : ''}`}</title>
            <rect x={x} y={18 + H - h} width={w} height={h} rx="4" className="riser" />
            <rect x={x} y={18 + H - h} width={w} height={h} rx="4" className="mastery" style={{ transform: `scaleY(${level})` }} />
          </g>
        )
      })}
      {at >= 0 && (
        <g className="flag" style={{ transform: `translate(${geo(at).x + w / 2}px, ${18 + H - geo(at).h - 3}px)` }}>
          <path d="M0 0V-15" />
          <path d="M0 -15h9l-3 4 3 4H0" className="pennant" />
        </g>
      )}
    </svg>
  )
}

function Climb({ track, onPick, onShare }) {
  const here = nextStep(track.concepts, Date.now())?.concept.id
  const done = (id) => isMastered(track.concepts.find((c) => c.id === id))
  return (
    <div>
      <div className="climb-head">
        <h2>The climb</h2>
        <button className="btn ghost xs" onClick={onShare}>Share</button>
      </div>
      <Staircase concepts={track.concepts} here={here} onPick={onPick} />
      {here && <p className="next-up">Next up: <b>{track.concepts.find((c) => c.id === here).name}</b></p>}
      <details className="fold">
        <summary>All {track.concepts.length} concepts</summary>
        <div className="climb">
        {track.concepts.map((c) => {
          const locked = !c.prereqs.every(done)
          const state = c.id === here ? 'here' : isMastered(c) ? 'done' : locked ? 'locked' : ''
          return (
            <button key={c.id} className={`stair ${state}`} onClick={() => onPick(c)} title={locked ? 'Needs its prerequisites first' : `Practice ${c.name}`}>
              <span className="dot" aria-hidden="true" />
              <span className="name">
                {c.name}
                <small>{state === 'here' ? 'You are here' : state === 'done' ? 'Mastered' : `${ENVIRONMENTS[envFor(c.type)].label}, ${Math.round(c.pL * 100)}%${locked ? ', locked' : ''}`}</small>
              </span>
            </button>
          )
        })}
        </div>
      </details>
    </div>
  )
}

const SHOWN = 4
const SYNC_LABEL = { saving: 'Saving…', synced: 'Synced', offline: 'Offline, will retry', error: 'Couldn’t sync, retrying' }

export default function Sidebar({ tracks, activeId, setActiveId, open, onClose, onNew, onPick, onSettings, account, onAccount, onShare, onHide, onStarter, busy }) {
  const have = new Set(tracks.map((t) => t.objective.toLowerCase()))
  const starters = STARTERS.filter((s) => !have.has(s.toLowerCase()))
  const [allGoals, setAllGoals] = useState(false)
  const shown = allGoals || tracks.length <= SHOWN ? tracks : [...tracks.slice(0, SHOWN), ...tracks.slice(SHOWN).filter((t) => t.id === activeId)]
  const active = tracks.find((t) => t.id === activeId)
  return (
    <>
    {open && <div className="scrim" onClick={onClose} aria-hidden="true" />}
    <aside className={`side${open ? ' open' : ''}`} aria-label="Objectives">
      <div className="side-top">
        <button className="brand" onClick={onNew}><Mark /> Stepwise</button>
        <button className="icon-btn" onClick={onHide} aria-label="Hide sidebar" title="Hide sidebar"><PanelIcon /></button>
      </div>
      {tracks.length > 0 && (
        <div>
          <h2>Objectives</h2>
          <div className="goals">
            {shown.map((t) => {
              const done = t.concepts.filter(isMastered).length
              const twin = tracks.some((o) => o !== t && o.title === t.title) && t.createdAt
              return (
                <button key={t.id} className="goal" aria-current={t.id === activeId} onClick={() => setActiveId(t.id)} title={`${t.title}: ${done} of ${t.concepts.length} mastered`}>
                  <span>{t.title}</span>
                  <small aria-label={`${done} of ${t.concepts.length} mastered`}>{twin ? `${new Date(t.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ` : ''}{done}/{t.concepts.length}</small>
                  <div className="meter"><i style={{ width: `${(done / t.concepts.length) * 100}%` }} /></div>
                </button>
              )
            })}
          </div>
          {tracks.length > SHOWN && (
            <button className="link side-link" onClick={() => setAllGoals(!allGoals)}>{allGoals ? 'Show fewer' : `Show all ${tracks.length}`}</button>
          )}
          <button className="btn ghost sm new" onClick={onNew}>New objective</button>
        </div>
      )}
      {active && <Climb track={active} onPick={(c) => onPick(active, c)} onShare={() => onShare(active)} />}
      {tracks.length > 0 && starters.length > 0 && (
        <details className="fold">
          <summary>Ready-made climbs, free</summary>
          <div className="starters">
            {starters.map((s) => <button key={s} onClick={() => onStarter(s)} disabled={busy}>{s}</button>)}
          </div>
        </details>
      )}
      {!tracks.length && (
        <div className="empty-climb">
          <Staircase concepts={[0.15, 0.3, 0.45, 0.6, 0.75].map((v, i) => ({ id: String(i), name: '', pL: 0 }))} onPick={() => {}} />
          <p>Your goals and the climb toward each one will show up here.</p>
        </div>
      )}
      <div className="side-foot">
        {account.username ? (
          <button className="who" onClick={onAccount} title={SYNC_LABEL[account.status]}>
            <span className={`sync-dot ${account.status}`} aria-hidden="true" />
            <span><b>{account.username}</b><small>{SYNC_LABEL[account.status]}</small></span>
          </button>
        ) : (
          <button className="btn gold xs" onClick={onAccount}>Sign in to sync</button>
        )}
        <button className="icon-btn" onClick={onSettings} aria-label="Settings" title="Settings"><GearIcon /></button>
      </div>
    </aside>
    </>
  )
}
