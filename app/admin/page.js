'use client'
import { useState, useEffect } from 'react'

export default function Admin() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/collect')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const totalSessions = data?.submissions?.reduce((a, s) => a + (s.sessionCount || 0), 0) || 0
  const totalRatings = data?.submissions?.reduce((a, s) => a + (s.ratingCount || 0), 0) || 0
  const totalMemory = data?.submissions?.reduce((a, s) => a + (s.memorySaved || 0), 0) || 0

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '40px', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <a href="/" style={{ color: '#2E75B6', fontSize: '14px' }}>← Tab Agent</a>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#1F4E79', marginTop: '12px' }}>
          Study Admin
        </h1>
        <p style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>
          Tab Agent user study data collection
        </p>
      </div>

      {loading && <p style={{ color: '#666' }}>Loading...</p>}
      {error && <p style={{ color: '#c0392b' }}>Error: {error}</p>}

      {data && (
        <>
          {/* Summary */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', flexWrap: 'wrap' }}>
            {[
              { label: 'Submissions', value: data.count },
              { label: 'Total sessions logged', value: totalSessions },
              { label: 'Rating sessions', value: totalRatings },
              { label: 'Total memory saved (est.)', value: `${totalMemory.toFixed(0)} MB` },
            ].map(s => (
              <div key={s.label} style={{
                flex: 1, minWidth: '160px',
                background: '#f5f5f5', border: '1px solid #e8e8e8',
                borderRadius: '8px', padding: '16px'
              }}>
                <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '6px' }}>
                  {s.label}
                </div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#1F4E79' }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Submissions table */}
          {data.submissions?.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#1F4E79' }}>
                  {['ID', 'Received', 'Exported at', 'Sessions', 'Ratings', 'Memory saved', 'Visits'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', color: 'white', textAlign: 'left', fontWeight: '600' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.submissions.map((s, i) => (
                  <tr key={s.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9f9f9', borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: '11px', color: '#666' }}>{s.id.slice(-8)}</td>
                    <td style={{ padding: '9px 12px' }}>{new Date(s.receivedAt).toLocaleString()}</td>
                    <td style={{ padding: '9px 12px', color: '#888' }}>{new Date(s.exportedAt).toLocaleString()}</td>
                    <td style={{ padding: '9px 12px', fontWeight: '600' }}>{s.sessionCount}</td>
                    <td style={{ padding: '9px 12px', fontWeight: '600' }}>{s.ratingCount}</td>
                    <td style={{ padding: '9px 12px' }}>{(s.memorySaved || 0).toFixed(0)} MB</td>
                    <td style={{ padding: '9px 12px' }}>{s.visitCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{
              background: '#f5f5f5', border: '1px solid #e8e8e8',
              borderRadius: '8px', padding: '32px', textAlign: 'center',
              color: '#888', fontSize: '14px'
            }}>
              No submissions yet. Share the extension with your study participants.
            </div>
          )}

          <p style={{ marginTop: '16px', fontSize: '12px', color: '#aaa' }}>
            Raw data available at <code>/api/collect</code> (GET)
          </p>
        </>
      )}
    </main>
  )
}
