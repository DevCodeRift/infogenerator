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
        // Sample screenshots to stay within API limits (max 15 images)
        const maxScreenshots = 15
        let selectedScreenshots = screenshots

        if (screenshots.length > maxScreenshots) {
          // Take evenly distributed samples from the session
          const step = Math.floor(screenshots.length / maxScreenshots)
          selectedScreenshots = []
          for (let i = 0; i < maxScreenshots; i++) {
            const index = Math.min(i * step, screenshots.length - 1)
            selectedScreenshots.push(screenshots[index])
          }
          console.log(`Sampling ${selectedScreenshots.length} of ${screenshots.length} screenshots for analysis`)
        } else {
          console.log(`Analyzing all ${screenshots.length} screenshots for ${studentName}...`)
        }

        const messages = [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Please analyze these ${selectedScreenshots.length} screenshots from ${studentName}'s learning session (sampled from ${screenshots.length} total screenshots). Write a brief report for their parents. Focus on what educational activities they were engaged in, what software or tools they used, and what progress they made. Write in a positive, professional tone suitable for parents. Use gender-neutral pronouns (they/them). Keep it to 2-3 sentences but be specific about what you observe them doing. Avoid using asterisks, EM dashes, or overly informal language.`
              },
              ...selectedScreenshots.map((url: string) => ({
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

    // Mark session as completed and save summary using student-names API as storage
    try {
      console.log('=== Updating session status ===')

      // Use the student-names API to store completion status
      const statusResponse = await fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/student-names`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId,
          studentName: studentName,
          status: 'completed',
          summary: summary
        })
      })

      if (statusResponse.ok) {
        console.log('Successfully saved session completion status:', sessionId)
      } else {
        console.error('Failed to save session completion status:', statusResponse.status)
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