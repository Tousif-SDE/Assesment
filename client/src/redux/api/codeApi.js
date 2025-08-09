import { apiSlice } from './apiSlice'

export const codeApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Run code
    runCode: builder.mutation({
      query: (codeData) => ({
        url: '/code/run',
        method: 'POST',
        body: codeData,
      }),
    }),
    
    // Test cases
    createTestCase: builder.mutation({
      query: (testCaseData) => ({
        url: '/testcases',
        method: 'POST',
        body: testCaseData,
      }),
      invalidatesTags: ['TestCase'],
    }),
    getTestCasesByRoom: builder.query({
      query: (roomId) => `/testcases/${roomId}`,
      providesTags: ['TestCase'],
    }),
    
    // Submissions
    createSubmission: builder.mutation({
      query: (submissionData) => ({
        url: '/submissions',
        method: 'POST',
        body: submissionData,
      }),
      invalidatesTags: ['Submission'],
    }),
    getSubmissionsByStudent: builder.query({
      query: () => '/submissions/student',
      providesTags: ['Submission'],
    }),
    getRoomSubmissions: builder.query({
      query: (roomId) => `/submissions/room/${roomId}`,
      providesTags: ['Submission'],
    }),
  }),
})

export const {
  useRunCodeMutation,
  useCreateTestCaseMutation,
  useGetTestCasesByRoomQuery,
  useCreateSubmissionMutation,
  useGetSubmissionsByStudentQuery,
  useGetRoomSubmissionsQuery,
} = codeApi