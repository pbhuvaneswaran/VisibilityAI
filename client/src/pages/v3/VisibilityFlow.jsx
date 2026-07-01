import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LLM_COLORS } from '../../components/llmConfig'
import { LLMChip, ScoreBar, PromptTable, ActionCard, BlogAnalysis, CrawlerCheck } from '../../components/VisibilityComponents'

const EXAMPLES = [
  { label: 'copilotverse.io', value: 'copilotverse.io' },
  { label: 'freshdesk.com', value: 'freshdesk.com' },
  { label: 'intercom.com', value: 'intercom.com' },
]

// Extract a readable snippet from an LLM answer centred around a keyword
function extractSnippet(answer, keyword, maxLen = 220) {
  if (!answer) return ''
  if (!keyword) return answer.slice(0, maxLen) + (answer.length > maxLen ? '...' : '')
  const lower = answer.toLowerCase()
  const idx = lower.indexOf(keyword.toLowerCase())
  if (idx === -1) return answer.slice(0, maxLen) + (answer.length > maxLen ? '...' : '')
  const start = Math.max(0, idx - 80)
  const end = Math.min(answer.length, start + maxLen)
  const snippet = answer.slice(start, end).trim()
  return (start > 0 ? '…' : '') + snippet + (end < answer.length ? '…' : '')
}

// Find the best LLM answer for a given question across all LLMs
function findAnswerForQuestion(visibility, question) {
  for (const llmData of Object.values(visibility?.perLLM || {})) {
    const entry = (llmData.details || []).find(d => d.question === question)
    if (entry?.answer) return { llm: null, entry }
  }
  return null
}

// Find all prompts where a competitor is cited and return the best snippet
function getCompetitorEvidence(visibility, competitor) {
  const results = []
  for (const [llm, llmData] of Object.entries(visibility?.perLLM || {})) {
    for (const entry of (llmData.details || [])) {
      if (entry.mentions?.[competitor] && entry.answer) {
        results.push({ llm, question: entry.question, snippet: extractSnippet(entry.answer, competitor) })
      }
    }
  }
  return results
}

// ─── Act 1: Score Overview ───────────────────────────────────────────────────

function ScoreOverview({ result }) {
  const brand = result.brand
  const agg = result.visibility?.aggregatePercentages || {}
  const brandPct = agg[brand] ?? 0
  const gaps = result.visibility?.gaps || []
  const totalPrompts = result.prompts?.length || 0

  // Top competitor by aggregate %
  const topCompetitor = Object.entries(agg)
    .filter(([b]) => b !== brand)
    .sort((a, b) => b[1] - a[1])[0]

  return (
    <div className="mb-8">
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className={`rounded-2xl p-5 ${brandPct === 0 ? 'bg-red-50 border border-red-100' : 'bg-indigo-50 border border-indigo-100'}`}>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Your AI visibility</p>
          <p className={`text-3xl font-bold ${brandPct === 0 ? 'text-red-600' : 'text-indigo-700'}`}>{brandPct}%</p>
          <p className="text-xs text-gray-500 mt-1">{brand}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Missed prompts</p>
          <p className="text-3xl font-bold text-gray-900">{gaps.length}<span className="text-base text-gray-400 font-normal"> / {totalPrompts}</span></p>
          <p className="text-xs text-gray-500 mt-1">where you're absent</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Top competitor</p>
          <p className="text-lg font-bold text-gray-900 truncate">{topCompetitor?.[0] || '—'}</p>
          <p className="text-xs text-gray-500 mt-1">{topCompetitor ? `${topCompetitor[1]}% mentions` : 'no data'}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Platforms checked</p>
          <div className="flex gap-1.5 flex-wrap mt-1">
            {result.llmsQueried.map(llm => {
              const c = LLM_COLORS[llm]
              return (
                <span key={llm} className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>{c.label}</span>
              )
            })}
          </div>
        </div>
      </div>

      {/* Per-LLM breakdown */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">Score per AI engine</p>
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${result.llmsQueried.length}, 1fr)` }}>
          {result.llmsQueried.map(llm => {
            const c = LLM_COLORS[llm]
            const pcts = result.visibility?.perLLM?.[llm]?.percentages || {}
            const allBrands = [brand, ...result.competitors]
            return (
              <div key={llm} className={`${c.bg} rounded-xl p-4`}>
                <p className={`text-sm font-bold ${c.text} mb-3`}>{c.label}</p>
                {allBrands.map(b => (
                  <div key={b} className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-600 truncate max-w-[100px]">{b}</span>
                    <span className={`text-xs font-bold ${b === brand ? c.text : 'text-gray-500'}`}>{pcts[b] ?? 0}%</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Act 2: Why You're Not Ranking ───────────────────────────────────────────

function WhyNotRanking({ result }) {
  const gaps = result.visibility?.gaps || []
  const agg = result.visibility?.aggregatePercentages || {}
  const brandPct = agg[result.brand] ?? 0
  const allBrands = [result.brand, ...result.competitors]

  // Everyone is at 0% — AI didn't mention anyone, show what AI actually said
  const allZero = Object.values(agg).every(p => p === 0)
  if (allZero || gaps.length === 0) {
    // Collect all prompts with their answers
    const promptsWithAnswers = (result.prompts || []).map(prompt => {
      const answers = {}
      for (const [llm, llmData] of Object.entries(result.visibility?.perLLM || {})) {
        const entry = (llmData.details || []).find(d => d.question === prompt)
        if (entry?.answer) answers[llm] = entry.answer
      }
      return { prompt, answers }
    })

    if (brandPct > 0) {
      return (
        <div className="mb-8">
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 text-center">
            <p className="text-emerald-700 font-semibold">You were cited across all checked prompts — great AI visibility!</p>
          </div>
        </div>
      )
    }

    return (
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-1">What AI says for these queries</h2>
        <p className="text-sm text-gray-500 mb-4">
          {result.brand} was not mentioned in any of these {result.prompts?.length} queries. Here's exactly what AI engines said — this is what you're competing with for attention.
        </p>
        <div className="space-y-4">
          {promptsWithAnswers.map(({ prompt, answers }, i) => (
            <div key={i} className="bg-white border border-orange-100 rounded-2xl overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3 bg-orange-50 border-b border-orange-100">
                <span className="text-orange-500 text-lg">🔴</span>
                <p className="text-sm font-semibold text-gray-800">"{prompt}"</p>
              </div>
              <div className="px-5 py-4 space-y-3">
                {Object.entries(answers).map(([llm, answer]) => {
                  const c = LLM_COLORS[llm]
                  return (
                    <div key={llm}>
                      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${c.bg} ${c.text} mb-1.5`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                        {c.label}
                      </span>
                      <blockquote className="text-sm text-gray-700 leading-relaxed bg-gray-50 border-l-4 border-gray-200 pl-4 pr-3 py-2 rounded-r-lg">
                        {extractSnippet(answer, '', 300) || answer.slice(0, 300)}
                      </blockquote>
                    </div>
                  )
                })}
                <p className="text-xs text-red-500 font-medium pt-1">
                  {result.brand} was not mentioned in any of these answers.
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mb-8">
      <h2 className="text-lg font-bold text-gray-900 mb-1">Where AI doesn't mention you — and what it says instead</h2>
      <p className="text-sm text-gray-500 mb-4">
        {gaps.length} prompt{gaps.length > 1 ? 's' : ''} where AI cited your competitors but not you
      </p>
      <div className="space-y-4">
        {gaps.map((gap, i) => {
          let snippet = ''
          let snippetLLM = ''
          const firstComp = gap.competitorsSeen?.[0]
          for (const [llm, llmData] of Object.entries(result.visibility?.perLLM || {})) {
            const entry = (llmData.details || []).find(d => d.question === gap.question)
            if (entry?.answer) {
              snippet = extractSnippet(entry.answer, firstComp, 240)
              snippetLLM = llm
              break
            }
          }

          return (
            <div key={i} className="bg-white border border-red-100 rounded-2xl overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3 bg-red-50 border-b border-red-100">
                <span className="text-red-500 text-lg">🔴</span>
                <p className="text-sm font-semibold text-gray-800">"{gap.question}"</p>
              </div>
              <div className="px-5 py-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                  You were not cited — {LLM_COLORS[snippetLLM]?.label || 'AI'} said instead:
                </p>
                {snippet && (
                  <blockquote className="text-sm text-gray-700 leading-relaxed bg-gray-50 border-l-4 border-red-300 pl-4 pr-3 py-2 rounded-r-lg italic mb-3">
                    "{snippet}"
                  </blockquote>
                )}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-gray-400 font-medium">Cited instead:</span>
                  {(gap.competitorsSeen || []).map(c => (
                    <span key={c} className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">{c}</span>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Act 3: Why Competitors Rank ─────────────────────────────────────────────

function WhyCompetitorsRank({ result }) {
  const agg = result.visibility?.aggregatePercentages || {}
  const topCompetitors = Object.entries(agg)
    .filter(([b]) => b !== result.brand && agg[b] > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name)

  if (topCompetitors.length === 0) return null

  return (
    <div className="mb-8">
      <h2 className="text-lg font-bold text-gray-900 mb-1">What AI says about your competitors</h2>
      <p className="text-sm text-gray-500 mb-4">The language patterns that get them cited — so you know exactly what content to create</p>
      <div className="space-y-4">
        {topCompetitors.map(comp => {
          const evidence = getCompetitorEvidence(result.visibility, comp)
          if (evidence.length === 0) return null
          const best = evidence[0]

          return (
            <div key={comp} className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-600">
                    {comp.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{comp}</p>
                    <p className="text-xs text-gray-400">cited in {evidence.length} of {result.prompts?.length} prompts ({agg[comp]}%)</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-gray-500">{agg[comp]}%</span>
              </div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                Why AI cites them — from a {LLM_COLORS[best.llm]?.label || 'AI'} answer:
              </p>
              <blockquote className="text-sm text-gray-700 leading-relaxed bg-blue-50 border-l-4 border-blue-300 pl-4 pr-3 py-2 rounded-r-lg italic">
                "{best.snippet}"
              </blockquote>
              {evidence.length > 1 && (
                <p className="text-xs text-gray-400 mt-2">+ {evidence.length - 1} more prompt{evidence.length > 2 ? 's' : ''} where they're cited</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Act 4: What To Do ───────────────────────────────────────────────────────

function WhatToDo({ result }) {
  const actions = result.actions || []
  const gaps = result.visibility?.gaps || []

  if (actions.length > 0) {
    return (
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-1">What to do to rank in AI search</h2>
        <p className="text-sm text-gray-500 mb-4">
          {actions.length} specific content actions — each backed by evidence from actual AI answers
        </p>
        <div className="space-y-4">
          {actions.map((action, i) => <ActionCard key={i} action={action} index={i} />)}
        </div>
      </div>
    )
  }

  // Fallback if no actions (no Anthropic key)
  if (gaps.length > 0) {
    return (
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-1">What to do to rank in AI search</h2>
        <p className="text-sm text-gray-500 mb-4">Create content targeting these AI-cited topics your page currently misses</p>
        <div className="space-y-3">
          {gaps.map((gap, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
              <div>
                <p className="text-sm font-semibold text-gray-800">Create content for: "{gap.question}"</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Competitors cited: {gap.competitorsSeen.join(', ')} — make your page the definitive answer to this query
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // All 0% — no gaps, no actions yet. Show what to create based on the prompts AI didn't cite you for.
  const brandPct = result.visibility?.aggregatePercentages?.[result.brand] ?? 0
  if (brandPct === 0 && result.prompts?.length > 0) {
    return (
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-1">What to do to start appearing in AI answers</h2>
        <p className="text-sm text-gray-500 mb-4">
          AI engines don't mention {result.brand} for any of these queries yet. Create dedicated content that directly answers each one — this is how you get cited.
        </p>
        <div className="space-y-3">
          {result.prompts.map((prompt, i) => (
            <div key={i} className="bg-white border border-indigo-100 rounded-xl p-4 flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
              <div>
                <p className="text-sm font-semibold text-gray-800">Create a dedicated page answering: "{prompt}"</p>
                <p className="text-xs text-gray-500 mt-1">
                  Write content specifically targeting this query. Use the AI answers above to see what language and topics AI engines currently associate with this search — then write content that matches and adds your unique angle.
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return null
}

// ─── Act 5: Technical Checks (collapsible) ───────────────────────────────────

function TechnicalChecks({ result }) {
  const [open, setOpen] = useState(false)
  const hasCrawler = !!result.crawlerStatus
  const hasGaps = result.blogGaps?.length > 0

  if (!hasCrawler && !hasGaps) return null

  return (
    <div className="mb-8">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-800 transition-colors"
      >
        <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        Technical checks {hasCrawler ? '· robots.txt' : ''} {hasGaps ? '· content gaps' : ''}
      </button>
      {open && (
        <div className="mt-4 space-y-4">
          <CrawlerCheck crawlerStatus={result.crawlerStatus} />
          <BlogAnalysis blogGaps={result.blogGaps} pageData={result.pageData} />
        </div>
      )}
    </div>
  )
}

// ─── URL Mode Result ──────────────────────────────────────────────────────────

function UrlModeResult({ result, onReset }) {
  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Visibility Report</h1>
          <p className="text-sm text-gray-500 mt-1">
            {result.brand} · {result.prompts.length} prompts · {result.llmsQueried.map(l => LLM_COLORS[l]?.label || l).join(', ')}
          </p>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <Link to="/dashboard" className="text-sm text-gray-500 hover:text-gray-800">View Dashboard →</Link>
          <button onClick={onReset} className="text-sm text-indigo-600 hover:underline">← New report</button>
        </div>
      </div>

      <ScoreOverview result={result} />
      <WhyNotRanking result={result} />
      <WhyCompetitorsRank result={result} />
      <WhatToDo result={result} />

      {/* Full prompt-by-prompt AI answers */}
      <div className="mb-8">
        <PromptTable
          prompts={result.prompts}
          llmsQueried={result.llmsQueried}
          visibility={result.visibility}
          brand={result.brand}
          competitors={result.competitors}
        />
      </div>

      <TechnicalChecks result={result} />
    </div>
  )
}

// ─── Keyword Mode Result ──────────────────────────────────────────────────────

function KeywordModeResult({ result, onReset }) {
  const rankings = result.brandRankings || []

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Search Landscape</h1>
          <p className="text-sm text-gray-500 mt-1">
            "{result.keyword}" · {result.prompts.length} queries · {result.llmsQueried.map(l => LLM_COLORS[l]?.label || l).join(', ')}
          </p>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <Link to="/dashboard" className="text-sm text-gray-500 hover:text-gray-800">View Dashboard →</Link>
          <button onClick={onReset} className="text-sm text-indigo-600 hover:underline">← New report</button>
        </div>
      </div>

      {/* Who dominates + why */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Who dominates AI search for this topic</h2>
        <p className="text-sm text-gray-500 mb-5">Ranked by citation frequency across all queries and AI engines</p>
        <div className="space-y-4">
          {rankings.map((r, i) => {
            const evidence = getCompetitorEvidence(result.visibility, r.brand)
            const best = evidence[0]
            return (
              <div key={r.brand} className="bg-white border border-gray-200 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${i === 0 ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-bold ${i === 0 ? 'text-indigo-700' : 'text-gray-800'}`}>{r.brand}</span>
                      <span className={`text-sm font-bold ${i === 0 ? 'text-indigo-600' : 'text-gray-500'}`}>{r.pct}%</span>
                    </div>
                    <div className="mt-1.5 bg-gray-100 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${i === 0 ? 'bg-indigo-500' : 'bg-gray-400'}`} style={{ width: `${r.pct}%` }} />
                    </div>
                  </div>
                </div>
                {best?.snippet && (
                  <>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                      What {LLM_COLORS[best.llm]?.label || 'AI'} says about them:
                    </p>
                    <blockquote className="text-sm text-gray-600 leading-relaxed bg-gray-50 border-l-4 border-gray-300 pl-4 pr-3 py-2 rounded-r-lg italic">
                      "{best.snippet}"
                    </blockquote>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* CTA */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 text-center">
        <h3 className="text-base font-bold text-gray-900 mb-1">Is YOUR brand in this landscape?</h3>
        <p className="text-sm text-gray-500 mb-4">
          Enter your website URL to see how you rank against these brands — and get a specific content action plan.
        </p>
        <button
          onClick={onReset}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors"
        >
          Check my website →
        </button>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function V3VisibilityFlow() {
  const [input, setInput] = useState('')
  const [selectedLLMs, setSelectedLLMs] = useState(['chatgpt', 'gemini'])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(() => {
    try { return JSON.parse(localStorage.getItem('peach_last_result')) || null }
    catch { return null }
  })

  const toggleLLM = (llm) =>
    setSelectedLLMs(prev => prev.includes(llm) ? prev.filter(l => l !== llm) : [...prev, llm])

  const handleReset = () => {
    localStorage.removeItem('peach_last_result')
    setResult(null)
  }

  const handleRun = async () => {
    setError('')
    const val = input.trim()
    if (!val) return setError('Enter your website URL.')
    if (selectedLLMs.length === 0) return setError('Select at least one AI engine.')

    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/v3/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: val, llms: selectedLLMs }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analysis failed')
      localStorage.setItem('peach_last_result', JSON.stringify(data))
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-10">
          {result.mode === 'url'
            ? <UrlModeResult result={result} onReset={handleReset} />
            : <KeywordModeResult result={result} onReset={handleReset} />
          }
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center px-6 max-w-sm">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-800 font-semibold mb-1">Analysing across {selectedLLMs.length} AI engines…</p>
          <p className="text-sm text-gray-400">Generating prompts, querying LLMs, diagnosing gaps — takes 30–60s</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Find out why AI doesn't mention you</h1>
          <p className="text-gray-500 text-base">
            Enter your website URL — we'll show you exactly why competitors rank in ChatGPT,
            <br />Gemini, and Google AI Overviews, and what content to create to compete.
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          <div className="flex gap-3 mb-3">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRun()}
              placeholder='yourwebsite.com'
              className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              autoFocus
            />
            <button
              onClick={handleRun}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-3 rounded-xl text-sm transition-colors whitespace-nowrap"
            >
              Analyse
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap mb-8">
            <span className="text-xs text-gray-400">Try:</span>
            {EXAMPLES.map(ex => (
              <button
                key={ex.value}
                onClick={() => setInput(ex.value)}
                className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition-colors"
              >
                {ex.label}
              </button>
            ))}
          </div>

          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Query with</p>
            <div className="flex gap-2">
              {['chatgpt', 'gemini', 'googleaio'].map(llm => (
                <LLMChip key={llm} llm={llm} selected={selectedLLMs.includes(llm)} onClick={() => toggleLLM(llm)} />
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-500 mt-4">{error}</p>}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          We crawl your page, generate 3 buyer queries, check ChatGPT + Gemini, and show you exactly why competitors are cited instead of you.
        </p>
      </div>
    </div>
  )
}
