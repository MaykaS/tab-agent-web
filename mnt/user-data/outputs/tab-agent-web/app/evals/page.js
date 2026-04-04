import styles from './evals.module.css'

export const metadata = {
  title: 'Evals — Tab Agent',
  description: 'User study and eval results for Tab Agent.',
}

export default function Evals() {
  return (
    <main>
      <nav className={styles.nav}>
        <a href="/" className={styles.navLogo}>Tab Agent</a>
        <div className={styles.navLinks}>
          <a href="/demo">Demo</a>
          <a href="/evals" style={{color: 'var(--blue-mid)', fontWeight: 600}}>Evals</a>
          <a href="https://github.com/MaykaS/tab_agent" target="_blank" rel="noopener">GitHub</a>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.inner}>
          <div className={styles.badge}>In progress</div>
          <h1 className={styles.title}>Eval Results</h1>
          <p className={styles.sub}>
            Results from the Tab Agent user study and AI backend comparison will be published here.
          </p>

          <div className={styles.claimsGrid}>
            <div className={styles.claimCard}>
              <div className={styles.claimStatus}>Pending</div>
              <h3>Claim 1 — Grouping quality</h3>
              <p>Does Tab Agent's AI grouping match how users would naturally organize their tabs? Measured via agreement rate test with 5–8 participants.</p>
            </div>
            <div className={styles.claimCard}>
              <div className={styles.claimStatus}>Pending</div>
              <h3>Claim 2 — Memory savings</h3>
              <p>Does sleeping tabs via Tab Agent free meaningful browser memory? Validated against Chrome Task Manager measurements.</p>
            </div>
            <div className={styles.claimCard}>
              <div className={styles.claimStatus}>Pending</div>
              <h3>Claim 3 — Task speed</h3>
              <p>Do users find and switch to tabs faster with Tab Agent than without? Measured via time-to-find tasks across 20 open tabs.</p>
            </div>
          </div>

          <div className={styles.modelComparison}>
            <h2>AI backend comparison</h2>
            <p>Grouping quality will be compared across three models using blind rating:</p>
            <div className={styles.models}>
              {[
                { name: "Gemini Nano", role: "Baseline", note: "Free, on-device" },
                { name: "Claude Haiku", role: "Gold standard", note: "Anthropic API" },
                { name: "GPT-4o mini", role: "Comparison", note: "OpenAI API" },
              ].map(m => (
                <div key={m.name} className={styles.modelCard}>
                  <div className={styles.modelName}>{m.name}</div>
                  <div className={styles.modelRole}>{m.role}</div>
                  <div className={styles.modelNote}>{m.note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
