// Small line icons, one per environment, plus the Stepwise mark (a staircase).
const svg = (children, size = 22) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)

export const EnvIcon = {
  explain: () => svg(<><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9h8M8 12h5" /></>),
  steps: () => svg(<><path d="M4 20h5v-5h5v-5h6" /><path d="M17 4h3v3" /></>),
  code: () => svg(<><path d="m8 7-5 5 5 5M16 7l5 5-5 5" /><path d="m13.5 5-3 14" /></>),
  drill: () => svg(<><rect x="3" y="7" width="13" height="13" rx="2" /><path d="M8 4h11a2 2 0 0 1 2 2v11" /></>),
  sim: () => svg(<><path d="M3 17c3-9 5-9 7-3s4 6 7-3" /><path d="M3 21h18" /><circle cx="17" cy="11" r="1.5" /></>),
}

export function Mark({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#1d5446" />
      <path d="M7 24h6v-5h6v-5h6V8" fill="none" stroke="#f0a81c" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
