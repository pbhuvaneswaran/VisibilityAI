import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { ScoreBar, PromptTable, ActionCard, BlogAnalysis, CrawlerCheck } from '../../components/VisibilityComponents'

const TABS = ['Overview', 'AI Answers', 'Content Gaps', 'Action Plan', 'Site Audit']
const LINE_COLORS = ['#4f46e5', '#9ca3af', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6']

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function OverviewTab({ runs }) {
  const latest = runs[0]

  // Chart: only URL-mode runs for the same brand, oldest first
  const chartData = useMemo(() => {
    if (!latest) return { data: [], brands: [] }
    const urlRuns = runs
      .filter(r => r.mode === 'url' && r.brand === latest.brand)
      .reverse()
    const brandList = Object.keys(latest.allBrandPcts || {}).slice(0, 6)
    return {
      data: urlRuns.map(r => ({
        date: formatDate(r.savedAt),
        ...Object.fromEntries(brandList.map(b => [b, r.allBrandPcts?.[b] ?? null])),
      })),
      brands: brandList,
    }
  }, [runs, latest])

  // Leaderboard: only the latest run's brands (not merged across unrelated runs)
  const leaderboard = useMemo(() => {
    return Object.entries(latest?.allBrandPcts || {})
      .map(([brand, pct]) => ({ brand, pct }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 8)
  }, [latest])

  if (!latest) {
    return <p className="text-sm text-gray-500">No runs yet. <Link to="/app" className="text-indigo-600 hover:underline">Run a check</Link> to see data here.</p>
  }

  return (
    <div>
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="AI mentions" value={`${latest.brandPct}%`} sub={latest.brand} />
        <StatCard label="Missed prompts" value={latest.missedPrompts} sub={`of ${latest.totalPrompts} prompts`} />
        <StatCard label="Total runs" value={runs.length} />
        <StatCard
          label="Top competitor"
          value={latest.topCompetitor && latest.topCompetitorPct > 0 ? latest.topCompetitor : 'None cited'}
          sub={latest.topCompetitor && latest.topCompetitorPct > 0 ? `${latest.topCompetitorPct}% mentions` : 'No competitors cited yet'}
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h2 className="text-base font-bold text-gray-900 mb-4">Mentions over time</h2>
          {chartData.data.length > 1 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {chartData.brands.map((brand, i) => (
                  <Line
                    key={brand}
                    type="monotone"
                    dataKey={brand}
                    stroke={brand === latest.brand ? LINE_COLORS[0] : LINE_COLORS[(i % (LINE_COLORS.length - 1)) + 1]}
                    strokeWidth={brand === latest.brand ? 3 : 1.5}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 py-12 text-center">Run more checks to see a trend over time.</p>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h2 className="text-base font-bold text-gray-900 mb-4">Leaderboard</h2>
          <div className="space-y-3">
            {leaderboard.map(r => (
              <ScoreBar key={r.brand} brand={r.brand} pct={r.pct} highlight={r.brand === latest.brand} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function AIAnswersTab({ latest }) {
  if (!latest) return <p className="text-sm text-gray-500">No runs yet.</p>
  return (
    <PromptTable
      prompts={latest.prompts}
      llmsQueried={latest.llmsQueried}
      visibility={latest.visibility}
      brand={latest.brand}
      competitors={latest.competitors}
    />
  )
}

function ContentGapsTab({ latestUrlRun }) {
  if (!latestUrlRun) {
    return <p className="text-sm text-gray-500">No URL-mode run found. <Link to="/app" className="text-indigo-600 hover:underline">Run the tool with a URL</Link> to see content gaps.</p>
  }
  return <BlogAnalysis blogGaps={latestUrlRun.blogGaps} pageData={{ url: latestUrlRun.input, wordCount: null }} />
}

function ActionPlanTab({ latestUrlRun }) {
  if (!latestUrlRun || !latestUrlRun.actions?.length) {
    return <p className="text-sm text-gray-500">No action plan available yet. <Link to="/app" className="text-indigo-600 hover:underline">Run the tool with a URL</Link> to generate one.</p>
  }
  return (
    <div className="space-y-4">
      {latestUrlRun.actions.map((action, i) => (
        <ActionCard key={i} action={action} index={i} />
      ))}
    </div>
  )
}

function SiteAuditTab({ latestUrlRun }) {
  if (!latestUrlRun) {
    return <p className="text-sm text-gray-500">No URL-mode run found. <Link to="/app" className="text-indigo-600 hover:underline">Run the tool with a URL</Link> to see a site audit.</p>
  }
  return (
    <div>
      <CrawlerCheck crawlerStatus={latestUrlRun.crawlerStatus} />
      <BlogAnalysis blogGaps={latestUrlRun.blogGaps} pageData={{ url: latestUrlRun.input, wordCount: null }} />
    </div>
  )
}

export default function Dashboard() {
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('Overview')

  useEffect(() => {
    fetch('/api/runs')
      .then(res => res.json())
      .then(data => setRuns(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }, [])

  const latest = runs[0]
  const latestUrlRun = runs.find(r => r.mode === 'url')

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">AI Visibility Dashboard</h1>
          <Link to="/app" className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            Run new check →
          </Link>
        </div>

        <div className="flex gap-1 border-b border-gray-200 mb-6">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'Overview' && <OverviewTab runs={runs} />}
        {activeTab === 'AI Answers' && <AIAnswersTab latest={latest} />}
        {activeTab === 'Content Gaps' && <ContentGapsTab latestUrlRun={latestUrlRun} />}
        {activeTab === 'Action Plan' && <ActionPlanTab latestUrlRun={latestUrlRun} />}
        {activeTab === 'Site Audit' && <SiteAuditTab latestUrlRun={latestUrlRun} />}
      </div>
    </div>
  )
}
