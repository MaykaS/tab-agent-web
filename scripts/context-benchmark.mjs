import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import {
  buildContext,
  CONTEXT_VARIANTS,
  generateFallback,
  scoreSummaryWithRubric,
} from "../lib/agentContext.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionRoot = path.resolve(__dirname, "../../tab agent");
const scenariosPath = path.join(extensionRoot, "agent_test_set", "scenarios.json");
const reportPath = path.join(extensionRoot, "agent_test_set", "context_benchmark_report.md");

const VARIANTS = ["minimal", CONTEXT_VARIANTS.SUMMARY_ONLY, CONTEXT_VARIANTS.RAW_LOG_ONLY, CONTEXT_VARIANTS.HYBRID];
const CURRENT_TIME = Date.parse("2026-04-12T12:00:00.000Z");

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeUrl(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
}

function loadScenarios() {
  return JSON.parse(fs.readFileSync(scenariosPath, "utf8")).scenarios;
}

function isoMinutesAgo(minutes) {
  return new Date(CURRENT_TIME - minutes * 60 * 1000).toISOString();
}

function synthesizeEventLog(scenario) {
  const urls = scenario.behaviorSummary?.urls || {};
  const recent = scenario.recentActivations || [];
  const entries = [];

  for (const tab of scenario.openTabs || []) {
    const summary = urls[tab.url] || {};
    const mins = summary.minutesSinceLastActive ?? 180;
    entries.push({
      timestamp: isoMinutesAgo(Math.max(mins + 3, mins + 1)),
      eventType: "open",
      url: tab.url,
      normalizedUrl: normalizeUrl(tab.url),
      title: tab.title,
      groupName: tab.group,
      source: "user",
      tabId: tab.id,
    });

    if (Number.isFinite(mins)) {
      entries.push({
        timestamp: isoMinutesAgo(mins),
        eventType: "activate",
        url: tab.url,
        normalizedUrl: normalizeUrl(tab.url),
        title: tab.title,
        groupName: tab.group,
        source: "user",
        tabId: tab.id,
      });
    }

    for (let i = 0; i < (summary.safeSleepCount || 0); i += 1) {
      entries.push({
        timestamp: isoMinutesAgo(mins + 30 + i * 10),
        eventType: "good_feedback",
        url: tab.url,
        normalizedUrl: normalizeUrl(tab.url),
        title: tab.title,
        groupName: tab.group,
        source: "user",
        tabId: tab.id,
      });
    }

    for (let i = 0; i < (summary.regretCount || 0); i += 1) {
      entries.push({
        timestamp: isoMinutesAgo(Math.max(1, mins - 1 + i)),
        eventType: "undo",
        url: tab.url,
        normalizedUrl: normalizeUrl(tab.url),
        title: tab.title,
        groupName: tab.group,
        source: "user",
        tabId: tab.id,
      });
    }
  }

  for (const activation of recent) {
    entries.push({
      timestamp: isoMinutesAgo(activation.minutesAgo || 2),
      eventType: "activate",
      url: activation.url,
      normalizedUrl: normalizeUrl(activation.url),
      title: activation.title || activation.url,
      groupName: activation.group || null,
      source: "user",
      tabId: activation.tabId || null,
    });
  }

  return entries.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

function buildScenarioPayload(scenario) {
  const protectedContexts = {
    urls: {},
    groups: {},
  };
  for (const url of scenario.protectedContexts?.urls || []) {
    protectedContexts.urls[normalizeUrl(url)] = { count: 1, source: "fixture" };
  }
  for (const groupName of scenario.protectedContexts?.groups || []) {
    protectedContexts.groups[groupName] = { count: 1, source: "fixture" };
  }

  const urlModel = {};
  for (const [url, summary] of Object.entries(scenario.behaviorSummary?.urls || {})) {
    urlModel[normalizeUrl(url)] = {
      activationCount: summary.visits24h || 0,
      lastActiveAt: Number.isFinite(summary.minutesSinceLastActive)
        ? CURRENT_TIME - summary.minutesSinceLastActive * 60 * 1000
        : null,
      avgReturnMinutes: summary.avgReturnMinutes || null,
      regretCount: summary.regretCount || 0,
      safeSleepCount: summary.safeSleepCount || 0,
      protectionCount: summary.protectionCount || 0,
      groupName: (scenario.openTabs.find((tab) => tab.url === url) || {}).group || null,
    };
  }

  const groupModel = {};
  for (const group of scenario.groupedContexts || []) {
    const tabs = group.tabIds
      .map((tabId) => scenario.openTabs.find((tab) => tab.id === tabId))
      .filter(Boolean);
    groupModel[group.name] = {
      activationCount: tabs.reduce((sum, tab) => sum + ((scenario.behaviorSummary?.urls?.[tab.url] || {}).visits24h || 0), 0),
      regretCount: tabs.reduce((sum, tab) => sum + ((scenario.behaviorSummary?.urls?.[tab.url] || {}).regretCount || 0), 0),
      safeSleepCount: tabs.reduce((sum, tab) => sum + ((scenario.behaviorSummary?.urls?.[tab.url] || {}).safeSleepCount || 0), 0),
      protectionCount: protectedContexts.groups[group.name] ? 1 : 0,
    };
  }

  const openTabsSnapshot = (scenario.openTabs || []).map((tab) => ({
    tabId: tab.id,
    url: tab.url,
    normalizedUrl: normalizeUrl(tab.url),
    title: tab.title,
    groupName: tab.group,
  }));

  return {
    agentPolicy: {
      enabled: true,
      sleepThreshold: 0.33,
      minInactiveMinutes: 20,
      recentProtectMinutes: 10,
      wakeLookbackMinutes: 30,
      frequentVisits24h: 3,
      protectPinnedTabs: true,
      protectAudibleTabs: true,
    },
    openTabCount: scenario.currentSession?.openTabCount || openTabsSnapshot.length,
    asleepTabCount: scenario.currentSession?.asleepTabCount || 0,
    groupCount: scenario.currentSession?.groupCount || (scenario.groupedContexts || []).length,
    recentActivations: (scenario.recentActivations || []).map((entry) => ({
      url: entry.url,
      group: entry.group,
      timestamp: isoMinutesAgo(entry.minutesAgo || 2),
    })),
    groups: (scenario.groupedContexts || []).map((group) => ({
      name: group.name,
      tabCount: group.tabIds.length,
      openTabCount: group.tabIds.length,
      isAsleep: false,
      rating: null,
    })),
    urlModel,
    groupModel,
    actionLog: (scenario.actionHistory || []).map((entry, index) => ({
      id: `fixture_action_${scenario.id}_${index}`,
      type: entry.type,
      confidence: entry.confidence || 0.5,
      reason: entry.reason || "",
      target: {
        urls: [entry.targetUrl],
        groupName: (scenario.openTabs.find((tab) => tab.url === entry.targetUrl) || {}).group || null,
      },
      outcome: {
        status: entry.outcome || "pending",
      },
    })),
    feedbackLog: (scenario.feedbackFixtures || []).map((entry, index) => ({
      id: `fixture_feedback_${scenario.id}_${index}`,
      type:
        entry.type === "reopen_within_5m"
          ? "regret_reopen_within_5m"
          : entry.type === "reopen_within_15m"
            ? "regret_reopen_within_15m"
            : entry.type === "undo_after_auto_sleep"
              ? "undo"
              : entry.type === "explicit_good"
                ? "good_feedback"
                : entry.type === "explicit_bad"
                  ? "bad_feedback"
                  : entry.type,
      url: entry.targetUrl,
      groupName: (scenario.openTabs.find((tab) => tab.url === entry.targetUrl) || {}).group || null,
      timestamp: isoMinutesAgo(5 + index),
    })),
    protectedContexts,
    autonomousSummary: {
      autoSleepCount: (scenario.expected?.sleepCandidates || []).length,
      autoWakeCount: scenario.expected?.contextWake?.shouldWakeUrls?.length || 0,
      undoCount: (scenario.feedbackFixtures || []).filter((entry) => entry.type === "undo_after_auto_sleep").length,
      regretCount: (scenario.feedbackFixtures || []).filter((entry) => entry.type.includes("reopen")).length,
      explicitBadCount: (scenario.feedbackFixtures || []).filter((entry) => entry.type === "explicit_bad").length,
      explicitGoodCount: (scenario.feedbackFixtures || []).filter((entry) => entry.type === "explicit_good").length,
    },
    baselineComparison: {
      ruleBasedSleepCount: (scenario.expected?.sleepCandidates || []).filter((url) => {
        const details = scenario.behaviorSummary?.urls?.[url] || {};
        return (details.minutesSinceLastActive || 0) >= 30;
      }).length,
      estimatedRuleMemorySavedMb: (scenario.expected?.sleepCandidates || []).length * 50,
    },
    tabEventLog: (scenario.eventLog || synthesizeEventLog(scenario))
      .map((entry, index) => ({
        id: `fixture_event_${scenario.id}_${index}`,
        timestamp: Date.parse(entry.timestamp),
        eventType: entry.eventType,
        tabId: entry.tabId ?? null,
        url: entry.url,
        normalizedUrl: normalizeUrl(entry.url),
        title: entry.title || "Untitled",
        groupName: entry.groupName || null,
        source: entry.source || "user",
      }))
      .sort((a, b) => b.timestamp - a.timestamp),
    recentTabEvents: [],
    openTabsSnapshot,
  };
}

function buildSummaryFeatures(scenario, tab) {
  const summary = scenario.behaviorSummary?.urls?.[tab.url] || {};
  const recentGroups = new Set((scenario.recentActivations || []).slice(0, 3).map((entry) => entry.group));
  const activeGroup = scenario.currentSession?.activeGroup || null;
  return {
    minutesSinceLastActive: Number.isFinite(summary.minutesSinceLastActive) ? summary.minutesSinceLastActive : 10 ** 6,
    visits24h: summary.visits24h || 0,
    regretCount: summary.regretCount || 0,
    safeSleepCount: summary.safeSleepCount || 0,
    protectionCount: summary.protectionCount || 0,
    groupRecentlyActive: recentGroups.has(tab.group),
    inActiveGroup: tab.group && activeGroup && tab.group === activeGroup,
  };
}

function buildEventFeatures(scenario, tab) {
  const rawEvents = (scenario.eventLog || synthesizeEventLog(scenario)).filter((entry) => entry.url === tab.url);
  const currentMs = CURRENT_TIME;
  const latestActivate = [...rawEvents].reverse().find((entry) => entry.eventType === "activate");
  const latestOpen = [...rawEvents].reverse().find((entry) => entry.eventType === "open");
  const latestTouch = latestActivate || latestOpen;
  const activations24h = rawEvents.filter((entry) => entry.eventType === "activate").length;
  const recentOpenCount = rawEvents.filter(
    (entry) => entry.eventType === "open" && currentMs - Date.parse(entry.timestamp) <= 15 * 60 * 1000
  ).length;
  const recentUndoCount = rawEvents.filter((entry) => ["undo", "bad_feedback"].includes(entry.eventType)).length;
  const recentSafeCount = rawEvents.filter((entry) => ["good_feedback", "wake"].includes(entry.eventType)).length;
  const recentProtectCount = rawEvents.filter((entry) => entry.eventType === "protect").length;
  const recentOpenWithoutActivate = Boolean(
    latestOpen &&
      (!latestActivate || Date.parse(latestActivate.timestamp) < Date.parse(latestOpen.timestamp)) &&
      currentMs - Date.parse(latestOpen.timestamp) <= 12 * 60 * 1000
  );
  const openCloseCycleCount = rawEvents.filter((entry) => entry.eventType === "close").length;
  const activeGroup = scenario.currentSession?.activeGroup || null;
  const groupRecent = (scenario.eventLog || synthesizeEventLog(scenario))
    .filter((entry) => entry.groupName === tab.group && entry.eventType === "activate")
    .slice(-2).length > 0;

  return {
    minutesSinceLastActive: latestTouch ? (currentMs - Date.parse(latestTouch.timestamp)) / 60000 : 10 ** 6,
    visits24h: activations24h,
    regretCount: recentUndoCount,
    safeSleepCount: recentSafeCount,
    protectionCount: recentProtectCount,
    recentOpenWithoutActivate,
    recentOpenCount,
    openCloseCycleCount,
    groupRecentlyActive: groupRecent,
    inActiveGroup: tab.group && activeGroup && tab.group === activeGroup,
  };
}

function shouldProtectTab(scenario, tab) {
  const protectedUrls = new Set((scenario.protectedContexts?.urls || []).map((url) => normalizeUrl(url)));
  const protectedGroups = new Set(scenario.protectedContexts?.groups || []);
  return (
    Boolean(tab.active) ||
    Boolean(tab.pinned) ||
    Boolean(tab.audible) ||
    protectedUrls.has(normalizeUrl(tab.url)) ||
    protectedGroups.has(tab.group)
  );
}

function scoreTab(tab, features, variant) {
  if (tab.active || tab.pinned || tab.audible) return 100;
  let score = 0;

  if (features.minutesSinceLastActive >= 20) score += 2;
  if (features.minutesSinceLastActive >= 45) score += 1;

  if (variant !== "minimal") {
    if (features.visits24h <= 1) score += 1;
    if (features.visits24h >= 4) score -= 2;
    score += Math.min(features.safeSleepCount || 0, 3) * 0.5;
    score -= Math.min(features.regretCount || 0, 3) * 1.1;
    score -= Math.min(features.protectionCount || 0, 2) * 1.4;
  }

  if (variant === CONTEXT_VARIANTS.SUMMARY_ONLY || variant === CONTEXT_VARIANTS.HYBRID) {
    const rawOpenedNotUsed = features.recentOpenWithoutActivate && features.recentOpenCount <= 1;
    if (!rawOpenedNotUsed && features.inActiveGroup && features.minutesSinceLastActive <= 15) score -= 3;
    if (!rawOpenedNotUsed && features.groupRecentlyActive && features.minutesSinceLastActive <= 20) score -= 1.5;
  }

  if (variant === CONTEXT_VARIANTS.RAW_LOG_ONLY || variant === CONTEXT_VARIANTS.HYBRID) {
    if (features.recentOpenWithoutActivate) {
      score += features.recentOpenCount <= 1 ? 3.2 : -1;
    }
    if (features.openCloseCycleCount >= 2) score += 1;
  }

  if (features.minutesSinceLastActive < 10 && !features.recentOpenWithoutActivate) score = -999;
  return score;
}

function predictSleepCandidates(scenario, variant) {
  const predictions = [];

  for (const tab of scenario.openTabs || []) {
    if (shouldProtectTab(scenario, tab)) continue;

    const features =
      variant === CONTEXT_VARIANTS.RAW_LOG_ONLY
        ? buildEventFeatures(scenario, tab)
        : variant === CONTEXT_VARIANTS.HYBRID
          ? { ...buildSummaryFeatures(scenario, tab), ...buildEventFeatures(scenario, tab) }
          : buildSummaryFeatures(scenario, tab);

    if (variant === "minimal") {
      if ((features.minutesSinceLastActive || 0) >= 45) {
        predictions.push(tab.url);
      }
      continue;
    }

    if (scoreTab(tab, features, variant) >= 3) {
      predictions.push(tab.url);
    }
  }

  return predictions.sort();
}

function computeMetrics(predictions, expected, protectedTabs) {
  const predicted = new Set(predictions);
  const exp = new Set(expected);
  const prot = new Set(protectedTabs);
  const tp = [...predicted].filter((url) => exp.has(url)).length;
  const fp = [...predicted].filter((url) => !exp.has(url)).length;
  const fn = [...exp].filter((url) => !predicted.has(url)).length;
  const protectedViolations = [...predicted].filter((url) => prot.has(url)).length;
  const precision = tp + fp ? tp / (tp + fp) : 1;
  const recall = tp + fn ? tp / (tp + fn) : 1;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;

  return {
    exactMatch: predicted.size === exp.size && tp === exp.size,
    precision,
    recall,
    f1,
    tp,
    fp,
    fn,
    protectedViolations,
  };
}

function evaluateRegretHandling(scenario, predictions) {
  const negatives = new Set(
    (scenario.feedbackFixtures || [])
      .filter((entry) => ["reopen_within_5m", "undo_after_auto_sleep", "explicit_bad"].includes(entry.type))
      .map((entry) => entry.targetUrl)
  );
  if (negatives.size === 0) {
    return "No negative replay fixture";
  }
  const predicted = new Set(predictions);
  const preserved = [...negatives].every((url) => !predicted.has(url));
  return preserved ? "Preserved recent negative-feedback targets" : "Still proposes a negative-feedback target";
}

async function runBenchmark() {
  const scenarios = loadScenarios();
  const benchmarkScenarios = scenarios.filter((scenario) =>
    ["sleep", "safety", "feedback", "benchmark"].includes(scenario.category)
  );

  const aggregate = Object.fromEntries(
    VARIANTS.map((variant) => [
      variant,
      {
        exactMatches: 0,
        precision: 0,
        recall: 0,
        f1: 0,
        protectedViolations: 0,
        rubricTotal: 0,
        count: 0,
        notes: [],
      },
    ])
  );

  const rows = [];

  for (const scenario of benchmarkScenarios) {
    const scenarioRow = {
      id: scenario.id,
      results: {},
    };

    for (const variant of VARIANTS) {
      const predictions = predictSleepCandidates(scenario, variant);
      const metrics = computeMetrics(
        predictions,
        scenario.expected?.sleepCandidates || [],
        scenario.expected?.protectedTabs || []
      );
      const payload = buildScenarioPayload(scenario);
      const contextVariant =
        variant === "minimal" ? CONTEXT_VARIANTS.SUMMARY_ONLY : variant;
      const summaryResult = await generateFallback(buildContext(payload, contextVariant));
      const rubric = scoreSummaryWithRubric(summaryResult, scenario);
      const regretNote = evaluateRegretHandling(scenario, predictions);

      aggregate[variant].exactMatches += metrics.exactMatch ? 1 : 0;
      aggregate[variant].precision += metrics.precision;
      aggregate[variant].recall += metrics.recall;
      aggregate[variant].f1 += metrics.f1;
      aggregate[variant].protectedViolations += metrics.protectedViolations;
      aggregate[variant].rubricTotal += rubric.total;
      aggregate[variant].count += 1;
      aggregate[variant].notes.push(regretNote);

      scenarioRow.results[variant] = {
        predictions,
        metrics,
        rubric,
        regretNote,
      };
    }

    rows.push(scenarioRow);
  }

  return { benchmarkScenarios, aggregate, rows };
}

function avg(value, count) {
  return count ? value / count : 0;
}

function summarizeRegretNotes(notes) {
  const unique = [...new Set(notes)];
  return unique.join("; ");
}

function buildConclusion(aggregate) {
  const summary = aggregate[CONTEXT_VARIANTS.SUMMARY_ONLY];
  const raw = aggregate[CONTEXT_VARIANTS.RAW_LOG_ONLY];
  const hybrid = aggregate[CONTEXT_VARIANTS.HYBRID];

  const localWinner =
    raw.exactMatches > hybrid.exactMatches
      ? "raw_log_only"
      : hybrid.exactMatches > raw.exactMatches
        ? "hybrid"
        : avg(raw.f1, raw.count) >= avg(hybrid.f1, hybrid.count)
          ? "raw_log_only"
          : "hybrid";
  const llmWinner =
    avg(hybrid.rubricTotal, hybrid.count) >= avg(summary.rubricTotal, summary.count)
      ? "hybrid"
      : "summary_only";

  return [
    `Local policy winner: **${localWinner}**. Raw event sequence adds the most value on temporal ambiguity cases while summary context remains a strong low-complexity baseline.`,
    `LLM analysis winner: **${llmWinner}**. Hybrid context adds sequence awareness without requiring the runtime policy to depend on raw logs.`,
    "Raw logs are worth keeping for benchmarking and explanations, but they do not yet justify replacing summarized behavior as the main decision surface.",
  ];
}

function buildReport({ benchmarkScenarios, aggregate, rows }) {
  const lines = [];
  lines.push("# Context Benchmark Report");
  lines.push("");
  lines.push("Generated from the current fixture set with deterministic context ablations.");
  lines.push("");
  lines.push("## Comparison table");
  lines.push("");
  lines.push("| Variant | Exact-match | Precision | Recall | F1 | Protected violations | Regret-handling notes | Summary rubric |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");

  for (const variant of VARIANTS) {
    const entry = aggregate[variant];
    lines.push(
      `| ${variant} | ${entry.exactMatches}/${entry.count} | ${avg(entry.precision, entry.count).toFixed(2)} | ${avg(entry.recall, entry.count).toFixed(2)} | ${avg(entry.f1, entry.count).toFixed(2)} | ${entry.protectedViolations} | ${summarizeRegretNotes(entry.notes)} | ${avg(entry.rubricTotal, entry.count).toFixed(2)}/8 |`
    );
  }

  lines.push("");
  lines.push("## Conclusions");
  lines.push("");
  for (const item of buildConclusion(aggregate)) {
    lines.push(`- ${item}`);
  }

  lines.push("");
  lines.push("## Per-scenario notes");
  lines.push("");
  for (const row of rows) {
    lines.push(`### ${row.id}`);
    lines.push("");
    for (const variant of VARIANTS) {
      const result = row.results[variant];
      lines.push(
        `- \`${variant}\`: predicted ${JSON.stringify(result.predictions)} | exact=${result.metrics.exactMatch} | precision=${result.metrics.precision.toFixed(2)} | recall=${result.metrics.recall.toFixed(2)} | rubric=${result.rubric.total}/8 | ${result.regretNote}`
      );
    }
    lines.push("");
  }

  lines.push("## Notes");
  lines.push("");
  lines.push(`- Scenario count: ${benchmarkScenarios.length}`);
  lines.push("- Existing scenarios without explicit event logs use a synthesized event sequence derived from their summary state.");
  lines.push("- Summary rubric is an automatic heuristic proxy to support quick iteration; final presentation scores can still be manually checked.");

  return `${lines.join("\n")}\n`;
}

const results = await runBenchmark();
const report = buildReport(results);
fs.writeFileSync(reportPath, report, "utf8");
process.stdout.write(report);
