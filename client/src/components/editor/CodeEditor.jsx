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

  return (
    <div 
      className="editor-container"
      style={{
        borderRadius: '20px',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(139, 92, 246, 0.1)',
        border: '1px solid rgba(226, 232, 240, 0.8)',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)'
      }}
    >
      <Editor
        height={height}
        language={monacoLanguage}
        value={value || getDefaultCode()}
        onChange={onChange}
        onMount={handleEditorDidMount}
        options={{
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 15,
          fontFamily: 'Monaco, Consolas, "Courier New", monospace',
          readOnly: readOnly || !isEditable,
          automaticLayout: true,
          tabSize: 2,
          lineNumbers: 'on',
          roundedSelection: false,
          cursorStyle: 'line',
          wordWrap: 'on',
          renderLineHighlight: 'all',
          scrollbar: {
            vertical: 'auto',
            horizontal: 'auto',
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
          },
          padding: {
            top: 20,
            bottom: 20,
            left: 20,
            right: 20
          },
          lineHeight: 24,
          cursorWidth: 2,
          smoothScrolling: true,
          mouseWheelScrollSensitivity: 1,
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
          overviewRulerLanes: 0,
          folding: true,
          foldingStrategy: 'indentation',
          showFoldingControls: 'always',
          foldingHighlight: true,
          foldingImportsByDefault: true,
          links: false,
          colorDecorators: true,
          lightbulb: {
            enabled: false
          },
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnCommitCharacter: true,
          acceptSuggestionOnEnter: 'on',
          wordBasedSuggestions: true,
          parameterHints: {
            enabled: true,
            cycle: true
          },
          autoIndent: 'full',
          formatOnPaste: true,
          formatOnType: true,
          dragAndDrop: false,
          copyWithSyntaxHighlighting: true,
          emptySelectionClipboard: false,
          find: {
            addExtraSpaceOnTop: false,
            autoFindInSelection: 'never',
            seedSearchStringFromSelection: 'never'
          },
          hover: {
            enabled: true,
            delay: 300,
            sticky: true
          }
        }}
        theme="vs"
        beforeMount={(monaco) => {
          // Customize the light theme to match Skelo design
          monaco.editor.defineTheme('skelo-light', {
            base: 'vs',
            inherit: true,
            rules: [
              { token: 'comment', foreground: '#6B7280', fontStyle: 'italic' },
              { token: 'keyword', foreground: '#8B5CF6', fontStyle: 'bold' },
              { token: 'string', foreground: '#059669' },
              { token: 'number', foreground: '#DC2626' },
              { token: 'type', foreground: '#1D4ED8' },
              { token: 'function', foreground: '#7C3AED' },
              { token: 'variable', foreground: '#374151' },
              { token: 'operator', foreground: '#6B7280' },
              { token: 'delimiter', foreground: '#6B7280' },
              { token: 'predefined', foreground: '#8B5CF6' }
            ],
            colors: {
              'editor.background': '#FFFFFF',
              'editor.foreground': '#374151',
              'editor.lineHighlightBackground': '#F8FAFC',
              'editor.lineHighlightBorder': '#E2E8F0',
              'editor.selectionBackground': '#E0E7FF',
              'editor.inactiveSelectionBackground': '#F3F4F6',
              'editorCursor.foreground': '#8B5CF6',
              'editorWhitespace.foreground': '#E5E7EB',
              'editorIndentGuide.background': '#F3F4F6',
              'editorIndentGuide.activeBackground': '#D1D5DB',
              'editorLineNumber.foreground': '#9CA3AF',
              'editorLineNumber.activeForeground': '#6B7280',
              'editorRuler.foreground': '#E5E7EB',
              'editorCodeLens.foreground': '#6B7280',
              'editorBracketMatch.background': '#E0E7FF',
              'editorBracketMatch.border': '#8B5CF6',
              'editorOverviewRuler.border': '#E5E7EB',
              'editorOverviewRuler.findMatchForeground': '#FBBF24',
              'editorOverviewRuler.selectionHighlightForeground': '#E0E7FF',
              'editorOverviewRuler.wordHighlightForeground': '#E0E7FF',
              'editorOverviewRuler.wordHighlightStrongForeground': '#E0E7FF',
              'editorOverviewRuler.modifiedForeground': '#3B82F6',
              'editorOverviewRuler.addedForeground': '#10B981',
              'editorOverviewRuler.deletedForeground': '#EF4444',
              'editorOverviewRuler.errorForeground': '#EF4444',
              'editorOverviewRuler.warningForeground': '#F59E0B',
              'editorOverviewRuler.infoForeground': '#3B82F6',
              'editorError.foreground': '#EF4444',
              'editorError.border': '#EF4444',
              'editorWarning.foreground': '#F59E0B',
              'editorWarning.border': '#F59E0B',
              'editorInfo.foreground': '#3B82F6',
              'editorInfo.border': '#3B82F6',
              'editorHint.foreground': '#6B7280',
              'editorHint.border': '#6B7280',
              'problemsErrorIcon.foreground': '#EF4444',
              'problemsWarningIcon.foreground': '#F59E0B',
              'problemsInfoIcon.foreground': '#3B82F6',
              'editorGutter.background': '#FFFFFF',
              'editorGutter.modifiedBackground': '#3B82F6',
              'editorGutter.addedBackground': '#10B981',
              'editorGutter.deletedBackground': '#EF4444',
              'diffEditor.insertedTextBackground': '#D1FAE5',
              'diffEditor.removedTextBackground': '#FEE2E2',
              'diffEditor.diagonalFill': '#F3F4F6',
              'diffEditor.insertedLineBackground': '#F0FDF4',
              'diffEditor.removedLineBackground': '#FEF2F2',
              'diffEditorGutter.insertedLineBackground': '#10B981',
              'diffEditorGutter.removedLineBackground': '#EF4444',
              'diffEditorOverview.insertedForeground': '#10B981',
              'diffEditorOverview.removedForeground': '#EF4444',
              'widget.shadow': 'rgba(0, 0, 0, 0.1)',
              'widget.border': '#E5E7EB',
              'editorWidget.background': '#FFFFFF',
              'editorWidget.foreground': '#374151',
              'editorSuggestWidget.background': '#FFFFFF',
              'editorSuggestWidget.border': '#E5E7EB',
              'editorSuggestWidget.selectedBackground': '#E0E7FF',
              'editorSuggestWidget.highlightForeground': '#8B5CF6',
              'editorSuggestWidget.foreground': '#374151',
              'editorHoverWidget.background': '#FFFFFF',
              'editorHoverWidget.border': '#E5E7EB',
              'editorHoverWidget.foreground': '#374151',
              'debugExceptionWidget.background': '#FEF2F2',
              'debugExceptionWidget.border': '#EF4444',
              'editorMarkerNavigation.background': '#FFFFFF',
              'editorMarkerNavigationError.background': '#FEF2F2',
              'editorMarkerNavigationWarning.background': '#FFFBEB',
              'editorMarkerNavigationInfo.background': '#EFF6FF',
              'editorSuggestWidget.statusBarBackground': '#F8FAFC',
              'editorSuggestWidget.statusBarForeground': '#6B7280'
            }
          });
        }}
      />
    </div>
  )
}

export default CodeEditor