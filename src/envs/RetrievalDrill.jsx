import { useEffect, useState } from 'react'

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// A flashcard deck. Exact matches count automatically; otherwise the learner judges themselves after seeing the card.
export default function DrillWorkspace({ exercise, onDone, active }) {
  const [k, setK] = useState(0)
  const [input, setInput] = useState('')
  const [shown, setShown] = useState(false)
  const [marks, setMarks] = useState([])

  const cards = exercise.cards
  const right = marks.filter(Boolean).length
  const streak = marks.length - (marks.lastIndexOf(false) + 1)
  const finished = k === cards.length

  function mark(correct) {
    setMarks([...marks, correct])
    setK(k + 1)
    setInput('')
    setShown(false)
  }

  function reveal() {
    if (norm(input) && norm(input) === norm(cards[k].back)) mark(true)
    else setShown(true)
  }

  useEffect(() => {
    if (!active || !shown) return
    const onKey = (e) => {
      if (e.key === '1') mark(false)
      if (e.key === '2') mark(true)
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })

  return (
    <div className="panes center">
      <section className="pane" style={{ alignSelf: 'start' }}>
        <div className="dots-row" aria-label={`${marks.length} of ${cards.length} cards done`}>
          {cards.map((_, n) => <i key={n} className={n < marks.length ? (marks[n] ? 'ok' : 'no') : n === k ? 'now' : ''} />)}
        </div>
        <p className="why">{finished ? 'Deck done' : `Card ${k + 1} of ${cards.length}`}{streak > 1 ? ` · streak ${streak} 🔥` : ''}</p>
        {finished ? (
          <div className="res" style={{ marginTop: 0 }}>
            <div className="score">{right}/{cards.length}</div>
            <button className="btn" onClick={() => onDone(Math.round((right / cards.length) * 100))}>Record it</button>
          </div>
        ) : (
          <>
            <div className={`flash${shown ? ' flipped' : ''}`}>
              <div>
                <div>{cards[k].front}</div>
                {shown && <div className="back">{cards[k].back}</div>}
              </div>
            </div>
            {!shown ? (
              <>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && reveal()}
                  placeholder="Type your answer, or leave blank and press Enter to flip"
                  autoFocus={active}
                  aria-label="Your answer"
                />
                <div className="row" style={{ margin: 0 }}><button className="btn" onClick={reveal}>Check</button><span className="kbd">Enter</span></div>
              </>
            ) : (
              <div className="row" style={{ margin: 0 }}>
                {input && <span className="why">You said: “{input}”</span>}
                <button className="btn ghost" onClick={() => mark(false)}>Missed it <span className="kbd">1</span></button>
                <button className="btn" onClick={() => mark(true)}>I had it <span className="kbd">2</span></button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
