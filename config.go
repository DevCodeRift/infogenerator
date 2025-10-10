package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

type Config struct {
	DataDir            string `json:"data_dir"`
	OpenAIAPIKey       string `json:"openai_api_key"`
	ClaudeAPIKey       string `json:"claude_api_key"`
	AnalysisPrompt     string `json:"analysis_prompt"`
	UseOfflineAnalysis bool   `json:"use_offline_analysis"`
	EnableAIEnhancement bool   `json:"enable_ai_enhancement"`
	PreferClaude       bool   `json:"prefer_claude"`
	WebappURL          string `json:"webapp_url"`
	ScreenshotSettings ScreenshotSettings `json:"screenshot_settings"`
	TimelapseSettings  TimelapseSettings  `json:"timelapse_settings"`
}

type ScreenshotSettings struct {
	Quality       int  `json:"quality"`        // JPEG quality 1-100
	Compress      bool `json:"compress"`       // Enable compression
	MaxFileSize   int  `json:"max_file_size"`  // Max file size in MB
}

func LoadConfig(configPath string) (*Config, error) {
	// Get executable directory first
	execDir, err := getExecutableDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get executable directory: %w", err)
	}

	// Set default configuration with executable directory as base
	config := &Config{
		DataDir:             filepath.Join(execDir, "sessions"),
		OpenAIAPIKey:        "",
		ClaudeAPIKey:        "",
		AnalysisPrompt:      "",
		UseOfflineAnalysis:  true,
		EnableAIEnhancement: false,
		PreferClaude:        true,
		WebappURL:           "", // Set to your Vercel app URL
		ScreenshotSettings: ScreenshotSettings{
			Quality:     80,
			Compress:    true,
			MaxFileSize: 5,
		},
		TimelapseSettings: TimelapseSettings{
			FPS:     2,
			Quality: "medium",
			Format:  "mp4",
		},
	}

	// Make config path absolute if it's not
	if !filepath.IsAbs(configPath) {
		configPath = filepath.Join(execDir, configPath)
	}

	// Check if config file exists
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		// Create default config file
		if err := config.Save(configPath); err != nil {
			return nil, fmt.Errorf("failed to create default config: %w", err)
		}
		fmt.Printf("Created default configuration file: %s\n", configPath)
		return config, nil
	}

	// Load existing config file
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	if err := json.Unmarshal(data, config); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	// Always ensure data directory is relative to executable directory
	if !filepath.IsAbs(config.DataDir) {
		config.DataDir = filepath.Join(execDir, config.DataDir)
	}

	return config, nil
}

func (c *Config) Save(configPath string) error {
	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(configPath, data, 0644)
}

func (c *Config) Validate() error {
	// Validate data directory
	if c.DataDir == "" {
		return fmt.Errorf("data_dir cannot be empty")
	}

	// Validate screenshot settings
	if c.ScreenshotSettings.Quality < 1 || c.ScreenshotSettings.Quality > 100 {
		return fmt.Errorf("screenshot quality must be between 1 and 100")
	}

	if c.ScreenshotSettings.MaxFileSize < 1 {
		return fmt.Errorf("max_file_size must be at least 1 MB")
	}

	return nil
}

func getExecutableDir() (string, error) {
	execPath, err := os.Executable()
	if err != nil {
		return "", err
	}
	return filepath.Dir(execPath), nil
}

// Helper functions for file operations (to avoid import issues)
func createFile(path string) (*os.File, error) {
	return os.Create(path)
}