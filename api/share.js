// POST a climb snapshot -> { id }; GET ?id= -> the snapshot. Public; see server/share.js.
import { sharedStore } from '../server/store.js'
import { vercel } from '../server/http.js'
import { handleShare } from '../server/share.js'

export default vercel((r) => handleShare(r, sharedStore()))
