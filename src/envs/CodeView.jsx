import CodeMirror from '@uiw/react-codemirror'
import { python } from '@codemirror/lang-python'

const extensions = [python()]
export const isDark = () => {
  const t = document.documentElement.dataset.theme
  return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
}

// Python code, highlighted; read-only unless onChange is given.
export default function CodeView({ value, onChange, height, onRun }) {
  return (
    <div
      className="codeview"
      onKeyDownCapture={(e) => {
        if (onRun && (e.shiftKey || e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault()
          onRun()
        }
      }}
    >
      <CodeMirror
        value={value}
        height={height}
        extensions={extensions}
        theme={isDark() ? 'dark' : 'light'}
        editable={Boolean(onChange)}
        onChange={onChange}
        basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: Boolean(onChange) }}
      />
    </div>
  )
}
