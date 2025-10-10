import { NextResponse } from 'next/server'

export async function GET() {
  try {
    if (!process.env.CLAUDE_API_KEY) {
      return NextResponse.json({
        error: 'No API key found',
        hasKey: false
      })
    }

    // Simple text-only test
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 50,
        messages: [{
          role: 'user',
          content: 'Say hello world'
        }]
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json({
        error: `Claude API error: ${response.status}`,
        details: errorText,
        hasKey: true
      })
    }

    const result = await response.json()
    return NextResponse.json({
      success: true,
      response: result.content[0].text,
      hasKey: true
    })

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      hasKey: !!process.env.CLAUDE_API_KEY
    })
  }
}