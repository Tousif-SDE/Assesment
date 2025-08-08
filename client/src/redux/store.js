import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice'
import editorReducer from './slices/editorSlice'
import { apiSlice } from './api/apiSlice'

export const store = configureStore({
  reducer: {
    [apiSlice.reducerPath]: apiSlice.reducer,
    auth: authReducer,
    editor: editorReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(apiSlice.middleware),
  devTools: true,
})