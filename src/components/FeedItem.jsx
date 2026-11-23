import { useState } from 'react'
import Md from './Md.jsx'
import Progress from './Progress.jsx'
import Settings from './Settings.jsx'
import { ACCESS_KEY } from '../lib/llm.js'
import { ENVIRONMENTS, envFor } from '../lib/planner.js'
const TYPE_LABEL = { concept: 'Concept', procedure: 'Procedure', skill: 'Skill', recall: 'Recall', intuition: 'Intuition' }

export default function FeedItem({ it, data, setData, actions, busy }) {
  const track = data.tracks.find((t) => t.id === it.trackId)

  switch (it.kind) {
    case 'me':
      return <div className="msg me">{it.text}</div>

    case 't':
      return (
        <div className={`msg t${it.err ? ' err' : ''}`}>
          <Md>{it.text}</Md>
          {it.next && (
            <div className="row">
              <button className="btn sm" onClick={() => actions.next()} disabled={busy}>Next →</button>
            </div>
          )}
        </div>
      )

    case 'plan':
      if (!track) return null
      return (
        <div className="msg t wide">
          <p><b>{track.title}</b> · {track.concepts.length} concepts, in order:</p>
          <ol className="plan">
            {track.concepts.map((c) => (
              <li key={c.id}>
                {c.name} <span className="why">{TYPE_LABEL[c.type]} → {ENVIRONMENTS[envFor(c.type)].label}</span>
                {c.grounded === false && <span className="chip warn" style={{ marginLeft: 8 }}>quote not found in source</span>}
              </li>
            ))}
          </ol>
        </div>
      )

    case 'exercise': {
      if (!track) return null
      const concept = track.concepts.find((c) => c.id === it.conceptId)
      return (
        <div className="msg t launch">
          <span className={`chip${it.mode === 'review' ? ' rev' : ''}`}>{ENVIRONMENTS[it.env].label}</span>
          <b>{concept.name}</b>
          {it.done === 'finished' && <span className="why">· {it.score}/100</span>}
          {(it.done === 'skipped' || it.done === 'switched') && <span className="why">· {it.done}</span>}
          {!it.done && <button className="btn sm" onClick={() => actions.openWorkspace(it.id)}>Open workspace</button>}
        </div>
      )
    }

    case 'progress':
      return <div className="msg t wide"><Progress tracks={data.tracks} actions={actions} busy={busy} /></div>

    case 'settings':
      return <div className="msg t wide"><Settings data={data} setData={setData} /></div>

    case 'access':
      return <AccessPrompt />

    case 'confirmDelete':
      return <ConfirmDelete track={track} onYes={() => actions.remove(it.trackId)} />

    default:
      return null
  }
}

function AccessPrompt() {
  const [code, setCode] = useState('')
  const [saved, setSaved] = useState(false)
  return (
    <div className="msg t">
      <p>This deployment needs an access code before I can call the model.</p>
      {saved ? (
        <p className="good">Saved. Send your message again.</p>
      ) : (
        <form className="row" onSubmit={(e) => { e.preventDefault(); localStorage.setItem(ACCESS_KEY, code); setSaved(true) }}>
          <input type="password" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Access code" aria-label="Access code" style={{ flex: 1 }} />
          <button className="btn sm" disabled={!code}>Save</button>
        </form>
      )}
    </div>
  )
}

function ConfirmDelete({ track, onYes }) {
  const [done, setDone] = useState(false)
  if (!track) return null
  return (
    <div className="msg t">
      <p>Delete <b>{track.title}</b> and its progress?</p>
      {!done && (
        <div className="row">
          <button className="btn danger sm" onClick={() => { setDone(true); onYes() }}>Delete it</button>
          <button className="btn ghost sm" onClick={() => setDone(true)}>Keep it</button>
        </div>
      )}
    </div>
  )
}
