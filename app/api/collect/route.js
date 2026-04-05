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
    sql = postgres(databaseUrl, {
      ssl: 'require',
    })
  }
  return sql
}

async function ensureSchema() {
  const db = getSql()
  await db`
    CREATE TABLE IF NOT EXISTS study_submissions (
      id TEXT PRIMARY KEY,
      received_at TIMESTAMPTZ NOT NULL,
      exported_at TIMESTAMPTZ NOT NULL,
      session_count INTEGER NOT NULL DEFAULT 0,
      rating_count INTEGER NOT NULL DEFAULT 0,
      avg_rating DOUBLE PRECISION NOT NULL DEFAULT 0,
      memory_saved DOUBLE PRECISION NOT NULL DEFAULT 0,
      visit_count INTEGER NOT NULL DEFAULT 0,
      payload JSONB NOT NULL
    )
  `
}

function buildSubmission(body) {
  const ratingHistory = Array.isArray(body.ratingHistory) ? body.ratingHistory : []
  const avgRating =
    ratingHistory.length > 0
      ? ratingHistory.reduce((sum, entry) => sum + (entry.avgScore || 0), 0) / ratingHistory.length
      : 0

  return {
    id: `submission_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    receivedAt: new Date().toISOString(),
    exportedAt: body.exportedAt,
    sessionCount: Array.isArray(body.sessionLog) ? body.sessionLog.length : 0,
    ratingCount: ratingHistory.length,
    avgRating,
    memorySaved: Number(body.memorySaved || 0),
    visitCount: Number(body.visitCount || 0),
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
        received_at,
        exported_at,
        session_count,
        rating_count,
        avg_rating,
        memory_saved,
        visit_count,
        payload
      ) VALUES (
        ${submission.id},
        ${submission.receivedAt},
        ${submission.exportedAt},
        ${submission.sessionCount},
        ${submission.ratingCount},
        ${submission.avgRating},
        ${submission.memorySaved},
        ${submission.visitCount},
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
        received_at AS "receivedAt",
        exported_at AS "exportedAt",
        session_count AS "sessionCount",
        rating_count AS "ratingCount",
        avg_rating AS "avgRating",
        memory_saved AS "memorySaved",
        visit_count AS "visitCount"
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
