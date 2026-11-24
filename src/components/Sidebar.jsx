import { BKT, MASTERED, isMastered } from '../lib/learner.js'
import { ENVIRONMENTS, envFor, nextStep } from '../lib/planner.js'
import { Mark } from './Icons.jsx'

// The climb, drawn as a staircase rising left to right. Each step's height is its place in the climb;
// marigold fills it as mastery grows; the flag marks the step the planner would pick next.
function Staircase({ concepts, here, onPick }) {
  const n = concepts.length
  const W = 264, H = 120, gap = 3
  const w = (W - gap * (n - 1)) / n
  return (
    <svg className="staircase" viewBox={`0 0 ${W} ${H + 18}`} role="img" aria-label="Progress up the climb">
      {concepts.map((c, i) => {
        const h = ((i + 1) / n) * H
        const x = i * (w + gap)
        // Fill from the starting guess (empty) to the mastery line (full), so untouched steps show no gold.
        const fill = Math.max(0, Math.min(1, (c.pL - BKT.init) / (MASTERED - BKT.init))) * h
        return (
          <g key={c.id} className="step" onClick={() => onPick(c)}>
            <title>{`${c.name}: ${Math.round(c.pL * 100)}%`}</title>
            <rect x={x} y={18 + H - h} width={w} height={h} rx="4" className="riser" />
            <rect x={x} y={18 + H - fill} width={w} height={fill} rx="4" className="mastery" />
            {c.id === here && (
              <g transform={`translate(${x + w / 2}, ${18 + H - h - 3})`} className="flag">
                <path d="M0 0V-15" />
                <path d="M0 -15h9l-3 4 3 4H0" className="pennant" />
              </g>
            )}
          </g>
        )
      })}
    </svg>
  )
}

function Climb({ track, onPick }) {
  const here = nextStep(track.concepts, Date.now())?.concept.id
  const done = (id) => isMastered(track.concepts.find((c) => c.id === id))
  return (
    <div>
      <h2>The climb</h2>
      <Staircase concepts={track.concepts} here={here} onPick={onPick} />
      {here && <p className="next-up">Next up: <b>{track.concepts.find((c) => c.id === here).name}</b></p>}
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
    </div>
  )
}

const SYNC_LABEL = { saving: 'Saving…', synced: 'Synced', offline: 'Offline, will retry', error: 'Couldn’t sync, retrying' }

export default function Sidebar({ tracks, activeId, setActiveId, open, onClose, onNew, onPick, onSettings, dark, toggleTheme, account, onAccount }) {
  const active = tracks.find((t) => t.id === activeId)
  return (
    <>
    {open && <div className="scrim" onClick={onClose} aria-hidden="true" />}
    <aside className={`side${open ? ' open' : ''}`} aria-label="Objectives">
      <button className="brand" onClick={onNew}><Mark /> Stepwise</button>
      {tracks.length > 0 && (
        <div>
          <h2>Objectives</h2>
          <div className="goals">
            {tracks.map((t) => {
              const done = t.concepts.filter(isMastered).length
              return (
                <button key={t.id} className="goal" aria-current={t.id === activeId} onClick={() => setActiveId(t.id)}>
                  <span>{t.title}</span>
                  <div className="meter"><i style={{ width: `${(done / t.concepts.length) * 100}%` }} /></div>
                  <small>{done} of {t.concepts.length} mastered{tracks.some((o) => o !== t && o.title === t.title) && t.createdAt ? `, started ${new Date(t.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}</small>
                </button>
              )
            })}
          </div>
          <button className="btn ghost sm new" onClick={onNew}>New objective</button>
        </div>
      )}
      {active && <Climb track={active} onPick={(c) => onPick(active, c)} />}
      {!tracks.length && (
        <div className="empty-climb">
          <Staircase concepts={[0.15, 0.3, 0.45, 0.6, 0.75].map((v, i) => ({ id: String(i), name: '', pL: 0 }))} onPick={() => {}} />
          <p>Your goals and the climb toward each one will show up here.</p>
        </div>
      )}
      <div className="who">
        {account.username ? (
          <>
            <span>Signed in as <b>{account.username}</b></span>
            <small className={`sync ${account.status}`}>{SYNC_LABEL[account.status]}</small>
          </>
        ) : (
          <button className="btn gold sm" onClick={onAccount}>Sign in to sync</button>
        )}
      </div>
      <div className="side-foot" style={{ marginTop: 0 }}>
        <button className="btn ghost sm" onClick={onSettings}>Settings</button>
        {account.username && <button className="btn ghost sm" onClick={onAccount}>Account</button>}
        <button className="btn ghost sm" onClick={toggleTheme}>{dark ? 'Light mode' : 'Dark mode'}</button>
      </div>
    </aside>
    </>
  )
}
