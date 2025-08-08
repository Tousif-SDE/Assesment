import { useRef, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import { useSelector, useDispatch } from 'react-redux'

const CodeEditor = ({
  value,
  onChange,
  language = '71', // Default to Python
  readOnly = false,
  height = '400px',
}) => {
  const editorRef = useRef(null)
  const dispatch = useDispatch()
  const { isEditable } = useSelector((state) => state.editor)
  
  // Map language IDs to Monaco editor language identifiers
  const languageMap = {
    '71': 'python', // Python
    '63': 'javascript', // JavaScript
    '54': 'cpp', // C++
    '50': 'c', // C
    '62': 'java', // Java
  }
  
  const monacoLanguage = languageMap[language] || 'python'

  // Handle editor mount
  const handleEditorDidMount = (editor) => {
    editorRef.current = editor
    // Focus the editor when mounted if it's editable
    if (!readOnly && isEditable) {
      editor.focus()
    }
  }

  // Update editor options when readOnly or isEditable changes
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({
        readOnly: readOnly || !isEditable,
      })
    }
  }, [readOnly, isEditable])

  // Default code templates for different languages
  const getDefaultCode = () => {
    if (!value || value.trim() === '') {
      switch (language) {
        case '71': // Python
          return '# Write your Python code here\n\ndef main():\n    print("Hello, World!")\n\nif __name__ == "__main__":\n    main()'
        case '63': // JavaScript
          return '// Write your JavaScript code here\n\nfunction main() {\n    console.log("Hello, World!");\n}\n\nmain();'
        case '54': // C++
          return '#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}'
        case '50': // C
          return '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}'
        case '62': // Java
          return 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}'
        default:
          return ''
      }
    }
    return value
  }

  return (
    <div className="editor-container rounded overflow-hidden shadow-md">
      {/* Loading state could be added here if needed */}
      <Editor
        height={height}
        language={monacoLanguage}
        value={getDefaultCode()}
        onChange={onChange}
        onMount={handleEditorDidMount}
        options={{
          minimap: { enabled: true },
          scrollBeyondLastLine: false,
          fontSize: 14,
          readOnly: readOnly || !isEditable,
          automaticLayout: true,
          tabSize: 2,
          lineNumbers: 'on',
          roundedSelection: true,
          cursorStyle: 'line',
          wordWrap: 'on',
          renderLineHighlight: 'all',
          scrollbar: {
            vertical: 'auto',
            horizontal: 'auto',
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
        }}
        theme="vs-dark"
      />
    </div>
  )
}

export default CodeEditor