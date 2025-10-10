import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'

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

    // Update the in-memory sessions store
    const sessionsResponse = await fetch(`${request.nextUrl.origin}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        studentName: 'Unknown Student',
        screenshotUrl: blob.url
      })
    })

    return NextResponse.json({ success: true, url: blob.url })
  } catch (error) {
    console.error('Error uploading screenshot:', error)
    return NextResponse.json(
      { error: 'Failed to upload screenshot' },
      { status: 500 }
    )
  }
}