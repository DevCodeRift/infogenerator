package main

import (
	"bytes"
	"fmt"
	"image"
	"image/jpeg"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/kbinani/screenshot"
)

type ScreenshotCapture struct {
	outputDir string
	quality   int
	webappURL string
}

func NewScreenshotCapture(outputDir string, webappURL string) *ScreenshotCapture {
	return &ScreenshotCapture{
		outputDir: outputDir,
		quality:   80, // JPEG quality
		webappURL: webappURL,
	}
}

func (sc *ScreenshotCapture) Initialize() error {
	// Create output directory if it doesn't exist
	if err := os.MkdirAll(sc.outputDir, 0755); err != nil {
		return fmt.Errorf("failed to create output directory: %w", err)
	}
	return nil
}

func (sc *ScreenshotCapture) CaptureScreen() (string, error) {
	return sc.CaptureScreenForSession("default")
}

func (sc *ScreenshotCapture) CaptureScreenForSession(sessionID string) (string, error) {
	// Get the number of displays
	n := screenshot.NumActiveDisplays()
	if n == 0 {
		return "", fmt.Errorf("no active displays found")
	}

	// Capture the primary display (display 0)
	bounds := screenshot.GetDisplayBounds(0)
	img, err := screenshot.CaptureRect(bounds)
	if err != nil {
		return "", fmt.Errorf("failed to capture screen: %w", err)
	}

	// Generate filename with timestamp
	timestamp := time.Now().Format("20060102_150405")
	filename := fmt.Sprintf("screenshot_%s.jpg", timestamp)
	filepath := filepath.Join(sc.outputDir, filename)

	// Save the image locally
	if err := sc.saveImage(img, filepath); err != nil {
		return "", fmt.Errorf("failed to save screenshot: %w", err)
	}

	// Send to webapp if URL is configured
	if sc.webappURL != "" {
		go sc.sendToWebapp(img, sessionID, timestamp, filename)
	}

	return filepath, nil
}

func (sc *ScreenshotCapture) saveImage(img image.Image, filepath string) error {
	file, err := os.Create(filepath)
	if err != nil {
		return err
	}
	defer file.Close()

	// Encode as JPEG with specified quality
	options := &jpeg.Options{Quality: sc.quality}
	return jpeg.Encode(file, img, options)
}

func (sc *ScreenshotCapture) sendToWebapp(img image.Image, sessionID, timestamp, filename string) {
	// Convert image to JPEG bytes
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: sc.quality}); err != nil {
		fmt.Printf("Failed to encode image for webapp: %v\n", err)
		return
	}

	// Create multipart form
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	// Add session ID
	if err := writer.WriteField("sessionId", sessionID); err != nil {
		fmt.Printf("Failed to write sessionId field: %v\n", err)
		return
	}

	// Add timestamp
	if err := writer.WriteField("timestamp", strconv.FormatInt(time.Now().Unix(), 10)); err != nil {
		fmt.Printf("Failed to write timestamp field: %v\n", err)
		return
	}

	// Add screenshot file
	part, err := writer.CreateFormFile("screenshot", filename)
	if err != nil {
		fmt.Printf("Failed to create form file: %v\n", err)
		return
	}

	if _, err := io.Copy(part, &buf); err != nil {
		fmt.Printf("Failed to copy image data: %v\n", err)
		return
	}

	if err := writer.Close(); err != nil {
		fmt.Printf("Failed to close multipart writer: %v\n", err)
		return
	}

	// Send HTTP request
	req, err := http.NewRequest("POST", sc.webappURL+"/api/screenshots", &body)
	if err != nil {
		fmt.Printf("Failed to create request: %v\n", err)
		return
	}

	req.Header.Set("Content-Type", writer.FormDataContentType())

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("Failed to send screenshot to webapp: %v\n", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		fmt.Printf("Webapp returned error status: %d\n", resp.StatusCode)
		return
	}

	fmt.Printf("Screenshot sent to webapp successfully\n")
}

func (sc *ScreenshotCapture) GetDisplayInfo() string {
	n := screenshot.NumActiveDisplays()
	if n == 0 {
		return "No active displays"
	}

	info := fmt.Sprintf("Found %d display(s):\n", n)
	for i := 0; i < n; i++ {
		bounds := screenshot.GetDisplayBounds(i)
		info += fmt.Sprintf("Display %d: %dx%d at (%d,%d)\n",
			i, bounds.Max.X-bounds.Min.X, bounds.Max.Y-bounds.Min.Y, bounds.Min.X, bounds.Min.Y)
	}
	return info
}