import Markdown from 'react-markdown'

// react-markdown does not render raw HTML, so model output can't inject markup.
export default function Md({ children }) {
  return <Markdown>{children}</Markdown>
}
