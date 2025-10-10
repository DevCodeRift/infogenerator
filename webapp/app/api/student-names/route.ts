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
    const response = await fetch('https://l9aepk5xvcnpybfx.public.blob.vercel-storage.com/session-data.json')
    if (response.ok) {
      const data = await response.json()
      studentNames = data.names || {}
      sessionStatus = data.status || {}
      sessionSummaries = data.summaries || {}
      console.log('Loaded session data from blob storage:', Object.keys(studentNames).length, 'sessions')
    }
  } catch (error) {
    console.log('No existing session data found, starting fresh')
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

    await put('session-data.json', JSON.stringify(data), {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })
    console.log('Saved session data to blob storage')
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