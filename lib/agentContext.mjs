export const CONTEXT_VARIANTS = {
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

  return {
    policy: payload.agentPolicy || {},
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
    },
  };
}

function buildRawLogContext(payload, options = {}) {
  return {
    policy: payload.agentPolicy || {},
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
  const raw = buildRawLogContext(payload, options);

  if (variant === CONTEXT_VARIANTS.RAW_LOG_ONLY) {
    return raw;
  }

  if (variant === CONTEXT_VARIANTS.HYBRID) {
    return {
      ...summary,
      rawLog: raw,
    };
  }

  return summary;
}

export async function generateFallback(context) {
  const benchmark = context.benchmark || {};
  const autonomousSummary = benchmark.autonomousSummary || {};
  const regrets = autonomousSummary.regretCount || 0;
  const undos = autonomousSummary.undoCount || 0;
  const protections = (context.recentFeedback || []).filter((item) => item.type === "protect").length;
  const summaryParts = [];

  if (regrets || undos) {
    summaryParts.push("The agent is being too aggressive in at least one context.");
  } else {
    summaryParts.push("Recent autonomous actions look stable and low-friction.");
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
