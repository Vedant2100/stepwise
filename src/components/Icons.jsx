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
  readcode: () => svg(<><path d="m7 8-4 4 4 4" /><circle cx="15" cy="12" r="4" /><path d="m18 15 3 3" /></>),
  sort: () => svg(<><path d="M4 6h10M4 12h7M4 18h4" /><path d="M18 4v16M15 17l3 3 3-3" /></>),
  notebook: () => svg(<><rect x="4" y="3" width="16" height="7" rx="2" /><rect x="4" y="14" width="16" height="7" rx="2" /><path d="M8 6.5h5M8 17.5l2-2 2 1.5 3-3" /></>),
  absorb: () => svg(<><path d="M3 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H3z" /><path d="M21 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z" /></>),
  interview: () => svg(<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" /></>),
  trace: () => svg(<><circle cx="5" cy="6" r="2" /><circle cx="12" cy="18" r="2" /><circle cx="19" cy="6" r="2" /><path d="M6.5 7.5 10.5 16M13.5 16l4-8.5" /></>),
}

export function Mark({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#1d5446" />
      <path d="M7 24h6v-5h6v-5h6V8" fill="none" stroke="#f0a81c" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export const PanelIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16" />
  </svg>
)

export const GearIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </svg>
)

const line = (children) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
)
export const ShareIcon = () => line(<><path d="M12 15V3M7 8l5-5 5 5" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></>)
export const MapIcon = () => line(<><rect x="4" y="3" width="16" height="5" rx="1.5" /><rect x="4" y="16" width="16" height="5" rx="1.5" /><path d="M12 8v8M9 13l3 3 3-3" /></>)
