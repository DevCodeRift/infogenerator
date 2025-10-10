package main

import (
	"fmt"
	"path/filepath"
	"strings"
	"time"
)

type AIAnalyzer struct {
	apiKey string
}

func NewAIAnalyzer(apiKey string) *AIAnalyzer {
	return &AIAnalyzer{apiKey: apiKey}
}

func (a *AIAnalyzer) GenerateSessionSummary(screenshots []Screenshot, prompt string, config *Config, studentName string) (string, error) {
	// Simple fallback implementation
	return fmt.Sprintf("Session analysis for %s: %d screenshots captured", studentName, len(screenshots)), nil
}

func RunUSBMode(configPath string, silent bool) {
	fmt.Println("USB mode not implemented in cleaned version")
}

type App struct {
	config           *Config
	sessionManager   *SessionManager
	screenshotCapture *ScreenshotCapture
	analyzer         *AIAnalyzer
	isRunning        bool
	stopChan         chan bool
}

func NewApp(configPath string) (*App, error) {
	// Load configuration
	config, err := LoadConfig(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load config: %w", err)
	}

	// Initialize session manager
	sessionManager, err := NewSessionManager(config.DataDir)
	if err != nil {
		return nil, fmt.Errorf("failed to create session manager: %w", err)
	}

	// Check for existing active session
	activeSession, err := sessionManager.GetActiveSession()
	if err != nil {
		return nil, fmt.Errorf("failed to check for active session: %w", err)
	}

	if activeSession != nil {
		fmt.Printf("Found existing active session (ID: %d, started: %s)\n",
			activeSession.ID, activeSession.StartTime.Format("2006-01-02 15:04:05"))
	}

	// Initialize screenshot capture
	screenshotCapture := NewScreenshotCapture("", config.WebappURL)

	// Initialize AI analyzer
	analyzer := NewAIAnalyzer(config.OpenAIAPIKey)

	app := &App{
		config:            config,
		sessionManager:    sessionManager,
		screenshotCapture: screenshotCapture,
		analyzer:          analyzer,
		stopChan:          make(chan bool),
	}

	return app, nil
}

func (app *App) StartSession(intervalSeconds int, studentName string) error {
	// Start new session
	session, err := app.sessionManager.StartSession("Screenshot capture session", studentName)
	if err != nil {
		return err
	}

	fmt.Printf("Started session ID: %d\n", session.ID)

	// Set up screenshot capture directory
	sessionDir := app.sessionManager.GetSessionScreenshotDir(session.ID)
	app.screenshotCapture.outputDir = sessionDir

	if err := app.screenshotCapture.Initialize(); err != nil {
		return err
	}

	// Print display information
	fmt.Println(app.screenshotCapture.GetDisplayInfo())

	// Start capture loop
	app.isRunning = true
	ticker := time.NewTicker(time.Duration(intervalSeconds) * time.Second)
	defer ticker.Stop()

	// Take initial screenshot
	if err := app.takeScreenshotForSession(session.ID); err != nil {
		fmt.Printf("Error taking screenshot: %v\n", err)
	}

	for app.isRunning {
		select {
		case <-ticker.C:
			if err := app.takeScreenshotForSession(session.ID); err != nil {
				fmt.Printf("Error taking screenshot: %v\n", err)
			}
		case <-app.stopChan:
			app.isRunning = false
		}
	}

	return nil
}

func (app *App) takeScreenshot() error {
	filePath, err := app.screenshotCapture.CaptureScreen()
	if err != nil {
		return err
	}

	if err := app.sessionManager.RecordScreenshot(filePath); err != nil {
		return err
	}

	fmt.Printf("Screenshot saved: %s\n", filepath.Base(filePath))
	return nil
}

func (app *App) takeScreenshotForSession(sessionID int) error {
	filePath, err := app.screenshotCapture.CaptureScreenForSession(fmt.Sprintf("%d", sessionID))
	if err != nil {
		return err
	}

	if err := app.sessionManager.RecordScreenshot(filePath); err != nil {
		return err
	}

	fmt.Printf("Screenshot saved: %s\n", filepath.Base(filePath))
	return nil
}

func (app *App) StopSession() {
	if app.isRunning {
		app.stopChan <- true

		if err := app.sessionManager.StopSession(); err != nil {
			fmt.Printf("Error stopping session: %v\n", err)
		} else {
			fmt.Println("Session stopped successfully")
		}
	}
}

func (app *App) StopSessionAndSummarize() error {
	// Check for active session
	activeSession, err := app.sessionManager.GetActiveSession()
	if err != nil {
		return fmt.Errorf("failed to get active session: %w", err)
	}

	if activeSession == nil {
		return fmt.Errorf("no active session found")
	}

	// Stop the capture loop
	if app.isRunning {
		app.stopChan <- true
	}

	// Stop the session in database
	if err := app.sessionManager.StopSession(); err != nil {
		return fmt.Errorf("failed to stop session: %w", err)
	}

	fmt.Printf("Session %d stopped. Duration: %s\n",
		activeSession.ID,
		time.Since(activeSession.StartTime).Round(time.Second))

	// Get screenshots for analysis
	screenshots, err := app.sessionManager.GetSessionScreenshots(activeSession.ID)
	if err != nil {
		return fmt.Errorf("failed to get session screenshots: %w", err)
	}

	fmt.Printf("Processing %d screenshots for analysis...\n", len(screenshots))

	if len(screenshots) == 0 {
		fmt.Println("No screenshots to analyze")
		return nil
	}

	// Generate summary
	summary, err := app.analyzer.GenerateSessionSummary(screenshots, app.config.AnalysisPrompt, app.config, activeSession.StudentName)
	if err != nil {
		return fmt.Errorf("failed to generate summary: %w", err)
	}

	// Save summary in the session folder
	sessionDir := app.sessionManager.GetSessionDir(activeSession.ID)
	summaryPath := filepath.Join(sessionDir, "summary.txt")

	if err := app.saveSummary(summaryPath, activeSession, summary); err != nil {
		return fmt.Errorf("failed to save summary: %w", err)
	}

	// Also save session info file
	sessionInfoPath := filepath.Join(sessionDir, "session_info.txt")
	if err := app.saveSessionInfo(sessionInfoPath, activeSession); err != nil {
		fmt.Printf("Warning: Failed to save session info: %v\n", err)
	}

	// Generate timelapse if enough screenshots
	if len(screenshots) >= 3 {
		fmt.Printf("Creating timelapse video from %d screenshots...\n", len(screenshots))
		if err := app.generateTimelapse(screenshots, sessionDir, activeSession); err != nil {
			fmt.Printf("Warning: Failed to create timelapse: %v\n", err)
		}
	} else {
		fmt.Printf("Skipping timelapse: need at least 3 screenshots (have %d)\n", len(screenshots))
	}

	fmt.Printf("Session analysis saved to: %s\n", sessionDir)
	fmt.Printf("Summary: %s\n", summaryPath)
	fmt.Println("\n" + summary)

	return nil
}

func (app *App) saveSummary(path string, session *Session, summary string) error {
	content := "Session Summary\n"
	content += "===============\n\n"
	content += fmt.Sprintf("Session ID: %d\n", session.ID)
	content += fmt.Sprintf("Student: %s\n", session.StudentName)
	content += fmt.Sprintf("Start Time: %s\n", session.StartTime.Format("2006-01-02 15:04:05"))
	content += fmt.Sprintf("End Time: %s\n", session.EndTime.Format("2006-01-02 15:04:05"))
	content += fmt.Sprintf("Duration: %s\n", session.EndTime.Sub(session.StartTime).Round(time.Second))
	content += "\nAnalysis:\n"
	content += "---------\n"
	content += summary

	return writeFile(path, content)
}

func (app *App) saveSessionInfo(path string, session *Session) error {
	content := "Session Information\n"
	content += "==================\n\n"
	content += fmt.Sprintf("Session ID: %d\n", session.ID)
	content += fmt.Sprintf("Student: %s\n", session.StudentName)
	content += fmt.Sprintf("Started: %s\n", session.StartTime.Format("2006-01-02 15:04:05"))
	content += fmt.Sprintf("Ended: %s\n", session.EndTime.Format("2006-01-02 15:04:05"))
	content += fmt.Sprintf("Duration: %s\n", session.EndTime.Sub(session.StartTime).Round(time.Second))
	content += fmt.Sprintf("Status: %s\n", session.Status)

	return writeFile(path, content)
}

func (app *App) generateTimelapse(screenshots []Screenshot, sessionDir string, session *Session) error {
	generator := NewTimelapseGenerator()

	// Check if FFmpeg is available
	if !generator.CheckFFmpegAvailable() {
		return fmt.Errorf("FFmpeg not found - timelapse generation requires FFmpeg to be installed")
	}

	// Generate filename with student name
	studentName := session.StudentName
	if studentName == "" {
		studentName = "Student"
	}

	// Clean student name for filename (remove spaces and special chars)
	cleanName := strings.ReplaceAll(studentName, " ", "_")
	cleanName = strings.ReplaceAll(cleanName, "/", "_")
	cleanName = strings.ReplaceAll(cleanName, "\\", "_")

	outputPath := filepath.Join(sessionDir, fmt.Sprintf("%s_session_%d_timelapse.%s",
		cleanName, session.ID, app.config.TimelapseSettings.Format))

	// Generate timelapse
	if err := generator.GenerateTimelapse(screenshots, outputPath, app.config.TimelapseSettings); err != nil {
		return err
	}

	// Add timelapse info to a separate file
	timelapseInfoPath := filepath.Join(sessionDir, "timelapse_info.txt")
	info := generator.GetTimelapseInfo(screenshots, app.config.TimelapseSettings)

	content := "Timelapse Information\n"
	content += "====================\n\n"
	content += fmt.Sprintf("Student: %s\n", session.StudentName)
	content += fmt.Sprintf("Session ID: %d\n", session.ID)
	content += fmt.Sprintf("Video File: %s\n", filepath.Base(outputPath))
	content += fmt.Sprintf("Settings: %d fps, %s quality, %s format\n",
		app.config.TimelapseSettings.FPS, app.config.TimelapseSettings.Quality, app.config.TimelapseSettings.Format)
	content += fmt.Sprintf("\n%s\n", info)

	if err := writeFile(timelapseInfoPath, content); err != nil {
		fmt.Printf("Warning: Failed to save timelapse info: %v\n", err)
	}

	fmt.Printf("✅ Timelapse created: %s\n", filepath.Base(outputPath))
	return nil
}

func (app *App) Close() error {
	if app.sessionManager != nil {
		return app.sessionManager.Close()
	}
	return nil
}

func writeFile(path, content string) error {
	file, err := createFile(path)
	if err != nil {
		return err
	}
	defer file.Close()

	_, err = file.WriteString(content)
	return err
}