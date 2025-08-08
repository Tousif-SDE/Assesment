import axios from 'axios';

export const runCode = async (req, res) => {
  try {
    const { language_id, source_code, stdin } = req.body;

    const response = await axios.post(
      'https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true',
      {
        language_id,
        source_code,
        stdin,
      },
      {
        headers: {
          'x-rapidapi-key': process.env.JUDGE0_API_KEY,
          'x-rapidapi-host': 'judge0-ce.p.rapidapi.com',
          'content-type': 'application/json',
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Error executing code:', error.message);
    res.status(500).json({ error: 'Code execution failed' });
  }
};
