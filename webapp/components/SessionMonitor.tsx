'use client'

import { useState, useEffect } from 'react'

interface Screenshot {
  url: string
  timestamp: string
  sessionId: string
}

interface Session {
  id: string
  studentName?: string
  startTime: string
  status: 'active' | 'completed'
  screenshots: string[]
}

export default function SessionMonitor() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [screenshots, setScreenshots] = useState<Screenshot[]>([])
  const [studentName, setStudentName] = useState('')

  // Load sessions on component mount
  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/sessions')
      const data = await response.json()
      setSessions(data)
    } catch (error) {
      console.error('Failed to fetch sessions:', error)
    }
  }

  const handleGenerateSummary = async (session: Session) => {
    if (!session.studentName || session.studentName === 'Unknown Student') {
      alert('Please enter a student name first')
      return
    }

    try {
      const response = await fetch('/api/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          studentName: session.studentName,
          screenshots: session.screenshots,
        }),
      })

      const summary = await response.json()
      alert(`Summary generated for ${session.studentName}:\\n\\n${summary.summary}`)
    } catch (error) {
      console.error('Failed to generate summary:', error)
      alert('Failed to generate summary')
    }
  }

  const updateStudentName = async (sessionId: string, name: string) => {
    try {
      const response = await fetch('/api/sessions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          studentName: name,
        }),
      })

      if (response.ok) {
        fetchSessions() // Refresh sessions
      }
    } catch (error) {
      console.error('Failed to update student name:', error)
    }
  }

  const activeSessions = sessions.filter(s => s.status === 'active')
  const completedSessions = sessions.filter(s => s.status === 'completed')

  return (
    <div className="space-y-6">
      {/* Active Sessions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          🟢 Active Sessions ({activeSessions.length})
        </h2>

        {activeSessions.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No active sessions. Start the Go application to begin monitoring.
          </p>
        ) : (
          <div className="space-y-4">
            {activeSessions.map((session) => (
              <div key={session.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Session {session.id}</h3>
                    <p className="text-sm text-gray-500">
                      Started: {new Date(session.startTime).toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-500">
                      Screenshots: {session.screenshots.length}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm text-green-600">Live</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center space-x-4">
                  <input
                    type="text"
                    placeholder="Enter student name..."
                    value={session.studentName === 'Unknown Student' ? '' : session.studentName || ''}
                    onChange={(e) => setStudentName(e.target.value)}
                    onBlur={(e) => {
                      if (e.target.value.trim()) {
                        updateStudentName(session.id, e.target.value.trim())
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  <button
                    onClick={() => handleGenerateSummary(session)}
                    disabled={!session.studentName || session.studentName === 'Unknown Student'}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    Generate Summary
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed Sessions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          ✅ Completed Sessions ({completedSessions.length})
        </h2>

        {completedSessions.length === 0 ? (
          <p className="text-gray-500 text-center py-4">
            No completed sessions yet.
          </p>
        ) : (
          <div className="space-y-4">
            {completedSessions.map((session) => (
              <div key={session.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">
                      {session.studentName || 'Unknown Student'} - Session {session.id}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Started: {new Date(session.startTime).toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-500">
                      Screenshots: {session.screenshots.length}
                    </p>
                  </div>

                  <button
                    onClick={() => handleGenerateSummary(session)}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    Generate Summary
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2">How to use:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>1. Start your Go application with the modified code to send screenshots here</li>
          <li>2. Sessions will appear in real-time as screenshots are captured</li>
          <li>3. Enter the student name when convenient</li>
          <li>4. Click "Generate Summary" to create analysis and timelapse</li>
        </ul>
      </div>
    </div>
  )
}