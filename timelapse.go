package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
)

type TimelapseGenerator struct {
	ffmpegPath string
	fps        int
	quality    string
}

type TimelapseSettings struct {
	FPS     int    `json:"fps"`
	Quality string `json:"quality"` // "high", "medium", "low"
	Format  string `json:"format"`  // "mp4", "webm"
}

func NewTimelapseGenerator() *TimelapseGenerator {
	// First try to find ffmpeg.exe in the same directory as the executable
	execPath, err := os.Executable()
	var ffmpegPath string

	if err == nil {
		execDir := filepath.Dir(execPath)
		localFFmpeg := filepath.Join(execDir, "ffmpeg.exe")

		// Check if local ffmpeg.exe exists
		if _, err := os.Stat(localFFmpeg); err == nil {
			ffmpegPath = localFFmpeg
		} else {
			// Fall back to system PATH
			ffmpegPath = "ffmpeg"
		}
	} else {
		// Fall back to system PATH
		ffmpegPath = "ffmpeg"
	}

	return &TimelapseGenerator{
		ffmpegPath: ffmpegPath,
		fps:        2,        // Default 2 fps for timelapse
		quality:    "medium",
	}
}

func (tg *TimelapseGenerator) CheckFFmpegAvailable() bool {
	_, err := exec.LookPath(tg.ffmpegPath)
	return err == nil
}

func (tg *TimelapseGenerator) GenerateTimelapse(screenshots []Screenshot, outputPath string, settings TimelapseSettings) error {
	if len(screenshots) < 2 {
		return fmt.Errorf("need at least 2 screenshots to create timelapse")
	}

	if !tg.CheckFFmpegAvailable() {
		return fmt.Errorf("FFmpeg not found in PATH - timelapse generation requires FFmpeg to be installed")
	}

	// Sort screenshots by timestamp
	sort.Slice(screenshots, func(i, j int) bool {
		return screenshots[i].Timestamp.Before(screenshots[j].Timestamp)
	})

	// Create temporary directory for processing
	tempDir := filepath.Join(filepath.Dir(outputPath), "temp_timelapse")
	if err := os.MkdirAll(tempDir, 0755); err != nil {
		return fmt.Errorf("failed to create temp directory: %w", err)
	}
	defer os.RemoveAll(tempDir) // Clean up temp directory

	// Copy and rename screenshots to sequential format required by FFmpeg
	fmt.Printf("Preparing %d screenshots for timelapse...\n", len(screenshots))
	for i, screenshot := range screenshots {
		srcPath := screenshot.FilePath
		dstPath := filepath.Join(tempDir, fmt.Sprintf("frame_%04d.jpg", i+1))

		if err := tg.copyFile(srcPath, dstPath); err != nil {
			return fmt.Errorf("failed to copy screenshot %d: %w", i+1, err)
		}
	}

	// Generate FFmpeg command
	inputPattern := filepath.Join(tempDir, "frame_%04d.jpg")

	// Build FFmpeg arguments based on settings
	args := []string{
		"-y", // Overwrite output file
		"-framerate", fmt.Sprintf("%d", settings.FPS),
		"-i", inputPattern,
		"-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2", // Standardize size
	}

	// Add quality settings
	switch strings.ToLower(settings.Quality) {
	case "high":
		args = append(args, "-crf", "18", "-preset", "slow")
	case "low":
		args = append(args, "-crf", "28", "-preset", "fast")
	default: // medium
		args = append(args, "-crf", "23", "-preset", "medium")
	}

	// Add codec and format
	if strings.ToLower(settings.Format) == "webm" {
		args = append(args, "-c:v", "libvpx-vp9", "-b:v", "1M")
	} else {
		args = append(args, "-c:v", "libx264", "-pix_fmt", "yuv420p")
	}

	args = append(args, outputPath)

	fmt.Printf("Generating timelapse video...\n")
	fmt.Printf("Command: ffmpeg %s\n", strings.Join(args, " "))

	// Execute FFmpeg command
	cmd := exec.Command(tg.ffmpegPath, args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("FFmpeg failed: %w", err)
	}

	fmt.Printf("Timelapse created successfully: %s\n", outputPath)
	return nil
}

func (tg *TimelapseGenerator) copyFile(src, dst string) error {
	sourceFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer sourceFile.Close()

	destFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer destFile.Close()

	// Copy file contents
	buf := make([]byte, 32*1024) // 32KB buffer
	for {
		n, err := sourceFile.Read(buf)
		if n > 0 {
			if _, writeErr := destFile.Write(buf[:n]); writeErr != nil {
				return writeErr
			}
		}
		if err != nil {
			if err.Error() == "EOF" {
				break
			}
			return err
		}
	}

	return destFile.Sync()
}

func (tg *TimelapseGenerator) GetTimelapseInfo(screenshots []Screenshot, settings TimelapseSettings) string {
	if len(screenshots) < 2 {
		return "Not enough screenshots for timelapse"
	}

	duration := screenshots[len(screenshots)-1].Timestamp.Sub(screenshots[0].Timestamp)
	videoLengthSeconds := float64(len(screenshots)) / float64(settings.FPS)

	return fmt.Sprintf("Timelapse: %d screenshots over %v compressed into %.1f seconds at %d fps",
		len(screenshots),
		duration.Round(1),
		videoLengthSeconds,
		settings.FPS)
}