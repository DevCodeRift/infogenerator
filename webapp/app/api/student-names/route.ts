import { NextRequest, NextResponse } from 'next/server'

// In-memory storage for student names and session status mapped to session IDs
const studentNames: { [sessionId: string]: string } = {}
const sessionStatus: { [sessionId: string]: 'active' | 'completed' } = {}
const sessionSummaries: { [sessionId: string]: string } = {}

export async function POST(request: NextRequest) {
  try {
    const { sessionId, studentName, status, summary } = await request.json()

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId' },
        { status: 400 }
      )
    }

    if (studentName) {
      studentNames[sessionId] = studentName
      console.log('Updated student name:', sessionId, '→', studentName)
    }

    if (status) {
      sessionStatus[sessionId] = status
      console.log('Updated session status:', sessionId, '→', status)
    }

    if (summary) {
      sessionSummaries[sessionId] = summary
      console.log('Updated session summary:', sessionId, '→', summary.substring(0, 50) + '...')
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
  return NextResponse.json({
    names: studentNames,
    status: sessionStatus,
    summaries: sessionSummaries
  })
}