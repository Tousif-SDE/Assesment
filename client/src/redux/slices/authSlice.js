import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  userInfo: null,
  token: localStorage.getItem('token') || null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      const { token, role, user } = action.payload
      state.token = token
      state.userInfo = { role, ...(user || {}) }
      
      localStorage.setItem('token', token)
      localStorage.setItem('userRole', role)
    },
    logout: (state) => {
      state.token = null
      state.userInfo = null
      
      localStorage.removeItem('token')
      localStorage.removeItem('userRole')
    },
  },
})

export const { setCredentials, logout } = authSlice.actions

export default authSlice.reducer