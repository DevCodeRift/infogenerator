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
  summary?: string
}

export default function SessionMonitor() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [screenshots, setScreenshots] = useState<Screenshot[]>([])
  const [editingSession, setEditingSession] = useState<string | null>(null)
  const [tempNames, setTempNames] = useState<{[key: string]: string}>({})
  const [viewingScreenshots, setViewingScreenshots] = useState<string | null>(null)

  // Load sessions on component mount and refresh every 10 seconds
  useEffect(() => {
    fetchSessions()
    const interval = setInterval(fetchSessions, 10000) // Refresh every 10 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/live-sessions')
      const data = await response.json()
      setSessions(data || [])

      // Initialize tempNames with existing student names
      const newTempNames: {[key: string]: string} = {}
      data?.forEach((session: Session) => {
        if (session.studentName && session.studentName !== 'Unknown Student') {
          newTempNames[session.id] = session.studentName
        }
      })
      setTempNames(prev => ({ ...newTempNames, ...prev }))
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
      const response = await fetch('/api/student-names', {
        method: 'POST',
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

  const deleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this session? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch('/api/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })

      if (response.ok) {
        fetchSessions() // Refresh sessions
        alert('Session deleted successfully')
      } else {
        alert('Failed to delete session')
      }
    } catch (error) {
      console.error('Failed to delete session:', error)
      alert('Failed to delete session')
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
                    value={tempNames[session.id] || ''}
                    onChange={(e) => {
                      setTempNames(prev => ({
                        ...prev,
                        [session.id]: e.target.value
                      }))
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const name = tempNames[session.id]?.trim()
                        if (name) {
                          updateStudentName(session.id, name)
                          setTempNames(prev => {
                            const newState = { ...prev }
                            delete newState[session.id]
                            return newState
                          })
                        }
                      }
                    }}
                    onBlur={(e) => {
                      const name = e.target.value.trim()
                      if (name) {
                        updateStudentName(session.id, name)
                        setTempNames(prev => {
                          const newState = { ...prev }
                          delete newState[session.id]
                          return newState
                        })
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  <button
                    onClick={() => setViewingScreenshots(session.id)}
                    className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                  >
                    View Screenshots
                  </button>

                  <button
                    onClick={() => handleGenerateSummary(session)}
                    disabled={!session.studentName || session.studentName === 'Unknown Student'}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    Generate Summary
                  </button>

                  <button
                    onClick={() => deleteSession(session.id)}
                    className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    Delete
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
                <div className="flex items-center justify-between mb-4">
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

                  <div className="flex space-x-2">
                    <button
                      onClick={() => setViewingScreenshots(session.id)}
                      className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                    >
                      View Screenshots
                    </button>

                    <button
                      onClick={() => handleGenerateSummary(session)}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      Regenerate Summary
                    </button>

                    <button
                      onClick={() => deleteSession(session.id)}
                      className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {session.summary && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-medium text-green-900 mb-2">Summary:</h4>
                    <p className="text-green-800 text-sm">{session.summary}</p>
                  </div>
                )}
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

      {/* Screenshot Viewer Modal */}
      {viewingScreenshots && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                Screenshots - Session {viewingScreenshots}
              </h3>
              <button
                onClick={() => setViewingScreenshots(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sessions
                .find(s => s.id === viewingScreenshots)
                ?.screenshots.map((screenshot, index) => (
                  <div key={index} className="border rounded-lg overflow-hidden">
                    <img
                      src={screenshot}
                      alt={`Screenshot ${index + 1}`}
                      className="w-full h-auto cursor-pointer hover:opacity-80"
                      onClick={() => window.open(screenshot, '_blank')}
                    />
                    <div className="p-2 text-xs text-gray-500 text-center">
                      Screenshot {index + 1}
                    </div>
                  </div>
                )) || []}
            </div>

            {sessions.find(s => s.id === viewingScreenshots)?.screenshots.length === 0 && (
              <p className="text-gray-500 text-center py-8">No screenshots available</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}