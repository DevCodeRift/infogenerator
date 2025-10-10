import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  console.log('=== Generate Summary API Called ===')
  try {
    const body = await request.json()
    const { sessionId, studentName, screenshots } = body

    console.log('Request:', { sessionId, studentName, screenshotCount: screenshots?.length })

    if (!sessionId || !screenshots || screenshots.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Use Claude API if available
    let summary = ''

    if (process.env.CLAUDE_API_KEY) {
      try {
        console.log(`Analyzing ALL ${screenshots.length} screenshots for ${studentName}...`)

        const messages = [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Please analyze these ${screenshots.length} screenshots from ${studentName}'s learning session and write a brief, casual report for their parents. Focus on what educational activities they were engaged in, what software/tools they used, and what progress they made. Write in a positive, informal tone suitable for parents. Use gender-neutral pronouns (they/them). Keep it to 2-3 sentences but be specific about what you observe them doing:`
              },
              ...screenshots.map((url: string) => ({
                type: 'image',
                source: {
                  type: 'url',
                  url: url
                }
              }))
            ]
          }
        ]

        const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.CLAUDE_API_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 300,
            messages: messages
          })
        })

        if (claudeResponse.ok) {
          const result = await claudeResponse.json()
          summary = result.content[0].text
          console.log('Claude analysis completed successfully')
        } else {
          throw new Error(`Claude API error: ${claudeResponse.status}`)
        }

      } catch (claudeError) {
        console.error('Claude analysis failed:', claudeError)
        console.error('API Key present:', !!process.env.CLAUDE_API_KEY)
        console.error('Screenshots count:', screenshots.length)
        summary = `${studentName} had a productive learning session today with ${screenshots.length} screenshots captured during their work. They engaged with various educational activities and showed consistent focus throughout the session. It's great to see them actively using technology to support their learning journey. [Claude API failed - check logs]`
      }
    } else {
      // Fallback without Claude
      summary = `${studentName} had a productive learning session today with ${screenshots.length} screenshots captured during their work. They engaged with various educational activities and showed consistent focus throughout the session. It's great to see them actively using technology to support their learning journey.`
    }

    // Mark session as completed and save summary
    try {
      console.log('=== Updating session status ===')
      const updateUrl = `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/sessions`
      console.log('Update URL:', updateUrl)
      console.log('Update payload:', { sessionId, status: 'completed', summary: summary.substring(0, 50) + '...' })

      const sessionsResponse = await fetch(updateUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          status: 'completed',
          summary
        })
      })

      console.log('Session update response status:', sessionsResponse.status)
      if (sessionsResponse.ok) {
        const updatedSession = await sessionsResponse.json()
        console.log('Successfully updated session:', updatedSession)
      } else {
        const errorText = await sessionsResponse.text()
        console.error('Failed to update session status:', sessionsResponse.status, errorText)
      }
    } catch (error) {
      console.error('Failed to update session status:', error)
    }

    return NextResponse.json({
      sessionId,
      studentName,
      screenshotCount: screenshots.length,
      summary,
      generatedAt: new Date().toISOString(),
      usedClaude: !!process.env.CLAUDE_API_KEY,
      hasApiKey: !!process.env.CLAUDE_API_KEY,
      debug: process.env.NODE_ENV === 'development' ? {
        apiKeyLength: process.env.CLAUDE_API_KEY?.length || 0,
        screenshotCount: screenshots.length
      } : undefined
    })

  } catch (error) {
    console.error('Error generating summary:', error)
    return NextResponse.json(
      { error: 'Failed to generate summary' },
      { status: 500 }
    )
  }
}