import { NextResponse } from 'next/server'
import { list } from '@vercel/blob'

export async function GET() {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.log('BLOB_READ_WRITE_TOKEN not configured')
      return NextResponse.json([])
    }

    // Get student names, session status, and summaries
    // Use relative URL for internal API calls on Vercel
    let studentData = { names: {}, status: {}, summaries: {} }
    try {
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000'
      console.log('Fetching student names from:', `${baseUrl}/api/student-names`)
      const studentNamesResponse = await fetch(`${baseUrl}/api/student-names`, {
        cache: 'no-store'
      })
      if (studentNamesResponse.ok) {
        studentData = await studentNamesResponse.json()
      } else {
        console.log('Student names fetch failed:', studentNamesResponse.status)
      }
    } catch (fetchError) {
      console.log('Error fetching student names:', fetchError)
    }

    const studentNames = studentData.names || {}
    const sessionStatus = studentData.status || {}
    const sessionSummaries = studentData.summaries || {}

    console.log('Session status data:', sessionStatus)
    console.log('Session summaries data:', Object.keys(sessionSummaries))

    // List all blobs in the screenshots folder (with pagination)
    console.log('Listing blobs with prefix: screenshots/')
    let allBlobs: Awaited<ReturnType<typeof list>>['blobs'] = []
    let cursor: string | undefined = undefined

    do {
      const response = await list({
        prefix: 'screenshots/',
        token: process.env.BLOB_READ_WRITE_TOKEN,
        cursor,
      })
      allBlobs = allBlobs.concat(response.blobs)
      cursor = response.cursor
      console.log(`Fetched ${response.blobs.length} blobs, total: ${allBlobs.length}, has more: ${!!cursor}`)
    } while (cursor)

    const blobs = allBlobs
    console.log(`Total blobs found: ${blobs.length}`)
    if (blobs.length > 0) {
      // Show newest blobs first for debugging
      const sortedByDate = [...blobs].sort((a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      )
      console.log('Newest blob pathnames:', sortedByDate.slice(0, 5).map(b => `${b.pathname} (${b.uploadedAt})`))
    }

    // Group by session ID and count screenshots
    const sessionMap = new Map()

    for (const blob of blobs) {
      // Extract session ID from path: screenshots/SESSION_ID/timestamp-filename.jpg
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

    // Sort sessions by start time (newest first)
    const sessions = Array.from(sessionMap.values()).sort((a, b) =>
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    )

    console.log('=== Live Sessions Response ===')
    console.log('Sessions from blob storage:', sessionMap.size)
    console.log('All session IDs found:', Array.from(sessionMap.keys()))
    console.log('Final sessions:', sessions.map(s => ({ id: s.id, startTime: s.startTime, status: s.status, screenshots: s.screenshots.length })))

    return NextResponse.json(sessions)
  } catch (error) {
    console.error('Error getting live sessions:', error)
    return NextResponse.json([])
  }
}