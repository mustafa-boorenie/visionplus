'use client';

import React, { useEffect, useState, useRef } from 'react';
import { WebRTCViewer } from './WebRTCViewer';

interface WebRTCSessionManagerProps {
  activeSessionId: string | null;
  availableSessions: Array<{ id: string; name?: string }>;
  onError?: (error: Error) => void;
}

/**
 * Manages multiple WebRTC sessions ensuring only one stream is active at a time
 * Based on WebRTC best practices for multiple peer connections
 */
export function WebRTCSessionManager({ 
  activeSessionId, 
  availableSessions, 
  onError 
}: WebRTCSessionManagerProps) {
  const [streamingSessions, setStreamingSessions] = useState<Set<string>>(new Set());
  const activeStreamRef = useRef<string | null>(null);
  const previousSessionRef = useRef<string | null>(null);

  // Cleanup function to stop all streams except the active one
  const cleanupInactiveSessions = () => {
    streamingSessions.forEach(sessionId => {
      if (sessionId !== activeSessionId) {
        console.log(`Stopping inactive session stream: ${sessionId}`);
        // The WebRTCViewer component will handle its own cleanup when unmounted
        setStreamingSessions(prev => {
          const newSet = new Set(prev);
          newSet.delete(sessionId);
          return newSet;
        });
      }
    });
  };

  // Monitor active session changes
  useEffect(() => {
    if (activeSessionId !== previousSessionRef.current) {
      console.log(`Active session changed from ${previousSessionRef.current} to ${activeSessionId}`);
      
      // Clean up previous session streams
      if (previousSessionRef.current) {
        cleanupInactiveSessions();
      }
      
      // Update tracking
      previousSessionRef.current = activeSessionId;
      activeStreamRef.current = activeSessionId;
      
      // Add new active session to streaming set
      if (activeSessionId) {
        setStreamingSessions(new Set([activeSessionId]));
      } else {
        setStreamingSessions(new Set());
      }
    }
  }, [activeSessionId]);

  // Session cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('WebRTCSessionManager unmounting, cleaning up all sessions');
      setStreamingSessions(new Set());
    };
  }, []);

  if (!activeSessionId) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
        <div className="text-center text-gray-500">
          <div className="text-lg font-medium">No Session Selected</div>
          <div className="text-sm">Select a session to view live browser stream</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Session indicator */}
      <div className="absolute top-2 left-2 z-10 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs">
        Session: {activeSessionId.substring(0, 8)}...
      </div>
      
      {/* Active streaming sessions counter */}
      <div className="absolute top-2 right-2 z-10 bg-blue-600 text-white px-2 py-1 rounded text-xs">
        Active Streams: {streamingSessions.size}
      </div>

      {/* Only render WebRTCViewer for the active session */}
      {activeSessionId && (
        <WebRTCViewer
          key={`webrtc-${activeSessionId}`} // Force re-mount on session change
          sessionId={activeSessionId}
          onError={(error) => {
            console.error(`WebRTC error for session ${activeSessionId}:`, error);
            
            // Remove failed session from streaming set
            setStreamingSessions(prev => {
              const newSet = new Set(prev);
              newSet.delete(activeSessionId);
              return newSet;
            });
            
            onError?.(error);
          }}
        />
      )}
      
      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-2 left-2 z-10 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs">
          <div>Streaming: {Array.from(streamingSessions).join(', ')}</div>
          <div>Available: {availableSessions.length}</div>
        </div>
      )}
    </div>
  );
}