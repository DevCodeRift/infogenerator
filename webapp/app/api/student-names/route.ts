import { NextRequest, NextResponse } from 'next/server'
import { put, head } from '@vercel/blob'

// In-memory cache (will be populated from blob storage)
let studentNames: { [sessionId: string]: string } = {}
let sessionStatus: { [sessionId: string]: 'active' | 'completed' } = {}
let sessionSummaries: { [sessionId: string]: string } = {}
let dataLoaded = false

// Load data from blob storage
async function loadData() {
  if (dataLoaded || !process.env.BLOB_READ_WRITE_TOKEN) return

  try {
    // Use list to find our session data file
    const { list } = await import('@vercel/blob')
    const { blobs } = await list({
      prefix: 'session-data',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })

    if (blobs.length > 0) {
      // Get the most recent session data file
      const latestBlob = blobs.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0]
      console.log('Loading session data from:', latestBlob.url)

      const response = await fetch(latestBlob.url)
      if (response.ok) {
        const data = await response.json()
        studentNames = data.names || {}
        sessionStatus = data.status || {}
        sessionSummaries = data.summaries || {}
        console.log('Loaded session data:', Object.keys(studentNames).length, 'sessions', Object.keys(sessionStatus).length, 'statuses')
      }
    } else {
      console.log('No session data file found, starting fresh')
    }
  } catch (error) {
    console.log('Error loading session data:', error, '- starting fresh')
  }

  dataLoaded = true
}

// Save data to blob storage
async function saveData() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return

  try {
    const data = {
      names: studentNames,
      status: sessionStatus,
      summaries: sessionSummaries,
      lastUpdated: new Date().toISOString()
    }

    // Use timestamp to ensure unique filename and avoid caching issues
    const timestamp = Date.now()
    const filename = `session-data-${timestamp}.json`

    const blob = await put(filename, JSON.stringify(data, null, 2), {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })

    console.log('Saved session data to blob storage:', blob.url)
    console.log('Data saved:', {
      names: Object.keys(studentNames).length,
      statuses: Object.keys(sessionStatus).length,
      summaries: Object.keys(sessionSummaries).length
    })
  } catch (error) {
    console.error('Failed to save session data:', error)
  }
}

export async function POST(request: NextRequest) {
  try {
    await loadData() // Ensure data is loaded first

    const { sessionId, studentName, status, summary } = await request.json()

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId' },
        { status: 400 }
      )
    }

    let dataChanged = false

    if (studentName) {
      studentNames[sessionId] = studentName
      console.log('Updated student name:', sessionId, '→', studentName)
      dataChanged = true
    }

    if (status) {
      sessionStatus[sessionId] = status
      console.log('Updated session status:', sessionId, '→', status)
      dataChanged = true
    }

    if (summary) {
      sessionSummaries[sessionId] = summary
      console.log('Updated session summary:', sessionId, '→', summary.substring(0, 50) + '...')
      dataChanged = true
    }

    if (dataChanged) {
      await saveData() // Persist changes to blob storage
    }

    return NextResponse.json({ success: true, studentName, status, summary: !!summary })
  } catch (error) {
    console.error('Error updating session data:', error)
    return NextResponse.json(
      { error: 'Failed to update session data' },
      { status: 500 }
    )
  }
}

export async function GET() {
  await loadData() // Ensure data is loaded first

  return NextResponse.json({
    names: studentNames,
    status: sessionStatus,
    summaries: sessionSummaries
  })
}