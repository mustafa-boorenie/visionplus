#!/bin/bash

# Exit on any error
set -e

echo "Starting WebRTC-optimized Playwright Browser..."

echo "Setting up virtual display..."
Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX +render -noreset &
export DISPLAY=:99

echo "Starting browser API server..."
exec npm start 