'use client';

import React, { useEffect, useRef, useState } from 'react';

interface WebRTCViewerProps {
  sessionId: string;
  onError?: (error: Error) => void;
}

export function WebRTCViewer({ sessionId, onError }: WebRTCViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const currentSessionRef = useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [remoteControlEnabled, setRemoteControlEnabled] = useState(false);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'circuit-breaker' | 'booting'>('booting');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [retryDelay, setRetryDelay] = useState(1000); // Start with 1 second
  const [circuitBreakerInfo, setCircuitBreakerInfo] = useState<{retryAfter: number} | null>(null);
  const [browserDimensions, setBrowserDimensions] = useState({ width: 1280, height: 720 }); // Default to optimized resolution
  const [useScreenshotFallback, setUseScreenshotFallback] = useState(false);
  const [lastScreenshot, setLastScreenshot] = useState<string | null>(null);
  const maxReconnectAttempts = 10;
  const maxRetryDelay = 30000; // Max 30 seconds

  const [retryTrigger, setRetryTrigger] = useState(0);
  const initializationRef = useRef(false);
  
  useEffect(() => {
    // Aggressive cleanup of previous session if sessionId changed
    if (currentSessionRef.current && currentSessionRef.current !== sessionId) {
      console.log(`🔄 Session changed from ${currentSessionRef.current} to ${sessionId}, performing aggressive cleanup...`);
      
      // Force close WebSocket immediately
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'stop_stream' }));
        }
        wsRef.current.close();
        wsRef.current = null;
      }
      
      // Force close peer connection
      if (pcRef.current) {
        if (pcRef.current.signalingState !== 'closed') {
          pcRef.current.close();
        }
        pcRef.current = null;
      }
      
      // Clear canvas immediately
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          ctx.fillStyle = '#1f2937'; // Dark gray background
          ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      }
      
      // Reset all state immediately
      setIsStreaming(false);
      setRemoteControlEnabled(false);
      setConnectionState('booting');
      setError(null);
      setIsLoading(true);
      setReconnectAttempts(0);
      setRetryDelay(1000);
      initializationRef.current = false;
      
      console.log(`✅ Cleanup completed for session ${currentSessionRef.current}`);
    }
    
    // Update current session reference
    currentSessionRef.current = sessionId;
    
    // Reset initialization flag on new session or retry
    if (retryTrigger > 0) {
      initializationRef.current = false;
    }
    
    // Prevent multiple initializations for the same session
    if (initializationRef.current) return;
    
    let mounted = true;
    let pc: RTCPeerConnection | null = null;
    let ws: WebSocket | null = null;
    let mediaStream: MediaStream | null = null;
    let screenshotInterval: NodeJS.Timeout | null = null;

    // Screenshot fallback function
    const startScreenshotFallback = async () => {
      if (screenshotInterval) return; // Already running
      
      console.log('Starting screenshot fallback...');
      screenshotInterval = setInterval(async () => {
        if (!mounted) return;
        
        try {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/sessions/${sessionId}/context`,
            {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' }
            }
          );
          
          if (response.ok) {
            const data = await response.json();
            if (data.screenshot && canvasRef.current) {
              const ctx = canvasRef.current.getContext('2d');
              if (ctx) {
                const img = new Image();
                img.onload = () => {
                  ctx.drawImage(img, 0, 0, canvasRef.current!.width, canvasRef.current!.height);
                  setLastScreenshot(data.screenshot);
                };
                img.src = `data:image/jpeg;base64,${data.screenshot}`;
              }
            }
          }
        } catch (error) {
          console.warn('Screenshot fallback failed:', error);
        }
      }, 1000); // 1 FPS for fallback
    };

    // (Typing detection removed as unnecessary)

    const initWebRTCWithCanvas = async () => {
      try {
        setConnectionState('booting');
        setIsLoading(true);
        setError(null);

        // First, create the WebRTC session via API
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/sessions/${sessionId}/webrtc/proxy`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: sessionId,
              streamId: `stream_${sessionId}_${Date.now()}` // Unique stream identifier
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          
          // Handle rate limiting or circuit breaker response
          if (response.status === 429) {
            if (errorData.rateLimit) {
              setConnectionState('circuit-breaker'); // Reuse circuit-breaker UI for rate limiting
              setCircuitBreakerInfo({ retryAfter: errorData.retryAfter || 30 });
              throw new Error(`Rate limit exceeded. Retry in ${errorData.retryAfter || 30}s`);
            } else if (errorData.circuitBreaker) {
              setConnectionState('circuit-breaker');
              setCircuitBreakerInfo({ retryAfter: errorData.retryAfter || 300 });
              throw new Error(`Circuit breaker is open. Retry in ${errorData.retryAfter || 300}s`);
            }
          }
          
          throw new Error(errorData.error || 'Failed to create WebRTC session');
        }

        const sessionData = await response.json();
        console.log('WebRTC session created:', sessionData);

        // Get Docker session info to construct WebSocket URL
        const sessionResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/sessions/${sessionId}`
        );
        
        if (!sessionResponse.ok) {
          throw new Error('Failed to get session info');
        }

        const sessionInfo = await sessionResponse.json();
        const dockerPort = sessionInfo.dockerSession?.port;
        
        if (!dockerPort) {
          throw new Error('Docker session not available');
        }

        // Connect via WebSocket for streaming with session-specific URL
        const wsUrl = `ws://localhost:${dockerPort}/stream/websocket/${sessionId}`;
        console.log(`🔌 Connecting to WebSocket for session ${sessionId}:`, wsUrl);
        
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('WebSocket connected');
          setConnectionState('connected');
          setReconnectAttempts(0); // Reset reconnect attempts on successful connection
          setError(null); // Clear any previous errors
          setUseScreenshotFallback(false); // Disable fallback when WebSocket works
          // Start streaming
          if (ws) ws.send(JSON.stringify({ type: 'start_stream' }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // Verify this message is for the current session
            if (data.sessionId && data.sessionId !== sessionId) {
              console.warn(`🚫 Ignoring message from wrong session: ${data.sessionId} (current: ${sessionId})`);
              return;
            }
            
            switch (data.type) {
              case 'ready':
                console.log(`📡 Stream ready for session ${sessionId}`);
                setIsLoading(false);
                setIsStreaming(true);
                setConnectionState('connected');
                break;
                
              case 'frame':
                // Double-check session ID in frame data
                if (data.sessionId && data.sessionId !== sessionId) {
                  console.warn(`🚫 Ignoring frame from session ${data.sessionId}, current session is ${sessionId}`);
                  return;
                }
                
                // Render frame to canvas only if it's for the current session
                if (canvasRef.current && data.frame && currentSessionRef.current === sessionId) {
                  const ctx = canvasRef.current.getContext('2d');
                  if (ctx) {
                    const img = new Image();
                    img.onload = () => {
                      // Final check before rendering
                      if (currentSessionRef.current !== sessionId) {
                        console.warn(`🚫 Session changed during frame load, skipping render`);
                        return;
                      }
                      
                      // Update browser dimensions based on actual image size
                      if (img.naturalWidth && img.naturalHeight) {
                        setBrowserDimensions(prev => {
                          if (prev.width !== img.naturalWidth || prev.height !== img.naturalHeight) {
                            console.log(`📐 Browser dimensions updated: ${img.naturalWidth}x${img.naturalHeight}`);
                            return { width: img.naturalWidth, height: img.naturalHeight };
                          }
                          return prev;
                        });
                      }
                      ctx.drawImage(img, 0, 0, canvasRef.current!.width, canvasRef.current!.height);
                      setLastScreenshot(data.frame);
                    };
                    img.onerror = () => {
                      console.warn('Failed to load frame image');
                    };
                    img.src = `data:image/jpeg;base64,${data.frame}`;
                  }
                }
                break;
                
              case 'error':
                console.error('Stream error:', data.error);
                if (data.recoverable) {
                  // Don't show error for recoverable errors
                  console.log('Recoverable streaming error, continuing...');
                } else {
                  setError(data.error);
                  // Enable screenshot fallback on stream errors
                  setUseScreenshotFallback(true);
                  startScreenshotFallback();
                }
                break;
            }
          } catch (err) {
            console.error('Failed to process WebSocket message:', err);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setUseScreenshotFallback(true);
          startScreenshotFallback();
          // Don't immediately show error - might be temporary
          setTimeout(() => {
            if (!mounted || connectionState === 'disconnected') {
              setError('WebSocket connection failed');
            }
          }, 2000);
        };

        ws.onclose = (event) => {
          console.log('WebSocket disconnected:', event.code, event.reason);
          setConnectionState('disconnected');
          setIsStreaming(false);
          setUseScreenshotFallback(true);
          startScreenshotFallback();
          
          // Attempt to reconnect if it wasn't a clean close
          if (mounted && event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
            setConnectionState('reconnecting');
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000); // Exponential backoff, max 10s
            console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
            
            setTimeout(() => {
              if (mounted) {
                setReconnectAttempts(prev => prev + 1);
                initWebRTCWithCanvas();
              }
            }, delay);
          } else if (reconnectAttempts >= maxReconnectAttempts) {
            setError('Failed to reconnect after multiple attempts');
            setUseScreenshotFallback(true);
            startScreenshotFallback();
          }
        };

        // Alternative: Try native WebRTC with canvas capture
        if (window.RTCPeerConnection) {
          try {
            // Create peer connection
            pc = new RTCPeerConnection({
              iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            });
            pcRef.current = pc;

            // Create a canvas stream for WebRTC
            const canvas = canvasRef.current;
            if (canvas) {
              // Create media stream from canvas
              mediaStream = (canvas as HTMLCanvasElement & { captureStream: (frameRate?: number) => MediaStream }).captureStream(30); // 30 FPS
              
              // Add video track to peer connection
              const videoTrack = mediaStream.getVideoTracks()[0];
              if (videoTrack) {
                pc.addTrack(videoTrack, mediaStream);
              }
            }

            // Set up video element to receive stream
            pc.ontrack = (event) => {
              console.log('Received track:', event.track.kind);
              if (event.track.kind === 'video' && videoRef.current) {
                const stream = new MediaStream([event.track]);
                videoRef.current.srcObject = stream;
                // Hide canvas, show video
                if (canvasRef.current) canvasRef.current.style.display = 'none';
                if (videoRef.current) videoRef.current.style.display = 'block';
              }
            };

            pc.onconnectionstatechange = () => {
              console.log('WebRTC connection state:', pc?.connectionState);
              if (pc?.connectionState === 'connected') {
                setConnectionState('connected');
              } else if (pc?.connectionState === 'failed' || pc?.connectionState === 'closed') {
                setConnectionState('disconnected');
              }
            };
          } catch (rtcError) {
            console.log('WebRTC setup skipped:', rtcError);
            // Continue with WebSocket-only streaming
          }
        }
        
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize streaming';
        console.error('Streaming initialization error:', err);
        
        if (mounted) {
          // Handle circuit breaker case - don't retry immediately
          if (connectionState === 'circuit-breaker' && circuitBreakerInfo) {
            setError(`Rate limit exceeded. Retrying in ${circuitBreakerInfo.retryAfter}s`);
            // Don't auto-retry on rate limits - let user manually retry
            return;
          }
          
          // Regular retry with exponential backoff
          if (reconnectAttempts < maxReconnectAttempts) {
            setConnectionState('reconnecting');
            setReconnectAttempts(prev => prev + 1);
            
            console.log(`Retrying WebRTC connection in ${retryDelay}ms (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
            
            setTimeout(() => {
              if (mounted) {
                setConnectionState('connecting');
                initWebRTCWithCanvas();
                // Exponential backoff: double the delay, up to max
                setRetryDelay(prev => Math.min(prev * 2, maxRetryDelay));
              }
            }, retryDelay);
          } else {
            // Max retries reached
            setError(`${errorMessage} (Max retries reached)`);
            setConnectionState('disconnected');
            if (onError) {
              onError(new Error(errorMessage));
            }
          }
        }
      } finally {
        if (mounted && connectionState !== 'reconnecting') {
          setIsLoading(false);
        }
      }
    };

    initializationRef.current = true;
    initWebRTCWithCanvas();

    return () => {
      mounted = false;
      initializationRef.current = false;
      
      // (Typing detection listeners removed)
      
      // Cleanup timers
      if (screenshotInterval) clearInterval(screenshotInterval);
      
      // Stop streaming
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'stop_stream' }));
        ws.close();
      }
      
      if (pc && pc.signalingState !== 'closed') {
        pc.close();
      }
      
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
      
      wsRef.current = null;
      pcRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, retryTrigger]);

  const handleRemoteControl = async (event: React.MouseEvent | React.KeyboardEvent) => {
    if (!remoteControlEnabled || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    try {
      const control: { type: string; x?: number; y?: number; key?: string; text?: string; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean } = { type: '' };
      
      // Handle mouse clicks
      if (event.type === 'click' && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = ((event as React.MouseEvent).clientX - rect.left) / rect.width;
        const y = ((event as React.MouseEvent).clientY - rect.top) / rect.height;
        control.type = 'mouse_click';
        // Use actual browser dimensions instead of hardcoded values
        control.x = Math.round(x * browserDimensions.width);
        control.y = Math.round(y * browserDimensions.height);
        console.log(`Click coordinates: canvas(${x.toFixed(3)}, ${y.toFixed(3)}) -> browser(${control.x}, ${control.y})`);
        
        // Send control command via WebSocket
        wsRef.current.send(JSON.stringify({ 
          type: 'control', 
          control 
        }));
      }
      
      // Handle keyboard events
      if (event.type === 'keydown') {
        const keyEvent = event as React.KeyboardEvent;
        
        // Prevent browser shortcuts from interfering
        event.preventDefault();
        event.stopPropagation();
        
        control.type = 'key_press';
        control.key = keyEvent.key;
        control.ctrlKey = keyEvent.ctrlKey;
        control.altKey = keyEvent.altKey;
        control.shiftKey = keyEvent.shiftKey;
        
        console.log(`Key pressed: ${keyEvent.key} (Ctrl: ${keyEvent.ctrlKey}, Alt: ${keyEvent.altKey}, Shift: ${keyEvent.shiftKey})`);
        
        // Send control command via WebSocket
        wsRef.current.send(JSON.stringify({ 
          type: 'control', 
          control 
        }));
      }
    } catch (err) {
      console.error('Remote control error:', err);
    }
  };

  if (error) {
    return (
      <div className={`border rounded-lg p-4 ${
        connectionState === 'circuit-breaker' 
          ? 'bg-yellow-50 border-yellow-200' 
          : connectionState === 'reconnecting'
          ? 'bg-blue-50 border-blue-200'
          : 'bg-red-50 border-red-200'
      }`}>
        <p className={`${
          connectionState === 'circuit-breaker' 
            ? 'text-yellow-800' 
            : connectionState === 'reconnecting'
            ? 'text-blue-800'
            : 'text-red-800'
        }`}>
          {connectionState === 'circuit-breaker' && 'Circuit Breaker: '}
          {connectionState === 'reconnecting' && 'Reconnecting: '}
          {connectionState === 'disconnected' && 'Streaming Error: '}
          {error}
        </p>
        {connectionState === 'reconnecting' && (
          <p className="text-blue-600 text-sm mt-1">
            Attempt {reconnectAttempts}/{maxReconnectAttempts} - Next retry in {Math.ceil(retryDelay / 1000)}s
          </p>
        )}
        {connectionState !== 'reconnecting' && (
          <button 
            onClick={() => {
              setError(null);
              setConnectionState('connecting');
              setCircuitBreakerInfo(null);
              setReconnectAttempts(0);
              setRetryDelay(1000);
              // Trigger re-initialization
              setRetryTrigger(prev => prev + 1);
            }} 
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry Connection
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Live View</h3>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              connectionState === 'connected' ? 'bg-green-500' : 
              connectionState === 'booting' ? 'bg-blue-500 animate-pulse' :
              connectionState === 'connecting' || connectionState === 'reconnecting' ? 'bg-yellow-500 animate-pulse' : 
              'bg-red-500'
            }`} />
            <span className="text-sm text-gray-600">
              {connectionState === 'connected' ? 'Connected' : 
               connectionState === 'booting' ? 'Booting...' :
               connectionState === 'connecting' ? 'Connecting...' : 
               connectionState === 'reconnecting' ? 'Reconnecting...' :
               'Disconnected'}
               {useScreenshotFallback && connectionState === 'connected' ? ' (Fallback)' : ''}
            </span>
          </div>
          <button
            onClick={() => setRemoteControlEnabled(!remoteControlEnabled)}
            className={`px-4 py-2 rounded ${
              remoteControlEnabled
                ? 'bg-green-600 text-white hover:bg-green-700' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            disabled={!isStreaming}
          >
            {remoteControlEnabled ? 'Remote Control ON' : 'Remote Control OFF'}
          </button>
        </div>
      </div>

      <div className="relative bg-gray-900 rounded-lg overflow-hidden">
        {(isLoading || connectionState === 'booting') && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800 z-10">
            <div className="text-white text-center">
              {connectionState === 'booting' ? (
                <div className="flex flex-col items-center space-y-2">
                  <div className="text-lg">Browser is booting up</div>
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              ) : (
                <div>Establishing connection...</div>
              )}
            </div>
          </div>
        )}
        
        {useScreenshotFallback && !isLoading && (
          <div className="absolute top-2 right-2 bg-yellow-600 text-white px-2 py-1 rounded text-xs z-20">
            Screenshot Mode
          </div>
        )}
        
        {/* Canvas for WebSocket streaming with full remote control */}
        <canvas
          ref={canvasRef}
          width={browserDimensions.width}
          height={browserDimensions.height}
          className="w-full h-auto cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{ maxHeight: '600px' }}
          onClick={handleRemoteControl}
          onKeyDown={handleRemoteControl}
          tabIndex={0}
        />
        
        {/* Video element for native WebRTC with full remote control */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-auto focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{ maxHeight: '600px', display: 'none' }}
          onClick={handleRemoteControl}
          onKeyDown={handleRemoteControl}
          tabIndex={0}
        />
      </div>

      {isStreaming && (
        <p className="text-sm text-gray-600">
          {remoteControlEnabled 
            ? `Click on the screen to interact or click and type directly. ${useScreenshotFallback ? 'Screenshot fallback active' : 'Live streaming active'} - remote keyboard and mouse control enabled.`
            : 'Enable remote control to interact with the browser'}
        </p>
      )}
    </div>
  );
} 