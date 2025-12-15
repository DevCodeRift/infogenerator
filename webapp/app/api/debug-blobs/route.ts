import { NextResponse } from 'next/server'
import { list, type ListBlobResult } from '@vercel/blob'

export async function GET() {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ error: 'BLOB_READ_WRITE_TOKEN not configured' }, { status: 500 })
    }

    // List all blobs with pagination
    let allBlobs: ListBlobResult['blobs'] = []
    let cursor: string | undefined = undefined

    do {
      const response: ListBlobResult = await list({
        prefix: 'screenshots/',
        token: process.env.BLOB_READ_WRITE_TOKEN,
        cursor,
      })
      allBlobs = allBlobs.concat(response.blobs)
      cursor = response.cursor
    } while (cursor)

    // Sort by upload date (newest first)
    allBlobs.sort((a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    )

    // Group by session ID
    const sessionGroups: { [key: string]: { count: number; newest: string; oldest: string } } = {}

    for (const blob of allBlobs) {
      const pathParts = blob.pathname.split('/')
      if (pathParts.length >= 2) {
        const sessionId = pathParts[1]
        if (!sessionGroups[sessionId]) {
          sessionGroups[sessionId] = {
            count: 0,
            newest: blob.uploadedAt,
            oldest: blob.uploadedAt,
          }
        }
        sessionGroups[sessionId].count++
        if (new Date(blob.uploadedAt) > new Date(sessionGroups[sessionId].newest)) {
          sessionGroups[sessionId].newest = blob.uploadedAt
        }
        if (new Date(blob.uploadedAt) < new Date(sessionGroups[sessionId].oldest)) {
          sessionGroups[sessionId].oldest = blob.uploadedAt
        }
      }
    }

    return NextResponse.json({
      totalBlobs: allBlobs.length,
      newestBlobs: allBlobs.slice(0, 10).map(b => ({
        pathname: b.pathname,
        uploadedAt: b.uploadedAt,
        size: b.size,
      })),
      sessions: sessionGroups,
      sessionCount: Object.keys(sessionGroups).length,
    })
  } catch (error) {
    console.error('Debug blobs error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
