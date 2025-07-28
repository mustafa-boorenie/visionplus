'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient, Session } from '@/lib/api-client';
import { Terminal, Play, Square, Camera, Download, Maximize2, Save, Plus, Layers, Minimize2, ChevronLeft, ChevronRight, FileCode } from 'lucide-react';

interface InteractiveModeProps {
  sessionId: string | null;
  session?: Session;
  onCreateSession: (startUrl?: string) => void;
}

interface CommandAction {
  id: string;
  command: string;
  timestamp: Date;
  success: boolean;
  screenshot?: string;
  error?: string;
}

export function InteractiveMode({ sessionId, session, onCreateSession }: InteractiveModeProps) {
  const [command, setCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [logs, setLogs] = useState<Array<{ type: 'command' | 'response' | 'error' | 'info'; text: string; timestamp: Date }>>([]);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [sessionIdInput, setSessionIdInput] = useState('');
  const [commandActions, setCommandActions] = useState<CommandAction[]>([]);
  const [showSequenceBuilder, setShowSequenceBuilder] = useState(false);
  const [latestScreenshot, setLatestScreenshot] = useState<string | null>(null);
  const [currentScreenshotIndex, setCurrentScreenshotIndex] = useState(0);
  const [isScreenshotExpanded, setIsScreenshotExpanded] = useState(false);
  const [showScreenshotTimeline, setShowScreenshotTimeline] = useState(false);
  const [screenshotTransitioning, setScreenshotTransitioning] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const screenshotTimelineRef = useRef<HTMLDivElement>(null);

  // Query command history
  const { data: historyData } = useQuery({
    queryKey: ['commandHistory', sessionId],
    queryFn: () => sessionId ? apiClient.getCommandHistory(sessionId) : null,
    enabled: !!sessionId,
  });
  
  // Query session details with commands and screenshots
  const { data: sessionDetails } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => sessionId ? apiClient.getSession(sessionId) : null,
    enabled: !!sessionId,
    refetchInterval: 5000, // Refresh every 5 seconds
  });
  
  // Load previous commands and screenshots when session details are loaded
  useEffect(() => {
    if (sessionDetails?.commands) {
      // Add previous commands to logs
      const previousLogs = sessionDetails.commands.map(cmd => ({
        type: 'command' as const,
        text: cmd.command,
        timestamp: new Date(cmd.startedAt)
      }));
      setLogs(prev => [...previousLogs, ...prev.filter(log => 
        !previousLogs.some(pl => pl.text === log.text && pl.timestamp.getTime() === log.timestamp.getTime())
      )]);
      
      // Add screenshots from session
      if (sessionDetails.screenshots) {
        const screenshotFilenames = sessionDetails.screenshots.map(s => s.filename);
        setScreenshots(prev => {
          const newScreenshots = [...prev];
          screenshotFilenames.forEach(filename => {
            if (!newScreenshots.includes(filename)) {
              newScreenshots.push(filename);
            }
          });
          return newScreenshots;
        });
      }
    }
  }, [sessionDetails]);

  // Update current screenshot index when screenshots change
  useEffect(() => {
    if (screenshots.length > 0) {
      setCurrentScreenshotIndex(screenshots.length - 1);
    }
  }, [screenshots]);

  // Handle screenshot navigation
  const navigateScreenshot = (index: number) => {
    if (index >= 0 && index < screenshots.length) {
      setScreenshotTransitioning(true);
      setTimeout(() => {
        setCurrentScreenshotIndex(index);
        setLatestScreenshot(screenshots[index]);
        setScreenshotTransitioning(false);
      }, 150);
    }
  };

  // Execute command mutation
  const executeCommandMutation = useMutation({
    mutationFn: ({ sessionId, command }: { sessionId: string; command: string }) =>
      apiClient.executeCommand(sessionId, command),
    onSuccess: (result) => {
      console.log('Command executed successfully:', result);
      
      // Add response to logs
      setLogs(prev => [...prev, {
        type: 'response',
        text: `✓ Command executed in ${result.executionTime}ms`,
        timestamp: new Date()
      }]);
      
      // Add screenshots
      if (result.result && result.result.screenshots && result.result.screenshots.length > 0) {
        console.log('Adding screenshots from result:', result.result.screenshots);
        const filenames = result.result.screenshots.map((s: string) => 
          s.includes('/') ? s.split('/').pop()! : s
        );
        setScreenshots(prev => {
          const newScreenshots = [...prev];
          filenames.forEach((filename: string) => {
            if (!newScreenshots.includes(filename)) {
              newScreenshots.push(filename);
            }
          });
          return newScreenshots;
        });
      }
      
      // Log step results
      if (result.result && result.result.stepResults) {
        result.result.stepResults.forEach(step => {
          setLogs(prev => [...prev, {
            type: step.success ? 'info' : 'error',
            text: `${step.success ? '✓' : '✗'} ${step.step} (${step.duration}ms)${step.error ? `: ${step.error}` : ''}`,
            timestamp: new Date()
          }]);
        });
      }
      
      // Create command action for sequence builder
      const action: CommandAction = {
        id: `action-${Date.now()}`,
        command: command,
        timestamp: new Date(),
        success: result.result?.success || false,
        screenshot: result.result?.screenshots?.[0],
        error: result.result?.errors?.join(', ')
      };
      setCommandActions(prev => [...prev, action]);
    },
    onError: (error: Error) => {
      console.error('Command execution error:', error);
      setLogs(prev => [...prev, {
        type: 'error',
        text: `Error: ${error.message || 'Unknown error occurred'}`,
        timestamp: new Date()
      }]);
      
      // Still create a failed action
      const action: CommandAction = {
        id: `action-${Date.now()}`,
        command: command,
        timestamp: new Date(),
        success: false,
        error: error.message
      };
      setCommandActions(prev => [...prev, action]);
    }
  });

  // Server-Sent Events connection
  useEffect(() => {
    if (sessionId && !eventSource) {
      let reconnectTimeout: NodeJS.Timeout | null = null;
      let reconnectAttempts = 0;
      const maxReconnectAttempts = 5;
      const reconnectDelay = 1000; // Start with 1 second

      const connect = () => {
        const es = apiClient.createEventSource(sessionId);
        
        es.onopen = () => {
          reconnectAttempts = 0; // Reset attempts on successful connection
          setLogs(prev => [...prev, {
            type: 'info',
            text: '🔌 Connected to session',
            timestamp: new Date()
          }]);
        };

        es.onmessage = (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
              case 'connected':
                console.log('SSE connected:', data);
                break;
              case 'log':
                setLogs(prev => [...prev, {
                  type: data.level === 'error' ? 'error' : 'info',
                  text: data.message,
                  timestamp: new Date()
                }]);
                break;
              case 'screenshot':
                // Handle real-time screenshot streaming
                if (data.filename) {
                  console.log('Received screenshot event:', data.filename);
                  setLogs(prev => [...prev, {
                    type: 'info',
                    text: `📸 Screenshot captured: ${data.filename}`,
                    timestamp: new Date()
                  }]);
                  // Ensure we're adding the filename, not the full path
                  const filename = data.filename.includes('/') 
                    ? data.filename.split('/').pop() 
                    : data.filename;
                  setScreenshots(prev => {
                    // Avoid duplicates
                    if (!prev.includes(filename!)) {
                      return [...prev, filename!];
                    }
                    return prev;
                  });
                  // Update latest screenshot
                  setLatestScreenshot(filename!);
                }
                break;
              case 'status':
                setLogs(prev => [...prev, {
                  type: 'info',
                  text: `Status: ${data.status}`,
                  timestamp: new Date()
                }]);
                break;
              case 'completed':
                if (data.result && data.result.screenshots) {
                  // Process screenshots to ensure we have filenames only
                  const filenames = data.result.screenshots.map((s: string) => 
                    s.includes('/') ? s.split('/').pop() : s
                  );
                  setScreenshots(prev => {
                    const newScreenshots = [...prev];
                    filenames.forEach((filename: string) => {
                      if (!newScreenshots.includes(filename)) {
                        newScreenshots.push(filename);
                      }
                    });
                    return newScreenshots;
                  });
                }
                break;
            }
          } catch (error) {
            console.error('Failed to parse SSE message:', error);
          }
        };

        es.onerror = (error) => {
          console.error('SSE error', error);
          setLogs(prev => [...prev, {
            type: 'error',
            text: '❌ Connection error - attempting to reconnect...',
            timestamp: new Date()
          }]);
          
          es.close();
          setEventSource(null);
          
          // Attempt to reconnect with exponential backoff
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            const delay = reconnectDelay * Math.pow(2, reconnectAttempts - 1);
            console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
            
            reconnectTimeout = setTimeout(() => {
              connect();
            }, delay);
          } else {
            setLogs(prev => [...prev, {
              type: 'error',
              text: '❌ Failed to reconnect after multiple attempts',
              timestamp: new Date()
            }]);
          }
        };

        setEventSource(es);
      };

      connect();

      return () => {
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
        }
      };
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [sessionId, eventSource]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleExecuteCommand = () => {
    if (!command.trim() || !sessionId) return;
    
    // Add to command history
    setCommandHistory(prev => [...prev, command]);
    setHistoryIndex(-1);
    
    // Add command to logs
    setLogs(prev => [...prev, {
      type: 'command',
      text: `> ${command}`,
      timestamp: new Date()
    }]);
    
    // Execute command
    executeCommandMutation.mutate({ sessionId, command });
    
    // Clear input
    setCommand('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleExecuteCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setCommand(commandHistory[commandHistory.length - 1 - newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCommand(commandHistory[commandHistory.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCommand('');
      }
    }
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const currentScreenshot = screenshots[currentScreenshotIndex];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-gray-800 p-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Terminal className="w-5 h-5 text-green-400" />
          <h2 className="text-lg font-bold text-white">Interactive Mode</h2>
          {session && (
            <span className={`px-2 py-1 text-xs rounded ${
              session.status === 'running' ? 'bg-green-600' : 
              session.status === 'error' ? 'bg-red-600' : 'bg-gray-600'
            } text-white`}>
              {session.status}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {sessionId && (
            <button
              onClick={() => setShowSequenceBuilder(!showSequenceBuilder)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              title="Create sequence from command history"
            >
              <FileCode className="w-4 h-4" />
              <span className="text-sm">Build Sequence</span>
            </button>
          )}
          
          {!sessionId && (
            <button
              onClick={() => onCreateSession()}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              <Play className="w-4 h-4" />
              Start Session
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Console */}
        <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
          {/* Logs */}
          <div className="flex-1 overflow-y-auto p-4 font-mono text-sm">
            {logs.length === 0 ? (
              <div className="text-gray-500">
                {sessionId ? 'Session ready. Enter a command below...' : 'Start a session to begin...'}
              </div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className={`mb-2 ${
                  log.type === 'command' ? 'text-cyan-400' :
                  log.type === 'response' ? 'text-green-400' :
                  log.type === 'error' ? 'text-red-400' : 'text-gray-400'
                }`}>
                  <span className="text-gray-600">[{formatTimestamp(log.timestamp)}]</span> {log.text}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>

                      {/* Command Input */}
            <div className="border-t border-gray-700 p-4 flex-shrink-0">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={sessionId ? "Enter command (e.g., 'navigate to google.com')" : "Start a session first"}
                disabled={!sessionId || executeCommandMutation.isPending}
                className="flex-1 px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded focus:outline-none focus:border-cyan-500 disabled:opacity-50"
              />
              <button
                onClick={handleExecuteCommand}
                disabled={!sessionId || !command.trim() || executeCommandMutation.isPending}
                className="px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {executeCommandMutation.isPending ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Screenshot Viewer */}
        {screenshots.length > 0 && (
          <div className="relative bg-gray-800 flex flex-col overflow-hidden" style={{ width: isScreenshotExpanded ? '60%' : '400px' }}>
            {/* Screenshot Header */}
            <div className="p-3 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Camera className="w-4 h-4" />
                Live View
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">
                  {currentScreenshotIndex + 1} / {screenshots.length}
                </span>
                <button
                  onClick={() => setIsScreenshotExpanded(!isScreenshotExpanded)}
                  className="p-1 text-gray-400 hover:text-white transition-colors"
                >
                  {isScreenshotExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Main Screenshot Display */}
            <div 
              className="relative flex-1 bg-gray-900 overflow-hidden"
              onMouseEnter={() => setShowScreenshotTimeline(true)}
              onMouseLeave={() => setShowScreenshotTimeline(false)}
            >
              {/* Screenshot Container with 16:9 Aspect Ratio */}
              <div className="relative w-full h-full flex items-center justify-center">
                <div 
                  className={`relative transition-opacity duration-300 ${
                    screenshotTransitioning ? 'opacity-0' : 'opacity-100'
                  }`}
                  style={{ 
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {currentScreenshot && sessionId && (
                    <div className="relative w-full h-full overflow-auto bg-gray-100">
                      <img
                        src={apiClient.getScreenshotUrl(sessionId, currentScreenshot)}
                        alt={`Screenshot ${currentScreenshotIndex + 1}`}
                        className="w-full h-full"
                        style={{
                          objectFit: 'contain',
                          objectPosition: 'center'
                        }}
                        onClick={() => setSelectedScreenshot(currentScreenshot)}
                      />
                    </div>
                  )}
                </div>

                {/* Navigation Arrows */}
                {screenshots.length > 1 && (
                  <>
                    <button
                      onClick={() => navigateScreenshot(currentScreenshotIndex - 1)}
                      disabled={currentScreenshotIndex === 0}
                      className={`absolute left-2 p-2 bg-gray-900 bg-opacity-70 rounded-full text-white transition-all ${
                        currentScreenshotIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-opacity-90'
                      }`}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => navigateScreenshot(currentScreenshotIndex + 1)}
                      disabled={currentScreenshotIndex === screenshots.length - 1}
                      className={`absolute right-2 p-2 bg-gray-900 bg-opacity-70 rounded-full text-white transition-all ${
                        currentScreenshotIndex === screenshots.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-opacity-90'
                      }`}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>

              {/* Screenshot Timeline */}
              <div 
                ref={screenshotTimelineRef}
                className={`absolute bottom-0 left-0 right-0 bg-gray-900 bg-opacity-90 transition-all duration-300 ${
                  showScreenshotTimeline ? 'h-16 opacity-100' : 'h-0 opacity-0'
                }`}
              >
                <div className="h-full flex items-center px-4 overflow-x-auto">
                  <div className="flex gap-2">
                    {screenshots.map((screenshot, index) => (
                      <button
                        key={index}
                        onClick={() => navigateScreenshot(index)}
                        className={`relative flex-shrink-0 h-10 w-16 rounded overflow-hidden border-2 transition-all ${
                          index === currentScreenshotIndex 
                            ? 'border-cyan-500 scale-110' 
                            : 'border-gray-700 hover:border-gray-500'
                        }`}
                      >
                        <img
                          src={sessionId ? apiClient.getScreenshotUrl(sessionId, screenshot) : ''}
                          alt={`Thumbnail ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        {index === screenshots.length - 1 && (
                          <div className="absolute top-0 right-0 w-2 h-2 bg-green-500 rounded-full m-1" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>


          </div>
        )}
      </div>

      {/* Screenshot Modal */}
      {selectedScreenshot && sessionId && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-8"
          onClick={() => setSelectedScreenshot(null)}
        >
          <div className="relative max-w-full max-h-full">
            <img
              src={apiClient.getScreenshotUrl(sessionId, selectedScreenshot)}
              alt="Full size screenshot"
              className="max-w-full max-h-full object-contain"
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                const link = document.createElement('a');
                link.href = apiClient.getScreenshotUrl(sessionId, selectedScreenshot);
                link.download = selectedScreenshot;
                link.click();
              }}
              className="absolute top-4 right-4 p-2 bg-gray-800 text-white rounded hover:bg-gray-700"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Sequence Builder Panel */}
      {showSequenceBuilder && (
        <div className="fixed right-0 top-0 h-full w-96 bg-gray-800 border-l border-gray-700 shadow-xl z-40 flex flex-col">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Layers className="w-5 h-5" />
              Sequence Builder
            </h3>
            <button
              onClick={() => setShowSequenceBuilder(false)}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            {commandActions.length > 0 && (
              <p className="text-gray-400 text-sm mb-4">
                Review and edit your commands below. Click on any command to modify it.
              </p>
            )}
            <div className="space-y-3">
              {commandActions.map((action, index) => (
                <div
                  key={action.id}
                  className={`p-3 rounded border ${
                    action.success 
                      ? 'bg-gray-700 border-gray-600' 
                      : 'bg-red-900/20 border-red-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="text-sm text-gray-400 mb-1">
                        Step {index + 1}
                      </div>
                      <input
                        type="text"
                        value={action.command}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          setCommandActions(prev => prev.map(a => 
                            a.id === action.id ? { ...a, command: newValue } : a
                          ));
                        }}
                        className="w-full px-2 py-1 bg-gray-600 text-white font-mono text-sm rounded border border-gray-500 focus:border-blue-400 focus:outline-none"
                      />
                      {action.error && (
                        <div className="text-red-400 text-xs mt-1">
                          {action.error}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setCommandActions(prev => prev.filter(a => a.id !== action.id));
                      }}
                      className="text-red-400 hover:text-red-300 ml-2"
                    >
                      ✕
                    </button>
                  </div>
                  {action.screenshot && (
                    <img
                      src={apiClient.getScreenshotUrl(sessionId!, action.screenshot)}
                      alt="Action screenshot"
                      className="mt-2 w-full rounded border border-gray-700"
                    />
                  )}
                </div>
              ))}
            </div>
            
            {commandActions.length === 0 && (
              <div className="text-gray-500 text-center py-8">
                Execute commands to build a sequence
              </div>
            )}
          </div>
          
          <div className="p-4 border-t border-gray-700">
            <input
              type="text"
              placeholder="Sequence name"
              className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded mb-3"
              id="sequence-name"
            />
            <button
              onClick={async () => {
                const nameInput = document.getElementById('sequence-name') as HTMLInputElement;
                const name = nameInput.value.trim();
                if (name && commandActions.length > 0) {
                  try {
                    await apiClient.saveSequence({
                      metadata: {
                        id: `seq-${Date.now()}`,
                        name,
                        description: `Sequence created from ${commandActions.length} actions`,
                        createdAt: new Date().toISOString(),
                      },
                      script: {
                        name,
                        description: `Automated sequence with ${commandActions.length} steps`,
                        actions: commandActions.map((a, index) => ({
                          type: 'command',
                          command: a.command,
                          description: `Step ${index + 1}: ${a.command}`
                        }))
                      }
                    });
                    setCommandActions([]);
                    nameInput.value = '';
                    setShowSequenceBuilder(false);
                  } catch (error) {
                    console.error('Failed to save sequence:', error);
                  }
                }
              }}
              disabled={commandActions.length === 0}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              Save Sequence
            </button>
          </div>
        </div>
      )}
      

    </div>
  );
} 