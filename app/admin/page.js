'use client'
import { useEffect, useState } from 'react'

export default function Admin() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/collect')
      .then(response => response.json())
      .then(json => {
        setData(json)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  const submissions = data?.submissions || []
  const totalSessions = submissions.reduce((sum, submission) => sum + (submission.sessionCount || 0), 0)
  const totalRatings = submissions.reduce((sum, submission) => sum + (submission.ratingCount || 0), 0)
  const totalMemorySaved = submissions.reduce((sum, submission) => sum + (submission.memorySaved || 0), 0)
  const avgRating = submissions.length
    ? submissions.reduce((sum, submission) => sum + (submission.avgRating || 0), 0) / submissions.length
    : 0

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '40px', maxWidth: '980px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <a href="/" style={{ color: '#2E75B6', fontSize: '14px' }}>← Tab Agent</a>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#1F4E79', marginTop: '12px' }}>
          Study Admin
        </h1>
        <p style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>
          Automatic study submissions collected from the extension.
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
              { label: 'Total memory saved (est.)', value: `${totalMemorySaved.toFixed(0)} MB` },
              { label: 'Average rating', value: `${avgRating.toFixed(1)}/5` },
            ].map(stat => (
              <div
                key={stat.label}
                style={{
                  flex: 1,
                  minWidth: '160px',
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
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#1F4E79' }}>
                  {['ID', 'Participant', 'Received', 'Tabs', 'Groups', 'Ratings', 'Useful', 'Trust', 'Would use', 'Memory saved', 'Total memory', 'Visits'].map(header => (
                    <th key={header} style={{ padding: '10px 12px', color: 'white', textAlign: 'left', fontWeight: '600' }}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {submissions.map((submission, index) => (
                  <tr key={submission.id}>
                    <td colSpan={12} style={{ padding: 0, borderBottom: '1px solid #eee' }}>
                      <div style={{ background: index % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <tbody>
                            <tr>
                              <td style={{ padding: '9px 12px', width: '8%', fontFamily: 'monospace', fontSize: '11px', color: '#666' }}>{submission.id.slice(-8)}</td>
                              <td style={{ padding: '9px 12px', width: '9%', fontFamily: 'monospace', fontSize: '11px' }}>{submission.participantId || '-'}</td>
                              <td style={{ padding: '9px 12px', width: '14%' }}>{new Date(submission.receivedAt).toLocaleString()}</td>
                              <td style={{ padding: '9px 12px', width: '6%', fontWeight: '600' }}>{submission.tabCount ?? '-'}</td>
                              <td style={{ padding: '9px 12px', width: '6%', fontWeight: '600' }}>{submission.groupCount ?? '-'}</td>
                              <td style={{ padding: '9px 12px', width: '10%', fontWeight: '600' }}>{(submission.avgRating || 0).toFixed(1)} / 5 ({submission.ratingCount})</td>
                              <td style={{ padding: '9px 12px', width: '6%', fontWeight: '600' }}>{submission.groupingUseful || '-'}</td>
                              <td style={{ padding: '9px 12px', width: '6%', fontWeight: '600' }}>{submission.trustSleepClose || '-'}</td>
                              <td style={{ padding: '9px 12px', width: '6%', fontWeight: '600' }}>{submission.wouldUseInRealBrowsing || '-'}</td>
                              <td style={{ padding: '9px 12px', width: '10%' }}>{(submission.memorySaved || 0).toFixed(0)} MB est.</td>
                              <td style={{ padding: '9px 12px', width: '10%' }}>{(submission.totalTabMemoryEstimateMb || 0).toFixed(0)} MB est.</td>
                              <td style={{ padding: '9px 12px', width: '5%' }}>{submission.visitCount}</td>
                            </tr>
                          </tbody>
                        </table>

                        {submission.payload?.groups?.length > 0 && (
                          <div style={{ padding: '0 12px 12px 12px' }}>
                            <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: '#1F4E79' }}>
                              Group snapshot
                            </div>
                            <div style={{ display: 'grid', gap: '8px' }}>
                              {submission.payload.groups.map(group => (
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
            Raw data available at <code>/api/collect</code> (GET). Memory fields are estimated on Chrome stable.
          </p>
        </>
      )}
    </main>
  )
}
