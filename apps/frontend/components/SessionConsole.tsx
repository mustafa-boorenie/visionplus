'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient, ConsoleLog } from '@/lib/api-client';
import { Terminal, Maximize2, Minimize2, Trash2, Download } from 'lucide-react';

interface SessionConsoleProps {
  sessionId: string | null;
  expanded?: boolean;
  onToggleExpanded?: () => void;
  className?: string;
}

export function SessionConsole({ 
  sessionId, 
  expanded = false, 
  onToggleExpanded, 
  className = '' 
}: SessionConsoleProps) {
  const [logs, setLogs] = useState<ConsoleLog[]>([]);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const consoleRef = useRef<HTMLDivElement>(null);

  // Query existing console logs
  const { data: consoleData, refetch: refetchLogs } = useQuery({
    queryKey: ['consoleLogs', sessionId],
    queryFn: () => sessionId ? apiClient.getConsoleLogs(sessionId, 100) : null,
    enabled: !!sessionId,
    refetchInterval: 5000, // Refresh every 5 seconds as fallback
  });

  // Load existing logs when data is fetched
  useEffect(() => {
    if (consoleData?.logs) {
      setLogs(consoleData.logs);
    }
  }, [consoleData]);

  // Set up SSE connection for real-time console logs
  useEffect(() => {
    if (!sessionId || eventSource) return;

    const es = new EventSource(apiClient.getConsoleStreamUrl(sessionId));
    
    es.onopen = () => {
      console.log('[CONSOLE] Connected to console stream');
    };

    es.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'console_log' && data.log) {
          const newLog: ConsoleLog = {
            ...data.log,
            createdAt: new Date(data.log.timestamp || data.log.createdAt)
          };
          
          setLogs(prev => {
            // Avoid duplicates
            if (prev.some(log => log.id === newLog.id)) {
              return prev;
            }
            return [...prev, newLog];
          });
        }
      } catch (error) {
        console.error('[CONSOLE] Failed to parse SSE message:', error);
      }
    };

    es.onerror = (error) => {
      console.error('[CONSOLE] SSE error:', error);
    };

    setEventSource(es);

    return () => {
      es.close();
      setEventSource(null);
    };
  }, [sessionId]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Handle manual scroll to disable auto-scroll
  const handleScroll = () => {
    if (!consoleRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = consoleRef.current;
    const isAtBottom = scrollHeight - scrollTop <= clientHeight + 10; // 10px threshold
    setAutoScroll(isAtBottom);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const downloadLogs = () => {
    const logText = logs.map(log => 
      `[${new Date(log.createdAt).toISOString()}] ${log.level.toUpperCase()}: ${log.message}`
    ).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-${sessionId}-console-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-400';
      case 'warn': return 'text-yellow-400';
      case 'success': return 'text-green-400';
      case 'debug': return 'text-gray-400';
      case 'info':
      default: return 'text-blue-400';
    }
  };

  const getSourceIcon = (source?: string) => {
    switch (source) {
      case 'user': return '👤';
      case 'automation': return '🤖';
      case 'browser': return '🌐';
      case 'system':
      default: return '⚙️';
    }
  };

  if (!sessionId) {
    return (
      <div className={`bg-gray-900 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-2 mb-2">
          <Terminal size={20} className="text-gray-400" />
          <span className="text-gray-400">Console</span>
        </div>
        <div className="text-gray-500 text-center py-8">
          No session selected
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-900 rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Terminal size={20} className="text-green-400" />
          <span className="text-white font-medium">Session Console</span>
          <span className="text-gray-400 text-sm">({logs.length} logs)</span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={downloadLogs}
            className="p-1 hover:bg-gray-700 rounded"
            title="Download logs"
            disabled={logs.length === 0}
          >
            <Download size={16} className="text-gray-400" />
          </button>
          <button
            onClick={clearLogs}
            className="p-1 hover:bg-gray-700 rounded"
            title="Clear logs"
            disabled={logs.length === 0}
          >
            <Trash2 size={16} className="text-gray-400" />
          </button>
          {onToggleExpanded && (
            <button
              onClick={onToggleExpanded}
              className="p-1 hover:bg-gray-700 rounded"
              title={expanded ? "Minimize" : "Maximize"}
            >
              {expanded ? (
                <Minimize2 size={16} className="text-gray-400" />
              ) : (
                <Maximize2 size={16} className="text-gray-400" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Console Content */}
      <div
        ref={consoleRef}
        className={`font-mono text-sm overflow-y-auto bg-black ${
          expanded ? 'h-96' : 'h-48'
        }`}
        onScroll={handleScroll}
      >
        {logs.length === 0 ? (
          <div className="text-gray-500 p-4 text-center">
            No console logs yet...
          </div>
        ) : (
          <div className="p-2">
            {logs.map((log) => (
              <div key={log.id} className="mb-1 hover:bg-gray-800 px-2 py-1 rounded">
                <div className="flex items-start gap-2">
                  <span className="text-gray-500 text-xs whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleTimeString()}
                  </span>
                  <span className="text-xs">{getSourceIcon(log.source)}</span>
                  <span className={`text-xs font-bold ${getLogLevelColor(log.level)}`}>
                    [{log.level.toUpperCase()}]
                  </span>
                  <span className="text-gray-300 flex-1 break-words">
                    {log.message}
                  </span>
                </div>
                {log.data && (
                  <div className="ml-16 mt-1">
                    <details className="text-gray-400 text-xs">
                      <summary className="cursor-pointer hover:text-gray-300">
                        Data
                      </summary>
                      <pre className="mt-1 p-2 bg-gray-800 rounded overflow-x-auto">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>

      {/* Auto-scroll indicator */}
      {logs.length > 0 && !autoScroll && (
        <div className="p-2 border-t border-gray-700">
          <button
            onClick={() => {
              setAutoScroll(true);
              logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            📌 Scroll to bottom
          </button>
        </div>
      )}
    </div>
  );
}