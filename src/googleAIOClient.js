import axios from 'axios';
import pLimit from 'p-limit';

async function askGoogleAIO(question) {
  const response = await axios.post(
    'https://google.serper.dev/search',
    { q: question, gl: 'us', hl: 'en' },
    { headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' }, timeout: 10000 }
  );

  const data = response.data;
  const answer = data.answerBox?.answer || data.answerBox?.snippet || data.knowledgeGraph?.description || '';
  return { answer, noAIO: !answer };
}

async function queryAllQuestionsGoogleAIO(questions) {
  const limit = pLimit(3);
  return Promise.all(
    questions.map((question) =>
      limit(async () => {
        try {
          const { answer, noAIO } = await askGoogleAIO(question);
          return { question, answer, noAIO };
        } catch (err) {
          return { question, answer: '', error: err.message };
        }
      })
    )
  );
}

export { queryAllQuestionsGoogleAIO };
