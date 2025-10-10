import { NextResponse } from 'next/server'
import { list } from '@vercel/blob'

export async function GET() {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json([])
    }

    // Get student names, session status, and summaries
    const studentNamesResponse = await fetch(`${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/api/student-names`)
    const studentData = studentNamesResponse.ok ? await studentNamesResponse.json() : {}

    const studentNames = studentData.names || {}
    const sessionStatus = studentData.status || {}
    const sessionSummaries = studentData.summaries || {}

    console.log('Session status data:', sessionStatus)
    console.log('Session summaries data:', Object.keys(sessionSummaries))

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
          // Get status and summary from the student-names API storage
          const status = sessionStatus[sessionId] || 'active'
          const summary = sessionSummaries[sessionId] || undefined

          console.log(`Session ${sessionId} - status:`, status, 'hasSummary:', !!summary)

          sessionMap.set(sessionId, {
            id: sessionId,
            studentName: studentNames[sessionId] || 'Unknown Student',
            startTime: new Date(blob.uploadedAt).toISOString(),
            status: status,
            screenshots: [],
            summary: summary
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

    console.log('=== Live Sessions Response ===')
    console.log('Sessions from blob storage:', sessionMap.size)
    console.log('Final sessions:', sessions.map(s => ({ id: s.id, status: s.status, hasScreenshots: s.screenshots.length > 0 })))

    return NextResponse.json(sessions)
  } catch (error) {
    console.error('Error getting live sessions:', error)
    return NextResponse.json([])
  }
}