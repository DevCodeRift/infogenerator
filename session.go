package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

type Session struct {
	ID          int       `json:"id"`
	StartTime   time.Time `json:"start_time"`
	EndTime     time.Time `json:"end_time"`
	Description string    `json:"description"`
	StudentName string    `json:"student_name"`
	Status      string    `json:"status"` // "active", "completed"
}

type Screenshot struct {
	ID        int       `json:"id"`
	SessionID int       `json:"session_id"`
	Timestamp time.Time `json:"timestamp"`
	FilePath  string    `json:"file_path"`
	FileSize  int64     `json:"file_size"`
}

type SessionManager struct {
	db            *sql.DB
	baseDir       string
	currentSession *Session
}

func NewSessionManager(baseDir string) (*SessionManager, error) {
	sm := &SessionManager{
		baseDir: baseDir,
	}

	// Create base directory (this will be the "sessions" folder alongside executable)
	if err := os.MkdirAll(baseDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create base directory: %w", err)
	}

	// Initialize database in the base directory
	if err := sm.initDatabase(); err != nil {
		return nil, fmt.Errorf("failed to initialize database: %w", err)
	}

	return sm, nil
}

func (sm *SessionManager) initDatabase() error {
	dbPath := filepath.Join(sm.baseDir, "sessions.db")
	var err error
	sm.db, err = sql.Open("sqlite3", dbPath)
	if err != nil {
		return err
	}

	// Create sessions table
	if _, err := sm.db.Exec(`
		CREATE TABLE IF NOT EXISTS sessions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			start_time DATETIME NOT NULL,
			end_time DATETIME,
			description TEXT,
			student_name TEXT,
			status TEXT NOT NULL DEFAULT 'active'
		)
	`); err != nil {
		return err
	}

	// Add student_name column to existing tables if it doesn't exist
	sm.db.Exec(`ALTER TABLE sessions ADD COLUMN student_name TEXT`)

	// Create screenshots table
	if _, err := sm.db.Exec(`
		CREATE TABLE IF NOT EXISTS screenshots (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			session_id INTEGER NOT NULL,
			timestamp DATETIME NOT NULL,
			file_path TEXT NOT NULL,
			file_size INTEGER NOT NULL,
			FOREIGN KEY (session_id) REFERENCES sessions (id)
		)
	`); err != nil {
		return err
	}

	return nil
}

func (sm *SessionManager) StartSession(description string, studentName string) (*Session, error) {
	// Check if there's an active session (both in memory and database)
	if sm.currentSession != nil && sm.currentSession.Status == "active" {
		return nil, fmt.Errorf("session already active (ID: %d)", sm.currentSession.ID)
	}

	// Check database for any active sessions (handles stale sessions from crashed processes)
	activeSession, err := sm.GetActiveSession()
	if err != nil {
		return nil, fmt.Errorf("failed to check for active sessions: %w", err)
	}

	if activeSession != nil {
		// Found a stale active session - check if it's really old (more than 10 minutes without activity)
		if time.Since(activeSession.StartTime) > 10*time.Minute {
			// Automatically clean up old stale session
			fmt.Printf("Found stale session (ID: %d, started: %s). Cleaning up...\n",
				activeSession.ID, activeSession.StartTime.Format("2006-01-02 15:04:05"))
			if err := sm.forceStopSession(activeSession.ID); err != nil {
				return nil, fmt.Errorf("failed to clean up stale session: %w", err)
			}
		} else {
			// Recent session - might still be active
			return nil, fmt.Errorf("session already active (ID: %d)", activeSession.ID)
		}
	}

	session := &Session{
		StartTime:   time.Now(),
		Description: description,
		StudentName: studentName,
		Status:      "active",
	}

	result, err := sm.db.Exec(
		"INSERT INTO sessions (start_time, description, student_name, status) VALUES (?, ?, ?, ?)",
		session.StartTime, session.Description, session.StudentName, session.Status,
	)
	if err != nil {
		return nil, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}

	session.ID = int(id)
	sm.currentSession = session

	// Create individual session directory (e.g., "session_1", "session_2")
	sessionDir := sm.GetSessionDir(session.ID)
	if err := os.MkdirAll(sessionDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create session directory: %w", err)
	}

	fmt.Printf("Session folder created: %s\n", sessionDir)

	return session, nil
}

func (sm *SessionManager) StopSession() error {
	if sm.currentSession == nil || sm.currentSession.Status != "active" {
		return fmt.Errorf("no active session to stop")
	}

	endTime := time.Now()
	_, err := sm.db.Exec(
		"UPDATE sessions SET end_time = ?, status = ? WHERE id = ?",
		endTime, "completed", sm.currentSession.ID,
	)
	if err != nil {
		return err
	}

	sm.currentSession.EndTime = endTime
	sm.currentSession.Status = "completed"

	return nil
}

// forceStopSession stops any session by ID (used for cleaning up stale sessions)
func (sm *SessionManager) forceStopSession(sessionID int) error {
	endTime := time.Now()
	_, err := sm.db.Exec(
		"UPDATE sessions SET end_time = ?, status = ? WHERE id = ? AND status = 'active'",
		endTime, "completed", sessionID,
	)
	if err != nil {
		return err
	}

	// Clear current session if it matches
	if sm.currentSession != nil && sm.currentSession.ID == sessionID {
		sm.currentSession.EndTime = endTime
		sm.currentSession.Status = "completed"
		sm.currentSession = nil
	}

	return nil
}

func (sm *SessionManager) RecordScreenshot(filePath string) error {
	if sm.currentSession == nil || sm.currentSession.Status != "active" {
		return fmt.Errorf("no active session")
	}

	// Get file size
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		return err
	}

	screenshot := &Screenshot{
		SessionID: sm.currentSession.ID,
		Timestamp: time.Now(),
		FilePath:  filePath,
		FileSize:  fileInfo.Size(),
	}

	_, err = sm.db.Exec(
		"INSERT INTO screenshots (session_id, timestamp, file_path, file_size) VALUES (?, ?, ?, ?)",
		screenshot.SessionID, screenshot.Timestamp, screenshot.FilePath, screenshot.FileSize,
	)

	return err
}

func (sm *SessionManager) GetCurrentSession() *Session {
	return sm.currentSession
}

func (sm *SessionManager) GetSessionScreenshots(sessionID int) ([]Screenshot, error) {
	rows, err := sm.db.Query(
		"SELECT id, session_id, timestamp, file_path, file_size FROM screenshots WHERE session_id = ? ORDER BY timestamp",
		sessionID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var screenshots []Screenshot
	for rows.Next() {
		var s Screenshot
		if err := rows.Scan(&s.ID, &s.SessionID, &s.Timestamp, &s.FilePath, &s.FileSize); err != nil {
			return nil, err
		}
		screenshots = append(screenshots, s)
	}

	return screenshots, rows.Err()
}

func (sm *SessionManager) GetSessionByID(id int) (*Session, error) {
	var session Session
	var endTime sql.NullTime
	var studentName sql.NullString
	err := sm.db.QueryRow(
		"SELECT id, start_time, end_time, description, student_name, status FROM sessions WHERE id = ?",
		id,
	).Scan(&session.ID, &session.StartTime, &endTime, &session.Description, &studentName, &session.Status)

	if endTime.Valid {
		session.EndTime = endTime.Time
	}
	if studentName.Valid {
		session.StudentName = studentName.String
	}

	if err != nil {
		return nil, err
	}

	return &session, nil
}

func (sm *SessionManager) GetActiveSession() (*Session, error) {
	var session Session
	var endTime sql.NullTime
	var studentName sql.NullString
	err := sm.db.QueryRow(
		"SELECT id, start_time, end_time, description, student_name, status FROM sessions WHERE status = 'active' ORDER BY start_time DESC LIMIT 1",
	).Scan(&session.ID, &session.StartTime, &endTime, &session.Description, &studentName, &session.Status)

	if endTime.Valid {
		session.EndTime = endTime.Time
	}
	if studentName.Valid {
		session.StudentName = studentName.String
	}

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil // No active session
		}
		return nil, err
	}

	sm.currentSession = &session
	return &session, nil
}

func (sm *SessionManager) GetSessionDir(sessionID int) string {
	return filepath.Join(sm.baseDir, fmt.Sprintf("session_%d", sessionID))
}

func (sm *SessionManager) GetSessionScreenshotDir(sessionID int) string {
	return sm.GetSessionDir(sessionID) // Screenshots go directly in session folder
}

func (sm *SessionManager) Close() error {
	if sm.db != nil {
		return sm.db.Close()
	}
	return nil
}

func (sm *SessionManager) GetStudentSessions(studentName string, limit int) ([]Session, error) {
	query := "SELECT id, start_time, end_time, description, student_name, status FROM sessions WHERE student_name = ? AND status = 'completed' ORDER BY start_time DESC"
	if limit > 0 {
		query += fmt.Sprintf(" LIMIT %d", limit)
	}

	rows, err := sm.db.Query(query, studentName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []Session
	for rows.Next() {
		var session Session
		var endTime sql.NullTime
		var studentNameNull sql.NullString

		if err := rows.Scan(&session.ID, &session.StartTime, &endTime, &session.Description, &studentNameNull, &session.Status); err != nil {
			return nil, err
		}

		if endTime.Valid {
			session.EndTime = endTime.Time
		}
		if studentNameNull.Valid {
			session.StudentName = studentNameNull.String
		}

		sessions = append(sessions, session)
	}

	return sessions, rows.Err()
}

func (sm *SessionManager) ExportSessionData(sessionID int, outputPath string) error {
	session, err := sm.GetSessionByID(sessionID)
	if err != nil {
		return err
	}

	screenshots, err := sm.GetSessionScreenshots(sessionID)
	if err != nil {
		return err
	}

	data := struct {
		Session     *Session     `json:"session"`
		Screenshots []Screenshot `json:"screenshots"`
	}{
		Session:     session,
		Screenshots: screenshots,
	}

	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(outputPath, jsonData, 0644)
}