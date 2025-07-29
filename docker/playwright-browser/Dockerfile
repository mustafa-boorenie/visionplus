FROM mcr.microsoft.com/playwright:v1.54.1-jammy

# Install additional system packages for WebRTC and video streaming
RUN apt-get update && apt-get install -y \
    # Video codecs and streaming
    ffmpeg \
    libvpx7 \
    libopus0 \
    # Audio support
    pulseaudio \
    alsa-utils \
    # Network and streaming tools
    curl \
    wget \
    # Clean up
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy server files
COPY docker/playwright-browser/server.js ./
COPY docker/playwright-browser/package.json ./

# Install Node.js dependencies
RUN npm install

# Create directories for streaming
RUN mkdir -p /app/streams /app/recordings

# Expose ports
EXPOSE 3000
# Expose additional port for WebRTC streaming
EXPOSE 8080

# Configure environment for WebRTC optimization
ENV HEADLESS=true
ENV DISPLAY=:99
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
# WebRTC optimizations
ENV WEBRTC_ENABLED=true
ENV VIDEO_CODEC=vp8
ENV AUDIO_CODEC=opus
ENV FRAME_RATE=30
ENV BITRATE=2000000

# Set up virtual display for headless WebRTC
RUN apt-get update && apt-get install -y xvfb && rm -rf /var/lib/apt/lists/*

# Start script that sets up virtual display and runs server
COPY docker/playwright-browser/start.sh ./
RUN chmod +x start.sh

CMD ["./start.sh"] 