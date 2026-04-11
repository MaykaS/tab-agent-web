import { NextResponse } from 'next/server'
import postgres from 'postgres'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function getDatabaseUrl() {
  return (
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL ||
    process.env.NEON_DATABASE_URL
  )
}

let sql

function getSql() {
  if (!sql) {
    const databaseUrl = getDatabaseUrl()
    if (!databaseUrl) {
      throw new Error('Missing Postgres connection string. Set POSTGRES_URL or DATABASE_URL.')
    }
    sql = postgres(databaseUrl, { ssl: 'require' })
  }
  return sql
}

async function ensureSchema() {
  const db = getSql()
  await db`
    CREATE TABLE IF NOT EXISTS study_submissions (
      id TEXT PRIMARY KEY,
      participant_id TEXT,
      received_at TIMESTAMPTZ NOT NULL,
      exported_at TIMESTAMPTZ NOT NULL,
      tab_count INTEGER,
      open_tab_count INTEGER,
      group_count INTEGER,
      asleep_group_count INTEGER,
      asleep_tab_count INTEGER,
      grouping_useful INTEGER,
      trust_sleep_close INTEGER,
      would_use_in_real_browsing INTEGER,
      session_count INTEGER NOT NULL DEFAULT 0,
      rating_count INTEGER NOT NULL DEFAULT 0,
      avg_rating DOUBLE PRECISION NOT NULL DEFAULT 0,
      memory_saved DOUBLE PRECISION NOT NULL DEFAULT 0,
      total_tab_memory_estimate_mb DOUBLE PRECISION,
      memory_metrics_are_estimated BOOLEAN NOT NULL DEFAULT TRUE,
      visit_count INTEGER NOT NULL DEFAULT 0,
      auto_sleep_count INTEGER NOT NULL DEFAULT 0,
      auto_wake_count INTEGER NOT NULL DEFAULT 0,
      undo_count INTEGER NOT NULL DEFAULT 0,
      regret_count INTEGER NOT NULL DEFAULT 0,
      explicit_bad_count INTEGER NOT NULL DEFAULT 0,
      explicit_good_count INTEGER NOT NULL DEFAULT 0,
      fixed_rule_sleep_count INTEGER NOT NULL DEFAULT 0,
      fixed_rule_memory_saved_mb DOUBLE PRECISION NOT NULL DEFAULT 0,
      payload JSONB NOT NULL
    )
  `
  await db`ALTER TABLE study_submissions ADD COLUMN IF NOT EXISTS participant_id TEXT`
  await db`ALTER TABLE study_submissions ADD COLUMN IF NOT EXISTS tab_count INTEGER`
  await db`ALTER TABLE study_submissions ADD COLUMN IF NOT EXISTS open_tab_count INTEGER`
  await db`ALTER TABLE study_submissions ADD COLUMN IF NOT EXISTS group_count INTEGER`
  await db`ALTER TABLE study_submissions ADD COLUMN IF NOT EXISTS asleep_group_count INTEGER`
  await db`ALTER TABLE study_submissions ADD COLUMN IF NOT EXISTS asleep_tab_count INTEGER`
  await db`ALTER TABLE study_submissions ADD COLUMN IF NOT EXISTS grouping_useful INTEGER`
  await db`ALTER TABLE study_submissions ADD COLUMN IF NOT EXISTS trust_sleep_close INTEGER`
  await db`ALTER TABLE study_submissions ADD COLUMN IF NOT EXISTS would_use_in_real_browsing INTEGER`
  await db`ALTER TABLE study_submissions ADD COLUMN IF NOT EXISTS total_tab_memory_estimate_mb DOUBLE PRECISION`
  await db`ALTER TABLE study_submissions ADD COLUMN IF NOT EXISTS memory_metrics_are_estimated BOOLEAN NOT NULL DEFAULT TRUE`
  await db`ALTER TABLE study_submissions ADD COLUMN IF NOT EXISTS auto_sleep_count INTEGER NOT NULL DEFAULT 0`
  await db`ALTER TABLE study_submissions ADD COLUMN IF NOT EXISTS auto_wake_count INTEGER NOT NULL DEFAULT 0`
  await db`ALTER TABLE study_submissions ADD COLUMN IF NOT EXISTS undo_count INTEGER NOT NULL DEFAULT 0`
  await db`ALTER TABLE study_submissions ADD COLUMN IF NOT EXISTS regret_count INTEGER NOT NULL DEFAULT 0`
  await db`ALTER TABLE study_submissions ADD COLUMN IF NOT EXISTS explicit_bad_count INTEGER NOT NULL DEFAULT 0`
  await db`ALTER TABLE study_submissions ADD COLUMN IF NOT EXISTS explicit_good_count INTEGER NOT NULL DEFAULT 0`
  await db`ALTER TABLE study_submissions ADD COLUMN IF NOT EXISTS fixed_rule_sleep_count INTEGER NOT NULL DEFAULT 0`
  await db`ALTER TABLE study_submissions ADD COLUMN IF NOT EXISTS fixed_rule_memory_saved_mb DOUBLE PRECISION NOT NULL DEFAULT 0`
}

function buildSubmission(body) {
  const ratingHistory = Array.isArray(body.ratingHistory) ? body.ratingHistory : []
  const avgRating =
    ratingHistory.length > 0
      ? ratingHistory.reduce((sum, entry) => sum + (entry.avgScore || 0), 0) / ratingHistory.length
      : 0
  const autonomousSummary = body.autonomousSummary || {}
  const baselineComparison = body.baselineComparison || {}

  return {
    id: `submission_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    participantId: body.participantId || null,
    receivedAt: new Date().toISOString(),
    exportedAt: body.exportedAt,
    sessionCount: Array.isArray(body.sessionLog) ? body.sessionLog.length : 0,
    tabCount: Number(body.tabCount || 0),
    openTabCount: Number(body.openTabCount || 0),
    groupCount: Number(body.groupCount || 0),
    asleepGroupCount: Number(body.asleepGroupCount || 0),
    asleepTabCount: Number(body.asleepTabCount || 0),
    groupingUseful: Number(body.studyResponses?.groupingUseful || 0),
    trustSleepClose: Number(body.studyResponses?.trustSleepClose || 0),
    wouldUseInRealBrowsing: Number(body.studyResponses?.wouldUseInRealBrowsing || 0),
    ratingCount: ratingHistory.length,
    avgRating: Number(body.avgRating ?? avgRating),
    memorySaved: Number(body.memorySavedEstimateMb ?? body.memorySaved ?? 0),
    totalTabMemoryEstimateMb: Number(body.totalTabMemoryEstimateMb || 0),
    memoryMetricsAreEstimated: body.memoryMetricsAreEstimated !== false,
    visitCount: Number(body.visitCount || 0),
    autoSleepCount: Number(autonomousSummary.autoSleepCount || 0),
    autoWakeCount: Number(autonomousSummary.autoWakeCount || 0),
    undoCount: Number(autonomousSummary.undoCount || 0),
    regretCount: Number(autonomousSummary.regretCount || 0),
    explicitBadCount: Number(autonomousSummary.explicitBadCount || 0),
    explicitGoodCount: Number(autonomousSummary.explicitGoodCount || 0),
    fixedRuleSleepCount: Number(baselineComparison.ruleBasedSleepCount || 0),
    fixedRuleMemorySavedMb: Number(baselineComparison.estimatedRuleMemorySavedMb || 0),
    payload: body,
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request) {
  try {
    const body = await request.json()

    if (!body?.exportedAt || !Array.isArray(body?.sessionLog)) {
      return NextResponse.json(
        { error: 'Invalid data structure' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    await ensureSchema()
    const db = getSql()
    const submission = buildSubmission(body)

    await db`
      INSERT INTO study_submissions (
        id,
        participant_id,
        received_at,
        exported_at,
        tab_count,
        open_tab_count,
        group_count,
        asleep_group_count,
        asleep_tab_count,
        grouping_useful,
        trust_sleep_close,
        would_use_in_real_browsing,
        session_count,
        rating_count,
        avg_rating,
        memory_saved,
        total_tab_memory_estimate_mb,
        memory_metrics_are_estimated,
        visit_count,
        auto_sleep_count,
        auto_wake_count,
        undo_count,
        regret_count,
        explicit_bad_count,
        explicit_good_count,
        fixed_rule_sleep_count,
        fixed_rule_memory_saved_mb,
        payload
      ) VALUES (
        ${submission.id},
        ${submission.participantId},
        ${submission.receivedAt},
        ${submission.exportedAt},
        ${submission.tabCount},
        ${submission.openTabCount},
        ${submission.groupCount},
        ${submission.asleepGroupCount},
        ${submission.asleepTabCount},
        ${submission.groupingUseful},
        ${submission.trustSleepClose},
        ${submission.wouldUseInRealBrowsing},
        ${submission.sessionCount},
        ${submission.ratingCount},
        ${submission.avgRating},
        ${submission.memorySaved},
        ${submission.totalTabMemoryEstimateMb},
        ${submission.memoryMetricsAreEstimated},
        ${submission.visitCount},
        ${submission.autoSleepCount},
        ${submission.autoWakeCount},
        ${submission.undoCount},
        ${submission.regretCount},
        ${submission.explicitBadCount},
        ${submission.explicitGoodCount},
        ${submission.fixedRuleSleepCount},
        ${submission.fixedRuleMemorySavedMb},
        ${JSON.stringify(submission.payload)}::jsonb
      )
    `

    return NextResponse.json(
      { success: true, id: submission.id },
      { headers: CORS_HEADERS }
    )
  } catch (err) {
    console.error('Collect error:', err)
    return NextResponse.json(
      { error: err.message || 'Server error' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}

export async function GET() {
  try {
    await ensureSchema()
    const db = getSql()
    const rows = await db`
      SELECT
        id,
        participant_id AS "participantId",
        received_at AS "receivedAt",
        exported_at AS "exportedAt",
        tab_count AS "tabCount",
        open_tab_count AS "openTabCount",
        group_count AS "groupCount",
        asleep_group_count AS "asleepGroupCount",
        asleep_tab_count AS "asleepTabCount",
        grouping_useful AS "groupingUseful",
        trust_sleep_close AS "trustSleepClose",
        would_use_in_real_browsing AS "wouldUseInRealBrowsing",
        session_count AS "sessionCount",
        rating_count AS "ratingCount",
        avg_rating AS "avgRating",
        memory_saved AS "memorySaved",
        total_tab_memory_estimate_mb AS "totalTabMemoryEstimateMb",
        memory_metrics_are_estimated AS "memoryMetricsAreEstimated",
        visit_count AS "visitCount",
        auto_sleep_count AS "autoSleepCount",
        auto_wake_count AS "autoWakeCount",
        undo_count AS "undoCount",
        regret_count AS "regretCount",
        explicit_bad_count AS "explicitBadCount",
        explicit_good_count AS "explicitGoodCount",
        fixed_rule_sleep_count AS "fixedRuleSleepCount",
        fixed_rule_memory_saved_mb AS "fixedRuleMemorySavedMb",
        payload
      FROM study_submissions
      ORDER BY received_at DESC
    `

    return NextResponse.json(
      { count: rows.length, submissions: rows },
      { headers: CORS_HEADERS }
    )
  } catch (err) {
    console.error('Collect read error:', err)
    return NextResponse.json(
      { error: err.message || 'Server error' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
