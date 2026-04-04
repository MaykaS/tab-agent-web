import styles from './page.module.css'

export default function Home() {
  return (
    <main>

      {/* ── Nav ── */}
      <nav className={styles.nav}>
        <span className={styles.navLogo}>Tab Agent</span>
        <div className={styles.navLinks}>
          <a href="/demo">Demo</a>
          <a href="/evals">Evals</a>
          <a href="https://github.com/MaykaS/tab_agent" target="_blank" rel="noopener">GitHub</a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.badge}>Chrome Extension · Gemini Nano · On-device AI</div>
          <h1 className={styles.heroTitle}>
            Your tabs,<br />intelligently managed
          </h1>
          <p className={styles.heroSub}>
            Tab Agent groups your open tabs by topic, learns which ones you actually return to,
            and lets you sleep, wake, or close entire groups with one click.
            No API key. No data leaves your device.
          </p>
          <div className={styles.heroCtas}>
            <a
              href="https://github.com/MaykaS/tab_agent"
              className={styles.btnPrimary}
              target="_blank" rel="noopener"
            >
              Install from GitHub
            </a>
            <a href="/demo" className={styles.btnSecondary}>
              See how it works
            </a>
          </div>
        </div>
      </section>

      {/* ── Problem ── */}
      <section className={styles.section}>
        <div className={styles.inner}>
          <h2 className={styles.sectionTitle}>The problem with tabs</h2>
          <p className={styles.sectionText}>
            Chrome's built-in tab suspension uses a fixed inactivity timer — it will suspend a Figma tab
            you return to every 20 minutes just as readily as a news article you opened 3 hours ago and forgot about.
            When a tab is suspended, Chrome discards the page from memory. Revisiting it means a full reload —
            network requests, JS execution, re-rendering. For heavy pages like Google Docs or Figma, that's
            genuinely disruptive.
          </p>
          <p className={styles.sectionText} style={{marginTop: '12px'}}>
            Existing extensions like The Marvellous Suspender, OneTab, and Tab Wrangler are either rule-based
            or require manual organization. <strong>None of them learn from you.</strong>
          </p>
        </div>
      </section>

      {/* ── Features ── */}
      <section className={styles.sectionAlt}>
        <div className={styles.inner}>
          <h2 className={styles.sectionTitle}>What Tab Agent does</h2>
          <div className={styles.featureGrid}>
            {[
              { icon: "◈", title: "AI grouping", desc: "Gemini Nano groups your open tabs by topic — Work, Research, Shopping — instantly, on your device." },
              { icon: "◉", title: "Frequent tab protection", desc: "Tabs you visit often get a badge and are never suspended without your confirmation." },
              { icon: "◐", title: "Sleep & Wake", desc: "Sleep an entire group to free memory. The group stays visible — wake it with one click when you need it back." },
              { icon: "◑", title: "Persistent groups", desc: "Close and reopen the popup anytime. Groups are remembered — no re-grouping, instant load." },
              { icon: "◒", title: "Stats dashboard", desc: "See memory saved, tab counts, and awake/asleep status per group. Rate grouping quality for research." },
              { icon: "◓", title: "100% private", desc: "No API key. No server. Gemini Nano runs entirely in your browser. Your tabs never leave your device." },
            ].map(f => (
              <div key={f.title} className={styles.featureCard}>
                <div className={styles.featureIcon}>{f.icon}</div>
                <h3 className={styles.featureTitle}>{f.title}</h3>
                <p className={styles.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Agent loop ── */}
      <section className={styles.section}>
        <div className={styles.inner}>
          <h2 className={styles.sectionTitle}>How the agent works</h2>
          <div className={styles.loopGrid}>
            {[
              { step: "Observe", desc: "Reads all open tabs — title, URL, and your visit history from local storage." },
              { step: "Decide", desc: "Sends the tab list to Gemini Nano. Gets back named groups. Caches the result." },
              { step: "Act", desc: "You click Sleep, Wake, or Close on a group. The agent never acts without you." },
              { step: "Remember", desc: "Logs every tab switch. Tabs visited 3+ times in 24h are marked frequent and protected." },
            ].map((item, i) => (
              <div key={item.step} className={styles.loopStep}>
                <div className={styles.loopNum}>{i + 1}</div>
                <div>
                  <div className={styles.loopStepTitle}>{item.step}</div>
                  <div className={styles.loopStepDesc}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div className={styles.callout}>
            <strong>Coming next:</strong> The agentic version will sleep and wake tabs autonomously —
            sleeping low-need tabs based on your behavioral patterns, and waking related tabs when you
            switch context. The user sets the policy once; the agent handles the rest.
          </div>
        </div>
      </section>

      {/* ── Install ── */}
      <section className={styles.sectionAlt} id="install">
        <div className={styles.inner}>
          <h2 className={styles.sectionTitle}>How to install</h2>
          <p className={styles.sectionText} style={{marginBottom: '24px'}}>
            Tab Agent isn't on the Chrome Web Store yet — install it in developer mode in 3 steps.
          </p>

          <div className={styles.installSteps}>
            <div className={styles.installStep}>
              <div className={styles.installNum}>1</div>
              <div>
                <h3 className={styles.installTitle}>Enable Gemini Nano</h3>
                <p>Open Chrome and go to these two URLs. Set the values shown, then click Relaunch.</p>
                <pre>{`chrome://flags/#prompt-api-for-gemini-nano
→ Set to: Enabled

chrome://flags/#optimization-guide-on-device-model
→ Set to: Enabled BypassPerfRequirement`}</pre>
                <p style={{marginTop: '12px'}}>Then open DevTools on any page and run:</p>
                <pre>{`await LanguageModel.create()`}</pre>
                <p style={{marginTop: '8px', fontSize: '14px', color: 'var(--gray-mid)'}}>
                  This downloads the model (~3GB). Wait for it to finish, then verify with{' '}
                  <code>await LanguageModel.availability()</code> — should return <code>"available"</code>.
                </p>
              </div>
            </div>

            <div className={styles.installStep}>
              <div className={styles.installNum}>2</div>
              <div>
                <h3 className={styles.installTitle}>Download the extension</h3>
                <p>
                  Clone or download the repo from{' '}
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
                <p>Go to <code>chrome://extensions</code>, enable Developer mode, click Load unpacked, and select the <code>tab_agent</code> folder.</p>
                <p style={{marginTop: '8px', fontSize: '14px', color: 'var(--gray-mid)'}}>
                  Tab Agent appears in your toolbar. Click it to group your tabs.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Research ── */}
      <section className={styles.section}>
        <div className={styles.inner}>
          <h2 className={styles.sectionTitle}>Research project</h2>
          <p className={styles.sectionText}>
            Tab Agent is a graduate research project at Cornell Johnson MBA, exploring agentic systems
            for browser memory management. The project studies three claims:
          </p>
          <div className={styles.claimGrid}>
            <div className={styles.claim}>
              <div className={styles.claimNum}>①</div>
              <div>AI grouping matches how users mentally organize their tabs</div>
            </div>
            <div className={styles.claim}>
              <div className={styles.claimNum}>②</div>
              <div>Sleeping tabs via Tab Agent frees meaningful browser memory</div>
            </div>
            <div className={styles.claim}>
              <div className={styles.claimNum}>③</div>
              <div>Users find and manage tabs faster with Tab Agent than without</div>
            </div>
          </div>
          <p className={styles.sectionText} style={{marginTop: '20px'}}>
            Eval results will be published at <a href="/evals">/evals</a> after the study completes.
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <div className={styles.inner}>
          <div className={styles.footerInner}>
            <span>Tab Agent · Maya Sagalin · Cornell Johnson MBA 2027</span>
            <div className={styles.footerLinks}>
              <a href="https://github.com/MaykaS/tab_agent" target="_blank" rel="noopener">GitHub</a>
              <a href="/demo">Demo</a>
              <a href="/evals">Evals</a>
            </div>
          </div>
        </div>
      </footer>

    </main>
  )
}
