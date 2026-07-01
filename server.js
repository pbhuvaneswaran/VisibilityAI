import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { generateBuyerQuestions } from './src/questionGenerator.js';
import { queryAllQuestionsClaude } from './src/claudeClient_aeo.js';
import { queryAllQuestionsGPT } from './src/openaiClient_aeo.js';
import { queryAllQuestionsGemini } from './src/geminiClient_aeo.js';
import { queryAllQuestionsGoogleAIO } from './src/googleAIOClient.js';
import { scoreVisibility } from './src/visibilityScorer.js';
import { recommendForGaps } from './src/gapRecommender.js';
import { dummyVisibilityResult } from './src/dummyVisibility.js';
import { runDiagnosis } from './index.js';
import { readWebPage } from './src/webReader.js';
import { analyzePageAndPrepare, extractCompetitors } from './src/competitorExtractor.js';
import { generateActionsOpenAI } from './src/actionGenerator.js';
import { saveRun } from './src/runLogger.js';
import { checkCrawlerAccess } from './src/robotsChecker.js';

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
  const url = normalizeUrl(trimmed);

  try {
    // Step 1: fetch page + robots.txt in parallel
    const [pageData, crawlerStatus] = await Promise.all([
      readWebPage(url),
      checkCrawlerAccess(url),
    ]);

    const brand = extractBrandFromUrl(url);

    // Step 2: single GPT call returns description + competitors + 3 prompts
    const { categoryDescription, competitors, prompts } = await analyzePageAndPrepare(pageData);

    if (!prompts || prompts.length === 0) {
      return res.status(500).json({ error: 'Failed to generate prompts from page' });
    }

    // Step 3: query all LLMs in parallel
    const enabledLLMs = requestedLLMs || ['chatgpt', 'gemini'];
    const llmJobs = {};
    if (enabledLLMs.includes('claude') && hasKey('ANTHROPIC_API_KEY')) llmJobs.claude = queryAllQuestionsClaude(prompts);
    if (enabledLLMs.includes('chatgpt') && hasKey('OPENAI_API_KEY')) llmJobs.chatgpt = queryAllQuestionsGPT(prompts);
    if (enabledLLMs.includes('gemini') && hasKey('GEMINI_API_KEY')) llmJobs.gemini = queryAllQuestionsGemini(prompts);
    if (enabledLLMs.includes('googleaio') && hasKey('SERPER_API_KEY')) llmJobs.googleaio = queryAllQuestionsGoogleAIO(prompts);

    if (Object.keys(llmJobs).length === 0) {
      return res.status(400).json({ error: 'No LLM API keys configured' });
    }

    const llmNames = Object.keys(llmJobs);
    const llmAnswers = await Promise.all(Object.values(llmJobs));
    const llmResults = Object.fromEntries(llmNames.map((name, i) => [name, llmAnswers[i]]));

    const visibility = scoreVisibility({ llmResults, brand, competitors });

    // Generate actions from gaps using OpenAI (no Anthropic needed)
    const actions = await generateActionsOpenAI({
      gaps: visibility.gaps || [],
      brand,
      llmResults,
    }).catch(err => { console.error('Action generation error:', err.message); return []; });

    const responsePayload = {
      mode: 'url',
      brand,
      competitors,
      prompts,
      llmsQueried: llmNames,
      visibility,
      categoryDescription,
      pageData: { url: pageData.url, title: pageData.title, wordCount: pageData.wordCount },
      crawlerStatus,
      actions,
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

app.get('/api/runs', (_req, res) => {
  const dir = path.join(process.cwd(), 'output', 'runs');
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    return res.json([]);
  }

  const runs = files
    .map((file) => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
        const allBrandPcts = data.visibility?.aggregatePercentages || {};
        const brandPct = allBrandPcts[data.brand] ?? 0;
        const competitorEntries = Object.entries(allBrandPcts).filter(([b]) => b !== data.brand);
        const [topCompetitor, topCompetitorPct] = competitorEntries.sort((a, b) => b[1] - a[1])[0] || [null, 0];

        return {
          savedAt: data.savedAt,
          input: data.input,
          mode: data.mode,
          brand: data.brand,
          competitors: data.competitors || [],
          llmsQueried: data.llmsQueried || [],
          brandPct,
          topCompetitor,
          topCompetitorPct,
          missedPrompts: data.visibility?.gaps?.length || 0,
          totalPrompts: data.prompts?.length || 0,
          allBrandPcts,
          prompts: data.prompts || [],
          gaps: data.visibility?.gaps || [],
          actions: data.actions || [],
          blogGaps: data.blogGaps || [],
          llmAnswers: data.llmAnswers || {},
          crawlerStatus: data.crawlerStatus || null,
          visibility: data.visibility || null,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

  res.json(runs);
});

app.get('/api/health', (_req, res) =>
  res.json({
    ok: true,
    keys: {
      anthropic: hasKey('ANTHROPIC_API_KEY'),
      claude_aeo: hasKey('ANTHROPIC_API_KEY'),
      openai: hasKey('OPENAI_API_KEY'),
      gemini: hasKey('GEMINI_API_KEY'),
      googleaio: hasKey('SERPER_API_KEY'),
      supabase: hasKey('SUPABASE_URL'),
      dodo: hasKey('DODO_API_KEY'),
    },
  })
);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
