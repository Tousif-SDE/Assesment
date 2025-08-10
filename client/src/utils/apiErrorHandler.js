/**
 * API Error Handler Utility
 * 
 * This utility provides functions to handle API errors and implement retry logic
 * for failed API requests in the client application.
 */

/**
 * Handles API errors by providing appropriate user-friendly messages
 * @param {Error} error - The error object from the API call
 * @returns {string} A user-friendly error message
 */
export const handleApiError = (error) => {
  // Log the error for debugging
  console.error('API Error:', error);
  
  // Check if it's a connection error or timeout
  if (!error.response || error.code === 'ECONNABORTED' || error.message?.includes('Network Error')) {
    console.error('Connection error:', error);
    return 'Unable to connect to the server. Please check your internet connection or try again later.';
  }
  
  // Request timeout
  if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
    return 'The request timed out. The server might be under heavy load. Please try again.';
  }

  // Server is starting up
  if (error.response?.status === 503) {
    return 'The server is starting up or temporarily unavailable. Please try again in a moment.';
  }
  
  // Gateway timeout
  if (error.response?.status === 504) {
    return 'The operation timed out. This might happen with complex code execution. Please try again or simplify your code.';
  }

  // Authentication errors
  if (error.response?.status === 401) {
    return 'Your session has expired. Please log in again.';
  }

  if (error.response?.status === 403) {
    return 'You do not have permission to perform this action.';
  }

  // Not found errors
  if (error.response?.status === 404) {
    return 'The requested resource was not found.';
  }
  
  // Bad request errors
  if (error.response?.status === 400) {
    // Try to extract specific error message from response
    const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Invalid request';
    return `Error: ${errorMessage}`;
  }

  // Code execution specific errors (500 range)
  if (error.response?.status >= 500) {
    // Check for specific error details in the response
    if (error.response?.data?.error === 'Code execution failed') {
      return 'Your code could not be executed. Please check for syntax errors or try again later.';
    }
    
    if (error.response?.data?.error === 'Code execution timed out') {
      return 'Your code took too long to execute. Please check for infinite loops or optimize your code.';
    }
    
    if (error.response?.data?.error === 'Code execution service unavailable') {
      return 'The code execution service is currently unavailable. Please try again later.';
    }
    
    if (error.response?.data?.error === 'Code execution service error') {
      return 'There was an error with the code execution service. Please try again later.';
    }
    
    // Generic server error
    return 'The server encountered an error. Please try again later.';
  }

  // Try to extract error message from response data
  const errorMessage = error.response?.data?.error || 
                       error.response?.data?.message || 
                       error.response?.data?.details || 
                       error.message || 
                       'An unexpected error occurred';
  
  return `Error: ${errorMessage}. Please try again.`;
};

/**
 * Retries a function with exponential backoff
 * @param {Function} fn - The function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries (default: 3)
 * @param {number} options.initialDelay - Initial delay in ms (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in ms (default: 10000)
 * @returns {Promise} The result of the function call
 */
export const retryWithBackoff = async (fn, options = {}) => {
  const { maxRetries = 3, initialDelay = 1000, maxDelay = 10000 } = options;
  let retries = 0;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      retries++;
      if (retries > maxRetries) {
        throw error;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(initialDelay * Math.pow(2, retries - 1), maxDelay);
      const jitter = delay * 0.2 * Math.random();
      const backoffDelay = delay + jitter;

      console.log(`API call failed. Retrying in ${Math.round(backoffDelay / 1000)}s... (${retries}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
};

/**
 * Creates a wrapped version of a function with retry logic
 * @param {Function} fn - The function to wrap with retry logic
 * @param {Object} options - Retry options (see retryWithBackoff)
 * @returns {Function} A wrapped function with retry logic
 */
export const withRetry = (fn, options = {}) => {
  return (...args) => retryWithBackoff(() => fn(...args), options);
};