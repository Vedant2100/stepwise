// Adapts framework-neutral handlers ({ method, body, cookie } -> { status, data, token? }) to Vercel's
// Node handler and to the Vite dev server.
import { sessionCookie } from './auth.js'

export function respond(res, { status, data, token }, secure = true) {
  if (token !== undefined) res.setHeader('Set-Cookie', sessionCookie(token, secure))
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(data))
}

export const vercel = (handle) => async (req, res) =>
  respond(res, await handle({ method: req.method, body: req.body, cookie: req.headers.cookie ?? '' }))
