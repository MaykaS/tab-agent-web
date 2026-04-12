import fs from "fs";
import path from "path";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const part = argv[i];
    if (part.startsWith("--")) {
      const [key, value] = part.replace(/^--/, "").split("=");
      args[key] = value ?? true;
    } else if (!args.input) {
      args.input = part;
    }
  }
  return args;
}

function loadTrainingExamples(inputPath) {
  const resolved = path.resolve(process.cwd(), inputPath);
  const json = JSON.parse(fs.readFileSync(resolved, "utf8"));
  if (Array.isArray(json.trainingExamples)) return json.trainingExamples;
  if (Array.isArray(json)) return json;
  throw new Error("Input JSON must be either an array of training examples or an object with trainingExamples.");
}

function scoreSleepability(example) {
  const features = example.context?.actionFeatures || {};
  const minutesSinceLastActive = Number(features.minutesSinceLastActive || 0);
  const visits24h = Number(features.visits24h || 0);
  const regretCount = Number(features.regretCount || 0);
  const safeSleepCount = Number(features.safeSleepCount || 0);

  return (
    minutesSinceLastActive * 0.02 +
    Math.max(0, 2 - visits24h) * 0.8 +
    safeSleepCount * 0.6 -
    regretCount * 1.1
  );
}

function simulateExamples(examples, thresholdDelta, minInactiveDelta) {
  let score = 0;
  let keptGoodSleeps = 0;
  let preventedBadSleeps = 0;
  let falseConservative = 0;

  for (const example of examples) {
    const policy = example.context?.policyState || {};
    const minutesSinceLastActive = Number(example.context?.actionFeatures?.minutesSinceLastActive || 0);
    const effectiveThreshold = (policy.sleepThreshold ?? 0.33) + thresholdDelta;
    const effectiveMinInactive = (policy.minInactiveMinutes ?? 20) + minInactiveDelta;
    const sleepability = scoreSleepability(example);
    const shouldSleep =
      minutesSinceLastActive >= effectiveMinInactive &&
      sleepability >= effectiveThreshold * 10;
    const reward = Number(example.reward || 0);

    if (shouldSleep) {
      score += reward;
      if (reward > 0) keptGoodSleeps += 1;
    } else {
      score -= reward;
      if (reward < 0) preventedBadSleeps += 1;
      if (reward > 0) falseConservative += 1;
    }
  }

  return {
    score: Number(score.toFixed(2)),
    keptGoodSleeps,
    preventedBadSleeps,
    falseConservative,
  };
}

function findBestPolicy(examples) {
  let best = null;

  for (let thresholdDelta = -0.08; thresholdDelta <= 0.08; thresholdDelta += 0.01) {
    for (let minInactiveDelta = -10; minInactiveDelta <= 10; minInactiveDelta += 5) {
      const result = simulateExamples(examples, Number(thresholdDelta.toFixed(2)), minInactiveDelta);
      const candidate = {
        thresholdDelta: Number(thresholdDelta.toFixed(2)),
        minInactiveDelta,
        ...result,
      };

      if (
        !best ||
        candidate.score > best.score ||
        (candidate.score === best.score && candidate.preventedBadSleeps > best.preventedBadSleeps)
      ) {
        best = candidate;
      }
    }
  }

  return best;
}

function buildSummary(best, exampleCount) {
  return {
    exampleCount,
    recommendedAdjustments: {
      sleepThresholdDelta: best.thresholdDelta,
      minInactiveMinutesDelta: best.minInactiveDelta,
    },
    expectedEffect: {
      preventedBadSleeps: best.preventedBadSleeps,
      keptGoodSleeps: best.keptGoodSleeps,
      falseConservative: best.falseConservative,
      aggregateRewardScore: best.score,
    },
  };
}

const args = parseArgs(process.argv);
if (!args.input) {
  throw new Error("Usage: npm run train:policy -- <path-to-export.json>");
}

const examples = loadTrainingExamples(args.input).filter((example) => example.action === "sleep");
if (examples.length === 0) {
  throw new Error("No sleep training examples found in input.");
}

const best = findBestPolicy(examples);
const summary = buildSummary(best, examples.length);
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
