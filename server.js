import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { generateBuyerQuestions } from './src/questionGenerator.js';
import { queryAllQuestionsClaude } from './src/claudeClient_aeo.js';
import { queryAllQuestionsGPT } from './src/openaiClient_aeo.js';
import { queryAllQuestionsGemini } from './src/geminiClient_aeo.js';
import { scoreVisibility } from './src/visibilityScorer.js';
import { recommendForGaps } from './src/gapRecommender.js';
import { dummyVisibilityResult } from './src/dummyVisibility.js';
import { runDiagnosis } from './index.js';
import { readWebPage } from './src/webReader.js';
import { analyzeBlogVsLLMs } from './src/blogAnalyzer.js';
import { generateActions } from './src/actionGenerator.js';
import { findDirectCompetitors, extractCategoryDescription, extractCompetitors } from './src/competitorExtractor.js';
import { generatePromptsFromPage, generatePromptsFromKeyword } from './src/promptGeneratorFromInput.js';
import { saveRun } from './src/runLogger.js';

dotenv.config();

const hasKey = (name) => !!process.env[name];

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/visibility', async (req, res) => {
  const { brand, competitors, category, demo, llms: requestedLLMs } = req.body;

  if (!brand || !category || !Array.isArray(competitors) || competitors.length === 0) {
    return res.status(400).json({ error: 'brand, category, and competitors[] are required' });
  }

  if (demo || !hasKey('ANTHROPIC_API_KEY')) {
    return res.json(dummyVisibilityResult({ brand, competitors, category }));
  }

  try {
    const questions = await generateBuyerQuestions({ brand, competitors, category });

    const enabledLLMs = requestedLLMs || ['claude', 'chatgpt', 'gemini'];
    const llmJobs = {};
    if (enabledLLMs.includes('claude') && hasKey('ANTHROPIC_API_KEY')) {
      llmJobs.claude = queryAllQuestionsClaude(questions);
    }
    if (enabledLLMs.includes('chatgpt') && hasKey('OPENAI_API_KEY')) {
      llmJobs.chatgpt = queryAllQuestionsGPT(questions);
    }
    if (enabledLLMs.includes('gemini') && hasKey('GEMINI_API_KEY')) {
      llmJobs.gemini = queryAllQuestionsGemini(questions);
    }

    const llmNames = Object.keys(llmJobs);
    const llmAnswers = await Promise.all(Object.values(llmJobs));
    const llmResults = Object.fromEntries(llmNames.map((name, i) => [name, llmAnswers[i]]));

    const visibility = scoreVisibility({ llmResults, brand, competitors });
    const gapRecommendations = await recommendForGaps({ gaps: visibility.gaps, brand, category });

    res.json({ brand, competitors, category, questions, llmsQueried: llmNames, visibility, gapRecommendations });
  } catch (err) {
    console.error('Visibility error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

function isUrlInput(str) {
  return /^https?:\/\//i.test(str) || /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/|$)/.test(str);
}

function normalizeUrl(str) {
  return /^https?:\/\//i.test(str) ? str : `https://${str}`;
}

function extractBrandFromUrl(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    const name = hostname.split('.')[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return 'Your Brand';
  }
}

function countBrandMentions(llmResults, brands, totalCombinations) {
  return brands.map(brand => {
    let mentions = 0;
    for (const answers of Object.values(llmResults)) {
      for (const { answer } of (answers || [])) {
        if (answer && answer.toLowerCase().includes(brand.toLowerCase())) mentions++;
      }
    }
    return { brand, mentions, pct: totalCombinations > 0 ? Math.round((mentions / totalCombinations) * 100) : 0 };
  }).sort((a, b) => b.mentions - a.mentions);
}

app.post('/api/v3/analyze', async (req, res) => {
  const { input, llms: requestedLLMs } = req.body;

  if (!input || typeof input !== 'string' || !input.trim()) {
    return res.status(400).json({ error: 'input is required' });
  }
  if (!hasKey('OPENAI_API_KEY')) {
    return res.status(400).json({ error: 'OPENAI_API_KEY is not configured. Add it to .env' });
  }

  const trimmed = input.trim();
  const isUrl = isUrlInput(trimmed);

  try {
    let brand, prompts, pageData = null, categoryDescription = null, competitors, brandRankings;

    if (isUrl) {
      const url = normalizeUrl(trimmed);
      pageData = await readWebPage(url);
      brand = extractBrandFromUrl(url);

      // Extract category description first (no brand name), then find competitors + generate prompts in parallel
      categoryDescription = await extractCategoryDescription(pageData);
      [competitors, prompts] = await Promise.all([
        findDirectCompetitors(categoryDescription),
        generatePromptsFromPage(pageData),
      ]);
    } else {
      prompts = await generatePromptsFromKeyword(trimmed);
    }

    if (!prompts || prompts.length === 0) {
      return res.status(500).json({ error: 'Failed to generate prompts from input' });
    }

    const enabledLLMs = requestedLLMs || ['chatgpt', 'gemini'];
    const llmJobs = {};
    if (enabledLLMs.includes('claude') && hasKey('ANTHROPIC_API_KEY')) llmJobs.claude = queryAllQuestionsClaude(prompts);
    if (enabledLLMs.includes('chatgpt') && hasKey('OPENAI_API_KEY')) llmJobs.chatgpt = queryAllQuestionsGPT(prompts);
    if (enabledLLMs.includes('gemini') && hasKey('GEMINI_API_KEY')) llmJobs.gemini = queryAllQuestionsGemini(prompts);

    if (Object.keys(llmJobs).length === 0) {
      return res.status(400).json({ error: 'No LLM API keys configured. Add ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY to .env' });
    }

    const llmNames = Object.keys(llmJobs);
    const llmAnswers = await Promise.all(Object.values(llmJobs));
    const llmResults = Object.fromEntries(llmNames.map((name, i) => [name, llmAnswers[i]]));

    if (!isUrl) {
      // Keyword mode: extract brands from LLM answers and rank them
      const extractedBrands = await extractCompetitors(llmResults);
      const total = prompts.length * llmNames.length;
      brandRankings = countBrandMentions(llmResults, extractedBrands, total).slice(0, 8);
      brand = brandRankings[0]?.brand || 'Unknown';
      competitors = brandRankings.slice(1, 4).map(r => r.brand);
    }

    const visibility = scoreVisibility({ llmResults, brand, competitors });

    let blogGaps = [], actions = [];
    if (isUrl && pageData) {
      try {
        blogGaps = await analyzeBlogVsLLMs({ pageData, prompts, llmResults, brand, competitors });
        actions = await generateActions({ gaps: blogGaps, brand, competitors, pageData });
      } catch (err) {
        console.error('Blog analysis error:', err.message);
      }
    }

    const responsePayload = {
      mode: isUrl ? 'url' : 'keyword',
      brand,
      competitors,
      prompts,
      llmsQueried: llmNames,
      visibility,
      ...(isUrl
        ? {
            categoryDescription,
            pageData: { url: pageData.url, title: pageData.title, wordCount: pageData.wordCount, headings: pageData.headings },
            blogGaps,
            actions,
          }
        : {
            keyword: trimmed,
            brandRankings,
          }),
    };

    // Save run for analysis (non-blocking)
    saveRun({
      input: trimmed,
      ...responsePayload,
      llmAnswers: llmResults,
    });

    res.json(responsePayload);
  } catch (err) {
    console.error('V3 analyze error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/diagnose', async (req, res) => {
  const { url, keyword } = req.body;
  if (!url && !keyword) {
    return res.status(400).json({ error: 'url or keyword is required' });
  }
  try {
    const report = await runDiagnosis({ blogUrl: url, keyword });
    res.json(report);
  } catch (err) {
    console.error('Diagnosis error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', (_req, res) =>
  res.json({
    ok: true,
    keys: {
      anthropic: hasKey('ANTHROPIC_API_KEY'),
      claude_aeo: hasKey('ANTHROPIC_API_KEY'),
      openai: hasKey('OPENAI_API_KEY'),
      gemini: hasKey('GEMINI_API_KEY'),
      supabase: hasKey('SUPABASE_URL'),
      stripe: hasKey('STRIPE_SECRET_KEY'),
    },
  })
);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
