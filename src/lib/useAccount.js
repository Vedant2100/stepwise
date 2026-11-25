import { useCallback, useEffect, useRef, useState } from 'react'
import { call, merge } from './sync.js'

const PUSH_DELAY = 1500
const RETRY_DELAY = 15_000

export default function useAccount(data, dataRef, setData) {
  const [username, setUsername] = useState(data.sync.username)
  const [status, setStatus] = useState(data.sync.username ? 'saving' : 'off')
  const pushed = useRef(null)
  const busy = useRef(false)

  const apply = useCallback((next) => {
    dataRef.current = next
    setData(next)
  }, [dataRef, setData])

  const content = (d) => JSON.stringify([d.tracks, d.deleted])

  const push = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    setStatus('saving')
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const local = dataRef.current
        const r = await call('/api/data', 'PUT', { version: local.sync.version, tracks: local.tracks, deleted: local.deleted })
        if (r.status === 200) {
          pushed.current = content(local)
          apply({ ...dataRef.current, sync: { ...dataRef.current.sync, version: r.data.version } })
          setStatus(content(dataRef.current) === pushed.current ? 'synced' : 'saving')
          return
        }
        if (r.status === 409) {
          apply({ ...merge(dataRef.current, r.data), sync: { ...dataRef.current.sync, version: r.data.version } })
          continue
        }
        if (r.status === 401) {
          setUsername(null)
          apply({ ...dataRef.current, sync: { version: 0, username: null } })
          setStatus('off')
          return
        }
        setStatus('error')
        return
      }
      setStatus('error')
    } catch {
      setStatus('offline')
    } finally {
      busy.current = false
    }
  }, [apply, dataRef])

  const pullAndMerge = useCallback(async (name) => {
    const r = await call('/api/data')
    if (r.status !== 200) throw new Error(r.data.error || 'Could not load your saved progress.')
    apply({ ...merge(dataRef.current, r.data), sync: { version: r.data.version, username: name } })
    await push()
  }, [apply, dataRef, push])

  useEffect(() => {
    call('/api/auth').then(async (r) => {
      const name = r.data.username ?? null
      setUsername(name)
      if (name) await pullAndMerge(name)
      else {
        if (dataRef.current.sync.username) apply({ ...dataRef.current, sync: { version: 0, username: null } })
        setStatus('off')
      }
    }, () => setStatus(dataRef.current.sync.username ? 'offline' : 'off'))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!username) return
    const changed = content(data) !== pushed.current
    if (!changed && status !== 'offline' && status !== 'error') return
    const t = setTimeout(push, changed ? PUSH_DELAY : RETRY_DELAY)
    return () => clearTimeout(t)
  }, [data, username, status, push])

  async function signIn(action, name, password) {
    const r = await call('/api/auth', 'POST', { action, username: name, password })
    if (r.status !== 200) throw new Error(r.data.error || 'Sign-in failed.')
    setUsername(r.data.username)
    await pullAndMerge(r.data.username)
    return r.data.username
  }

  async function signOut() {
    await push()
    if (content(dataRef.current) !== pushed.current) throw new Error('Your latest progress hasn’t reached your account yet, so you’re still signed in. Check your connection and try again.')
    await call('/api/auth', 'POST', { action: 'logout' })
    setUsername(null)
    setStatus('off')
    pushed.current = null
    apply({ tracks: [], deleted: [], sync: { version: 0, username: null } })
  }

  const shown = status === 'synced' && username && content(data) !== pushed.current ? 'saving' : status
  return { username, status: shown, signIn, signOut }
}
