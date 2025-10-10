import { NextRequest, NextResponse } from 'next/server'

// In-memory storage for student names and session status mapped to session IDs
const studentNames: { [sessionId: string]: string } = {}
const sessionStatus: { [sessionId: string]: 'active' | 'completed' } = {}
const sessionSummaries: { [sessionId: string]: string } = {}

export async function POST(request: NextRequest) {
  try {
    const { sessionId, studentName } = await request.json()

    if (!sessionId || !studentName) {
      return NextResponse.json(
        { error: 'Missing sessionId or studentName' },
        { status: 400 }
      )
    }

    studentNames[sessionId] = studentName
    console.log('Updated student name:', sessionId, '→', studentName)

    return NextResponse.json({ success: true, studentName })
  } catch (error) {
    console.error('Error updating student name:', error)
    return NextResponse.json(
      { error: 'Failed to update student name' },
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