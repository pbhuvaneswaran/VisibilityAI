import axios from 'axios';

const CRAWLERS = {
  GPTBot: 'ChatGPT',
  'Google-Extended': 'Gemini / AI Overviews',
  ClaudeBot: 'Claude',
  'anthropic-ai': 'Claude',
  PerplexityBot: 'Perplexity',
};

function parseRobotsTxt(text) {
  const blocked = new Set();
  const lines = text.split('\n').map((l) => l.trim());

  let currentAgents = [];
  let sawRuleSinceLastAgentBlock = true; // allows grouping consecutive User-agent lines

  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;

    if (/^user-agent:/i.test(line)) {
      const agent = line.split(':').slice(1).join(':').trim();
      if (sawRuleSinceLastAgentBlock) {
        currentAgents = [agent];
        sawRuleSinceLastAgentBlock = false;
      } else {
        currentAgents.push(agent);
      }
    } else if (/^(disallow|allow):/i.test(line)) {
      sawRuleSinceLastAgentBlock = true;
      const isDisallow = /^disallow:/i.test(line);
      const path = line.split(':').slice(1).join(':').trim();
      if (isDisallow && path === '/') {
        for (const agent of currentAgents) {
          if (agent) blocked.add(agent);
        }
      }
    }
  }

  return blocked;
}

async function checkCrawlerAccess(url) {
  const status = {};
  for (const bot of Object.keys(CRAWLERS)) status[bot] = 'unknown';

  try {
    const { origin } = new URL(url);
    const response = await axios.get(`${origin}/robots.txt`, { timeout: 5000, validateStatus: () => true });

    if (response.status !== 200 || typeof response.data !== 'string') {
      for (const bot of Object.keys(CRAWLERS)) status[bot] = 'unknown';
      return status;
    }

    const blocked = parseRobotsTxt(response.data);
    const blockedAll = blocked.has('*');

    for (const bot of Object.keys(CRAWLERS)) {
      status[bot] = blockedAll || blocked.has(bot) ? 'blocked' : 'allowed';
    }
  } catch {
    for (const bot of Object.keys(CRAWLERS)) status[bot] = 'unknown';
  }

  return status;
}

export { checkCrawlerAccess, CRAWLERS };
