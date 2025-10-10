#!/bin/bash

# InfoGenerator - Auto Start Script
# Double-click this file to start monitoring

# Get the directory where this script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Change to the script directory
cd "$DIR"

# Check if the binary exists
if [ ! -f "./infogenerator" ]; then
    echo "Building InfoGenerator..."
    go build -o infogenerator
    if [ $? -ne 0 ]; then
        echo "❌ Build failed. Make sure Go is installed."
        read -p "Press Enter to exit..."
        exit 1
    fi
fi

# Clear the screen and show welcome message
clear
echo "🚀 InfoGenerator - Student Session Monitor"
echo "=========================================="
echo ""
echo "✅ Webapp URL: https://infogenerator-gltba4l7d-codedevrifts-projects.vercel.app"
echo ""
echo "📝 Instructions:"
echo "   1. This will start capturing screenshots automatically"
echo "   2. Open the webapp URL above in your browser"
echo "   3. Watch sessions appear in real-time"
echo "   4. Add student names when convenient"
echo "   5. Close this window to stop monitoring"
echo ""
echo "🎯 Starting session in 3 seconds..."
sleep 1
echo "🎯 Starting session in 2 seconds..."
sleep 1
echo "🎯 Starting session in 1 second..."
sleep 1
echo ""
echo "📸 Monitoring started! Screenshots are being captured..."
echo "🌐 View live progress at: https://infogenerator-gltba4l7d-codedevrifts-projects.vercel.app"
echo ""
echo "💡 Tip: Leave this window open. Close it when you want to stop."
echo "==================================================================================="
echo ""

# Start the monitoring with default settings
./infogenerator -start -interval 30

echo ""
echo "✅ Session completed!"
echo "🌐 Check your webapp for the summary: https://infogenerator-gltba4l7d-codedevrifts-projects.vercel.app"
echo ""
read -p "Press Enter to exit..."