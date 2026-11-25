const day = (t) => new Date(t).toDateString()

export function today(tracks, now = Date.now()) {
  const log = tracks.flatMap((t) => t.log)
  const done = log.filter((l) => day(l.at) === day(now)).length
  const reviewsDone = log.filter((l) => day(l.at) === day(now) && l.mode === 'review').length
  const due = tracks.flatMap((t) => t.concepts).filter((c) => c.review && c.review.due <= now).length
  const goal = Math.max(3, Math.min(8, reviewsDone + due + 1))
  const days = new Set(log.map((l) => day(l.at)))
  let streak = 0
  const d = new Date(now)
  if (!days.has(day(d))) d.setDate(d.getDate() - 1)
  while (days.has(day(d))) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  return { done, goal, due, streak, minutes: Math.max(0, goal - done) * 2 }
}
