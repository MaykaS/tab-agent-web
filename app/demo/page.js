import styles from './demo.module.css'

export const metadata = {
  title: 'Demo — Tab Agent',
  description: 'See Tab Agent in action with mock data.',
}

export default function Demo() {
  return (
    <main>
      <nav className={styles.nav}>
        <a href="/" className={styles.navLogo}>Tab Agent</a>
        <div className={styles.navLinks}>
          <a href="/demo" style={{color: 'var(--blue-mid)', fontWeight: 600}}>Demo</a>
          <a href="/evals">Evals</a>
          <a href="https://github.com/MaykaS/tab_agent" target="_blank" rel="noopener">GitHub</a>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.inner}>
          <div className={styles.badge}>Coming soon</div>
          <h1 className={styles.title}>Interactive Demo</h1>
          <p className={styles.sub}>
            An interactive version of Tab Agent's stats and grouping UI — no Chrome extension needed.
            Uses mock tab data to show exactly how the agent works.
          </p>
          <p className={styles.sub} style={{marginTop: '12px'}}>
            Being built after the user study milestone. In the meantime,{' '}
            <a href="https://github.com/MaykaS/tab_agent" target="_blank" rel="noopener">
              install the real extension from GitHub
            </a>.
          </p>
        </div>
      </section>
    </main>
  )
}
