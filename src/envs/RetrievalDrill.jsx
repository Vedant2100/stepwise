import { useState } from 'react'

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// Exact matches count automatically; otherwise the learner judges their own answer after seeing the card.
export default function RetrievalDrill({ exercise, onDone }) {
  const [k, setK] = useState(0)
  const [input, setInput] = useState('')
  const [shown, setShown] = useState(false)
  const [right, setRight] = useState(0)
  const [sent, setSent] = useState(false)

  const cards = exercise.cards
  const score = Math.round((right / cards.length) * 100)

  function mark(correct) {
    if (correct) setRight(right + 1)
    setK(k + 1)
    setInput('')
    setShown(false)
  }

  function reveal() {
    if (norm(input) === norm(cards[k].back)) mark(true)
    else setShown(true)
  }

  if (k === cards.length) {
    return (
      <div className="res">
        <div className="score">{right}/{cards.length}</div>
        {!sent && <button className="btn" onClick={() => { setSent(true); onDone(score) }}>Record it</button>}
      </div>
    )
  }

  return (
    <>
      <p className="why">Card {k + 1} of {cards.length}</p>
      <div className="flash">{cards[k].front}</div>
      <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !shown && reveal()} disabled={shown} aria-label="Your answer" />
      {!shown ? (
        <div className="row"><button className="btn" onClick={reveal}>Check</button></div>
      ) : (
        <>
          <p className="nudge">Answer: <b>{cards[k].back}</b></p>
          <div className="row">
            <button className="btn" onClick={() => mark(true)}>I had it</button>
            <button className="btn ghost" onClick={() => mark(false)}>Missed it</button>
          </div>
        </>
      )}
    </>
  )
}
