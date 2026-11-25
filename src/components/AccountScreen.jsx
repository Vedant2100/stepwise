import { useEffect, useRef, useState } from 'react'
import { Mark } from './Icons.jsx'

const SYNC_LABEL = { saving: 'Saving…', synced: 'Everything is saved to your account.', offline: 'Offline. Changes will save when you’re back online.', error: 'Couldn’t save just now. Retrying.' }

export default function AccountScreen({ account, onClose }) {
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const first = useRef(null)

  useEffect(() => {
    first.current?.focus()
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  async function run(fn) {
    setBusy(true)
    setError('')
    try {
      await fn()
      onClose()
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  function submit(e) {
    e.preventDefault()
    if (!name.trim()) return setError('Enter a username.')
    if (password.length < 8) return setError('Passwords are at least 8 characters.')
    run(() => account.signIn(mode, name.trim(), password))
  }

  const register = mode === 'register'
  return (
    <div className="auth" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <button className="btn ghost sm auth-close" onClick={onClose}>Back</button>
      <div className="auth-card">
        <Mark size={44} />
        {account.username ? (
          <>
            <h1 id="auth-title">Signed in as {account.username}</h1>
            <p className="why">{SYNC_LABEL[account.status] ?? ''}</p>
            <p>Signing out removes your progress from this browser. It stays in your account.</p>
            {error && <p className="bad" role="alert">{error}</p>}
            <button ref={first} className="btn ghost wide" disabled={busy} onClick={() => run(account.signOut)}>{busy ? 'Signing out…' : 'Sign out'}</button>
          </>
        ) : (
          <form onSubmit={submit} noValidate>
            <h1 id="auth-title">{register ? 'Create your account' : 'Sign in'}</h1>
            <p className="why">{register ? 'Your progress in this browser comes with you.' : 'Pick up your climbs on any device.'}</p>
            <label>
              <span>Username</span>
              <input ref={first} value={name} onChange={(e) => setName(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} />
            </label>
            <label>
              <span>Password</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={register ? 'new-password' : 'current-password'} />
              {register && <small className="why">At least 8 characters.</small>}
            </label>
            {error && <p className="bad" role="alert">{error}</p>}
            <button className="btn wide" disabled={busy}>{busy ? 'One moment…' : register ? 'Create account' : 'Sign in'}</button>
            <p className="auth-switch">
              {register ? 'Already have an account?' : 'New to Stepwise?'}{' '}
              <button type="button" className="link" onClick={() => { setMode(register ? 'login' : 'register'); setError('') }}>{register ? 'Sign in' : 'Create an account'}</button>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
