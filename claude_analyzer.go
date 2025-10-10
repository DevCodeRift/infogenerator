package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
	"time"
)

type ClaudeAnalyzer struct {
	apiKey     string
	baseURL    string
	model      string
	httpClient *http.Client
}

type ClaudeRequest struct {
	Model     string          `json:"model"`
	MaxTokens int             `json:"max_tokens"`
	Messages  []ClaudeMessage `json:"messages"`
}

type ClaudeMessage struct {
	Role    string           `json:"role"`
	Content []ClaudeContent  `json:"content"`
}

type ClaudeContent struct {
	Type   string            `json:"type"`
	Text   string            `json:"text,omitempty"`
	Source *ClaudeImageSource `json:"source,omitempty"`
}

type ClaudeImageSource struct {
	Type      string `json:"type"`
	MediaType string `json:"media_type"`
	Data      string `json:"data"`
}

type ClaudeResponse struct {
	Content []ClaudeResponseContent `json:"content"`
	Error   *ClaudeError            `json:"error,omitempty"`
}

type ClaudeResponseContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type ClaudeError struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

func NewClaudeAnalyzer(apiKey string) *ClaudeAnalyzer {
	return &ClaudeAnalyzer{
		apiKey:  apiKey,
		baseURL: "https://api.anthropic.com/v1/messages",
		model:   "claude-sonnet-4-20250514",
		httpClient: &http.Client{
			Timeout: 120 * time.Second,
		},
	}
}

func (ca *ClaudeAnalyzer) GenerateSessionSummary(screenshots []Screenshot, analysisPrompt string, studentName string) (string, error) {
	// Sort screenshots by timestamp
	sort.Slice(screenshots, func(i, j int) bool {
		return screenshots[i].Timestamp.Before(screenshots[j].Timestamp)
	})

	// Sample screenshots for analysis (limit to avoid token limits)
	sampledScreenshots := ca.sampleScreenshots(screenshots, 8)

	fmt.Printf("Analyzing %d screenshots with Claude API...\n", len(sampledScreenshots))

	// Prepare the analysis prompt
	if analysisPrompt == "" {
		analysisPrompt = ca.getDefaultAnalysisPrompt()
	}

	// Build the message content
	messageContent := []ClaudeContent{
		{
			Type: "text",
			Text: fmt.Sprintf("%s\n\nStudent name: %s\nTotal screenshots in session: %d\nScreenshots being analyzed: %d\nSession duration: %s\n\nHere are the screenshots in chronological order:",
				analysisPrompt,
				studentName,
				len(screenshots),
				len(sampledScreenshots),
				ca.calculateSessionDuration(screenshots)),
		},
	}

	// Add each screenshot
	for i, screenshot := range sampledScreenshots {
		imageData, err := ca.encodeImageToBase64(screenshot.FilePath)
		if err != nil {
			fmt.Printf("Warning: Failed to encode screenshot %s: %v\n", screenshot.FilePath, err)
			continue
		}

		// Add timestamp info
		messageContent = append(messageContent, ClaudeContent{
			Type: "text",
			Text: fmt.Sprintf("\n--- Screenshot %d taken at %s ---",
				i+1, screenshot.Timestamp.Format("15:04:05 MST")),
		})

		// Add the image
		messageContent = append(messageContent, ClaudeContent{
			Type: "image",
			Source: &ClaudeImageSource{
				Type:      "base64",
				MediaType: "image/jpeg",
				Data:      imageData,
			},
		})
	}

	// Prepare the request
	request := ClaudeRequest{
		Model:     ca.model,
		MaxTokens: 2000,
		Messages: []ClaudeMessage{
			{
				Role:    "user",
				Content: messageContent,
			},
		},
	}

	// Make the API call
	response, err := ca.makeAPIRequest(request)
	if err != nil {
		return "", fmt.Errorf("Claude API request failed: %w", err)
	}

	if len(response.Content) == 0 {
		return "", fmt.Errorf("no response from Claude API")
	}

	return response.Content[0].Text, nil
}

func (ca *ClaudeAnalyzer) sampleScreenshots(screenshots []Screenshot, maxCount int) []Screenshot {
	if len(screenshots) <= maxCount {
		return screenshots
	}

	// Take evenly spaced samples
	interval := float64(len(screenshots)) / float64(maxCount)
	sampled := make([]Screenshot, 0, maxCount)

	for i := 0; i < maxCount; i++ {
		index := int(float64(i) * interval)
		if index >= len(screenshots) {
			index = len(screenshots) - 1
		}
		sampled = append(sampled, screenshots[index])
	}

	return sampled
}

func (ca *ClaudeAnalyzer) encodeImageToBase64(imagePath string) (string, error) {
	imageFile, err := os.Open(imagePath)
	if err != nil {
		return "", err
	}
	defer imageFile.Close()

	imageData, err := io.ReadAll(imageFile)
	if err != nil {
		return "", err
	}

	return base64.StdEncoding.EncodeToString(imageData), nil
}

func (ca *ClaudeAnalyzer) makeAPIRequest(request ClaudeRequest) (*ClaudeResponse, error) {
	jsonData, err := json.Marshal(request)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", ca.baseURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", ca.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := ca.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var response ClaudeResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}

	if response.Error != nil {
		return nil, fmt.Errorf("Claude API error: %s", response.Error.Message)
	}

	return &response, nil
}

func (ca *ClaudeAnalyzer) getDefaultAnalysisPrompt() string {
	return `You are helping create a brief, positive report for parents about their child's learning session in a technology/computing class. Based on these screenshots, write a short, casual summary suitable for parents that includes:

1. What specific technology/software/programming the student was working with
2. What project or activity they were focused on
3. Any specific skills they demonstrated or learned
4. Their level of engagement and progress

Please write this in a warm, encouraging tone that:
- Uses gender-neutral pronouns (they/them) throughout
- Focuses on what the student accomplished and learned
- Mentions specific technologies/tools being used
- Keeps technical terms simple enough for parents to understand
- Is 3-4 sentences long
- Shows enthusiasm for the student's progress

Example style: "Riley had a great introduction to Roblox Studio today, starting with the guided tour to get familiar with the platform. They dove right into the hands-on activities, creating and customizing a ball before moving on to insert various shapes into their workspace. Riley showed excellent attention to detail as they learned to use the essential tools - moving, rotating, and scaling objects to get them just right. It's wonderful to see them building confidence with 3D design and getting comfortable with the creative possibilities that Roblox Studio offers."

Do not include headers, bullet points, or section breaks - just write a natural paragraph report.`
}

func (ca *ClaudeAnalyzer) calculateSessionDuration(screenshots []Screenshot) string {
	if len(screenshots) < 2 {
		return "Unknown"
	}

	start := screenshots[0].Timestamp
	end := screenshots[len(screenshots)-1].Timestamp
	duration := end.Sub(start)

	return duration.Round(time.Second).String()
}