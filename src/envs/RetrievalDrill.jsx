import { useState } from 'react'

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// Exact matches count automatically; otherwise the learner judges their own answer after seeing the card.
export default function RetrievalDrill({ exercise, onDone }) {
  const [k, setK] = useState(0)
  const [input, setInput] = useState('')
  const [shown, setShown] = useState(false)
  const [right, setRight] = useState(0)

  const cards = exercise.cards
  const finished = k === cards.length
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

  if (finished) {
    return (
      <div className="space-y-2">
        <p className="text-2xl font-semibold">{right}/{cards.length}</p>
        <button className="btn" onClick={() => onDone(score)}>Continue</button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-stone-500">Card {k + 1} of {cards.length}</p>
      <p className="text-lg">{cards[k].front}</p>
      <input
        className="field"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !shown && reveal()}
        disabled={shown}
        autoFocus
        aria-label="Your answer"
      />
      {!shown ? (
        <button className="btn" onClick={reveal}>Check</button>
      ) : (
        <div className="space-y-2">
          <p className="text-sm">Answer: <b>{cards[k].back}</b></p>
          <div className="flex gap-2">
            <button className="btn" onClick={() => mark(true)}>I had it</button>
            <button className="btn-ghost" onClick={() => mark(false)}>Missed it</button>
          </div>
        </div>
      )}
    </div>
  )
}
