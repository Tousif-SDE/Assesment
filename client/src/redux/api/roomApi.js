import { apiSlice } from './apiSlice'

export const roomApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Teacher endpoints
    createRoom: builder.mutation({
      query: (roomData) => ({
        url: '/room/create',
        method: 'POST',
        body: roomData,
      }),
      invalidatesTags: ['Room'],
    }),
    getMyRooms: builder.query({
      query: () => '/room/myrooms',
      providesTags: ['Room'],
    }),
    
    // Student endpoints
    joinRoom: builder.mutation({
      query: (data) => ({
        url: '/room/join',
        method: 'POST',
        body: data, // Accept the full data object
      }),
    }),
  }),
})

export const {
  useCreateRoomMutation,
  useGetMyRoomsQuery,
  useJoinRoomMutation,
} = roomApi