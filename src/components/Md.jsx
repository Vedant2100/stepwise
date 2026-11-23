import Markdown from 'react-markdown'

// react-markdown does not render raw HTML, so model output can't inject markup.
export default function Md({ children }) {
  return (
    <div className="prose-sw text-sm leading-relaxed">
      <Markdown>{children}</Markdown>
    </div>
  )
}
