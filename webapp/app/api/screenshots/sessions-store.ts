interface Session {
  id: string
  studentName?: string
  startTime: string
  status: 'active' | 'completed'
  screenshots: string[]
  summary?: string
}

// Shared sessions store
export const sessions: Session[] = []

export function updateSession(sessionId: string, updates: Partial<Session>) {
  const session = sessions.find(s => s.id === sessionId)
  if (session) {
    Object.assign(session, updates)
  }
  return session
}

export function createSession(sessionId: string, studentName: string = 'Unknown Student') {
  const session: Session = {
    id: sessionId,
    studentName,
    startTime: new Date().toISOString(),
    status: 'active',
    screenshots: []
  }
  sessions.push(session)
  return session
}