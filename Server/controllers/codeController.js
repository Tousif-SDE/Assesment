import axios from 'axios';

export const runCode = async (req, res) => {
  try {
    const { language_id, source_code, stdin } = req.body;

    // Validate required parameters
    if (!language_id) {
      return res.status(400).json({ error: 'language_id is required' });
    }
    if (!source_code) {
      return res.status(400).json({ error: 'source_code is required' });
    }

    // Check if Judge0 API key is configured
    if (!process.env.JUDGE0_API_KEY) {
      console.error('JUDGE0_API_KEY is not configured in environment variables');
      return res.status(500).json({ 
        error: 'Code execution service is not properly configured', 
        details: 'Missing API key configuration'
      });
    }

    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    try {
      const response = await axios.post(
        'https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true',
        {
          language_id,
          source_code,
          stdin: stdin || '',
        },
        {
          headers: {
            'x-rapidapi-key': process.env.JUDGE0_API_KEY,
            'x-rapidapi-host': 'judge0-ce.p.rapidapi.com',
            'content-type': 'application/json',
          },
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);
      return res.json({
        stdout: response.data.stdout,
        stderr: response.data.stderr,
        compile_output: response.data.compile_output,
        status: response.data.status,
      });
    } catch (axiosError) {
      clearTimeout(timeoutId);
      throw axiosError;
    }
  } catch (error) {
    console.error('Error executing code:', error);
    
    // Provide more detailed error information
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Code execution timed out' });
    }
    
    if (error.response) {
      // The request was made and the server responded with a status code outside the 2xx range
      console.error('Judge0 API error response:', error.response.data);
      return res.status(error.response.status).json({ 
        error: 'Code execution service error', 
        details: error.response.data
      });
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received from Judge0 API');
      return res.status(503).json({ 
        error: 'Code execution service unavailable', 
        details: 'No response from execution service'
      });
    }
    
    // Generic error handler
    res.status(500).json({ 
      error: 'Code execution failed', 
      details: error.message || 'Unknown error'
    });
  }
};
