'use client'
import { useEffect, useState } from 'react'

export default function Admin() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/collect')
      .then((response) => response.json())
      .then((json) => {
        setData(json)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  const submissions = data?.submissions || []
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

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '40px', maxWidth: '1180px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <a href="/" style={{ color: '#2E75B6', fontSize: '14px' }}>← Tab Agent</a>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#1F4E79', marginTop: '12px' }}>
          Study Admin
        </h1>
        <p style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>
          Compare assistant, rule baseline, and autonomous-agent telemetry from the extension.
        </p>
      </div>

      {loading && <p style={{ color: '#666' }}>Loading...</p>}
      {error && <p style={{ color: '#c0392b' }}>Error: {error}</p>}

      {data && (
        <>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', flexWrap: 'wrap' }}>
            {[
              { label: 'Submissions', value: data.count },
              { label: 'Total sessions logged', value: totalSessions },
              { label: 'Rating sessions', value: totalRatings },
              { label: 'Average rating', value: `${avgRating.toFixed(1)}/5` },
              { label: 'Autonomous memory saved', value: `${totalMemorySaved.toFixed(0)} MB est.` },
              { label: 'Rule baseline memory', value: `${totalRuleMemory.toFixed(0)} MB est.` },
              { label: 'Avg undo rate', value: avgUndoRate.toFixed(1) },
            ].map((stat) => (
              <div
                key={stat.label}
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
                  {stat.label}
                </div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#1F4E79' }}>{stat.value}</div>
              </div>
            ))}
          </div>

          {submissions.length > 0 ? (
            <div style={{ display: 'grid', gap: '16px' }}>
              {submissions.map((submission, index) => {
                const payload = submission.payload || {}
                return (
                  <div
                    key={submission.id}
                    style={{
                      border: '1px solid #e8e8e8',
                      borderRadius: '10px',
                      background: index % 2 === 0 ? '#fff' : '#fcfcfc',
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ padding: '16px 18px', borderBottom: '1px solid #eee' }}>
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
                    </div>

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

                      {payload.groups?.length > 0 && (
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: '700', color: '#1F4E79', marginBottom: '8px' }}>
                            Group snapshot
                          </div>
                          <div style={{ display: 'grid', gap: '8px' }}>
                            {payload.groups.map((group) => (
                              <div
                                key={`${submission.id}-${group.name}`}
                                style={{
                                  padding: '10px 12px',
                                  background: '#fff',
                                  border: '1px solid #e8e8e8',
                                  borderRadius: '8px',
                                }}
                              >
                                <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                                  {group.name}
                                </div>
                                <div style={{ fontSize: '12px', color: '#555', lineHeight: '1.6' }}>
                                  Tabs: {group.tabCount} · Open: {group.openTabCount} · Status: {group.isAsleep ? 'asleep' : 'awake'} · Rating: {group.rating ?? '-'} / 5 · Memory: ~{(group.estimatedMemoryMb || 0).toFixed(0)} MB · Saved: ~{(group.estimatedSavedMemoryMb || 0).toFixed(0)} MB
                                </div>
                                <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                                  {Array.isArray(group.tabTitlesPreview) ? group.tabTitlesPreview.join(', ') : ''}
                                </div>
                              </div>
                            ))}
                          </div>
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
                                  {action.type.replace('_', ' ')} · confidence {(Number(action.confidence || 0) * 100).toFixed(0)}%
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
                  </div>
                )
              })}
            </div>
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
            Raw data available at <code>/api/collect</code>. Memory fields are estimated on Chrome stable. Baseline A is a fixed inactivity threshold; Baseline B is the assistant MVP; experimental metrics reflect autonomous-agent behavior.
          </p>
        </>
      )}
    </main>
  )
}
