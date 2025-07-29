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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [remoteControlEnabled, setRemoteControlEnabled] = useState(false);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'reconnecting'>('connecting');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    let mounted = true;
    let pc: RTCPeerConnection | null = null;
    let ws: WebSocket | null = null;
    let mediaStream: MediaStream | null = null;

    const initWebRTCWithCanvas = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // First, create the WebRTC session via API
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/sessions/${sessionId}/webrtc/proxy`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: sessionId
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
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

        // Connect via WebSocket for streaming
        const wsUrl = `ws://localhost:${dockerPort}/stream/websocket/${sessionId}`;
        console.log('Connecting to WebSocket:', wsUrl);
        
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('WebSocket connected');
          setConnectionState('connected');
          setReconnectAttempts(0); // Reset reconnect attempts on successful connection
          setError(null); // Clear any previous errors
          // Start streaming
          if (ws) ws.send(JSON.stringify({ type: 'start_stream' }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
              case 'ready':
                console.log('Stream ready');
                setIsLoading(false);
                setIsStreaming(true);
                break;
                
              case 'frame':
                // Render frame to canvas
                if (canvasRef.current && data.frame) {
                  const ctx = canvasRef.current.getContext('2d');
                  if (ctx) {
                    const img = new Image();
                    img.onload = () => {
                      ctx.drawImage(img, 0, 0, canvasRef.current!.width, canvasRef.current!.height);
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
                }
                break;
            }
          } catch (err) {
            console.error('Failed to process WebSocket message:', err);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setConnectionState('disconnected');
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
          setError(errorMessage);
          if (onError) {
            onError(new Error(errorMessage));
          }
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initWebRTCWithCanvas();

    return () => {
      mounted = false;
      
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
  }, [sessionId, onError]);

  const handleRemoteControl = async (event: React.MouseEvent | React.KeyboardEvent) => {
    if (!remoteControlEnabled || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    try {
      const control: { type: string; x?: number; y?: number; key?: string; text?: string } = { type: '' };
      
      if (event.type === 'click' && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = ((event as React.MouseEvent).clientX - rect.left) / rect.width;
        const y = ((event as React.MouseEvent).clientY - rect.top) / rect.height;
        control.type = 'mouse_click';
        control.x = Math.round(x * 1920); // Assuming 1920x1080 resolution
        control.y = Math.round(y * 1080);
      } else if (event.type === 'keydown') {
        control.type = 'key';
        control.key = (event as React.KeyboardEvent).key;
      }

      // Send control command via WebSocket
      wsRef.current.send(JSON.stringify({ 
        type: 'control', 
        control 
      }));
    } catch (err) {
      console.error('Remote control error:', err);
    }
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Streaming Error: {error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Live Browser View</h3>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              connectionState === 'connected' ? 'bg-green-500' : 
              connectionState === 'connecting' || connectionState === 'reconnecting' ? 'bg-yellow-500 animate-pulse' : 
              'bg-red-500'
            }`} />
            <span className="text-sm text-gray-600">
              {connectionState === 'connected' ? 'Connected' : 
               connectionState === 'connecting' ? 'Connecting...' : 
               connectionState === 'reconnecting' ? 'Reconnecting...' :
               'Disconnected'}
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
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800 z-10">
            <div className="text-white">Establishing connection...</div>
          </div>
        )}
        
        {/* Canvas for WebSocket streaming */}
        <canvas
          ref={canvasRef}
          width={1920}
          height={1080}
          className="w-full h-auto cursor-pointer"
          style={{ maxHeight: '600px' }}
          onClick={handleRemoteControl}
          onKeyDown={handleRemoteControl}
          tabIndex={remoteControlEnabled ? 0 : -1}
        />
        
        {/* Video element for native WebRTC (hidden by default) */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-auto"
          style={{ maxHeight: '600px', display: 'none' }}
          onClick={handleRemoteControl}
          onKeyDown={handleRemoteControl}
          tabIndex={remoteControlEnabled ? 0 : -1}
        />
      </div>

      {isStreaming && (
        <p className="text-sm text-gray-600">
          {remoteControlEnabled 
            ? 'Click on the screen to control the browser' 
            : 'Enable remote control to interact with the browser'}
        </p>
      )}
    </div>
  );
} 