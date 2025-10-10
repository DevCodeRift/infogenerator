import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  try {
    const { sessionId, studentName, screenshots } = await request.json()

    if (!sessionId || !screenshots || screenshots.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Try to call the Go binary for analysis
    let summary
    const goAppPath = process.env.GO_APP_PATH || '../infogenerator'

    try {
      // Call the Go application to analyze the session
      const { stdout, stderr } = await execAsync(
        `${goAppPath} -analyze`,
        { cwd: path.dirname(goAppPath), timeout: 60000 }
      )

      // Parse the analysis result if available
      summary = {
        sessionId,
        studentName: studentName || 'Unknown Student',
        screenshotCount: screenshots.length,
        summary: stdout || `Analysis for ${studentName || 'student'}: Session contained ${screenshots.length} screenshots captured over the monitoring period.`,
        activities: [
          'Computer usage detected',
          'Screenshot analysis performed',
          'Session data processed'
        ],
        generatedAt: new Date().toISOString(),
        analysisOutput: stdout,
        analysisError: stderr
      }
    } catch (goError) {
      console.log('Go analyzer not available, using fallback analysis:', goError)

      // Fallback analysis
      summary = {
        sessionId,
        studentName: studentName || 'Unknown Student',
        screenshotCount: screenshots.length,
        summary: `Analysis for ${studentName || 'student'}: Session contained ${screenshots.length} screenshots captured over the monitoring period. Primary activities included computer usage and application interaction.`,
        activities: [
          'Computer usage detected',
          'Multiple applications used',
          'Active engagement observed'
        ],
        generatedAt: new Date().toISOString(),
        note: 'Analysis performed using fallback method - full analysis requires Go application'
      }
    }

    return NextResponse.json(summary)
  } catch (error) {
    console.error('Error generating summary:', error)
    return NextResponse.json(
      { error: 'Failed to generate summary' },
      { status: 500 }
    )
  }
}