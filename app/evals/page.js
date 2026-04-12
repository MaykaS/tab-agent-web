import styles from './evals.module.css'

export const metadata = {
  title: 'Evaluation Framework | Tab Agent',
  description: 'Evaluation framing for the Tab Agent assistant and autonomous browser agent.',
}

export default function Evals() {
  const comparisons = [
    {
      name: 'Baseline A',
      role: 'Static rule-based tab management',
      note: 'Fixed inactivity thresholds with no personalization.',
    },
    {
      name: 'Baseline B',
      role: 'Assistant MVP',
      note: 'AI grouping with user-triggered actions and no autonomous loop.',
    },
    {
      name: 'Experimental',
      role: 'Autonomous personalized agent',
      note: 'Local prediction, autonomous sleep, context wake, and feedback-driven learning.',
    },
  ]

  return (
    <main>
      <nav className={styles.nav}>
        <a href="/" className={styles.navLogo}>
          Tab Agent
        </a>
        <div className={styles.navLinks}>
          <a href="/demo">Demo</a>
          <a href="/evals" style={{ color: 'var(--blue-mid)', fontWeight: 600 }}>
            Evals
          </a>
          <a href="https://github.com/MaykaS/tab_agent" target="_blank" rel="noopener">
            GitHub
          </a>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.inner}>
          <div className={styles.badge}>Evaluation framework</div>
          <h1 className={styles.title}>How Tab Agent is evaluated</h1>
          <p className={styles.sub}>
            The current evaluation compares a fixed rule baseline, the earlier assistant MVP, and
            the current autonomous browser agent. The goal is not just lower memory use. The goal
            is to save memory while minimizing user interruption.
          </p>

          <div className={styles.claimsGrid}>
            <div className={styles.claimCard}>
              <div className={styles.claimStatus}>Claim 1</div>
              <h3>Grouping quality</h3>
              <p>
                Does Tab Agent&apos;s grouping align with how users mentally organize their tabs and
                working contexts?
              </p>
            </div>
            <div className={styles.claimCard}>
              <div className={styles.claimStatus}>Claim 2</div>
              <h3>Memory savings</h3>
              <p>
                Does autonomous sleep free meaningful browser memory while staying conservative
                enough to avoid obvious disruption?
              </p>
            </div>
            <div className={styles.claimCard}>
              <div className={styles.claimStatus}>Claim 3</div>
              <h3>Workflow speed</h3>
              <p>
                Does the agent help users recover and manage tab context faster than manual or
                static-rule alternatives?
              </p>
            </div>
          </div>

          <div className={styles.modelComparison}>
            <h2>Comparison conditions</h2>
            <p>The current benchmark is product-focused rather than model-brand-focused:</p>
            <div className={styles.models}>
              {comparisons.map((item) => (
                <div key={item.name} className={styles.modelCard}>
                  <div className={styles.modelName}>{item.name}</div>
                  <div className={styles.modelRole}>{item.role}</div>
                  <div className={styles.modelNote}>{item.note}</div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.modelComparison}>
            <h2>Primary metrics</h2>
            <p>
              Evaluation is centered on the tradeoff between benefit and interruption cost:
            </p>
            <div className={styles.models}>
              {[
                {
                  name: 'Benefit',
                  role: 'Memory saved',
                  note: 'Estimated memory saved, autonomous sleep count, and reduced open-tab footprint.',
                },
                {
                  name: 'Cost',
                  role: 'Interruption and regret',
                  note: 'Undo rate, quick reopen after auto-sleep, manual wake after sleep, and explicit bad feedback.',
                },
                {
                  name: 'User outcome',
                  role: 'Trust and usefulness',
                  note: 'Perceived usefulness, trust, willingness to use, and clarity of explanations.',
                },
              ].map((item) => (
                <div key={item.name} className={styles.modelCard}>
                  <div className={styles.modelName}>{item.name}</div>
                  <div className={styles.modelRole}>{item.role}</div>
                  <div className={styles.modelNote}>{item.note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
