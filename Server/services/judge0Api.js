import axios from 'axios';

const API = axios.create({
  baseURL: 'https://judge0-ce.p.rapidapi.com',
  headers: {
    'x-rapidapi-key': process.env.JUDGE0_API_KEY,
    'x-rapidapi-host': 'judge0-ce.p.rapidapi.com',
    'content-type': 'application/json',
  },
});

export const executeCode = async (language_id, source_code) => {
  const { data } = await API.post('/submissions', {
    language_id,
    source_code,
  });

  // Get token to fetch result
  const token = data.token;

  // Poll for result
  let result = null;
  while (!result || result.status?.id <= 2) {
    const res = await API.get(`/submissions/${token}`);
    result = res.data;
    if (result.status?.id > 2) break;
    await new Promise((r) => setTimeout(r, 1000)); // wait 1s
  }

  return result;
};
