import { NextResponse } from 'next/server'
import { list } from '@vercel/blob'

export async function GET() {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json([])
    }

    // Get student names
    const studentNamesResponse = await fetch(`${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/api/student-names`)
    const studentNames = studentNamesResponse.ok ? await studentNamesResponse.json() : {}

    // Get session summaries from the webapp sessions store
    const { sessions: webappSessions } = await import('../screenshots/sessions-store')
    const webappSessionsData = webappSessions || []

    // List all blobs in the screenshots folder
    const { blobs } = await list({
      prefix: 'screenshots/',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })

    // Group by session ID and count screenshots
    const sessionMap = new Map()

    for (const blob of blobs) {
      // Extract session ID from path: screenshots/1/timestamp-filename.jpg
      const pathParts = blob.pathname.split('/')
      if (pathParts.length >= 3) {
        const sessionId = pathParts[1]

        if (!sessionMap.has(sessionId)) {
          // Check if this session exists in webapp sessions store
          const webappSession = webappSessionsData.find(s => s.id === sessionId)

          sessionMap.set(sessionId, {
            id: sessionId,
            studentName: studentNames[sessionId] || 'Unknown Student',
            startTime: new Date(blob.uploadedAt).toISOString(),
            status: webappSession?.status || 'active',
            screenshots: [],
            summary: webappSession?.summary || undefined
          })
        }

        const session = sessionMap.get(sessionId)
        session.screenshots.push(blob.url)

        // Update start time to earliest screenshot
        if (new Date(blob.uploadedAt) < new Date(session.startTime)) {
          session.startTime = new Date(blob.uploadedAt).toISOString()
        }
      }
    }

    const sessions = Array.from(sessionMap.values())

    return NextResponse.json(sessions)
  } catch (error) {
    console.error('Error getting live sessions:', error)
    return NextResponse.json([])
  }
}