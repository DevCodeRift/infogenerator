'use client'

import { useState, useEffect } from 'react'

interface Session {
  id: string
  studentName?: string
  startTime: string
  status: 'active' | 'completed'
  screenshots: string[]
}

export default function SessionHistory() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)

  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/sessions')
      const data = await response.json()
      setSessions(data.filter((s: Session) => s.status === 'completed'))
    } catch (error) {
      console.error('Failed to fetch sessions:', error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            Session History
          </h2>
          <p className="text-gray-600 mt-1">
            View and manage completed monitoring sessions
          </p>
        </div>

        <div className="p-6">
          {sessions.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No completed sessions yet
              </h3>
              <p className="text-gray-500">
                Completed sessions will appear here after monitoring is finished.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedSession(session)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {session.studentName || 'Unknown Student'}
                      </h3>
                      <p className="text-sm text-gray-500">
                        Session {session.id} • {session.screenshots.length} screenshots
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(session.startTime).toLocaleDateString()} at{' '}
                        {new Date(session.startTime).toLocaleTimeString()}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Completed
                      </span>
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Session Details Modal */}
      {selectedSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  Session Details - {selectedSession.studentName}
                </h3>
                <button
                  onClick={() => setSelectedSession(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Session ID</label>
                  <p className="mt-1 text-gray-900">{selectedSession.id}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Student Name</label>
                  <p className="mt-1 text-gray-900">{selectedSession.studentName || 'Unknown Student'}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Start Time</label>
                  <p className="mt-1 text-gray-900">
                    {new Date(selectedSession.startTime).toLocaleString()}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Screenshots Captured</label>
                  <p className="mt-1 text-gray-900">{selectedSession.screenshots.length}</p>
                </div>

                <div className="flex space-x-4 pt-4">
                  <button
                    onClick={() => {
                      // TODO: Implement summary generation
                      alert('Summary generation will be implemented')
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Generate Summary
                  </button>

                  <button
                    onClick={() => {
                      // TODO: Implement timelapse generation
                      alert('Timelapse generation will be implemented')
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                  >
                    Create Timelapse
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}