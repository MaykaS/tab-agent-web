'use client'
import { useEffect, useMemo, useState } from 'react'

const POLL_INTERVAL_MS = 30000
const palette = {
  page: '#f5f1ea',
  surface: '#fffdfa',
  surfaceAlt: '#f8f4ed',
  border: '#ddd2c2',
  borderSoft: '#ebe2d6',
  ink: '#213547',
  muted: '#66717d',
  subtle: '#8a948f',
  accent: '#183b5b',
  accentSoft: '#eef4f8',
  success: '#2f6b46',
  successSoft: '#edf7ef',
  warning: '#9a6a1f',
  warningSoft: '#fdf6e9',
  danger: '#a65246',
  dangerSoft: '#fdf0ee',
  shadow: '0 18px 40px rgba(24, 37, 52, 0.06)',
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
        flex: 1,
        minWidth: '180px',
        background: palette.surface,
        border: `1px solid ${palette.borderSoft}`,
        borderRadius: '18px',
        padding: '18px 18px 16px',
        boxShadow: '0 6px 16px rgba(24, 37, 52, 0.04)',
      }}
    >
      <div style={{ fontSize: '11px', color: palette.subtle, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '8px', fontWeight: '700' }}>
        {label}
      </div>
      <div style={{ fontSize: '30px', fontWeight: '800', color: palette.ink, letterSpacing: '-0.03em' }}>{value}</div>
    </div>
  )
}

function MiniBarChart({ title, items, color = '#1F4E79', formatter = (value) => value }) {
  const max = Math.max(...items.map((item) => item.value), 1)
  return (
    <div style={{ background: palette.surface, border: `1px solid ${palette.borderSoft}`, borderRadius: '18px', padding: '18px', boxShadow: '0 6px 16px rgba(24, 37, 52, 0.04)' }}>
      <div style={{ fontSize: '13px', fontWeight: '800', color: palette.ink, marginBottom: '14px', letterSpacing: '-0.01em' }}>{title}</div>
      <div style={{ display: 'grid', gap: '10px' }}>
        {items.map((item) => (
          <div key={item.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '12px', marginBottom: '5px' }}>
              <span style={{ color: palette.muted, fontWeight: '600' }}>{item.label}</span>
              <span style={{ color: palette.subtle }}>{formatter(item.value)}</span>
            </div>
            <div style={{ height: '10px', background: '#efe8de', borderRadius: '999px', overflow: 'hidden' }}>
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
    <div style={{ background: palette.surface, border: `1px solid ${palette.borderSoft}`, borderRadius: '18px', padding: '18px', boxShadow: '0 6px 16px rgba(24, 37, 52, 0.04)' }}>
      <div style={{ fontSize: '13px', fontWeight: '800', color: palette.ink, marginBottom: '12px', letterSpacing: '-0.01em' }}>{title}</div>
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

function ScatterChart({ title, points }) {
  const width = 320
  const height = 150
  const maxX = Math.max(...points.map((point) => point.x), 1)
  const maxY = Math.max(...points.map((point) => point.y), 0.01)

  return (
    <div style={{ background: palette.surface, border: `1px solid ${palette.borderSoft}`, borderRadius: '18px', padding: '18px', boxShadow: '0 6px 16px rgba(24, 37, 52, 0.04)' }}>
      <div style={{ fontSize: '13px', fontWeight: '800', color: palette.ink, marginBottom: '12px', letterSpacing: '-0.01em' }}>{title}</div>
      {points.length > 0 ? (
        <>
          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '150px', display: 'block', background: '#fbf8f2', borderRadius: '12px' }}>
            {points.map((point) => {
              const cx = (point.x / maxX) * (width - 20) + 10
              const cy = height - (point.y / maxY) * (height - 20) - 10
              return <circle key={point.id} cx={cx} cy={cy} r="5" fill={palette.accent} opacity="0.88" />
            })}
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '11px', color: palette.subtle, marginTop: '8px' }}>
            <span>Memory saved</span>
            <span>Regret rate</span>
          </div>
        </>
      ) : (
        <div style={{ fontSize: '12px', color: palette.subtle }}>No points yet.</div>
      )}
    </div>
  )
}

function SessionSummaryMetric({ label, value, tone = 'neutral', priority = false }) {
  const tones = {
    neutral: {
      background: palette.accentSoft,
      border: '#d6e2ec',
      label: '#5e7388',
      value: palette.accent,
    },
    positive: {
      background: palette.successSoft,
      border: '#d7e8db',
      label: '#5d7c67',
      value: palette.success,
    },
    warning: {
      background: palette.warningSoft,
      border: '#ebd8b2',
      label: '#8b6b35',
      value: palette.warning,
    },
    danger: {
      background: palette.dangerSoft,
      border: '#efcfc9',
      label: '#92524a',
      value: palette.danger,
    },
  }

  const palette = tones[tone] || tones.neutral

  return (
    <div
      style={{
        minWidth: priority ? '132px' : '104px',
        padding: priority ? '12px 14px' : '10px 12px',
        borderRadius: '14px',
        background: palette.background,
        border: `1px solid ${palette.border}`,
        display: 'grid',
        gap: '4px',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          color: palette.label,
          textTransform: 'uppercase',
          letterSpacing: '.06em',
          fontWeight: '700',
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: priority ? '22px' : '18px', fontWeight: '800', color: palette.value }}>
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

  const submissions = data?.submissions || []
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
    fontSize: '13px',
    fontWeight: '800',
    color: palette.accent,
    marginBottom: '14px',
    letterSpacing: '.08em',
    textTransform: 'uppercase',
  }

  const cardShellStyle = {
    border: `1px solid ${palette.borderSoft}`,
    borderRadius: '20px',
    background: palette.surface,
    overflow: 'hidden',
    boxShadow: '0 10px 30px rgba(24, 37, 52, 0.05)',
  }

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '44px 32px 56px', maxWidth: '1240px', margin: '0 auto', background: palette.page, color: palette.ink }}>
      <div style={{ marginBottom: '28px', padding: '30px 32px', background: 'linear-gradient(135deg, #fcfaf6 0%, #f3ede2 100%)', border: `1px solid ${palette.border}`, borderRadius: '28px', boxShadow: palette.shadow }}>
        <a href="/" style={{ color: palette.accent, fontSize: '13px', textDecoration: 'none', fontWeight: '700', letterSpacing: '.02em' }}><span aria-hidden="true">&larr;</span> Back to Tab Agent</a>
        <div style={{ fontSize: '11px', color: palette.subtle, textTransform: 'uppercase', letterSpacing: '.14em', fontWeight: '800', marginTop: '18px' }}>
          Research console
        </div>
        <h1 style={{ fontSize: '38px', fontWeight: '800', color: palette.ink, marginTop: '10px', letterSpacing: '-0.04em', lineHeight: '1.05' }}>
          Study Admin
        </h1>
        <p style={{ color: palette.muted, fontSize: '15px', marginTop: '10px', maxWidth: '780px', lineHeight: '1.75' }}>
          Review submitted sessions, track trust and regret trends, and inspect how the tab agent is learning over time. This page is designed for operator review, benchmark storytelling, and publishable study snapshots.
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '18px' }}>
          <span style={{ fontSize: '12px', padding: '7px 11px', borderRadius: '999px', background: palette.accentSoft, color: palette.accent, fontWeight: '700', border: '1px solid #d8e3ee' }}>
            Polling every 30s
          </span>
          <span style={{ fontSize: '12px', padding: '7px 11px', borderRadius: '999px', background: palette.surface, color: palette.muted, fontWeight: '700', border: `1px solid ${palette.borderSoft}` }}>
            Live data from /api/collect
          </span>
          {lastUpdated && (
            <span style={{ fontSize: '12px', padding: '7px 11px', borderRadius: '999px', background: '#f7f3ec', color: palette.subtle, fontWeight: '700', border: `1px solid ${palette.borderSoft}` }}>
              Last updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {loading && <p style={{ color: palette.muted }}>Loading...</p>}
      {error && <p style={{ color: palette.danger }}>Error: {error}</p>}

      {data && (
        <>
          <section style={{ marginBottom: '26px', padding: '22px', background: palette.surfaceAlt, border: `1px solid ${palette.border}`, borderRadius: '24px', boxShadow: '0 8px 18px rgba(24, 37, 52, 0.03)' }}>
            <div style={sectionTitleStyle}>Top-level metrics</div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
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

          <section style={{ marginBottom: '26px', padding: '22px', background: palette.surfaceAlt, border: `1px solid ${palette.border}`, borderRadius: '24px', boxShadow: '0 8px 18px rgba(24, 37, 52, 0.03)' }}>
            <div style={sectionTitleStyle}>Trend view</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            <TrendChart title="Reward trend" points={dashboard.trend} valueKey="avgReward" color="#1F4E79" />
            <TrendChart title="Regret-rate trend" points={dashboard.trend} valueKey="regretRate" color="#B26D00" yFormatter={(value) => `${Math.round(value * 100)}%`} />
            <TrendChart title="Memory-saved trend" points={dashboard.trend} valueKey="memorySaved" color="#2E7D32" yFormatter={(value) => `${Math.round(value)} MB`} />
            <ScatterChart title="Memory saved vs regret rate" points={dashboard.scatter} />
          </div>
          </section>

          <section style={{ marginBottom: '26px', padding: '22px', background: palette.surfaceAlt, border: `1px solid ${palette.border}`, borderRadius: '24px', boxShadow: '0 8px 18px rgba(24, 37, 52, 0.03)' }}>
            <div style={sectionTitleStyle}>Learning signals</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
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
            <div style={{ background: palette.surface, border: `1px solid ${palette.borderSoft}`, borderRadius: '18px', padding: '18px', boxShadow: '0 6px 16px rgba(24, 37, 52, 0.04)' }}>
              <div style={{ fontSize: '13px', fontWeight: '800', color: palette.ink, marginBottom: '12px' }}>
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
            <section style={{ padding: '22px', background: palette.surfaceAlt, border: `1px solid ${palette.border}`, borderRadius: '24px', boxShadow: '0 8px 18px rgba(24, 37, 52, 0.03)' }}>
              <div style={sectionTitleStyle}>Submitted sessions</div>
              <div style={{ fontSize: '13px', color: palette.muted, marginBottom: '16px', lineHeight: '1.7', maxWidth: '760px' }}>
                Each submission includes the browser snapshot, autonomous outcomes, and learning signals. Expand a session only when you want the detailed trace.
              </div>
            <div style={{ display: 'grid', gap: '16px' }}>
              {submissions.map((submission, index) => {
                const payload = submission.payload || {}
                const regretRate = submission.autoSleepCount
                  ? Number(submission.regretCount || 0) / Number(submission.autoSleepCount || 1)
                  : 0
                const undoRate = submission.autoSleepCount
                  ? Number(submission.undoCount || 0) / Number(submission.autoSleepCount || 1)
                  : 0
                const regretTone = regretRate >= 0.35 ? 'danger' : regretRate >= 0.18 ? 'warning' : 'positive'
                const undoTone = undoRate >= 0.18 ? 'warning' : undoRate > 0 ? 'neutral' : 'positive'
                const memoryLift = Number(submission.memorySaved || 0) - Number(submission.fixedRuleMemorySavedMb || 0)
                const memoryTone = memoryLift >= 0 ? 'positive' : 'warning'
                const sessionSubtitle = payload.autonomyState?.mode === 'trusted_autonomy'
                  ? 'Trusted autonomy active'
                  : 'Observation-first session'

                return (
                  <details
                    key={submission.id}
                    style={{
                      ...cardShellStyle,
                      background: index % 2 === 0 ? palette.surface : '#fbf7f0',
                    }}
                  >
                    <summary
                      style={{
                        padding: '20px 22px',
                        borderBottom: '1px solid #edf2f7',
                        cursor: 'pointer',
                        listStyle: 'none',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                        <div style={{ display: 'grid', gap: '10px', minWidth: '250px', flex: '1 1 320px' }}>
                          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                color: palette.muted,
                                textTransform: 'uppercase',
                                letterSpacing: '.06em',
                                fontWeight: '700',
                                padding: '6px 10px',
                                borderRadius: '999px',
                                background: palette.accentSoft,
                                border: '1px solid #d9e4ed',
                              }}
                            >
                              {sessionSubtitle}
                            </span>
                            <span style={{ fontSize: '12px', color: palette.subtle }}>
                              {new Date(submission.receivedAt).toLocaleString()}
                            </span>
                          </div>
                          <div>
                            <div style={{ fontSize: '24px', fontWeight: '800', color: palette.ink, lineHeight: '1.15', letterSpacing: '-0.03em' }}>
                              Participant {submission.participantId || 'anonymous'}
                            </div>
                            <div style={{ fontSize: '13px', color: palette.muted, marginTop: '6px', lineHeight: '1.7', maxWidth: '620px' }}>
                              {submission.autoSleepCount || submission.autoWakeCount
                                ? 'Snapshot includes autonomous outcomes, feedback signals, and memory estimates for this session.'
                                : 'Snapshot captured grouping behavior and trust signals before autonomous actions started.'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', color: palette.subtle, fontFamily: 'monospace' }}>
                              {submission.id}
                            </span>
                            <span
                              style={{
                                fontSize: '12px',
                                color: palette.accent,
                                background: palette.accentSoft,
                                border: '1px solid #d8e3ee',
                                padding: '5px 9px',
                                borderRadius: '999px',
                                fontWeight: '700',
                              }}
                            >
                              {submission.tabCount ?? 0} tabs
                            </span>
                            <span
                              style={{
                                fontSize: '12px',
                                color: palette.accent,
                                background: palette.accentSoft,
                                border: '1px solid #d8e3ee',
                                padding: '5px 9px',
                                borderRadius: '999px',
                                fontWeight: '700',
                              }}
                            >
                              {submission.groupCount ?? 0} groups
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gap: '12px', flex: '1 1 420px', minWidth: '280px' }}>
                          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <SessionSummaryMetric
                              label="Auto-sleeps"
                              value={formatCompactNumber(submission.autoSleepCount ?? 0)}
                              tone="neutral"
                              priority
                            />
                            <SessionSummaryMetric
                              label="Regrets"
                              value={formatCompactNumber(submission.regretCount ?? 0)}
                              tone={regretTone}
                              priority
                            />
                            <SessionSummaryMetric
                              label="Undos"
                              value={formatCompactNumber(submission.undoCount ?? 0)}
                              tone={undoTone}
                              priority
                            />
                          </div>
                          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <SessionSummaryMetric label="Auto-wakes" value={formatCompactNumber(submission.autoWakeCount ?? 0)} tone="positive" />
                            <SessionSummaryMetric
                              label="Memory lift"
                              value={`${memoryLift >= 0 ? '+' : ''}${formatCompactNumber(memoryLift)} MB`}
                              tone={memoryTone}
                            />
                            <SessionSummaryMetric
                              label="Trust"
                              value={submission.trustSleepClose ? `${submission.trustSleepClose}/5` : '-'}
                              tone="neutral"
                            />
                          </div>
                        </div>
                      </div>
                    </summary>

                    <div style={{ padding: '18px 22px 22px', display: 'grid', gap: '16px', background: '#fcfaf6' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
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
                              borderRadius: '12px',
                              padding: '12px 13px',
                              boxShadow: '0 2px 8px rgba(31,78,121,0.03)',
                            }}
                          >
                            <div style={{ fontSize: '11px', color: '#7e8ea0', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '6px', fontWeight: '700' }}>
                              {item.label}
                            </div>
                            <div style={{ fontSize: '18px', fontWeight: '800', color: '#274866' }}>{item.value}</div>
                          </div>
                        ))}
                      </div>

                      {payload.openAiPolicySummary?.summary && (
                        <div style={{ padding: '14px 15px', background: palette.accentSoft, border: '1px solid #d9e4ed', borderRadius: '12px' }}>
                          <div style={{ fontSize: '12px', fontWeight: '700', color: palette.accent, marginBottom: '6px' }}>
                            OpenAI policy summary
                          </div>
                          <div style={{ fontSize: '13px', color: palette.muted, lineHeight: '1.7' }}>
                            {payload.openAiPolicySummary.summary}
                          </div>
                        </div>
                      )}

                      {payload.adaptivePolicySummary?.effectivePolicy && (
                        <div style={{ padding: '14px 15px', background: palette.warningSoft, border: '1px solid #ebd8b2', borderRadius: '12px' }}>
                          <div style={{ fontSize: '12px', fontWeight: '700', color: palette.warning, marginBottom: '6px' }}>
                            Adaptive policy summary
                          </div>
                          <div style={{ fontSize: '13px', color: '#645a44', lineHeight: '1.7' }}>
                            Sleep threshold: {payload.adaptivePolicySummary.effectivePolicy.sleepThreshold} | Min inactive: {payload.adaptivePolicySummary.effectivePolicy.minInactiveMinutes} min | Recent protect: {payload.adaptivePolicySummary.effectivePolicy.recentProtectMinutes} min
                          </div>
                          {Array.isArray(payload.adaptivePolicySummary.notes) && payload.adaptivePolicySummary.notes.length > 0 && (
                            <div style={{ fontSize: '12px', color: '#73684b', marginTop: '6px', lineHeight: '1.6' }}>
                              {payload.adaptivePolicySummary.notes.join(' ')}
                            </div>
                          )}
                        </div>
                      )}

                      {payload.actionLog?.length > 0 && (
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: '700', color: palette.accent, marginBottom: '8px' }}>
                            Recent autonomous actions
                          </div>
                          <div style={{ display: 'grid', gap: '8px' }}>
                            {payload.actionLog.slice(0, 5).map((action) => (
                              <div key={action.id} style={{ padding: '11px 13px', border: `1px solid ${palette.borderSoft}`, borderRadius: '12px', background: palette.surface }}>
                                <div style={{ fontSize: '12px', fontWeight: '700', color: action.type === 'auto_sleep' ? palette.warning : palette.accent }}>
                                  {action.type.replace('_', ' ')} | confidence {(Number(action.confidence || 0) * 100).toFixed(0)}%
                                </div>
                                <div style={{ fontSize: '12px', color: palette.muted, marginTop: '4px', lineHeight: '1.6' }}>
                                  {action.reason}
                                </div>
                                <div style={{ fontSize: '12px', color: palette.subtle, marginTop: '4px' }}>
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
