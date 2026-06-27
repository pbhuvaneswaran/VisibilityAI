import OpenAI from 'openai';

function getClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

async function generatePromptsFromPage({ title, headings, content }) {
  const client = getClient();
  const headingText = headings.slice(0, 12).map(h => h.text).join(', ');

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: `You are generating buyer research queries for an AEO (Answer Engine Optimization) study.

A buyer who has NEVER heard of any specific product is searching for a solution. Read this page and understand what category of product it is, then generate the queries that buyer would type.

Page info:
Title: ${title}
Headings: ${headingText}
Content excerpt: ${content.slice(0, 1500)}

Generate 8 buyer-intent queries.

STRICT RULES:
- NEVER mention any brand, product, or company name in the queries — not even the one on this page
- Write as a buyer discovering the category for the first time
- Use category-level language: "best AI tool for X", "how to automate Y for Z", "top platforms that help with W"
- Include: comparison queries, use-case queries, pricing queries, "best X for [audience]" queries

Return ONLY a valid JSON array of 8 strings:
["query 1", "query 2", ...]`,
    }],
  });

  const text = response.choices[0].message.content.trim();
  try {
    const match = text.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch {
    return [];
  }
}

async function generatePromptsFromKeyword(keyword) {
  const client = getClient();

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 600,
    messages: [{
      role: 'user',
      content: `Generate 8 related search queries someone would type into Claude, ChatGPT, or Gemini when exploring: "${keyword}"

Include variations: comparisons, use-case specific, pricing questions, and "best X for Y" style queries. Keep queries natural and buyer-intent focused.
Do NOT include any specific brand or product names in the queries.

Return ONLY a valid JSON array of 8 strings:
["query 1", "query 2", ...]`,
    }],
  });

  const text = response.choices[0].message.content.trim();
  try {
    const match = text.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch {
    return [];
  }
}

export { generatePromptsFromPage, generatePromptsFromKeyword };
