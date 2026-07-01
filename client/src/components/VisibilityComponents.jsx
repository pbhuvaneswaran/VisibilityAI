import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { LLM_COLORS } from './llmConfig'

export function LLMChip({ llm, selected, onClick }) {
  const c = LLM_COLORS[llm]
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-all ${
        selected ? `${c.bg} ${c.text} border-current` : 'bg-white text-gray-400 border-gray-200'
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${selected ? c.dot : 'bg-gray-300'}`} />
      {c.label}
    </button>
  )
}

export function ScoreBar({ brand, pct, highlight }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`text-sm font-semibold w-32 truncate ${highlight ? 'text-indigo-700' : 'text-gray-600'}`}>{brand}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2.5">
        <div
          className={`h-2.5 rounded-full transition-all ${highlight ? 'bg-indigo-500' : 'bg-gray-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-sm font-bold w-10 text-right ${highlight ? 'text-indigo-700' : 'text-gray-500'}`}>{pct}%</span>
    </div>
  )
}

function MentionCell({ mentioned }) {
  return mentioned
    ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 text-xs font-bold">✓</span>
    : <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-50 text-red-400 text-xs">✗</span>
}

export function PromptRow({ promptData, brand, competitors, llmsQueried }) {
  const [expanded, setExpanded] = useState(false)
  const allBrands = [brand, ...competitors]

  const brandMentioned = (b) =>
    llmsQueried.some(llm =>
      promptData.perLLM?.[llm]?.find(r => r.question === promptData.prompt)?.mentions?.[b]
    )

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-4 py-3 bg-white hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="flex-1 text-sm text-gray-700 font-medium">{promptData.prompt}</span>
          <div className="flex items-center gap-3 flex-shrink-0">
            {allBrands.map(b => (
              <div key={b} className="flex flex-col items-center gap-0.5">
                <MentionCell mentioned={brandMentioned(b)} />
                <span className="text-[10px] text-gray-400 max-w-[52px] truncate">{b}</span>
              </div>
            ))}
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-4 space-y-4">
          {llmsQueried.map(llm => {
            const c = LLM_COLORS[llm]
            const entry = promptData.perLLM?.[llm]?.find(r => r.question === promptData.prompt)
            if (!entry) return null
            return (
              <div key={llm}>
                <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ${c.bg} ${c.text} text-xs font-semibold mb-2`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                  {c.label}
                </div>
                <div className="text-sm text-gray-600 leading-relaxed bg-white border border-gray-100 rounded-lg px-3 py-2 prose prose-sm max-w-none prose-p:my-1 prose-ol:my-1 prose-ul:my-1 prose-li:my-0.5">
                  <ReactMarkdown>{entry.answer || '—'}</ReactMarkdown>
                </div>
                <div className="flex gap-2 mt-1.5 flex-wrap">
                  {allBrands.map(b => (
                    <span key={b} className={`text-xs px-2 py-0.5 rounded-full font-medium ${entry.mentions?.[b] ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                      {b} {entry.mentions?.[b] ? '✓' : '✗'}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function PromptTable({ prompts, llmsQueried, visibility, brand, competitors }) {
  const allBrands = [brand, ...competitors]
  const promptTable = prompts.map(prompt => ({
    prompt,
    perLLM: Object.fromEntries(
      (llmsQueried || []).map(llm => [llm, visibility?.perLLM?.[llm]?.details || []])
    ),
  }))

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-gray-900">Prompt-by-Prompt Breakdown</h2>
        <p className="text-xs text-gray-400">Click any row to see AI answers</p>
      </div>
      <div className="flex items-center gap-3 px-4 mb-2">
        <span className="flex-1 text-xs font-bold text-gray-400 uppercase tracking-wide">Prompt</span>
        <div className="flex gap-3 flex-shrink-0">
          {allBrands.map(b => (
            <span key={b} className={`text-[10px] font-bold uppercase tracking-wide w-6 text-center ${b === brand ? 'text-indigo-600' : 'text-gray-400'}`}>
              {b.slice(0, 5)}
            </span>
          ))}
          <span className="w-4" />
        </div>
      </div>
      <div className="space-y-1.5">
        {promptTable.map((pd, i) => (
          <PromptRow key={i} promptData={pd} brand={brand} competitors={competitors} llmsQueried={llmsQueried} />
        ))}
      </div>
    </div>
  )
}

export function ActionCard({ action, index }) {
  const priorityColor = { high: 'bg-red-100 text-red-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-gray-100 text-gray-600' }
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
            {index + 1}
          </span>
          <h3 className="text-sm font-bold text-gray-900">{action.gap}</h3>
        </div>
        {action.priority && (
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${priorityColor[action.priority] || priorityColor.low}`}>
            {action.priority} priority
          </span>
        )}
      </div>
      <p className="text-sm text-gray-800 font-medium mb-3">{action.action}</p>
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 mb-3">
        <p className="text-xs font-bold text-indigo-600 uppercase tracking-wide mb-1">Why this works</p>
        <p className="text-sm text-gray-700 leading-relaxed">{action.why}</p>
      </div>
      {action.format && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Best format:</span>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{action.format}</span>
        </div>
      )}
    </div>
  )
}

export function BlogAnalysis({ blogGaps, pageData }) {
  if (!pageData) return null
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-gray-900 mb-0.5">Blog Analysis</h2>
          <p className="text-xs text-gray-400 truncate max-w-xs">{pageData.url}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-amber-600">{(blogGaps || []).length}</div>
          <div className="text-xs text-gray-400">topics missing</div>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Your page ({pageData.wordCount?.toLocaleString()} words) is missing <strong>{(blogGaps || []).length} topics</strong> that AI engines cite when recommending competitors.
      </p>
      <div className="space-y-2">
        {(blogGaps || []).map((gap, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-red-100 text-red-500 text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">✗</span>
            <div>
              <span className="text-sm font-semibold text-gray-700">{gap.topic}</span>
              <span className="text-sm text-gray-500"> — {gap.description}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const CRAWLER_LABELS = {
  GPTBot: 'ChatGPT',
  'Google-Extended': 'Gemini / AI Overviews',
  ClaudeBot: 'Claude',
  'anthropic-ai': 'Claude',
  PerplexityBot: 'Perplexity',
}

export function CrawlerCheck({ crawlerStatus }) {
  if (!crawlerStatus) return null
  const entries = Object.entries(crawlerStatus)
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
      <h2 className="text-base font-bold text-gray-900 mb-1">robots.txt Crawler Check</h2>
      <p className="text-sm text-gray-500 mb-4">Whether AI crawlers can access your site to ground their answers</p>
      <div className="space-y-2">
        {entries.map(([bot, status]) => (
          <div key={bot} className={`flex items-start gap-3 px-4 py-3 rounded-xl ${
            status === 'blocked' ? 'bg-red-50' : status === 'allowed' ? 'bg-emerald-50' : 'bg-gray-50'
          }`}>
            <span className="text-lg leading-none mt-0.5">
              {status === 'blocked' ? '🔴' : status === 'allowed' ? '✅' : '⚪'}
            </span>
            <div>
              <p className="text-sm font-semibold text-gray-800">
                {bot} {status === 'blocked' ? 'is BLOCKED' : status === 'allowed' ? 'is allowed' : '— unknown'}
                <span className="text-gray-400 font-normal"> ({CRAWLER_LABELS[bot]})</span>
              </p>
              {status === 'blocked' && (
                <p className="text-xs text-gray-500 mt-0.5">
                  This crawler cannot read your content — it directly limits AI citations. Fix: remove or update the Disallow rule for {bot} in robots.txt.
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
