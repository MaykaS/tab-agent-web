import { NextResponse } from 'next/server'
import { writeFile, readFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

// Store submissions in /tmp (Vercel serverless writable directory)
const DATA_DIR = '/tmp/tabagent-study'
const INDEX_FILE = path.join(DATA_DIR, 'index.json')
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

async function ensureDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true })
  }
}

async function getIndex() {
  try {
    const raw = await readFile(INDEX_FILE, 'utf8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request) {
  try {
    await ensureDir()

    const body = await request.json()

    // Validate basic structure
    if (!body.exportedAt || !body.sessionLog) {
      return NextResponse.json(
        { error: 'Invalid data structure' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    // Generate submission ID
    const id = `submission_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

    // Save individual submission
    const submissionFile = path.join(DATA_DIR, `${id}.json`)
    await writeFile(submissionFile, JSON.stringify({
      id,
      receivedAt: new Date().toISOString(),
      ...body
    }, null, 2))

    // Update index
    const index = await getIndex()
    index.push({
      id,
      receivedAt: new Date().toISOString(),
      exportedAt: body.exportedAt,
      sessionCount: body.sessionLog?.length || 0,
      ratingCount: body.ratingHistory?.length || 0,
      memorySaved: body.memorySaved || 0,
      visitCount: body.visitCount || 0,
    })
    await writeFile(INDEX_FILE, JSON.stringify(index, null, 2))

    return NextResponse.json({ success: true, id }, { headers: CORS_HEADERS })

  } catch (err) {
    console.error('Collect error:', err)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}

// Allow GET for admin to check submission count
export async function GET() {
  const index = await getIndex()
  return NextResponse.json(
    { count: index.length, submissions: index },
    { headers: CORS_HEADERS }
  )
}
