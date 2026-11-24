import { useState } from 'react'
import Md from './Md.jsx'
import Progress from './Progress.jsx'
import Settings from './Settings.jsx'
import AccountForm from './AccountForm.jsx'
import { EnvIcon, Mark } from './Icons.jsx'
import { ACCESS_KEY } from '../lib/llm.js'
import { ENVIRONMENTS, alternativesFor, envFor } from '../lib/planner.js'
const TYPE_LABEL = { concept: 'Concept', procedure: 'Procedure', skill: 'Skill', recall: 'Recall', intuition: 'Intuition', reading: 'Code reading', ordering: 'Ordering', data: 'Data', algorithm: 'Algorithm' }

// The teacher speaks without a bubble, next to the Stepwise mark.
export const Avatar = () => <span className="avatar"><Mark size={30} /></span>

function Teacher({ err, wide, children }) {
  return (
    <div className={`msg t${err ? ' err' : ''}${wide ? ' wide' : ''}`}>
      <Avatar />
      <div className="body">{children}</div>
    </div>
  )
}

export default function FeedItem({ it, data, setData, actions, busy, openWs }) {
  const track = data.tracks.find((t) => t.id === it.trackId)

  switch (it.kind) {
    case 'me':
      return <div className="msg me">{it.text}</div>

    case 't':
      return (
        <Teacher err={it.err}>
          <Md>{it.text}</Md>
          {it.next && (
            <div className="row">
              <button className="btn sm" onClick={() => actions.next()} disabled={busy}>Next exercise</button>
            </div>
          )}
        </Teacher>
      )

    case 'plan':
      if (!track) return null
      return (
        <Teacher wide>
          <p>Here’s the climb for <b>{track.title}</b>: {track.concepts.length} concepts, each with the practice that suits it. We start at the bottom.</p>
          <ol className="plan-stairs">
            {track.concepts.map((c, i) => (
              <li key={c.id} style={{ '--i': i }}>
                <span>{c.name}</span>
                <small>{TYPE_LABEL[c.type]}, practiced in {ENVIRONMENTS[envFor(c.type)].label.toLowerCase()}</small>
                {c.grounded === false && <span className="warn">Quote not found in your source</span>}
              </li>
            ))}
          </ol>
        </Teacher>
      )

    case 'exercise': {
      if (!track) return null
      const concept = track.concepts.find((c) => c.id === it.conceptId)
      const Icon = EnvIcon[it.env]
      const status = {
        finished: 'Recorded',
        skipped: 'Skipped',
        switched: 'Switched to another workspace',
      }[it.done] ?? (it.mode === 'review' ? 'Spaced review, ready' : 'Ready when you are')
      return (
        <div className={`launch${openWs === it.id ? ' open' : ''}`}>
          <span className="glyph"><Icon /></span>
          <div>
            <small>{ENVIRONMENTS[it.env].label}</small>
            <b>{concept.name}</b>
            <small>{status}</small>
          </div>
          {!it.done && (
            <div className="try">
              <span>Or try it as</span>
              {alternativesFor(it.env, data.tracks).map((env) => {
                const Alt = EnvIcon[env]
                return <button key={env} className="btn ghost xs" disabled={!!busy} onClick={() => actions.switchEnv(env)}><Alt /> {ENVIRONMENTS[env].label}</button>
              })}
            </div>
          )}
          {it.done === 'finished' ? (
            <span className="done-score">{it.score}<small>/100</small></span>
          ) : !it.done ? (
            <button className="btn sm" onClick={() => actions.openWorkspace(it.id)}>Open workspace</button>
          ) : <span />}
        </div>
      )
    }

    case 'progress':
      return <Teacher wide><Progress tracks={data.tracks} actions={actions} busy={busy} /></Teacher>

    case 'settings':
      return <Teacher wide><Settings data={data} changeTracks={actions.changeTracks} /></Teacher>

    case 'account':
      return <Teacher><AccountForm account={actions.account} /></Teacher>

    case 'access':
      return <Teacher><AccessPrompt /></Teacher>

    case 'confirmDelete':
      return <Teacher><ConfirmDelete track={track} onYes={() => actions.remove(it.trackId)} /></Teacher>

    default:
      return null
  }
}

function AccessPrompt() {
  const [code, setCode] = useState('')
  const [saved, setSaved] = useState(false)
  return (
    <div>
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
    <div>
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
