import { useEffect, useState } from 'react'
import Home from './components/Home.jsx'
import TrackView from './components/TrackView.jsx'
import { load, save } from './lib/storage.js'

export default function App() {
  const [data, setData] = useState(load)
  const [openId, setOpenId] = useState(null)
  const [dark, setDark] = useState(() => localStorage.getItem('stepwise.theme') === 'dark')

  useEffect(() => save(data), [data])
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('stepwise.theme', dark ? 'dark' : 'light')
  }, [dark])

  const track = data.tracks.find((t) => t.id === openId)
  const update = (next) => setData({ tracks: data.tracks.map((t) => (t.id === next.id ? next : t)) })
  const remove = () => {
    setData({ tracks: data.tracks.filter((t) => t.id !== openId) })
    setOpenId(null)
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <button className="text-xl font-bold tracking-tight" onClick={() => setOpenId(null)}>Stepwise</button>
        <button className="btn-ghost" onClick={() => setDark(!dark)} aria-label="Toggle dark mode">{dark ? 'Light' : 'Dark'}</button>
      </header>
      {track ? (
        <TrackView key={track.id} track={track} update={update} remove={remove} back={() => setOpenId(null)} />
      ) : (
        <Home data={data} setData={setData} open={setOpenId} />
      )}
    </main>
  )
}
