import styles from './demo.module.css'

export const metadata = {
  title: 'Guided Walkthrough | Tab Agent',
  description: 'A guided walkthrough of the current Tab Agent product and agent loop.',
}

export default function Demo() {
  const sections = [
    {
      title: '1. Popup grouping',
      body: 'The popup groups open tabs locally with Gemini Nano, caches the result, and gives the user manual control over sleep, wake, and close actions.',
    },
    {
      title: '2. Stats page',
      body: 'The Stats page shows estimated memory saved, group state, grouping quality ratings, study submission, and the autonomous activity feed.',
    },
    {
      title: '3. Autonomous activity',
      body: 'The background agent can auto-sleep low-need tabs, wake related contexts, and log every action with explanations plus Undo and Protect controls.',
    },
    {
      title: '4. Optional OpenAI layer',
      body: 'When enabled on the backend, OpenAI adds advisory policy summaries and recommendations. The browser agent itself still makes local real-time decisions.',
    },
  ]

  return (
    <main>
      <nav className={styles.nav}>
        <a href="/" className={styles.navLogo}>
          Tab Agent
        </a>
        <div className={styles.navLinks}>
          <a href="/demo" style={{ color: 'var(--blue-mid)', fontWeight: 600 }}>
            Demo
          </a>
          <a href="/evals">Evals</a>
          <a href="https://github.com/MaykaS/tab_agent" target="_blank" rel="noopener">
            GitHub
          </a>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.inner}>
          <div className={styles.badge}>Guided walkthrough</div>
          <h1 className={styles.title}>How the current product works</h1>
          <p className={styles.sub}>
            This page explains the live browser-only v1: local grouping, autonomous tab
            management, feedback-driven learning, and the optional OpenAI summary layer.
          </p>
          <p className={styles.sub} style={{ marginTop: '12px' }}>
            The full experience still requires installing the Chrome extension from{' '}
            <a href="https://github.com/MaykaS/tab_agent" target="_blank" rel="noopener">
              GitHub
            </a>
            .
          </p>
        </div>
      </section>

      <section className={styles.hero}>
        <div className={styles.inner}>
          <div style={{ display: 'grid', gap: '16px', marginTop: '12px' }}>
            {sections.map((section) => (
              <div
                key={section.title}
                style={{
                  background: '#fff',
                  border: '1px solid #e8e8e8',
                  borderRadius: '12px',
                  padding: '20px 22px',
                }}
              >
                <h2 style={{ fontSize: '20px', marginBottom: '8px', color: '#111' }}>
                  {section.title}
                </h2>
                <p style={{ fontSize: '15px', lineHeight: 1.7, color: '#555' }}>
                  {section.body}
                </p>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: '18px',
              background: '#f7fbff',
              border: '1px solid #dbeefe',
              borderRadius: '12px',
              padding: '18px 20px',
            }}
          >
            <h2 style={{ fontSize: '18px', marginBottom: '8px', color: '#111' }}>
              Architecture at a glance
            </h2>
            <p style={{ fontSize: '15px', lineHeight: 1.7, color: '#555' }}>
              The extension is the real product surface: popup, background service worker, local
              autonomous policy, Stats page, and feedback loop. The website/backend supports
              deployment, study collection, admin review, and optional OpenAI-powered summaries.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
