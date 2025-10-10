import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { sessions, createSession } from './sessions-store'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('screenshot') as File
    const sessionId = formData.get('sessionId') as string
    const timestamp = formData.get('timestamp') as string

    if (!file || !sessionId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if blob token exists
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('BLOB_READ_WRITE_TOKEN not found')
      return NextResponse.json(
        { error: 'Storage not configured' },
        { status: 500 }
      )
    }

    // Store in Vercel Blob
    const blob = await put(`screenshots/${sessionId}/${timestamp}-${file.name}`, file, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })

    // Store metadata in temporary storage (could be database)
    const metadata = {
      sessionId,
      timestamp,
      url: blob.url,
      size: file.size,
      filename: file.name,
    }

    console.log('Screenshot received:', metadata)

    // Update or create session in the sessions store
    let session = sessions.find(s => s.id === sessionId)
    if (!session) {
      session = createSession(sessionId)
    }

    // Add screenshot URL to session
    session.screenshots.push(blob.url)

    // Update start time to earliest if this is an earlier screenshot
    const screenshotTime = new Date().toISOString()
    if (new Date(screenshotTime) < new Date(session.startTime)) {
      session.startTime = screenshotTime
    }

    return NextResponse.json({ success: true, url: blob.url })
  } catch (error) {
    console.error('Error uploading screenshot:', error)
    return NextResponse.json(
      { error: 'Failed to upload screenshot' },
      { status: 500 }
    )
  }
}