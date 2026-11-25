import { useEffect, useRef, useState } from 'react'
import { ACCESS_KEY } from '../lib/llm.js'
import { download, parseData } from '../lib/storage.js'
import { REMINDER_KEY, canRemind, setReminder } from '../lib/reminder.js'

const SYNC_LABEL = { saving: 'Saving…', synced: 'Everything is saved to your account.', offline: 'Offline. Changes will save when you’re back online.', error: 'Couldn’t save just now. Retrying.' }

function Choice({ label, value, options, onChange }) {
  return (
    <div className="choice" role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{text}</button>
      ))}
    </div>
  )
}

export default function SettingsScreen({ data, changeTracks, account, theme, setTheme, look, setLook, onSignIn, focus, onClose }) {
  const [code, setCode] = useState(localStorage.getItem(ACCESS_KEY) ?? '')
  const [saved, setSaved] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [remind, setRemind] = useState(localStorage.getItem(REMINDER_KEY) ?? '')
  const codeRef = useRef(null)
  const backRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => {
    ;(focus === 'access' ? codeRef : backRef).current?.focus()
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [focus, onClose])

  async function importFile(file) {
    try {
      const imported = parseData(await file.text())
      const ids = new Set(data.tracks.map((t) => t.id))
      const fresh = imported.tracks.filter((t) => !ids.has(t.id))
      changeTracks((ts) => [...ts, ...fresh])
      setMessage(`Imported ${fresh.length} objective(s); ${imported.tracks.length - fresh.length} already here were skipped.`)
    } catch (e) {
      setMessage(e instanceof SyntaxError ? 'That file is not valid JSON.' : e.message)
    }
  }

  async function signOut() {
    setBusy(true)
    setMessage('')
    try {
      await account.signOut()
    } catch (e) {
      setMessage(e.message)
    }
    setBusy(false)
  }

  async function changeReminder(time) {
    const ok = await setReminder(time)
    if (!ok) return setMessage('Notifications are turned off for Stepwise. Allow them in your phone’s settings.')
    setRemind(time)
    localStorage.setItem(REMINDER_KEY, time)
  }

  function saveCode(e) {
    e.preventDefault()
    localStorage.setItem(ACCESS_KEY, code.trim())
    setSaved(true)
  }

  return (
    <div className="auth settings" role="dialog" onClick={(e) => e.target === e.currentTarget && onClose()} aria-modal="true" aria-labelledby="settings-title">
      <div className="auth-card settings-card">
        <div className="card-head">
          <h1 id="settings-title">Settings</h1>
          <button ref={backRef} className="icon-btn" onClick={onClose} aria-label="Close settings" title="Close (Esc)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <section>
          <h2>Account</h2>
          {account.username ? (
            <>
              <p>Signed in as <b>{account.username}</b>. <span className="why">{SYNC_LABEL[account.status] ?? ''}</span></p>
              <button className="btn ghost sm" disabled={busy} onClick={signOut}>{busy ? 'Signing out…' : 'Sign out'}</button>
              <p className="why small">Signing out clears this browser; your account keeps everything.</p>
            </>
          ) : (
            <>
              <p className="why">Sync your progress across devices.</p>
              <div className="row">
                <button className="btn sm" onClick={() => onSignIn('login')}>Sign in</button>
                <button className="btn ghost sm" onClick={() => onSignIn('register')}>Create account</button>
              </div>
            </>
          )}
        </section>

        <section>
          <h2>Appearance</h2>
          <div className="setting"><span>Theme</span><Choice label="Theme" value={theme} onChange={setTheme} options={[['', 'System'], ['light', 'Light'], ['dark', 'Dark']]} /></div>
          <div className="setting"><span>Look</span><Choice label="Look" value={look} onChange={setLook} options={[['solid', 'Solid'], ['glass', 'Liquid glass']]} /></div>
        </section>

        {canRemind && (
          <section>
            <h2>Daily reminder</h2>
            <p className="why">A daily nudge when today’s climb is ready.</p>
            <div className="setting">
              <label className="check"><input type="checkbox" checked={Boolean(remind)} onChange={(e) => changeReminder(e.target.checked ? '19:00' : '')} /> Remind me every day</label>
              {remind && <input type="time" value={remind} onChange={(e) => e.target.value && changeReminder(e.target.value)} aria-label="Reminder time" style={{ width: 'auto' }} />}
            </div>
          </section>
        )}

        <section>
          <h2>Access code</h2>
          <p className="why">Needed for your own goals and grading.</p>
          <form className="row" onSubmit={saveCode}>
            <input ref={codeRef} className="secret" autoComplete="off" autoCapitalize="off" spellCheck={false} data-1p-ignore data-lpignore="true" value={code} onChange={(e) => { setCode(e.target.value); setSaved(false) }} placeholder="Access code" aria-label="Access code" style={{ flex: 1 }} />
            <button className="btn sm">{saved ? 'Saved' : 'Save'}</button>
          </form>
        </section>

        <section>
          <h2>Your data</h2>
          <p className="why">Back up your progress or restore it.</p>
          <div className="row">
            <button className="btn ghost sm" onClick={() => download(data)} disabled={!data.tracks.length}>Export JSON</button>
            <button className="btn ghost sm" onClick={() => fileRef.current.click()}>Import JSON</button>
            <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => e.target.files[0] && importFile(e.target.files[0])} />
          </div>
        </section>
        {message && <p role="status">{message}</p>}
      </div>
    </div>
  )
}
