'use client'
import { useEffect, useMemo, useState } from 'react'

const POLL_INTERVAL_MS = 30000

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
        background: '#f5f5f5',
        border: '1px solid #e8e8e8',
        borderRadius: '8px',
        padding: '16px',
      }}
    >
      <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '6px' }}>
        {label}
      </div>
      <div style={{ fontSize: '28px', fontWeight: '700', color: '#1F4E79' }}>{value}</div>
    </div>
  )
}

function MiniBarChart({ title, items, color = '#1F4E79', formatter = (value) => value }) {
  const max = Math.max(...items.map((item) => item.value), 1)
  return (
    <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '10px', padding: '16px' }}>
      <div style={{ fontSize: '12px', fontWeight: '700', color: '#1F4E79', marginBottom: '12px' }}>{title}</div>
      <div style={{ display: 'grid', gap: '10px' }}>
        {items.map((item) => (
          <div key={item.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '12px', marginBottom: '4px' }}>
              <span style={{ color: '#555' }}>{item.label}</span>
              <span style={{ color: '#888' }}>{formatter(item.value)}</span>
            </div>
            <div style={{ height: '10px', background: '#f1f1f1', borderRadius: '999px', overflow: 'hidden' }}>
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
    <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '10px', padding: '16px' }}>
      <div style={{ fontSize: '12px', fontWeight: '700', color: '#1F4E79', marginBottom: '10px' }}>{title}</div>
      {points.length > 0 ? (
        <>
          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '120px', display: 'block' }}>
            <polyline fill="none" stroke={color} strokeWidth="3" points={coords} />
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '11px', color: '#888', marginTop: '8px' }}>
            <span>{points[0]?.label}</span>
            <span>Latest {yFormatter(points[points.length - 1]?.[valueKey] || 0)}</span>
          </div>
        </>
      ) : (
        <div style={{ fontSize: '12px', color: '#888' }}>Not enough submissions yet.</div>
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
    <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '10px', padding: '16px' }}>
      <div style={{ fontSize: '12px', fontWeight: '700', color: '#1F4E79', marginBottom: '10px' }}>{title}</div>
      {points.length > 0 ? (
        <>
          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '150px', display: 'block', background: '#fafafa', borderRadius: '8px' }}>
            {points.map((point) => {
              const cx = (point.x / maxX) * (width - 20) + 10
              const cy = height - (point.y / maxY) * (height - 20) - 10
              return <circle key={point.id} cx={cx} cy={cy} r="5" fill="#1F4E79" opacity="0.85" />
            })}
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '11px', color: '#888', marginTop: '8px' }}>
            <span>Memory saved</span>
            <span>Regret rate</span>
          </div>
        </>
      ) : (
        <div style={{ fontSize: '12px', color: '#888' }}>No points yet.</div>
      )}
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
    fontSize: '14px',
    fontWeight: '700',
    color: '#1F4E79',
    marginBottom: '12px',
    letterSpacing: '.02em',
  }

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '40px', maxWidth: '1180px', margin: '0 auto', background: '#fbfcfe' }}>
      <div style={{ marginBottom: '24px', padding: '24px 26px', background: 'linear-gradient(180deg, #ffffff 0%, #f6fbff 100%)', border: '1px solid #dfeaf5', borderRadius: '16px', boxShadow: '0 6px 20px rgba(31,78,121,0.05)' }}>
        <a href="/" style={{ color: '#2E75B6', fontSize: '14px', textDecoration: 'none', fontWeight: '600' }}><span aria-hidden="true">&larr;</span> Back to Tab Agent</a>
        <h1 style={{ fontSize: '30px', fontWeight: '700', color: '#1F4E79', marginTop: '12px' }}>
          Study Admin
        </h1>
        <p style={{ color: '#555', fontSize: '15px', marginTop: '8px', maxWidth: '780px', lineHeight: '1.7' }}>
          This dashboard turns submitted extension sessions into a research view of the agent: live telemetry, reward and regret trends, and early policy-training signals. It refreshes automatically every 30 seconds as new submissions arrive.
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '14px' }}>
          <span style={{ fontSize: '12px', padding: '6px 10px', borderRadius: '999px', background: '#eef5fb', color: '#1F4E79', fontWeight: '600' }}>
            Polling every 30s
          </span>
          <span style={{ fontSize: '12px', padding: '6px 10px', borderRadius: '999px', background: '#f5f5f5', color: '#666', fontWeight: '600' }}>
            Live data from /api/collect
          </span>
          {lastUpdated && (
            <span style={{ fontSize: '12px', padding: '6px 10px', borderRadius: '999px', background: '#f8f8f8', color: '#888', fontWeight: '600' }}>
              Last updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {loading && <p style={{ color: '#666' }}>Loading...</p>}
      {error && <p style={{ color: '#c0392b' }}>Error: {error}</p>}

      {data && (
        <>
          <section style={{ marginBottom: '24px' }}>
            <div style={sectionTitleStyle}>Top-level metrics</div>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
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

          <section style={{ marginBottom: '24px' }}>
            <div style={sectionTitleStyle}>Trend view</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <TrendChart title="Reward trend" points={dashboard.trend} valueKey="avgReward" color="#1F4E79" />
            <TrendChart title="Regret-rate trend" points={dashboard.trend} valueKey="regretRate" color="#B26D00" yFormatter={(value) => `${Math.round(value * 100)}%`} />
            <TrendChart title="Memory-saved trend" points={dashboard.trend} valueKey="memorySaved" color="#2E7D32" yFormatter={(value) => `${Math.round(value)} MB`} />
            <ScatterChart title="Memory saved vs regret rate" points={dashboard.scatter} />
          </div>
          </section>

          <section style={{ marginBottom: '24px' }}>
            <div style={sectionTitleStyle}>Learning signals</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <MiniBarChart title="Outcome breakdown" items={outcomeItems} color="#1F4E79" />
            <MiniBarChart
              title="Top regret contexts"
              items={dashboard.topRegretContexts.map((item) => ({
                label: item.groupName,
                value: item.badRate,
              }))}
              color="#B26D00"
              formatter={(value) => `${Math.round(value * 100)}% bad`}
            />
            <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '10px', padding: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#1F4E79', marginBottom: '12px' }}>
                Offline training recommendation
              </div>
              <div style={{ fontSize: '12px', color: '#666', lineHeight: '1.6', marginBottom: '10px' }}>
                This is a lightweight offline policy suggestion based on submitted training examples. It is meant for analysis, not automatic deployment.
              </div>
              {recommendation ? (
                <div style={{ fontSize: '13px', color: '#555', lineHeight: '1.7' }}>
                  <div>Examples: <strong>{recommendation.exampleCount}</strong></div>
                  <div>Suggested sleep-threshold delta: <strong>{recommendation.thresholdDelta}</strong></div>
                  <div>Suggested min-inactive delta: <strong>{recommendation.minInactiveDelta} min</strong></div>
                  <div>Prevented bad sleeps: <strong>{recommendation.preventedBadSleeps}</strong></div>
                  <div>Kept good sleeps: <strong>{recommendation.keptGoodSleeps}</strong></div>
                  <div>Aggregate reward score: <strong>{formatNumber(recommendation.score, 2)}</strong></div>
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: '#888' }}>
                  No training examples yet. Once submissions include enough auto-sleep outcomes, this panel will recommend a threshold update.
                </div>
                )}
              </div>
            </div>
          </section>

          {submissions.length > 0 ? (
            <section>
              <div style={sectionTitleStyle}>Submitted sessions</div>
              <div style={{ fontSize: '13px', color: '#666', marginBottom: '12px', lineHeight: '1.6' }}>
                Each submission includes the browser snapshot, autonomous outcomes, and learning signals. Expand a session only when you want the detailed trace.
              </div>
            <div style={{ display: 'grid', gap: '16px' }}>
              {submissions.map((submission, index) => {
                const payload = submission.payload || {}
                return (
                  <details
                    key={submission.id}
                    style={{
                      border: '1px solid #e8e8e8',
                      borderRadius: '10px',
                      background: index % 2 === 0 ? '#fff' : '#fcfcfc',
                      overflow: 'hidden',
                    }}
                  >
                    <summary style={{ padding: '16px 18px', borderBottom: '1px solid #eee', cursor: 'pointer', listStyle: 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>
                            {new Date(submission.receivedAt).toLocaleString()}
                          </div>
                          <div style={{ fontSize: '18px', fontWeight: '700', color: '#1F4E79' }}>
                            Participant {submission.participantId || 'anonymous'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px', fontFamily: 'monospace' }}>
                            {submission.id}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                          {[
                            `Tabs ${submission.tabCount ?? 0}`,
                            `Groups ${submission.groupCount ?? 0}`,
                            `Auto-sleeps ${submission.autoSleepCount ?? 0}`,
                            `Auto-wakes ${submission.autoWakeCount ?? 0}`,
                            `Undos ${submission.undoCount ?? 0}`,
                            `Regrets ${submission.regretCount ?? 0}`,
                          ].map((item) => (
                            <span
                              key={item}
                              style={{
                                fontSize: '12px',
                                padding: '6px 10px',
                                borderRadius: '999px',
                                background: '#f0f6fb',
                                color: '#1F4E79',
                                fontWeight: '600',
                              }}
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    </summary>

                    <div style={{ padding: '16px 18px', display: 'grid', gap: '16px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                        {[
                          { label: 'Useful', value: submission.groupingUseful || '-' },
                          { label: 'Trust', value: submission.trustSleepClose || '-' },
                          { label: 'Would use', value: submission.wouldUseInRealBrowsing || '-' },
                          { label: 'Avg rating', value: `${(submission.avgRating || 0).toFixed(1)}/5` },
                          { label: 'Autonomous memory', value: `${(submission.memorySaved || 0).toFixed(0)} MB est.` },
                          { label: 'Rule baseline', value: `${(submission.fixedRuleMemorySavedMb || 0).toFixed(0)} MB est.` },
                          { label: 'Training examples', value: payload.trainingExamples?.length || 0 },
                        ].map((item) => (
                          <div key={item.label} style={{ background: '#f8f8f8', border: '1px solid #eee', borderRadius: '8px', padding: '12px' }}>
                            <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '6px' }}>
                              {item.label}
                            </div>
                            <div style={{ fontSize: '18px', fontWeight: '700', color: '#333' }}>{item.value}</div>
                          </div>
                        ))}
                      </div>

                      {payload.openAiPolicySummary?.summary && (
                        <div style={{ padding: '12px 14px', background: '#f7fbff', border: '1px solid #d9ecfb', borderRadius: '8px' }}>
                          <div style={{ fontSize: '12px', fontWeight: '700', color: '#1F4E79', marginBottom: '6px' }}>
                            OpenAI policy summary
                          </div>
                          <div style={{ fontSize: '13px', color: '#555', lineHeight: '1.6' }}>
                            {payload.openAiPolicySummary.summary}
                          </div>
                        </div>
                      )}

                      {payload.adaptivePolicySummary?.effectivePolicy && (
                        <div style={{ padding: '12px 14px', background: '#fbfaf5', border: '1px solid #eee3c2', borderRadius: '8px' }}>
                          <div style={{ fontSize: '12px', fontWeight: '700', color: '#8a6d1d', marginBottom: '6px' }}>
                            Adaptive policy summary
                          </div>
                          <div style={{ fontSize: '13px', color: '#555', lineHeight: '1.6' }}>
                            Sleep threshold: {payload.adaptivePolicySummary.effectivePolicy.sleepThreshold} | Min inactive: {payload.adaptivePolicySummary.effectivePolicy.minInactiveMinutes} min | Recent protect: {payload.adaptivePolicySummary.effectivePolicy.recentProtectMinutes} min
                          </div>
                          {Array.isArray(payload.adaptivePolicySummary.notes) && payload.adaptivePolicySummary.notes.length > 0 && (
                            <div style={{ fontSize: '12px', color: '#666', marginTop: '6px' }}>
                              {payload.adaptivePolicySummary.notes.join(' ')}
                            </div>
                          )}
                        </div>
                      )}

                      {payload.actionLog?.length > 0 && (
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: '700', color: '#1F4E79', marginBottom: '8px' }}>
                            Recent autonomous actions
                          </div>
                          <div style={{ display: 'grid', gap: '8px' }}>
                            {payload.actionLog.slice(0, 5).map((action) => (
                              <div key={action.id} style={{ padding: '10px 12px', border: '1px solid #eee', borderRadius: '8px', background: '#fafafa' }}>
                                <div style={{ fontSize: '12px', fontWeight: '700', color: action.type === 'auto_sleep' ? '#b26d00' : '#1F4E79' }}>
                                  {action.type.replace('_', ' ')} | confidence {(Number(action.confidence || 0) * 100).toFixed(0)}%
                                </div>
                                <div style={{ fontSize: '12px', color: '#555', marginTop: '4px', lineHeight: '1.6' }}>
                                  {action.reason}
                                </div>
                                <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
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
                background: '#f5f5f5',
                border: '1px solid #e8e8e8',
                borderRadius: '8px',
                padding: '32px',
                textAlign: 'center',
                color: '#888',
                fontSize: '14px',
              }}
            >
              No submissions yet. Share the extension with your study participants.
            </div>
          )}

          <p style={{ marginTop: '16px', fontSize: '12px', color: '#aaa' }}>
            Raw data available at <code>/api/collect</code>. Memory fields are estimated on Chrome stable. Baseline A is a fixed inactivity threshold; Baseline B is the assistant MVP; experimental metrics reflect autonomous-agent behavior. Dashboard values update automatically from new submissions hitting Vercel.
          </p>
        </>
      )}
    </main>
  )
}
