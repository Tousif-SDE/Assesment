import { apiSlice } from './apiSlice'

export const codeApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Run code - FIXED: Changed to match Postman endpoint
    runCode: builder.mutation({
      query: (codeData) => ({
        url: '/code/run', // This matches your Postman: executionCode -> /code/run
        method: 'POST',
        body: codeData,
      }),
    }),
        
    // Test cases - FIXED: Updated endpoints to match your backend
    createTestCase: builder.mutation({
      query: (testCaseData) => ({
        url: '/testcases', // This matches your Postman: testcase -> /testcases
        method: 'POST',
        body: testCaseData,
      }),
      invalidatesTags: ['TestCase'],
    }),
    
    // FIXED: Changed endpoint to match your working pattern
    getTestCasesByRoom: builder.query({
      query: (roomId) => `/testcases/room/${roomId}`, // This should match your backend route
      providesTags: ['TestCase'],
    }),
        
    // Submissions - FIXED: Updated to match Postman
    createSubmission: builder.mutation({
      query: (submissionData) => ({
        url: '/submissions', // This matches your Postman: submission -> /submissions
        method: 'POST',
        body: submissionData,
      }),
      invalidatesTags: ['Submission'],
    }),
    
    getSubmissionsByStudent: builder.query({
      query: () => '/submissions/student',
      providesTags: ['Submission'],
    }),
    
    // FIXED: Added the endpoint that appears in your Postman
    getSubmissionsWithStudentName: builder.query({
      query: () => '/submissions/student-with-name',
      providesTags: ['Submission'],
    }),
    
    getRoomSubmissions: builder.query({
      query: (roomId) => `/submissions/room/${roomId}`,
      providesTags: ['Submission'],
    }),
        
    // Teacher Dashboard
    getTeacherDashboard: builder.query({
      query: () => '/teacher/dashboard',
      providesTags: ['TeacherDashboard', 'Submission'],
    }),
    
    // FIXED: Added the rooms endpoint that appears in your Postman
    getRoomsCreated: builder.query({
      query: () => '/getroomscreated', // This matches your Postman
      providesTags: ['Room'],
    }),
  }),
})

export const {
  useRunCodeMutation,
  useCreateTestCaseMutation,
  useGetTestCasesByRoomQuery,
  useCreateSubmissionMutation,
  useGetSubmissionsByStudentQuery,
  useGetSubmissionsWithStudentNameQuery,
  useGetRoomSubmissionsQuery,
  useGetTeacherDashboardQuery,
  useGetRoomsCreatedQuery,
} = codeApi