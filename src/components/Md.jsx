import Markdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'

// react-markdown does not render raw HTML, so model output can't inject markup. Math renders with KaTeX.
export default function Md({ children }) {
  return <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{children}</Markdown>
}
