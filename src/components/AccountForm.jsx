import { useState } from 'react'

// Sign in, create an account, or (when signed in) sign out.
export default function AccountForm({ account }) {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  async function run(fn) {
    setBusy(true)
    setError('')
    try {
      setDone(await fn())
    } catch (e) {
      setError(e.message)
    }
    setBusy(false)
  }

  if (done) return <p className="good">{done}</p>

  if (account.username) {
    return (
      <div>
        <p>You’re signed in as <b>{account.username}</b>. Your progress syncs to your account and to any other device where you sign in.</p>
        <p className="why">Signing out removes your progress from this browser (it stays in your account).</p>
        {error && <p className="bad">{error}</p>}
        <button className="btn ghost sm" disabled={busy} onClick={() => run(async () => { await account.signOut(); return 'Signed out. This browser no longer has your progress; sign in again to get it back.' })}>Sign out</button>
      </div>
    )
  }

  const submit = (action) => run(async () => {
    const who = await account.signIn(action, name, password)
    return action === 'register' ? `Account created. Signed in as ${who}; your progress in this browser is now saved to it.` : `Signed in as ${who}. Progress from this browser and your account has been combined.`
  })

  return (
    <form className="account" onSubmit={(e) => { e.preventDefault(); submit('login') }}>
      <p>Sign in to keep your progress in your account and pick it up on any device. Anything you’ve done in this browser comes with you.</p>
      <label>
        <span className="why">Username</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} required />
      </label>
      <label>
        <span className="why">Password (at least 8 characters)</span>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" minLength={8} required />
      </label>
      {error && <p className="bad">{error}</p>}
      <div className="row">
        <button className="btn" disabled={busy || !name || password.length < 8}>{busy ? 'Working…' : 'Sign in'}</button>
        <button type="button" className="btn ghost" disabled={busy || !name || password.length < 8} onClick={() => submit('register')}>Create account</button>
      </div>
    </form>
  )
}
