export const CONTEXT_VARIANTS = {
  RECENCY_ONLY: "recency_only",
  SUMMARY_ONLY: "summary_only",
  RAW_LOG_ONLY: "raw_log_only",
  HYBRID: "hybrid",
};

const DEFAULT_RAW_EVENT_LIMIT = 75;
const DEFAULT_RAW_EVENT_WINDOW_HOURS = 24;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function truncateRecentEvents(events, limit = DEFAULT_RAW_EVENT_LIMIT, windowHours = DEFAULT_RAW_EVENT_WINDOW_HOURS) {
  const newest = Array.isArray(events) ? events : [];
  if (newest.length === 0) return [];

  const latestTimestamp = newest[0]?.timestamp || Date.now();
  const cutoff = latestTimestamp - windowHours * 60 * 60 * 1000;

  return newest
    .filter((entry) => entry && entry.timestamp >= cutoff)
    .slice(0, limit)
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((entry) => ({
      timestamp: entry.timestamp,
      eventType: entry.eventType,
      url: entry.url,
      normalizedUrl: entry.normalizedUrl,
      title: entry.title,
      groupName: entry.groupName || null,
      source: entry.source || "user",
      tabId: typeof entry.tabId === "number" ? entry.tabId : null,
    }));
}

function buildSummaryContext(payload) {
  const actions = Array.isArray(payload.actionLog) ? payload.actionLog.slice(0, 20) : [];
  const feedback = Array.isArray(payload.feedbackLog) ? payload.feedbackLog.slice(0, 20) : [];
  const groups = Array.isArray(payload.groups) ? payload.groups : [];
  const urlModel = payload.urlModel || {};
  const groupModel = payload.groupModel || {};
  const memorySummary = payload.agentMemorySummary || {};
  const evaluationSummary = payload.evaluationSummary || {};
  const autonomyState = payload.autonomyState || {};

  return {
    policy: payload.agentPolicy || {},
    autonomyState,
    currentSession: {
      openTabCount: payload.openTabCount || 0,
      asleepTabCount: payload.asleepTabCount || 0,
      groupCount: payload.groupCount || 0,
      recentActivations: (payload.recentActivations || []).slice(0, 5),
    },
    behaviorSummary: {
      groups: groups.map((group) => ({
        name: group.name,
        tabCount: group.tabCount,
        openTabCount: group.openTabCount,
        isAsleep: group.isAsleep,
        rating: group.rating,
      })),
      topUrls: Object.entries(urlModel)
        .slice(0, 12)
        .map(([url, model]) => ({
          url,
          activationCount: model.activationCount || 0,
          avgReturnMinutes: model.avgReturnMinutes || null,
          regretCount: model.regretCount || 0,
          safeSleepCount: model.safeSleepCount || 0,
          protectionCount: model.protectionCount || 0,
          groupName: model.groupName || null,
        })),
      groupModel: Object.entries(groupModel).map(([groupName, model]) => ({
        groupName,
        activationCount: model.activationCount || 0,
        regretCount: model.regretCount || 0,
        safeSleepCount: model.safeSleepCount || 0,
        protectionCount: model.protectionCount || 0,
      })),
      learnedMemory: {
        cautionAreas: (memorySummary.cautionAreas || []).slice(0, 6),
        safeSleepAreas: (memorySummary.safeSleepAreas || []).slice(0, 6),
        wakePatterns: (memorySummary.wakePatterns || []).slice(0, 4),
      },
    },
    recentActions: actions.map((action) => ({
      type: action.type,
      confidence: action.confidence,
      reason: action.reason,
      target: action.target,
      outcome: action.outcome,
      feedback: action.feedback,
    })),
    recentFeedback: feedback,
    benchmark: {
      autonomousSummary: payload.autonomousSummary || {},
      baselineComparison: payload.baselineComparison || {},
      evaluationSummary,
    },
  };
}

function buildRecencyOnlyContext(payload) {
  const actions = Array.isArray(payload.actionLog) ? payload.actionLog.slice(0, 8) : [];
  const recentActivations = Array.isArray(payload.recentActivations) ? payload.recentActivations.slice(0, 5) : [];

  return {
    policy: payload.agentPolicy || {},
    autonomyState: {
      mode: payload.autonomyState?.mode || "observing",
      progress: payload.autonomyState?.progress ?? null,
    },
    currentSession: {
      openTabCount: payload.openTabCount || 0,
      asleepTabCount: payload.asleepTabCount || 0,
      groupCount: payload.groupCount || 0,
      recentActivations,
    },
    recentActions: actions.map((action) => ({
      type: action.type,
      confidence: action.confidence,
      createdAt: action.createdAt,
      reason: action.reason,
      outcome: action.outcome,
    })),
    benchmark: {
      autonomousSummary: payload.autonomousSummary || {},
      baselineComparison: payload.baselineComparison || {},
    },
  };
}

function summarizeTopContexts(payload) {
  const urlModel = payload.urlModel || {};
  const groupModel = payload.groupModel || {};
  const groups = Array.isArray(payload.groups) ? payload.groups : [];

  const topActiveGroups = [...groups]
    .sort((a, b) => (b.openTabCount || 0) - (a.openTabCount || 0))
    .slice(0, 3)
    .map((group) => ({
      name: group.name,
      openTabCount: group.openTabCount,
      rating: group.rating ?? null,
    }));

  const mostRegrettedContexts = Object.entries(groupModel)
    .map(([groupName, model]) => ({
      groupName,
      regretCount: model.regretCount || 0,
      safeSleepCount: model.safeSleepCount || 0,
    }))
    .sort((a, b) => b.regretCount - a.regretCount)
    .filter((group) => group.regretCount > 0)
    .slice(0, 5);

  const protectedContexts = Object.entries(groupModel)
    .map(([groupName, model]) => ({
      groupName,
      protectionCount: model.protectionCount || 0,
    }))
    .sort((a, b) => b.protectionCount - a.protectionCount)
    .filter((group) => group.protectionCount > 0)
    .slice(0, 5);

  const mostFrequentUrls = Object.entries(urlModel)
    .map(([url, model]) => ({
      url,
      activationCount: model.activationCount || 0,
      groupName: model.groupName || null,
    }))
    .sort((a, b) => b.activationCount - a.activationCount)
    .filter((entry) => entry.activationCount > 0)
    .slice(0, 6);

  return {
    topActiveGroups,
    mostRegrettedContexts,
    protectedContexts,
    mostFrequentUrls,
  };
}

function buildRawLogContext(payload, options = {}) {
  return {
    policy: payload.agentPolicy || {},
    autonomyState: payload.autonomyState || {},
    currentOpenTabs: Array.isArray(payload.openTabsSnapshot) ? payload.openTabsSnapshot : [],
    recentEvents: truncateRecentEvents(
      payload.tabEventLog || payload.recentTabEvents || [],
      options.rawEventLimit || DEFAULT_RAW_EVENT_LIMIT,
      options.rawEventWindowHours || DEFAULT_RAW_EVENT_WINDOW_HOURS
    ),
  };
}

export function buildContext(payload, variant = CONTEXT_VARIANTS.SUMMARY_ONLY, options = {}) {
  const summary = buildSummaryContext(payload);
  const recencyOnly = buildRecencyOnlyContext(payload);
  const raw = buildRawLogContext(payload, options);
  const digest = summarizeTopContexts(payload);

  if (variant === CONTEXT_VARIANTS.RECENCY_ONLY) {
    return recencyOnly;
  }

  if (variant === CONTEXT_VARIANTS.RAW_LOG_ONLY) {
    return raw;
  }

  if (variant === CONTEXT_VARIANTS.HYBRID) {
    return {
      contextDigest: digest,
      ...summary,
      rawLog: raw,
    };
  }

  return {
    ...summary,
    contextDigest: digest,
  };
}

export async function generateFallback(context) {
  const benchmark = context.benchmark || {};
  const autonomousSummary = benchmark.autonomousSummary || {};
  const regrets = autonomousSummary.regretCount || 0;
  const undos = autonomousSummary.undoCount || 0;
  const protections = (context.recentFeedback || []).filter((item) => item.type === "protect").length;
  const mode = context.autonomyState?.mode || "observing";
  const summaryParts = [];

  if (regrets || undos) {
    summaryParts.push("The agent is being too aggressive in at least one context.");
  } else {
    summaryParts.push("Recent autonomous actions look stable and low-friction.");
  }

  if (mode === "observing") {
    summaryParts.push("The agent is still in observation mode and should stay conservative.");
  } else {
    summaryParts.push("The agent has enough trust evidence to use narrowly scoped autonomy.");
  }

  if (protections > 0) {
    summaryParts.push("Users are explicitly protecting some tabs or groups, which should feed into future sleep decisions.");
  }

  if (context.rawLog?.recentEvents?.length) {
    const recentSleeps = context.rawLog.recentEvents.filter((entry) => entry.eventType === "sleep").length;
    const recentUndos = context.rawLog.recentEvents.filter((entry) => entry.eventType === "undo").length;
    if (recentUndos > 0 && recentUndos >= Math.max(1, Math.floor(recentSleeps / 2))) {
      summaryParts.push("The recent event log suggests at least one sleep decision is being revisited quickly.");
    }
  }

  if (context.contextDigest?.mostRegrettedContexts?.length) {
    summaryParts.push("Some groups have accumulated repeated regret and should stay conservative.");
  }

  const protectedContexts = (context.behaviorSummary?.groupModel || [])
    .filter((group) => group.regretCount > group.safeSleepCount && group.groupName)
    .map((group) => group.groupName)
    .slice(0, 5);

  const sleepThresholdDelta = regrets > 0 ? -0.05 : 0;
  const wakeThresholdDelta = context.rawLog?.recentEvents?.length ? 0.02 : 0;

  return {
    summary: summaryParts.join(" "),
    recommendations: [
      regrets > 0 ? "Lower sleep aggressiveness for contexts with repeated regret." : "Keep the current confidence threshold for now.",
      protections > 0 ? "Increase protection weight for user-protected tabs and groups." : "Keep user protection available as an override.",
      context.rawLog?.recentEvents?.length
        ? "Use the recent event sequence to double-check whether quick reopen loops are forming."
        : "Summarized behavior is enough for the current conservative policy pass.",
      context.contextDigest?.mostRegrettedContexts?.length
        ? `Pay attention to ${context.contextDigest.mostRegrettedContexts[0].groupName} because it has the strongest regret signal.`
        : "No single group currently dominates the regret profile.",
    ],
    thresholdAdjustments: {
      sleepThresholdDelta,
      wakeThresholdDelta,
    },
    protectedContexts,
  };
}

export function scoreSummaryWithRubric(summaryResult, scenario) {
  const summaryText = `${summaryResult.summary || ""} ${(summaryResult.recommendations || []).join(" ")}`.toLowerCase();
  const expectedProtected = (scenario.expected?.protectedTabs || []).map((item) => item.toLowerCase());
  const benchmarkNote = String(scenario.expected?.benchmarkNotes || "").toLowerCase();
  const expectedSleepCount = (scenario.expected?.sleepCandidates || []).length;
  const expectedWakeGroups = scenario.expected?.contextWake?.shouldWakeGroups || [];
  const dimensionScores = {
    aggressionDiagnosisAccuracy: 0,
    recommendationUsefulness: 0,
    contextAwareness: 0,
    nonHallucination: 2,
  };

  if (
    (expectedSleepCount === 0 && (summaryText.includes("stable") || summaryText.includes("low-friction"))) ||
    (expectedSleepCount > 0 && (summaryText.includes("aggressive") || summaryText.includes("conservative")))
  ) {
    dimensionScores.aggressionDiagnosisAccuracy = 2;
  } else if (summaryText) {
    dimensionScores.aggressionDiagnosisAccuracy = 1;
  }

  const usefulRecommendationHits = (summaryResult.recommendations || []).filter((item) =>
    /sleep|protect|threshold|context|override/.test(String(item).toLowerCase())
  ).length;
  dimensionScores.recommendationUsefulness = clamp(usefulRecommendationHits, 0, 2);

  const contextReferences =
    expectedProtected.some((entry) => summaryText.includes(entry)) ||
    expectedWakeGroups.some((entry) => summaryText.includes(String(entry).toLowerCase())) ||
    benchmarkNote.split(" ").some((token) => token.length > 6 && summaryText.includes(token));
  dimensionScores.contextAwareness = contextReferences ? 2 : summaryText ? 1 : 0;

  if (/cpu|ram kill|network driver|operating system/.test(summaryText)) {
    dimensionScores.nonHallucination = 0;
  } else if (/browser/.test(summaryText) === false && summaryText.length > 0) {
    dimensionScores.nonHallucination = 1;
  }

  return {
    total:
      dimensionScores.aggressionDiagnosisAccuracy +
      dimensionScores.recommendationUsefulness +
      dimensionScores.contextAwareness +
      dimensionScores.nonHallucination,
    dimensions: dimensionScores,
  };
}
