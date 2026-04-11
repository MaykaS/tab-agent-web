import { NextResponse } from 'next/server'

function buildContext(payload) {
  const actions = Array.isArray(payload.actionLog) ? payload.actionLog.slice(0, 20) : []
  const feedback = Array.isArray(payload.feedbackLog) ? payload.feedbackLog.slice(0, 20) : []
  const groups = Array.isArray(payload.groups) ? payload.groups : []
  const urlModel = payload.urlModel || {}
  const groupModel = payload.groupModel || {}

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
  }
}

async function generateFallback(context) {
  const regrets = context.benchmark.autonomousSummary?.regretCount || 0
  const undos = context.benchmark.autonomousSummary?.undoCount || 0
  const protections = context.recentFeedback.filter((item) => item.type === 'protect').length
  const summaryParts = []

  if (regrets || undos) {
    summaryParts.push('The agent is being too aggressive in at least one context.')
  } else {
    summaryParts.push('Recent autonomous actions look stable and low-friction.')
  }

  if (protections > 0) {
    summaryParts.push('Users are explicitly protecting some tabs or groups, which should feed into future sleep decisions.')
  }

  return {
    summary: summaryParts.join(' '),
    recommendations: [
      regrets > 0 ? 'Lower sleep aggressiveness for contexts with repeated regret.' : 'Keep the current confidence threshold for now.',
      protections > 0 ? 'Increase protection weight for user-protected tabs and groups.' : 'Keep user protection available as an override.',
    ],
    thresholdAdjustments: {
      sleepThresholdDelta: regrets > 0 ? -0.05 : 0,
      wakeThresholdDelta: 0,
    },
    protectedContexts: context.behaviorSummary.groupModel
      .filter((group) => group.regretCount > group.safeSleepCount && group.groupName)
      .map((group) => group.groupName)
      .slice(0, 5),
  }
}

export async function POST(request) {
  try {
    const payload = await request.json()
    const context = buildContext(payload)
    const apiKey = process.env.OPENAI_API_KEY
    const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini'

    if (!apiKey) {
      return NextResponse.json(await generateFallback(context))
    }

    const prompt = `
You are helping tune a conservative autonomous browser tab agent.
Return valid JSON only with this shape:
{
  "summary": "short paragraph",
  "recommendations": ["..."],
  "thresholdAdjustments": {
    "sleepThresholdDelta": number,
    "wakeThresholdDelta": number
  },
  "protectedContexts": ["group name"]
}

Use the structured context below to identify where the agent is too aggressive or too conservative.
Do not suggest actions outside browser tab management.

Context:
${JSON.stringify(context, null, 2)}
    `.trim()

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: prompt,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI error ${response.status}`)
    }

    const json = await response.json()
    const outputText =
      json.output_text ||
      json.output?.map((item) => item?.content?.map((content) => content?.text).join(' ')).join(' ') ||
      ''

    const parsed = JSON.parse(outputText)
    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Agent summary error:', error)
    return NextResponse.json(await generateFallback({ benchmark: { autonomousSummary: {} }, recentFeedback: [], behaviorSummary: { groupModel: [] } }))
  }
}
