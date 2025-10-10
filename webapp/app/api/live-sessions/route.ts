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
          sessionMap.set(sessionId, {
            id: sessionId,
            studentName: studentNames[sessionId] || 'Unknown Student',
            startTime: new Date(blob.uploadedAt).toISOString(),
            status: 'active',
            screenshots: []
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