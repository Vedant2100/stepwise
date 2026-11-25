import { sessionCookie } from './auth.js'

export function respond(res, { status, data, token }, secure = true) {
  if (token !== undefined) res.setHeader('Set-Cookie', sessionCookie(token, secure))
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(data))
}

export const clientIp = (headers) => (headers['x-forwarded-for'] ?? '').split(',')[0].trim() || headers['x-real-ip'] || ''

export const vercel = (handle) => async (req, res) =>
  respond(res, await handle({ method: req.method, body: req.body, query: req.query ?? {}, ip: clientIp(req.headers), cookie: req.headers.cookie ?? '' }))
