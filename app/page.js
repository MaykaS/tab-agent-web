import styles from './page.module.css'

export default function Home() {
  const features = [
    {
      icon: 'AI',
      title: 'On-device grouping',
      desc: 'Gemini Nano groups your tabs by topic locally in Chrome, creating a usable context map before any autonomous action happens.',
    },
    {
      icon: 'SL',
      title: 'Autonomous sleep',
      desc: 'A conservative local policy sleeps low-need tabs based on recency, behavior history, and protection rules.',
    },
    {
      icon: 'WK',
      title: 'Context wake',
      desc: 'When you return to a working context, the agent can wake related slept tabs so the relevant cluster is ready again.',
    },
    {
      icon: 'FB',
      title: 'Feedback loop',
      desc: 'Undo, Protect, Good, and Bad feedback give the agent signals about which autonomous decisions helped and which were mistakes.',
    },
    {
      icon: 'LG',
      title: 'Action log',
      desc: 'The Stats page shows what the agent did, why it acted, and what happened after so the system stays explainable.',
    },
    {
      icon: 'OA',
      title: 'Optional OpenAI layer',
      desc: 'OpenAI is advisory only. It can add policy summaries and recommendations, but the real-time browser agent still runs locally.',
    },
  ]

  const loop = [
    {
      step: 'Observe',
      desc: 'Read open tabs, recent activations, cached groups, and local behavior memory.',
    },
    {
      step: 'Predict',
      desc: 'Estimate whether each tab is likely to be needed soon using a local browser-only policy.',
    },
    {
      step: 'Act',
      desc: 'Autonomously sleep low-need tabs and wake related slept tabs when the user re-enters a context.',
    },
    {
      step: 'Learn',
      desc: 'Update future decisions from reopen behavior, undo, protect, and explicit good or bad feedback.',
    },
  ]

  return (
    <main>
      <nav className={styles.nav}>
        <span className={styles.navLogo}>Tab Agent</span>
        <div className={styles.navLinks}>
          <a href="/demo">Demo</a>
          <a href="/evals">Evals</a>
          <a href="/admin">Admin</a>
          <a href="https://github.com/MaykaS/tab_agent" target="_blank" rel="noopener">
            GitHub
          </a>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.badge}>Chrome extension | Gemini Nano | Browser-only v1</div>
          <h1 className={styles.heroTitle}>
            A local-first browser
            <br />
            memory-management agent
          </h1>
          <p className={styles.heroSub}>
            Tab Agent groups tabs, autonomously manages low-need tabs, wakes related contexts,
            learns from feedback, and optionally adds OpenAI-powered summaries and
            recommendations. The core agent runs locally in Chrome.
          </p>
          <div className={styles.heroCtas}>
            <a
              href="https://github.com/MaykaS/tab_agent"
              className={styles.btnPrimary}
              target="_blank"
              rel="noopener"
            >
              Install from GitHub
            </a>
            <a href="/demo" className={styles.btnSecondary}>
              Guided walkthrough
            </a>
            <a href="/admin" className={styles.btnSecondary}>
              Live admin dashboard
            </a>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.inner}>
          <h2 className={styles.sectionTitle}>Why this exists</h2>
          <p className={styles.sectionText}>
            Browser memory management is still mostly generic and rule-based. It does not know
            which tab you will need in five minutes, which group belongs to your current task,
            or which tabs you repeatedly regret losing.
          </p>
          <p className={styles.sectionText} style={{ marginTop: '12px' }}>
            Tab Agent starts with the browser because it is a visible, measurable wedge into a
            larger idea: personalized memory management that saves resources without interrupting
            real work.
          </p>
        </div>
      </section>

      <section className={styles.sectionAlt}>
        <div className={styles.inner}>
          <h2 className={styles.sectionTitle}>What the current product does</h2>
          <div className={styles.featureGrid}>
            {features.map((feature) => (
              <div key={feature.title} className={styles.featureCard}>
                <div className={styles.featureIcon}>{feature.icon}</div>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureDesc}>{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.inner}>
          <h2 className={styles.sectionTitle}>How the agent works</h2>
          <div className={styles.loopGrid}>
            {loop.map((item, index) => (
              <div key={item.step} className={styles.loopStep}>
                <div className={styles.loopNum}>{index + 1}</div>
                <div>
                  <div className={styles.loopStepTitle}>{item.step}</div>
                  <div className={styles.loopStepDesc}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div className={styles.callout}>
            <strong>What&apos;s next:</strong> broaden the policy beyond tabs, harden the public
            release path, and expand from a browser-only v1 into deeper personalized
            memory-management infrastructure.
          </div>
        </div>
      </section>

      <section className={styles.sectionAlt}>
        <div className={styles.inner}>
          <h2 className={styles.sectionTitle}>Local core vs optional cloud layer</h2>
          <p className={styles.sectionText}>
            The core agent works without OpenAI. Local features include grouping, autonomous
            sleep, context wake, local behavior memory, and the full feedback loop.
          </p>
          <p className={styles.sectionText} style={{ marginTop: '12px' }}>
            The optional backend layer adds study submission, admin review, and OpenAI-assisted
            policy summaries. OpenAI is advisory only and does not control real-time browser
            actions.
          </p>
          <p className={styles.sectionText} style={{ marginTop: '12px' }}>
            You can inspect the live telemetry and training-style graphs on{' '}
            <a href="/admin">/admin</a>.
          </p>
        </div>
      </section>

      <section className={styles.sectionAlt} id="install">
        <div className={styles.inner}>
          <h2 className={styles.sectionTitle}>How to install</h2>
          <p className={styles.sectionText} style={{ marginBottom: '24px' }}>
            The live site is the product page and backend surface. The real product is the Chrome
            extension, which you currently install in developer mode from GitHub.
          </p>

          <div className={styles.installSteps}>
            <div className={styles.installStep}>
              <div className={styles.installNum}>1</div>
              <div>
                <h3 className={styles.installTitle}>Enable Gemini Nano</h3>
                <p>Open Chrome and set these flags, then relaunch:</p>
                <pre>{`chrome://flags/#prompt-api-for-gemini-nano
-> Enabled

chrome://flags/#optimization-guide-on-device-model
-> Enabled BypassPerfRequirement`}</pre>
                <p style={{ marginTop: '12px' }}>Then open DevTools and run:</p>
                <pre>{`await LanguageModel.create()`}</pre>
                <p style={{ marginTop: '8px', fontSize: '14px', color: 'var(--gray-mid)' }}>
                  This downloads the local model. When it finishes, verify with{' '}
                  <code>await LanguageModel.availability()</code> and confirm it returns{' '}
                  <code>&quot;available&quot;</code>.
                </p>
              </div>
            </div>

            <div className={styles.installStep}>
              <div className={styles.installNum}>2</div>
              <div>
                <h3 className={styles.installTitle}>Download the extension</h3>
                <p>
                  Clone or download the extension repo from{' '}
                  <a href="https://github.com/MaykaS/tab_agent" target="_blank" rel="noopener">
                    github.com/MaykaS/tab_agent
                  </a>
                </p>
                <pre>{`git clone https://github.com/MaykaS/tab_agent.git`}</pre>
              </div>
            </div>

            <div className={styles.installStep}>
              <div className={styles.installNum}>3</div>
              <div>
                <h3 className={styles.installTitle}>Load in Chrome</h3>
                <p>
                  Go to <code>chrome://extensions</code>, enable Developer mode, click Load
                  unpacked, and select the <code>tab agent</code> folder.
                </p>
                <p style={{ marginTop: '8px', fontSize: '14px', color: 'var(--gray-mid)' }}>
                  After install, check the popup for grouping, open the Stats page, watch
                  autonomous activity, and optionally generate an AI summary if the backend OpenAI
                  layer is enabled.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.inner}>
          <h2 className={styles.sectionTitle}>Research and product direction</h2>
          <p className={styles.sectionText}>
            Tab Agent began as a manual AI-assisted tab organizer and has now evolved into a
            working agentic browser prototype. It is being used to test how autonomous tab memory
            management compares with both static rules and manual assistant workflows.
          </p>
          <div className={styles.claimGrid}>
            <div className={styles.claim}>
              <div className={styles.claimNum}>1</div>
              <div>Grouping quality should match how users mentally organize tabs.</div>
            </div>
            <div className={styles.claim}>
              <div className={styles.claimNum}>2</div>
              <div>Autonomous sleep should save meaningful browser memory.</div>
            </div>
            <div className={styles.claim}>
              <div className={styles.claimNum}>3</div>
              <div>Users should manage and recover tab context faster than with manual baselines.</div>
            </div>
          </div>
          <p className={styles.sectionText} style={{ marginTop: '20px' }}>
            More details on evaluation framing and comparison baselines live on{' '}
            <a href="/evals">/evals</a>.
          </p>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.inner}>
          <div className={styles.footerInner}>
            <span>Tab Agent | Maya Sagalin | Cornell Johnson MBA 2027</span>
            <div className={styles.footerLinks}>
              <a href="https://github.com/MaykaS/tab_agent" target="_blank" rel="noopener">
                GitHub
              </a>
              <a href="/demo">Demo</a>
              <a href="/evals">Evals</a>
              <a href="/admin">Admin</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
