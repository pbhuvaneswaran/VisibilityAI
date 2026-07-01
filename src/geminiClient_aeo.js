import { GoogleGenerativeAI } from '@google/generative-ai';
import pLimit from 'p-limit';

function getClient() {
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

async function askGemini(question) {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' });
  const result = await model.generateContent(question);
  return result.response.text() || '';
}

async function queryAllQuestionsGemini(questions) {
  const limit = pLimit(2);
  return Promise.all(
    questions.map((question) =>
      limit(async () => {
        try {
          const answer = await askGemini(question);
          return { question, answer };
        } catch (err) {
          return { question, answer: '', error: err.message };
        }
      })
    )
  );
}

export { queryAllQuestionsGemini };
