'use client'
import { useEffect, useMemo, useState } from 'react'

const POLL_INTERVAL_MS = 30000
const palette = {
  page: '#ffffff',
  surface: '#ffffff',
  surfaceAlt: '#ffffff',
  border: '#dde4ec',
  borderSoft: '#e8edf3',
  ink: '#213547',
  muted: '#66717d',
  subtle: '#8a948f',
  accent: '#183b5b',
  accentSoft: '#f6f9fc',
  success: '#2f6b46',
  successSoft: '#f5faf6',
  warning: '#9a6a1f',
  warningSoft: '#fdfaf4',
  danger: '#a65246',
  dangerSoft: '#fdf6f5',
  shadow: '0 8px 24px rgba(16, 24, 40, 0.04)',
}

function outcomeToReward(outcome) {
  if (!outcome) return 0
  if (outcome === 'safe_after_15m' || outcome === 'good_feedback') return 1
  if (outcome === 'protect') return -0.5
  if (outcome === 'undo' || outcome === 'bad_feedback') return -1
  if (String(outcome).includes('regret')) return -1
  return 0
}

function formatNumber(value, digits = 1) {
  return Number(value || 0).toFixed(digits)
}

function formatCompactNumber(value) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(value || 0))
}

function parsePayload(payload) {
  if (!payload) return {}
  if (typeof payload === 'object') return payload
  if (typeof payload !== 'string') return {}
  try {
    return JSON.parse(payload)
  } catch {
    return {}
  }
}

function normalizeSubmission(submission) {
  const payload = parsePayload(submission?.payload)
  return {
    ...submission,
    payload,
    tabCount: Number(submission?.tabCount || 0),
    groupCount: Number(submission?.groupCount || 0),
    autoSleepCount: Number(submission?.autoSleepCount || 0),
    autoWakeCount: Number(submission?.autoWakeCount || 0),
    undoCount: Number(submission?.undoCount || 0),
    regretCount: Number(submission?.regretCount || 0),
    memorySaved: Number(submission?.memorySaved || 0),
    fixedRuleMemorySavedMb: Number(submission?.fixedRuleMemorySavedMb || 0),
    avgRating: Number(submission?.avgRating || 0),
    trustSleepClose: Number(submission?.trustSleepClose || 0),
    groupingUseful: Number(submission?.groupingUseful || 0),
    wouldUseInRealBrowsing: Number(submission?.wouldUseInRealBrowsing || 0),
    sessionCount: Number(submission?.sessionCount || 0),
    ratingCount: Number(submission?.ratingCount || 0),
  }
}

function aggregateDashboard(submissions) {
  const trend = submissions
    .slice()
    .reverse()
    .map((submission, index) => {
      const payload = submission.payload || {}
      const trainingExamples = Array.isArray(payload.trainingExamples) ? payload.trainingExamples : []
      const rewards = trainingExamples.map((example) => Number(example.reward || 0))
      const avgReward = rewards.length
        ? rewards.reduce((sum, reward) => sum + reward, 0) / rewards.length
        : 0
      const autoSleepCount = Number(submission.autoSleepCount || 0)
      const regretRate = autoSleepCount
        ? Number(submission.regretCount || 0) / autoSleepCount
        : 0

      return {
        x: index + 1,
        label: new Date(submission.receivedAt).toLocaleDateString(),
        avgReward,
        regretRate,
        memorySaved: Number(submission.memorySaved || 0),
        undoCount: Number(submission.undoCount || 0),
      }
    })

  const outcomeCounts = {
    safe: 0,
    regret: 0,
    undo: 0,
    good: 0,
    bad: 0,
    protect: 0,
  }

  const contextCounts = {}
  let trainingExampleCount = 0
  let totalReward = 0

  for (const submission of submissions) {
    const payload = submission.payload || {}
    const feedbackLog = Array.isArray(payload.feedbackLog) ? payload.feedbackLog : []
    const trainingExamples = Array.isArray(payload.trainingExamples) ? payload.trainingExamples : []
    trainingExampleCount += trainingExamples.length

    for (const example of trainingExamples) {
      totalReward += Number(example.reward || 0)
      const groupName = example.target?.groupName || 'Ungrouped'
      const reward = Number(example.reward || 0)
      if (!contextCounts[groupName]) {
        contextCounts[groupName] = { reward: 0, bad: 0, total: 0 }
      }
      contextCounts[groupName].reward += reward
      contextCounts[groupName].total += 1
      if (reward < 0) contextCounts[groupName].bad += 1
    }

    for (const feedback of feedbackLog) {
      if (feedback.type === 'undo') outcomeCounts.undo += 1
      else if (feedback.type === 'protect') outcomeCounts.protect += 1
      else if (feedback.type === 'good_feedback') outcomeCounts.good += 1
      else if (feedback.type === 'bad_feedback') outcomeCounts.bad += 1
      else if (String(feedback.type).includes('regret')) outcomeCounts.regret += 1
      else if (feedback.type === 'safe_after_15m') outcomeCounts.safe += 1
    }
  }

  const topRegretContexts = Object.entries(contextCounts)
    .map(([groupName, stats]) => ({
      groupName,
      avgReward: stats.total ? stats.reward / stats.total : 0,
      badRate: stats.total ? stats.bad / stats.total : 0,
      total: stats.total,
    }))
    .sort((a, b) => a.avgReward - b.avgReward)
    .slice(0, 5)

  const scatter = submissions.map((submission) => ({
    id: submission.id,
    label: submission.participantId || 'anon',
    x: Number(submission.memorySaved || 0),
    y: submission.autoSleepCount ? Number(submission.regretCount || 0) / Number(submission.autoSleepCount || 1) : 0,
  }))

  return {
    trend,
    outcomeCounts,
    topRegretContexts,
    scatter,
    trainingExampleCount,
    avgReward: trainingExampleCount ? totalReward / trainingExampleCount : 0,
  }
}

function scoreSleepability(example) {
  const features = example.context?.actionFeatures || {}
  const minutesSinceLastActive = Number(features.minutesSinceLastActive || 0)
  const visits24h = Number(features.visits24h || 0)
  const regretCount = Number(features.regretCount || 0)
  const safeSleepCount = Number(features.safeSleepCount || 0)

  return (
    minutesSinceLastActive * 0.02 +
    Math.max(0, 2 - visits24h) * 0.8 +
    safeSleepCount * 0.6 -
    regretCount * 1.1
  )
}

function simulateTrainingExamples(examples, thresholdDelta, minInactiveDelta) {
  let score = 0
  let preventedBadSleeps = 0
  let keptGoodSleeps = 0

  for (const example of examples) {
    const policy = example.context?.policyState || {}
    const minutesSinceLastActive = Number(example.context?.actionFeatures?.minutesSinceLastActive || 0)
    const effectiveThreshold = (policy.sleepThreshold ?? 0.33) + thresholdDelta
    const effectiveMinInactive = (policy.minInactiveMinutes ?? 20) + minInactiveDelta
    const shouldSleep =
      minutesSinceLastActive >= effectiveMinInactive &&
      scoreSleepability(example) >= effectiveThreshold * 10
    const reward = Number(example.reward || 0)

    if (shouldSleep) {
      score += reward
      if (reward > 0) keptGoodSleeps += 1
    } else {
      score -= reward
      if (reward < 0) preventedBadSleeps += 1
    }
  }

  return { score, preventedBadSleeps, keptGoodSleeps }
}

function findTrainingRecommendation(submissions) {
  const examples = submissions.flatMap((submission) =>
    Array.isArray(submission.payload?.trainingExamples) ? submission.payload.trainingExamples : []
  )

  if (examples.length === 0) {
    return null
  }

  let best = null
  for (let thresholdDelta = -0.08; thresholdDelta <= 0.08; thresholdDelta += 0.01) {
    for (let minInactiveDelta = -10; minInactiveDelta <= 10; minInactiveDelta += 5) {
      const candidate = {
        thresholdDelta: Number(thresholdDelta.toFixed(2)),
        minInactiveDelta,
        ...simulateTrainingExamples(examples, thresholdDelta, minInactiveDelta),
      }
      if (!best || candidate.score > best.score) {
        best = candidate
      }
    }
  }

  return {
    exampleCount: examples.length,
    ...best,
  }
}

function StatCard({ label, value }) {
  return (
    <div
      style={{
        minWidth: '0',
        background: palette.surface,
        border: `1px solid ${palette.borderSoft}`,
        borderRadius: '16px',
        padding: '14px 16px 13px',
        boxShadow: '0 1px 4px rgba(16, 24, 40, 0.025)',
        minHeight: '96px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ fontSize: '10px', color: palette.subtle, textTransform: 'uppercase', letterSpacing: '.09em', marginBottom: '7px', fontWeight: '700' }}>
        {label}
      </div>
      <div style={{ fontSize: '20px', fontWeight: '600', color: palette.ink, letterSpacing: '-0.02em', lineHeight: '1.15' }}>{value}</div>
    </div>
  )
}

function MiniBarChart({ title, items, color = '#1F4E79', formatter = (value) => value }) {
  const max = Math.max(...items.map((item) => item.value), 1)
  return (
    <div style={{ background: palette.surface, border: `1px solid ${palette.borderSoft}`, borderRadius: '16px', padding: '14px 15px', boxShadow: '0 1px 4px rgba(16, 24, 40, 0.025)' }}>
      <div style={{ fontSize: '12px', fontWeight: '700', color: palette.ink, marginBottom: '12px', letterSpacing: '-0.01em' }}>{title}</div>
      <div style={{ display: 'grid', gap: '10px' }}>
        {items.map((item) => (
          <div key={item.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '12px', marginBottom: '5px' }}>
              <span style={{ color: palette.muted, fontWeight: '600' }}>{item.label}</span>
              <span style={{ color: palette.subtle }}>{formatter(item.value)}</span>
            </div>
            <div style={{ height: '10px', background: '#edf2f7', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{ width: `${(item.value / max) * 100}%`, height: '100%', background: color, borderRadius: '999px' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TrendChart({ title, points, color, valueKey, yFormatter = (value) => value.toFixed(2) }) {
  const values = points.map((point) => point[valueKey])
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const width = 320
  const height = 120
  const coords = points.map((point, index) => {
    const x = points.length === 1 ? 0 : (index / (points.length - 1)) * width
    const y = height - ((point[valueKey] - min) / Math.max(max - min, 1)) * height
    return `${x},${y}`
  }).join(' ')

  return (
    <div style={{ background: palette.surface, border: `1px solid ${palette.borderSoft}`, borderRadius: '16px', padding: '14px 15px', boxShadow: '0 1px 4px rgba(16, 24, 40, 0.025)' }}>
      <div style={{ fontSize: '12px', fontWeight: '700', color: palette.ink, marginBottom: '10px', letterSpacing: '-0.01em' }}>{title}</div>
      {points.length > 0 ? (
        <>
          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '120px', display: 'block' }}>
            <polyline fill="none" stroke={color} strokeWidth="3" points={coords} />
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '11px', color: palette.subtle, marginTop: '8px' }}>
            <span>{points[0]?.label}</span>
            <span>Latest {yFormatter(points[points.length - 1]?.[valueKey] || 0)}</span>
          </div>
        </>
      ) : (
        <div style={{ fontSize: '12px', color: palette.subtle }}>Not enough submissions yet.</div>
      )}
    </div>
  )
}

function SessionComparisonCard({ title, points }) {
  return (
    <div style={{ background: palette.surface, border: `1px solid ${palette.borderSoft}`, borderRadius: '16px', padding: '14px 15px', boxShadow: '0 1px 4px rgba(16, 24, 40, 0.025)' }}>
      <div style={{ fontSize: '12px', fontWeight: '700', color: palette.ink, marginBottom: '10px', letterSpacing: '-0.01em' }}>{title}</div>
      {points.length > 0 ? (
        <div style={{ display: 'grid', gap: '8px' }}>
          {points.slice(0, 5).map((point, index) => (
            <div
              key={point.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '28px minmax(0, 1fr) auto auto',
                gap: '10px',
                alignItems: 'center',
                padding: '8px 10px',
                border: `1px solid ${palette.borderSoft}`,
                borderRadius: '12px',
                background: '#fbfdff',
              }}
            >
              <div style={{ fontSize: '10px', color: palette.subtle }}>{index + 1}</div>
              <div style={{ fontSize: '11px', color: palette.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {point.label}
              </div>
              <div style={{ fontSize: '11px', color: palette.ink }}>{Math.round(point.x)} MB</div>
              <div style={{ fontSize: '11px', color: palette.ink }}>{Math.round(point.y * 100)}%</div>
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr) auto auto', gap: '10px', fontSize: '10px', color: palette.subtle, padding: '0 10px' }}>
            <span />
            <span>Session</span>
            <span>Memory</span>
            <span>Regret</span>
          </div>
        </div>
      ) : (
        <div style={{ fontSize: '12px', color: palette.subtle }}>No points yet.</div>
      )}
    </div>
  )
}

function SessionSummaryMetric({ label, value, tone = 'neutral', priority = false }) {
  return (
    <div
      style={{
        minWidth: '0',
        padding: '10px 12px',
        borderRadius: '12px',
        background: palette.surface,
        border: `1px solid ${palette.borderSoft}`,
        display: 'grid',
        gap: '3px',
        minHeight: '62px',
        alignContent: 'space-between',
      }}
    >
      <div
        style={{
          fontSize: '9px',
          color: palette.subtle,
          textTransform: 'uppercase',
          letterSpacing: '.06em',
          fontWeight: '700',
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: '16px', fontWeight: '600', color: palette.ink, lineHeight: '1.1' }}>
        {value}
      </div>
    </div>
  )
}

export default function Admin() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const response = await fetch('/api/collect', { cache: 'no-store' })
        if (!response.ok) {
          throw new Error(`Failed to load study data (${response.status})`)
        }
        const json = await response.json()
        if (cancelled) return
        setData(json)
        setLoading(false)
        setLastUpdated(new Date())
      } catch (err) {
        if (cancelled) return
        setError(err.message)
        setLoading(false)
      }
    }

    load()
    const timer = setInterval(load, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  const submissions = useMemo(() => {
    if (!Array.isArray(data?.submissions)) return []
    return data.submissions.map(normalizeSubmission)
  }, [data])
  const dashboard = useMemo(() => aggregateDashboard(submissions), [submissions])
  const recommendation = useMemo(() => findTrainingRecommendation(submissions), [submissions])

  const totalSessions = submissions.reduce((sum, submission) => sum + (submission.sessionCount || 0), 0)
  const totalRatings = submissions.reduce((sum, submission) => sum + (submission.ratingCount || 0), 0)
  const totalMemorySaved = submissions.reduce((sum, submission) => sum + (submission.memorySaved || 0), 0)
  const totalRuleMemory = submissions.reduce((sum, submission) => sum + (submission.fixedRuleMemorySavedMb || 0), 0)
  const avgRating = submissions.length
    ? submissions.reduce((sum, submission) => sum + (submission.avgRating || 0), 0) / submissions.length
    : 0
  const avgUndoRate = submissions.length
    ? submissions.reduce((sum, submission) => sum + (submission.undoCount || 0), 0) / submissions.length
    : 0

  const outcomeItems = [
    { label: 'Safe', value: dashboard.outcomeCounts.safe },
    { label: 'Regret', value: dashboard.outcomeCounts.regret },
    { label: 'Undo', value: dashboard.outcomeCounts.undo },
    { label: 'Good', value: dashboard.outcomeCounts.good },
    { label: 'Bad', value: dashboard.outcomeCounts.bad },
    { label: 'Protect', value: dashboard.outcomeCounts.protect },
  ]

  const sectionTitleStyle = {
    fontSize: '11px',
    fontWeight: '700',
    color: palette.accent,
    marginBottom: '12px',
    letterSpacing: '.1em',
    textTransform: 'uppercase',
  }

  const cardShellStyle = {
    border: `1px solid ${palette.borderSoft}`,
    borderRadius: '18px',
    background: palette.surface,
    overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(16, 24, 40, 0.025)',
  }

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '32px 24px 44px', maxWidth: '1180px', margin: '0 auto', background: palette.page, color: palette.ink }}>
      <div style={{ marginBottom: '20px', padding: '22px 24px', background: palette.surface, border: `1px solid ${palette.border}`, borderRadius: '20px', boxShadow: palette.shadow }}>
        <a href="/" style={{ color: palette.accent, fontSize: '12px', textDecoration: 'none', fontWeight: '600', letterSpacing: '.02em' }}><span aria-hidden="true">&larr;</span> Back to Tab Agent</a>
        <div style={{ fontSize: '10px', color: palette.subtle, textTransform: 'uppercase', letterSpacing: '.14em', fontWeight: '700', marginTop: '14px' }}>
          Research console
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: '800', color: palette.ink, marginTop: '8px', letterSpacing: '-0.03em', lineHeight: '1.05' }}>
          Study Admin
        </h1>
        <p style={{ color: palette.muted, fontSize: '13px', marginTop: '8px', maxWidth: '760px', lineHeight: '1.7' }}>
          Review submitted sessions, track trust and regret trends, and inspect how the tab agent is learning over time. This page is designed for operator review, benchmark storytelling, and publishable study snapshots.
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '14px' }}>
          <span style={{ fontSize: '11px', padding: '6px 10px', borderRadius: '999px', background: palette.accentSoft, color: palette.accent, fontWeight: '600', border: '1px solid #d8e3ee' }}>
            Polling every 30s
          </span>
          <span style={{ fontSize: '11px', padding: '6px 10px', borderRadius: '999px', background: palette.surface, color: palette.muted, fontWeight: '600', border: `1px solid ${palette.borderSoft}` }}>
            Live data from /api/collect
          </span>
          {lastUpdated && (
            <span style={{ fontSize: '11px', padding: '6px 10px', borderRadius: '999px', background: '#f8fafc', color: palette.subtle, fontWeight: '600', border: `1px solid ${palette.borderSoft}` }}>
              Last updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {loading && <p style={{ color: palette.muted }}>Loading...</p>}
      {error && <p style={{ color: palette.danger }}>Error: {error}</p>}

      {data && (
        <>
          <section style={{ marginBottom: '18px', padding: '16px', background: palette.surfaceAlt, border: `1px solid ${palette.border}`, borderRadius: '18px', boxShadow: '0 1px 4px rgba(16, 24, 40, 0.02)' }}>
            <div style={sectionTitleStyle}>Top-level metrics</div>
          <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <StatCard label="Submissions" value={data.count} />
            <StatCard label="Total sessions logged" value={totalSessions} />
            <StatCard label="Training examples" value={dashboard.trainingExampleCount} />
            <StatCard label="Average reward" value={formatNumber(dashboard.avgReward, 2)} />
            <StatCard label="Autonomous memory saved" value={`${totalMemorySaved.toFixed(0)} MB est.`} />
            <StatCard label="Rule baseline memory" value={`${totalRuleMemory.toFixed(0)} MB est.`} />
            <StatCard label="Avg undo rate" value={avgUndoRate.toFixed(1)} />
            <StatCard label="Average rating" value={`${avgRating.toFixed(1)}/5`} />
          </div>
          </section>

          <section style={{ marginBottom: '18px', padding: '16px', background: palette.surfaceAlt, border: `1px solid ${palette.border}`, borderRadius: '18px', boxShadow: '0 1px 4px rgba(16, 24, 40, 0.02)' }}>
            <div style={sectionTitleStyle}>Trend view</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px' }}>
            <TrendChart title="Reward trend" points={dashboard.trend} valueKey="avgReward" color="#1F4E79" />
            <TrendChart title="Regret-rate trend" points={dashboard.trend} valueKey="regretRate" color="#B26D00" yFormatter={(value) => `${Math.round(value * 100)}%`} />
            <TrendChart title="Memory-saved trend" points={dashboard.trend} valueKey="memorySaved" color="#2E7D32" yFormatter={(value) => `${Math.round(value)} MB`} />
            <SessionComparisonCard title="Session comparison" points={dashboard.scatter} />
          </div>
          </section>

          <section style={{ marginBottom: '18px', padding: '16px', background: palette.surfaceAlt, border: `1px solid ${palette.border}`, borderRadius: '18px', boxShadow: '0 1px 4px rgba(16, 24, 40, 0.02)' }}>
            <div style={sectionTitleStyle}>Learning signals</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            <MiniBarChart title="Outcome breakdown" items={outcomeItems} color={palette.accent} />
            <MiniBarChart
              title="Top regret contexts"
              items={dashboard.topRegretContexts.map((item) => ({
                label: item.groupName,
                value: item.badRate,
              }))}
              color={palette.warning}
              formatter={(value) => `${Math.round(value * 100)}% bad`}
            />
            <div style={{ background: palette.surface, border: `1px solid ${palette.borderSoft}`, borderRadius: '16px', padding: '14px 15px', boxShadow: '0 1px 4px rgba(16, 24, 40, 0.025)' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: palette.ink, marginBottom: '10px' }}>
                Offline training recommendation
              </div>
              <div style={{ fontSize: '12px', color: palette.muted, lineHeight: '1.7', marginBottom: '10px' }}>
                This is a lightweight offline policy suggestion based on submitted training examples. It is meant for analysis, not automatic deployment.
              </div>
              {recommendation ? (
                <div style={{ fontSize: '13px', color: palette.muted, lineHeight: '1.8' }}>
                  <div>Examples: <strong>{recommendation.exampleCount}</strong></div>
                  <div>Suggested sleep-threshold delta: <strong>{recommendation.thresholdDelta}</strong></div>
                  <div>Suggested min-inactive delta: <strong>{recommendation.minInactiveDelta} min</strong></div>
                  <div>Prevented bad sleeps: <strong>{recommendation.preventedBadSleeps}</strong></div>
                  <div>Kept good sleeps: <strong>{recommendation.keptGoodSleeps}</strong></div>
                  <div>Aggregate reward score: <strong>{formatNumber(recommendation.score, 2)}</strong></div>
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: palette.subtle }}>
                  No training examples yet. Once submissions include enough auto-sleep outcomes, this panel will recommend a threshold update.
                </div>
                )}
              </div>
            </div>
          </section>

          {submissions.length > 0 ? (
            <section style={{ padding: '16px', background: palette.surfaceAlt, border: `1px solid ${palette.border}`, borderRadius: '18px', boxShadow: '0 1px 4px rgba(16, 24, 40, 0.02)' }}>
              <div style={sectionTitleStyle}>Submitted sessions</div>
              <div style={{ fontSize: '12px', color: palette.muted, marginBottom: '12px', lineHeight: '1.6', maxWidth: '720px' }}>
                Each submission includes the browser snapshot, autonomous outcomes, and learning signals. Expand a session only when you want the detailed trace.
              </div>
            <div style={{ display: 'grid', gap: '12px' }}>
              {submissions.map((submission, index) => {
                const payload = submission.payload || {}
                const regretRate = submission.autoSleepCount
                  ? Number(submission.regretCount || 0) / Number(submission.autoSleepCount || 1)
                  : 0
                const undoRate = submission.autoSleepCount
                  ? Number(submission.undoCount || 0) / Number(submission.autoSleepCount || 1)
                  : 0
                const memoryLift = Number(submission.memorySaved || 0) - Number(submission.fixedRuleMemorySavedMb || 0)
                const sessionSubtitle = payload.autonomyState?.mode === 'trusted_autonomy'
                  ? 'Trusted autonomy active'
                  : 'Observation-first session'

                return (
                  <details
                    key={submission.id}
                    style={cardShellStyle}
                  >
                    <summary
                      style={{
                        padding: '14px 16px',
                        borderBottom: '1px solid #edf2f7',
                        cursor: 'pointer',
                        listStyle: 'none',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                        <div style={{ display: 'grid', gap: '8px', minWidth: '220px', flex: '1 1 300px' }}>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <span
                              style={{
                                fontSize: '9px',
                                color: palette.muted,
                                textTransform: 'uppercase',
                                letterSpacing: '.08em',
                                fontWeight: '700',
                                padding: '5px 8px',
                                borderRadius: '999px',
                                background: palette.accentSoft,
                                border: '1px solid #dde6ef',
                              }}
                            >
                              {sessionSubtitle}
                            </span>
                            <span style={{ fontSize: '11px', color: palette.subtle }}>
                              {new Date(submission.receivedAt).toLocaleString()}
                            </span>
                          </div>
                          <div>
                            <div style={{ fontSize: '18px', fontWeight: '800', color: palette.ink, lineHeight: '1.15', letterSpacing: '-0.02em' }}>
                              Participant {submission.participantId || 'anonymous'}
                            </div>
                            <div style={{ fontSize: '12px', color: palette.muted, marginTop: '4px', lineHeight: '1.55', maxWidth: '560px' }}>
                              {submission.autoSleepCount || submission.autoWakeCount
                                ? 'Snapshot includes autonomous outcomes, feedback signals, and memory estimates for this session.'
                                : 'Snapshot captured grouping behavior and trust signals before autonomous actions started.'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: palette.subtle, fontFamily: 'monospace' }}>
                              {submission.id}
                            </span>
                            <span
                              style={{
                                fontSize: '10px',
                                color: palette.accent,
                                background: palette.accentSoft,
                                border: '1px solid #dde6ef',
                                padding: '4px 8px',
                                borderRadius: '999px',
                                fontWeight: '600',
                              }}
                            >
                              {submission.tabCount ?? 0} tabs
                            </span>
                            <span
                              style={{
                                fontSize: '10px',
                                color: palette.accent,
                                background: palette.accentSoft,
                                border: '1px solid #dde6ef',
                                padding: '4px 8px',
                                borderRadius: '999px',
                                fontWeight: '600',
                              }}
                            >
                              {submission.groupCount ?? 0} groups
                            </span>
                          </div>
                        </div>

                        <div style={{ flex: '1 1 340px', minWidth: '240px' }}>
                          <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                            <SessionSummaryMetric
                              label="Auto-sleeps"
                              value={formatCompactNumber(submission.autoSleepCount ?? 0)}
                            />
                            <SessionSummaryMetric
                              label="Regrets"
                              value={formatCompactNumber(submission.regretCount ?? 0)}
                            />
                            <SessionSummaryMetric
                              label="Undos"
                              value={formatCompactNumber(submission.undoCount ?? 0)}
                            />
                            <SessionSummaryMetric label="Auto-wakes" value={formatCompactNumber(submission.autoWakeCount ?? 0)} tone="positive" />
                            <SessionSummaryMetric
                              label="Memory lift"
                              value={`${memoryLift >= 0 ? '+' : ''}${formatCompactNumber(memoryLift)} MB`}
                            />
                            <SessionSummaryMetric
                              label="Trust"
                              value={submission.trustSleepClose ? `${submission.trustSleepClose}/5` : '-'}
                            />
                          </div>
                        </div>
                      </div>
                    </summary>

                    <div style={{ padding: '14px 16px 16px', display: 'grid', gap: '12px', background: '#fbfdff' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                        {[
                          { label: 'Useful', value: submission.groupingUseful || '-' },
                          { label: 'Would use', value: submission.wouldUseInRealBrowsing || '-' },
                          { label: 'Avg rating', value: `${(submission.avgRating || 0).toFixed(1)}/5` },
                          { label: 'Regret rate', value: `${Math.round(regretRate * 100)}%` },
                          { label: 'Autonomous memory', value: `${(submission.memorySaved || 0).toFixed(0)} MB est.` },
                          { label: 'Rule baseline', value: `${(submission.fixedRuleMemorySavedMb || 0).toFixed(0)} MB est.` },
                          { label: 'Training examples', value: payload.trainingExamples?.length || 0 },
                        ].map((item) => (
                          <div
                            key={item.label}
                            style={{
                              background: '#fff',
                              border: '1px solid #e6edf5',
                              borderRadius: '10px',
                              padding: '10px 11px',
                              boxShadow: '0 1px 4px rgba(16, 24, 40, 0.02)',
                            }}
                          >
                            <div style={{ fontSize: '9px', color: palette.subtle, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '5px', fontWeight: '700' }}>
                              {item.label}
                            </div>
                            <div style={{ fontSize: '15px', fontWeight: '800', color: palette.ink, lineHeight: '1.2' }}>{item.value}</div>
                          </div>
                        ))}
                      </div>

                      {payload.openAiPolicySummary?.summary && (
                        <div style={{ padding: '12px 13px', background: '#f9fbfd', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                          <div style={{ fontSize: '10px', fontWeight: '700', color: palette.accent, marginBottom: '5px', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                            OpenAI policy summary
                          </div>
                          <div style={{ fontSize: '12px', color: palette.muted, lineHeight: '1.6' }}>
                            {payload.openAiPolicySummary.summary}
                          </div>
                        </div>
                      )}

                      {payload.adaptivePolicySummary?.effectivePolicy && (
                        <div style={{ padding: '12px 13px', background: '#fcfcfd', border: '1px solid #eceff3', borderRadius: '10px' }}>
                          <div style={{ fontSize: '10px', fontWeight: '700', color: palette.ink, marginBottom: '5px', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                            Adaptive policy summary
                          </div>
                          <div style={{ fontSize: '12px', color: palette.muted, lineHeight: '1.6' }}>
                            Sleep threshold: {payload.adaptivePolicySummary.effectivePolicy.sleepThreshold} | Min inactive: {payload.adaptivePolicySummary.effectivePolicy.minInactiveMinutes} min | Recent protect: {payload.adaptivePolicySummary.effectivePolicy.recentProtectMinutes} min
                          </div>
                          {Array.isArray(payload.adaptivePolicySummary.notes) && payload.adaptivePolicySummary.notes.length > 0 && (
                            <div style={{ fontSize: '11px', color: palette.subtle, marginTop: '5px', lineHeight: '1.5' }}>
                              {payload.adaptivePolicySummary.notes.join(' ')}
                            </div>
                          )}
                        </div>
                      )}

                      {payload.actionLog?.length > 0 && (
                        <div>
                          <div style={{ fontSize: '10px', fontWeight: '700', color: palette.accent, marginBottom: '6px', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                            Recent autonomous actions
                          </div>
                          <div style={{ display: 'grid', gap: '6px' }}>
                            {payload.actionLog.slice(0, 5).map((action) => (
                              <div key={action.id} style={{ padding: '9px 11px', border: `1px solid ${palette.borderSoft}`, borderRadius: '10px', background: palette.surface }}>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: action.type === 'auto_sleep' ? palette.warning : palette.accent }}>
                                  {action.type.replace('_', ' ')} | confidence {(Number(action.confidence || 0) * 100).toFixed(0)}%
                                </div>
                                <div style={{ fontSize: '11px', color: palette.muted, marginTop: '3px', lineHeight: '1.5' }}>
                                  {action.reason}
                                </div>
                                <div style={{ fontSize: '10px', color: palette.subtle, marginTop: '3px' }}>
                                  Outcome: {action.outcome?.status || 'pending'}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </details>
                )
              })}
            </div>
            </section>
          ) : (
            <div
              style={{
                background: palette.surface,
                border: `1px solid ${palette.border}`,
                borderRadius: '18px',
                padding: '32px',
                textAlign: 'center',
                color: palette.subtle,
                fontSize: '14px',
              }}
            >
              No submissions yet. Share the extension with your study participants.
            </div>
          )}

          <p style={{ marginTop: '18px', fontSize: '12px', color: palette.subtle, lineHeight: '1.7' }}>
            Raw data available at <code>/api/collect</code>. Memory fields are estimated on Chrome stable. Baseline A is a fixed inactivity threshold; Baseline B is the assistant MVP; experimental metrics reflect autonomous-agent behavior. Dashboard values update automatically from new submissions hitting Vercel.
          </p>
        </>
      )}
    </main>
  )
}
