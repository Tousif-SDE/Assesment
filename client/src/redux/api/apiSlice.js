import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { handleApiError } from '../../utils/apiErrorHandler';

// Create a base query with auth header
const baseQuery = fetchBaseQuery({
  baseUrl: `${import.meta.env.VITE_API_URL || ''}/api`,
  prepareHeaders: (headers, { getState }) => {
    // Get the token from the auth state
    const token = getState().auth.token;
    
    // If we have a token, add it to the headers
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
    
    return headers;
  },
  // Add timeout to prevent hanging requests
  timeout: 15000, // 15 seconds timeout
});

// Add retry logic to the base query
const baseQueryWithRetry = async (args, api, extraOptions) => {
  let result = await baseQuery(args, api, extraOptions);
  
  // Retry logic for connection errors or 5xx errors
  let retries = 0;
  const MAX_RETRIES = 3;
  
  while (
    (result.error && 
     (result.error.status === 'FETCH_ERROR' || 
      result.error.status >= 500 || 
      result.error.status === 'TIMEOUT_ERROR')) && 
    retries < MAX_RETRIES
  ) {
    retries++;
    console.log(`Executing API request to ${args.url} (attempt ${retries + 1}/${MAX_RETRIES + 1})`);
    
    // Exponential backoff
    const delay = Math.min(1000 * (2 ** retries), 10000);
    console.log(`Retrying request in ${delay}ms...`);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    result = await baseQuery(args, api, extraOptions);
  }
  
  // Handle errors
  if (result.error) {
    // Special handling for 401 Unauthorized
    if (result.error.status === 401) {
      console.error(`Authentication error for ${args.url}:`, result.error);
    } else if (result.error.status >= 400 && result.error.status < 500) {
      console.error(`Client error (${result.error.status}) for ${args.url}:`, result.error);
    } else if (result.error.status >= 500) {
      console.error(`Server error (${result.error.status}) for ${args.url}:`, result.error);
    }
    
    // Format error message for UI display
    result.error.message = handleApiError(result.error);
  }
  
  return result;
}

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithRetry,
  tagTypes: ['Room', 'TestCase', 'Submission', 'TeacherDashboard'],
  endpoints: (builder) => ({}),
})