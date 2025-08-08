import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  code: '',
  input: '',
  output: '',
  language: '71', // Default to Python (Judge0 language ID)
  runTriggered: false,
  isEditable: false, // For student view (locked until 'Solve' is clicked)
  testCase: null,
  roomId: null,
}

const editorSlice = createSlice({
  name: 'editor',
  initialState,
  reducers: {
    setCode: (state, action) => {
      state.code = action.payload
    },
    setInput: (state, action) => {
      state.input = action.payload
    },
    setOutput: (state, action) => {
      state.output = action.payload
    },
    setLanguage: (state, action) => {
      state.language = action.payload
    },
    setRunTriggered: (state, action) => {
      state.runTriggered = action.payload
    },
    setEditable: (state, action) => {
      state.isEditable = action.payload
    },
    setTestCase: (state, action) => {
      state.testCase = action.payload
    },
    setRoomId: (state, action) => {
      state.roomId = action.payload
    },
    // Update multiple properties at once (for socket updates)
    updateEditorState: (state, action) => {
      return { ...state, ...action.payload }
    },
    resetEditor: () => initialState,
  },
})

export const {
  setCode,
  setInput,
  setOutput,
  setLanguage,
  setRunTriggered,
  setEditable,
  setTestCase,
  setRoomId,
  updateEditorState,
  resetEditor,
} = editorSlice.actions

export default editorSlice.reducer