import { NextResponse } from 'next/server'
import { buildContext, CONTEXT_VARIANTS, generateFallback } from '../../../lib/agentContext.mjs'

export async function POST(request) {
  try {
    const payload = await request.json()
    const variant = payload.contextVariant || CONTEXT_VARIANTS.SUMMARY_ONLY
    const context = buildContext(payload, variant)
    const apiKey = process.env.OPENAI_API_KEY
    const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini'

    if (!apiKey) {
      return NextResponse.json(await generateFallback(context))
    }

    const prompt = `
You are helping tune a conservative, focus-first browser memory agent for knowledge workers.
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

The product rule is: it is better to miss a sleep than to break focus.
Use the structured context below to identify where the agent is too aggressive or too conservative.
Pay special attention to:
- autonomy mode ("observing" vs "trusted_autonomy")
- repeated regret, undo, and protect patterns
- learned caution areas
- whether safe-sleep confidence is justified or premature
Do not suggest actions outside browser tab management.
This context variant is: ${variant}.

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
