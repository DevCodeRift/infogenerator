import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN

    return NextResponse.json({
      success: true,
      hasToken: !!token,
      tokenLength: token ? token.length : 0,
      tokenStart: token ? token.substring(0, 20) + '...' : 'No token',
      allEnvKeys: Object.keys(process.env).filter(key => key.includes('BLOB')),
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}