import Anthropic from '@anthropic-ai/sdk';

async function generateActions({ gaps, brand, competitors, pageData }) {
  if (!gaps || gaps.length === 0) return [];
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const gapList = gaps.map((g, i) =>
    `Gap ${i + 1}: ${g.topic}
  Missing: ${g.description}
  Related prompt: "${g.evidencePrompt}"
  AI evidence: "${g.evidenceQuote}"`
  ).join('\n\n');

  const prompt = `You are an AEO (Answer Engine Optimization) strategist helping "${brand}" get cited by Claude, ChatGPT, and Gemini.

Their blog: ${pageData?.url || 'their website'}
Their competitors: ${competitors.join(', ')}

Content gaps identified (topics their blog misses that AI engines cite competitors for):
${gapList}

For each gap, write an actionable recommendation. Each action must have:
- action: one clear sentence describing exactly what to add or change in the blog
- why: 2-3 sentences explaining WHY this will get them cited by AI engines, using the evidence quote as proof
- format: what content format works best (e.g., "comparison table", "step-by-step list", "stat-backed paragraph", "FAQ section")
- priority: "high", "medium", or "low"

The "why" field must quote or reference the AI evidence to make the reasoning credible and specific. Users should understand exactly WHY this action works based on real AI behavior observed.

Return ONLY valid JSON array:
[{"gap":"...","action":"...","why":"...","format":"...","priority":"high"}]`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].text.trim();
  try {
    const match = text.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch {
    return [];
  }
}

// OpenAI-based action generation (no Anthropic key needed)
import OpenAI from 'openai';

async function generateActionsOpenAI({ gaps, brand, llmResults }) {
  if (!gaps || gaps.length === 0) return [];
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const gapEvidence = gaps.map(gap => {
    let snippet = '';
    const comp = gap.competitorsSeen?.[0] || '';
    for (const llmData of Object.values(llmResults)) {
      const entry = (llmData || []).find(d => d.question === gap.question);
      if (entry?.answer) {
        const idx = entry.answer.toLowerCase().indexOf(comp.toLowerCase());
        snippet = idx > -1
          ? entry.answer.slice(Math.max(0, idx - 60), idx + 180).trim()
          : entry.answer.slice(0, 220);
        break;
      }
    }
    return `Query: "${gap.question}"\nCompetitors cited: ${gap.competitorsSeen.join(', ')}\nWhat AI said: "${snippet}"`;
  }).join('\n\n');

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 900,
    messages: [{
      role: 'user',
      content: `You are an AEO (Answer Engine Optimization) strategist. "${brand}" is not being cited by AI engines for these buyer queries. Based on the evidence of what AI says about competitors, generate 3 specific content actions "${brand}" should take to start appearing in AI answers.

GAPS — queries where competitors appear but "${brand}" doesn't:
${gapEvidence}

For each action return:
- gap: the query it targets (copy exactly from above)
- action: one clear sentence — exactly what content to create or add
- why: 2 sentences explaining WHY this will get "${brand}" cited, referencing the AI evidence above as proof
- priority: "high" | "medium" | "low"

Return ONLY valid JSON array, no explanation:
[{"gap":"...","action":"...","why":"...","priority":"high"}]`,
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

export { generateActions, generateActionsOpenAI };
