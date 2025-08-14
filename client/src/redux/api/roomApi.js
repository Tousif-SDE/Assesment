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
    deleteRoom: builder.mutation({
      query: (roomId) => ({
        url: `/room/${roomId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Room'],
    }),
        
    // Student endpoints - FIXED: Changed from '/room/join' to '/joinstudent'
    joinRoom: builder.mutation({
      query: (data) => ({
        url: '/room/join', // Fixed endpoint to match Postman
        method: 'POST',
        body: data,
      }),
    }),
  }),
})

export const {
  useCreateRoomMutation,
  useGetMyRoomsQuery,
  useDeleteRoomMutation,
  useJoinRoomMutation,
} = roomApi