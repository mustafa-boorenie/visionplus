#!/bin/bash

# Test screenshot streaming functionality

API_URL="http://localhost:3002/api"

echo "=== Testing Screenshot Streaming ==="
echo ""

# 1. Create a session
echo "1. Creating session..."
SESSION_RESPONSE=$(curl -s -X POST $API_URL/sessions)
SESSION_ID=$(echo $SESSION_RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "   Session ID: $SESSION_ID"
echo ""

# 2. Connect to SSE stream in background and save output
echo "2. Connecting to SSE stream..."
curl -N -H "Accept: text/event-stream" $API_URL/sessions/$SESSION_ID/stream 2>/dev/null | while read -r line; do
    if [[ $line == data:* ]]; then
        # Extract data after "data: "
        data="${line#data: }"
        echo "   [SSE] $data"
        
        # Check if it's a screenshot event
        if echo "$data" | grep -q '"type":"screenshot"'; then
            echo "   ✅ SCREENSHOT RECEIVED!"
        fi
    fi
done &

SSE_PID=$!
echo "   SSE PID: $SSE_PID"
echo ""

# Wait a moment for SSE to connect
sleep 2

# 3. Execute a command that will generate screenshots
echo "3. Executing command to generate screenshots..."
COMMAND="navigate to google.com and take a screenshot"
curl -s -X POST $API_URL/sessions/$SESSION_ID/execute \
  -H "Content-Type: application/json" \
  -d "{\"command\": \"$COMMAND\"}" &

echo "   Command sent: $COMMAND"
echo ""

# 4. Wait for some screenshots to stream
echo "4. Waiting for screenshot events (10 seconds)..."
sleep 10

# 5. Check screenshots endpoint
echo ""
echo "5. Checking screenshots list..."
SCREENSHOTS=$(curl -s $API_URL/sessions/$SESSION_ID/screenshots)
echo "   Screenshots response: $SCREENSHOTS"

# Kill the SSE connection
kill $SSE_PID 2>/dev/null

echo ""
echo "=== Test Complete ==="
echo ""
echo "If you saw '✅ SCREENSHOT RECEIVED!' messages above, screenshot streaming is working!" 