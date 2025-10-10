package main

import (
	"bufio"
	"database/sql"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
)

func main() {
	var (
		startSession = flag.Bool("start", false, "Start a new screenshot session")
		stopSession  = flag.Bool("stop", false, "Stop current session and generate summary")
		usbAuto      = flag.Bool("usb-auto", false, "USB auto mode - start/stop based on USB insertion/removal")
		analyze      = flag.Bool("analyze", false, "Analyze existing sessions and generate reports")
		silent       = flag.Bool("silent", false, "Run in silent background mode")
		interval     = flag.Int("interval", 30, "Screenshot interval in seconds")
		configPath   = flag.String("config", "config.json", "Path to configuration file")
	)
	flag.Parse()

	// Check if any command-line arguments were provided
	if *analyze {
		// Analysis mode
		runAnalysisMode(*configPath)
	} else if *usbAuto {
		// USB auto mode
		RunUSBMode(*configPath, *silent)
	} else if *startSession || *stopSession {
		// Command-line mode (for advanced users)
		runCommandLineMode(*startSession, *stopSession, *interval, *configPath, *silent)
	} else {
		// Check if we're running from a USB drive - if so, auto-start USB mode silently
		if isRunningFromUSB() {
			RunUSBMode(*configPath, true) // Silent mode for autorun
		} else {
			// Interactive mode (for double-click execution)
			runInteractiveMode(*configPath)
		}
	}
}

func runCommandLineMode(start, stop bool, interval int, configPath string, silent bool) {
	// In silent mode, suppress all output
	if silent {
		log.SetOutput(io.Discard)
	}

	// Initialize application
	app, err := NewApp(configPath)
	if err != nil {
		if !silent {
			log.Fatal("Failed to initialize application:", err)
		}
		return
	}

	switch {
	case start:
		if !silent {
			fmt.Println("Starting screenshot session...")
			fmt.Printf("Taking screenshots every %d seconds\n", interval)
			fmt.Println("Press Ctrl+C to stop or run with -stop flag")
		}

		// Handle graceful shutdown
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

		go func() {
			<-sigChan
			if !silent {
				fmt.Println("\nStopping session...")
			}
			app.StopSession()
		}()

		if err := app.StartSession(interval, "Student"); err != nil {
			if !silent {
				log.Fatal("Failed to start session:", err)
			}
			return
		}

	case stop:
		if !silent {
			fmt.Println("Stopping session and generating summary...")
		}
		if err := app.StopSessionAndSummarize(); err != nil {
			if !silent {
				log.Fatal("Failed to stop session:", err)
			}
			return
		}
	}
}

func runInteractiveMode(configPath string) {
	// Clear screen and show welcome message
	fmt.Println("\n" + strings.Repeat("=", 60))
	fmt.Println("     📸 InfoGenerator - Screenshot Analyzer")
	fmt.Println("     Completely Offline • No API Keys Required")
	fmt.Println(strings.Repeat("=", 60))

	// Initialize application
	app, err := NewApp(configPath)
	if err != nil {
		fmt.Printf("\n❌ Error: %v\n", err)
		pauseForUser()
		return
	}
	defer app.Close()

	reader := bufio.NewReader(os.Stdin)

	for {
		// Check for active session
		activeSession, _ := app.sessionManager.GetActiveSession()

		fmt.Println("\n🎯 What would you like to do?")
		if activeSession != nil {
			fmt.Printf("   ⏳ Active session running (ID: %d)\n", activeSession.ID)
			fmt.Println("   1️⃣  Stop current session and generate summary")
			fmt.Println("   2️⃣  Exit (keep session running)")
		} else {
			fmt.Println("   1️⃣  USB Auto Mode (Recommended)")
			fmt.Println("   2️⃣  Start new screenshot session manually")
			fmt.Println("   3️⃣  Analyze previous session")
			fmt.Println("   4️⃣  Exit")
		}

		fmt.Print("\n💭 Enter your choice (1-" + func() string {
			if activeSession != nil { return "2" } else { return "4" }
		}() + "): ")

		choice, _ := reader.ReadString('\n')
		choice = strings.TrimSpace(choice)

		if activeSession != nil {
			switch choice {
			case "1":
				handleStopSession(app)
			case "2":
				fmt.Println("\n👋 Session will continue running in the background.")
				fmt.Println("   Double-click this program again to stop it.")
				pauseForUser()
				return
			default:
				fmt.Println("❌ Invalid choice. Please enter 1 or 2.")
			}
		} else {
			switch choice {
			case "1":
				handleUSBAutoMode(app)
				return
			case "2":
				handleAnalyzeExisting(app)
			case "3":
				handleStartSession(app, reader)
			case "4":
				fmt.Println("\n👋 Goodbye!")
				return
			default:
				fmt.Println("❌ Invalid choice. Please enter 1, 2, 3, or 4.")
			}
		}
	}
}

func handleStartSession(app *App, reader *bufio.Reader) {
	fmt.Println("\n🚀 Starting New Session")

	// Use default student name
	studentName := "Student"

	// Get screenshot interval
	fmt.Print("⏱️  Screenshot interval in seconds (default 30): ")
	intervalStr, _ := reader.ReadString('\n')
	intervalStr = strings.TrimSpace(intervalStr)

	interval := 30
	if intervalStr != "" {
		if i, err := strconv.Atoi(intervalStr); err == nil && i > 0 {
			interval = i
		}
	}

	fmt.Printf("\n✅ Starting session with %d second intervals\n", interval)
	fmt.Println("📸 Screenshots will be saved automatically")
	fmt.Println("🛑 Close this window or press Ctrl+C to stop")
	fmt.Println(strings.Repeat("-", 50))

	// Start session in the background
	go func() {
		if err := app.StartSession(interval, studentName); err != nil {
			fmt.Printf("❌ Error starting session: %v\n", err)
		}
	}()

	// Handle graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	fmt.Println("\n🛑 Stopping session...")
	if err := app.StopSessionAndSummarize(); err != nil {
		fmt.Printf("❌ Error during analysis: %v\n", err)
	} else {
		fmt.Println("✅ Session analysis complete!")
	}
	pauseForUser()
}

func handleStopSession(app *App) {
	fmt.Println("\n🛑 Stopping Session & Generating Analysis...")
	fmt.Println("⏳ Please wait while we analyze your screenshots...")

	if err := app.StopSessionAndSummarize(); err != nil {
		fmt.Printf("❌ Error: %v\n", err)
	} else {
		fmt.Println("\n✅ Analysis complete!")
		fmt.Println("📁 Check the session folder for your detailed report")
	}

	pauseForUser()
}

func handleUSBAutoMode(app *App) {
	app.Close() // Close the app properly before switching to USB mode
	RunUSBMode("config.json", false) // Interactive USB mode
}

func handleAnalyzeExisting(app *App) {
	app.Close() // Close current app instance
	runAnalysisMode("config.json")
}

func isRunningFromUSB() bool {
	// Get the directory where the executable is located
	execPath, err := os.Executable()
	if err != nil {
		return false
	}

	execDir := filepath.Dir(execPath)

	// Check if we're running from a removable drive (common USB mount points)
	// Linux: /media or /mnt
	if strings.HasPrefix(execDir, "/media/") || strings.HasPrefix(execDir, "/mnt/") {
		return true
	}

	// Windows: Check if it's a drive letter other than C: (most USB drives)
	if len(execDir) >= 2 && execDir[1] == ':' {
		driveLetter := strings.ToUpper(string(execDir[0]))
		// Assume anything other than C: might be a USB drive
		if driveLetter != "C" {
			return true
		}
	}

	// Additional check: look for autorun files in the same directory
	autorunInf := filepath.Join(execDir, "autorun.inf")
	autorunSh := filepath.Join(execDir, "autorun.sh")

	if _, err := os.Stat(autorunInf); err == nil {
		return true
	}
	if _, err := os.Stat(autorunSh); err == nil {
		return true
	}

	return false
}

func runAnalysisMode(configPath string) {
	fmt.Println("\n" + strings.Repeat("=", 60))
	fmt.Println("     📊 InfoGenerator - Analysis Mode")
	fmt.Println("     Analyzing Existing Sessions")
	fmt.Println(strings.Repeat("=", 60))

	// Initialize application
	app, err := NewApp(configPath)
	if err != nil {
		fmt.Printf("\n❌ Error: %v\n", err)
		pauseForUser()
		return
	}
	defer app.Close()

	// Find unanalyzed sessions
	unanalyzedSessions, err := findUnanalyzedSessions(app)
	if err != nil {
		fmt.Printf("❌ Error finding sessions: %v\n", err)
		pauseForUser()
		return
	}

	if len(unanalyzedSessions) == 0 {
		fmt.Println("\n✅ No unanalyzed sessions found.")
		fmt.Println("All sessions have been processed already.")
		pauseForUser()
		return
	}

	fmt.Printf("\n🔍 Found %d unanalyzed session(s):\n\n", len(unanalyzedSessions))

	// Process each session
	for i, session := range unanalyzedSessions {
		fmt.Printf("%d. Session %d (Started: %s)\n",
			i+1, session.ID, session.StartTime.Format("2006-01-02 15:04:05"))

		screenshots, err := app.sessionManager.GetSessionScreenshots(session.ID)
		if err != nil {
			fmt.Printf("   ❌ Error getting screenshots: %v\n", err)
			continue
		}

		if len(screenshots) == 0 {
			fmt.Printf("   ⚠️  No screenshots found - skipping\n")
			continue
		}

		fmt.Printf("   📸 Processing %d screenshots...\n", len(screenshots))

		// Generate analysis
		summary, err := app.analyzer.GenerateSessionSummary(screenshots, app.config.AnalysisPrompt, app.config, session.StudentName)
		if err != nil {
			fmt.Printf("   ❌ Analysis failed: %v\n", err)
			continue
		}

		// Save analysis
		sessionDir := app.sessionManager.GetSessionDir(session.ID)
		summaryPath := filepath.Join(sessionDir, "summary.txt")

		if err := app.saveSummary(summaryPath, &session, summary); err != nil {
			fmt.Printf("   ❌ Failed to save summary: %v\n", err)
			continue
		}

		// Generate timelapse if enough screenshots
		if len(screenshots) >= 3 {
			fmt.Printf("   🎬 Creating timelapse...\n")
			if err := app.generateTimelapse(screenshots, sessionDir, &session); err != nil {
				fmt.Printf("   ⚠️  Timelapse failed: %v\n", err)
			}
		}

		fmt.Printf("   ✅ Analysis complete: %s\n\n", summaryPath)
	}

	fmt.Println("🎉 All sessions analyzed successfully!")
	fmt.Println("Check the session folders for detailed reports.")
	pauseForUser()
}

func findUnanalyzedSessions(app *App) ([]Session, error) {
	// Get all completed sessions
	rows, err := app.sessionManager.db.Query(
		"SELECT id, start_time, end_time, description, student_name, status FROM sessions WHERE status = 'completed' ORDER BY start_time DESC",
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var unanalyzed []Session
	for rows.Next() {
		var session Session
		var endTime sql.NullTime
		var studentName sql.NullString

		if err := rows.Scan(&session.ID, &session.StartTime, &endTime, &session.Description, &studentName, &session.Status); err != nil {
			continue
		}

		if endTime.Valid {
			session.EndTime = endTime.Time
		}
		if studentName.Valid {
			session.StudentName = studentName.String
		}

		// Check if analysis already exists
		sessionDir := app.sessionManager.GetSessionDir(session.ID)
		summaryPath := filepath.Join(sessionDir, "summary.txt")

		if _, err := os.Stat(summaryPath); os.IsNotExist(err) {
			// No analysis exists - add to unanalyzed list
			unanalyzed = append(unanalyzed, session)
		}
	}

	return unanalyzed, rows.Err()
}

func pauseForUser() {
	fmt.Print("\n⏎  Press Enter to continue...")
	bufio.NewReader(os.Stdin).ReadString('\n')
}