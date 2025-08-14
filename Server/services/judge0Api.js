// Replace the existing executeCode function in your API file
import axios from 'axios';

const API = axios.create({
  baseURL: 'https://judge0-ce.p.rapidapi.com',
  headers: {
    'x-rapidapi-key': process.env.JUDGE0_API_KEY,
    'x-rapidapi-host': 'judge0-ce.p.rapidapi.com',
    'content-type': 'application/json',
  },
});

export const executeCode = async (language_id, source_code, stdin = '') => {
  try {
    console.log('📤 Submitting code to Judge0 API...');
    
    // FIXED: Use the correct endpoint with proper parameters
    const { data } = await API.post('/submissions?base64_encoded=false&wait=false', {
      language_id,
      source_code,
      stdin,
    });

    console.log('✅ Submission created with token:', data.token);
    
    // Get token to fetch result
    const token = data.token;

    // FIXED: Improved polling with timeout and better error handling
    let result = null;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds timeout
    
    while (attempts < maxAttempts) {
      console.log(`🔄 Polling attempt ${attempts + 1}/${maxAttempts}`);
      
      const res = await API.get(`/submissions/${token}?base64_encoded=false`);
      result = res.data;
      
      console.log('📊 Status:', result.status?.description || 'Unknown');
      
      // FIXED: Check for completion status properly
      if (result.status && result.status.id > 2) {
        console.log('✅ Execution completed');
        break;
      }
      
      // Wait 1 second before next poll
      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
    }
    
    // FIXED: Handle timeout case
    if (attempts >= maxAttempts) {
      console.error('❌ Execution timeout');
      return {
        status: { id: 6, description: 'Time Limit Exceeded' },
        stdout: '',
        stderr: 'Execution timeout - please try again',
        compile_output: '',
        time: null,
        memory: null
      };
    }
    
    console.log('🎯 Final result:', {
      status: result.status?.description,
      stdout: result.stdout ? 'Has output' : 'No output',
      stderr: result.stderr ? 'Has errors' : 'No errors'
    });
    
    return result;
  } catch (error) {
    console.error('❌ Judge0 API Error:', error.message);
    
    // FIXED: Return consistent error format
    return {
      status: { id: 6, description: 'Internal Error' },
      stdout: '',
      stderr: error.response?.data?.message || error.message || 'Unknown error occurred',
      compile_output: '',
      time: null,
      memory: null
    };
  }
};