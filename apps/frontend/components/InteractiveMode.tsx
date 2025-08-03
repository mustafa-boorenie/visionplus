'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient, Session } from '@/lib/api-client';
import { Terminal, Play, Square, Camera, Download, Maximize2, Save, Plus, Layers, Minimize2, ChevronLeft, ChevronRight, FileCode, Sparkles, FolderOpen, List, MonitorPlay } from 'lucide-react';
import { WebRTCViewer } from './WebRTCViewer';
import { WebRTCSessionManager } from './WebRTCSessionManager';
import { IntelligentInputProcessor } from './IntelligentInputProcessor';
import { SessionConsole } from './SessionConsole';

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
  const [showAIProcessor, setShowAIProcessor] = useState(false);
  const [screenshotTransitioning, setScreenshotTransitioning] = useState(false);
  const [isIntelligentProcessing, setIsIntelligentProcessing] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(sessionId);
  const [consoleExpanded, setConsoleExpanded] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const screenshotTimelineRef = useRef<HTMLDivElement>(null);

  // Query sessions list
  const { data: sessionsData, refetch: refetchSessions } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => apiClient.listSessions(),
    refetchInterval: 5000,
  });

  // Query sequences list
  const { data: sequencesData, refetch: refetchSequences } = useQuery({
    queryKey: ['sequences'],
    queryFn: () => apiClient.listSequences(),
    refetchInterval: 30000, // Less frequent for sequences
  });

  // Query command history
  const { data: historyData } = useQuery({
    queryKey: ['commandHistory', selectedSessionId],
    queryFn: () => selectedSessionId ? apiClient.getCommandHistory(selectedSessionId) : null,
    enabled: !!selectedSessionId,
  });
  
  // Query session details with commands and screenshots
  const { data: sessionDetails } = useQuery({
    queryKey: ['session', selectedSessionId],
    queryFn: () => selectedSessionId ? apiClient.getSession(selectedSessionId) : null,
    enabled: !!selectedSessionId,
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

  // Sidebar handlers
  const handleNewSession = () => {
    onCreateSession();
    refetchSessions();
  };

  const handleSelectSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    // Clear current state when switching sessions
    setLogs([]);
    setScreenshots([]);
    setCommandActions([]);
  };

  const handleExecuteSequence = async (sequenceName: string) => {
    if (selectedSessionId) {
      try {
        await apiClient.executeSequence(selectedSessionId, sequenceName);
        refetchSessions();
      } catch (error) {
        console.error('Error executing sequence:', error);
      }
    } else {
      // Create new session and execute sequence
      try {
        await apiClient.executeSequenceWithNewSession(sequenceName);
        refetchSessions();
      } catch (error) {
        console.error('Error executing sequence with new session:', error);
      }
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

  const handleExecuteCommand = async () => {
    if (!command.trim() || !sessionId) return;
    
    setIsIntelligentProcessing(true);
    
    // Add to command history
    setCommandHistory(prev => [...prev, command]);
    setHistoryIndex(-1);
    
    // Add command to logs
    setLogs(prev => [...prev, {
      type: 'command',
      text: `🤖 AI Processing: "${command}"`,
      timestamp: new Date()
    }]);
    
    try {
      // Step 1: Get current HTML and screenshot
      setLogs(prev => [...prev, {
        type: 'info',
        text: 'Capturing page context...',
        timestamp: new Date()
      }]);

      const contextResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/sessions/${sessionId}/context`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        }
      );

      if (!contextResponse.ok) {
        throw new Error('Failed to get page context');
      }

      const context = await contextResponse.json();
      
      // Step 2: Send to OpenAI API for intelligent processing
      setLogs(prev => [...prev, {
        type: 'info',
        text: 'Processing with AI...',
        timestamp: new Date()
      }]);

      const aiResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/intelligent/process-input`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            userInput: command.trim(),
            html: context.html,
            screenshot: context.screenshot,
            url: context.url,
            timestamp: Date.now()
          })
        }
      );

      if (!aiResponse.ok) {
        const errorData = await aiResponse.json();
        throw new Error(errorData.error || 'Failed to process input with AI');
      }

      const aiResult = await aiResponse.json();
      
      // Step 3: Execute the generated script
      setLogs(prev => [...prev, {
        type: 'info',
        text: `Executing ${aiResult.script.steps?.length || 0} automation steps...`,
        timestamp: new Date()
      }]);

      const executionResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/intelligent/execute-script`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            script: aiResult.script,
            executionId: aiResult.executionId
          })
        }
      );

      if (!executionResponse.ok) {
        const errorData = await executionResponse.json();
        throw new Error(errorData.error || 'Failed to execute automation script');
      }

      const executionResult = await executionResponse.json();
      
      // Success feedback
      setLogs(prev => [...prev, {
        type: 'response',
        text: `✓ Successfully executed ${executionResult.completedSteps}/${executionResult.totalSteps} steps`,
        timestamp: new Date()
      }]);

      if (executionResult.errors.length > 0) {
        setLogs(prev => [...prev, {
          type: 'error',
          text: `⚠️ ${executionResult.errors.length} steps had errors`,
          timestamp: new Date()
        }]);
      }

    } catch (error) {
      console.error('Intelligent automation error:', error);
      setLogs(prev => [...prev, {
        type: 'error',
        text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      }]);
    } finally {
      setIsIntelligentProcessing(false);
    }
    
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
    <div className="h-screen flex bg-gray-900">
      {/* Left Sidebar */}
      <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <Terminal className="w-6 h-6 text-green-400" />
            <h1 className="text-xl font-bold text-white">AI Playwright</h1>
          </div>
        </div>

        {/* New Session Button */}
        <div className="p-4 border-b border-gray-700">
          <button
            onClick={handleNewSession}
            className="w-full flex items-center gap-3 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            New Session
          </button>
        </div>

        {/* Sequences Section */}
        <div className="border-b border-gray-700">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Sequences</h3>
              <button
                onClick={() => setShowSequenceBuilder(true)}
                className="p-1 text-gray-400 hover:text-white transition-colors"
                title="New Sequence"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {sequencesData?.sequences.map((sequence) => (
                <button
                  key={sequence.metadata.id}
                  onClick={() => handleExecuteSequence(sequence.metadata.name)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left text-gray-300 hover:bg-gray-700 rounded-md transition-colors"
                >
                  <FileCode className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{sequence.metadata.name}</div>
                    {sequence.metadata.description && (
                      <div className="text-xs text-gray-500 truncate">{sequence.metadata.description}</div>
                    )}
                  </div>
                </button>
              ))}
              {(!sequencesData?.sequences || sequencesData.sequences.length === 0) && (
                <div className="text-sm text-gray-500 italic py-2">No sequences available</div>
              )}
            </div>
          </div>
        </div>

        {/* Sessions Section */}
        <div className="flex-1 overflow-hidden">
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Active Sessions</h3>
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {sessionsData?.sessions.map((sessionItem) => (
                <button
                  key={sessionItem.id}
                  onClick={() => handleSelectSession(sessionItem.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-md transition-colors ${
                    selectedSessionId === sessionItem.id 
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <MonitorPlay className="w-4 h-4 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">Session {sessionItem.id.slice(-8)}</div>
                    <div className="text-xs opacity-75 truncate">
                      {sessionItem.currentUrl || 'No URL'}
                    </div>
                  </div>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    sessionItem.status === 'running' ? 'bg-green-400' : 
                    sessionItem.status === 'error' ? 'bg-red-400' : 'bg-gray-400'
                  }`} />
                </button>
              ))}
              {(!sessionsData?.sessions || sessionsData.sessions.length === 0) && (
                <div className="text-sm text-gray-500 italic py-2">No active sessions</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedSessionId ? (
          <div>
            {/* Header for selected session */}
            <div className="bg-gray-800 p-4 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <Terminal className="w-5 h-5 text-green-400" />
                <h2 className="text-lg font-bold text-white">Session {selectedSessionId.slice(-8)}</h2>
                {sessionDetails && (
                  <span className={`px-2 py-1 text-xs rounded ${
                    sessionDetails.status === 'running' ? 'bg-green-600' : 
                    sessionDetails.status === 'error' ? 'bg-red-600' : 'bg-gray-600'
                  } text-white`}>
                    {sessionDetails.status}
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSequenceBuilder(!showSequenceBuilder)}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  title="Create sequence from command history"
                >
                  <FileCode className="w-4 h-4" />
                  <span className="text-sm">Build Sequence</span>
                </button>
                <button
                  onClick={() => setShowAIProcessor(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                  title="AI-Generate Script"
                >
                  <Sparkles className="w-4 h-4" />
                  <span className="text-sm">AI Script</span>
                </button>
              </div>
            </div>

            {/* Main session content */}
            <div className="flex-1 flex overflow-hidden">
        {/* Console */}
        <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
          {/* Session Console Component */}
          <div className="flex-1 p-3">
            <SessionConsole
              sessionId={selectedSessionId}
              expanded={consoleExpanded}
              onToggleExpanded={() => setConsoleExpanded(!consoleExpanded)}
              className="h-full"
            />
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
                  placeholder={sessionId ? "Enter command (e.g., 'search for red socks', 'fill contact form')" : "Start a session first"}
                  disabled={!sessionId || isIntelligentProcessing}
                  className="flex-1 px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                />
                <button
                  onClick={handleExecuteCommand}
                  disabled={!sessionId || !command.trim() || isIntelligentProcessing}
                  className="px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isIntelligentProcessing ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Play className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
        </div>

        {/* WebRTC Session Manager - Live browser streaming with session isolation */}
        <div className="relative bg-gray-800 p-3 m-3 flex flex-col overflow-hidden rounded-lg" style={{ width: '800px', height: '500px' }}>
          <div className="flex-1 p-5">
            <WebRTCSessionManager
              activeSessionId={selectedSessionId}
              availableSessions={sessionsData?.sessions?.map(s => ({ id: s.id, name: `Session ${s.id.substring(0, 8)}` })) || []}
              onError={(error: Error) => {
                setLogs(prev => [...prev, {
                  type: 'error',
                  text: `WebRTC Error: ${error.message}`,
                  timestamp: new Date()
                }]);
              }}
            />
          </div>
        </div>

        {/* Intelligent Input Processor */}
        {showAIProcessor && (
          <div className="relative bg-gray-800 flex flex-col overflow-hidden rounded-lg" style={{ width: '800px', height: '500px' }}>
            <div className="p-3 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Square className="w-4 h-4" />
                Intelligent Input Processor
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-blue-400">
                  ● Intelligent
                </span>
              </div>
            </div>
            
                         <div className="flex-1 p-2">
               <button onClick={() => setShowAIProcessor(false)} className="absolute top-2 right-2 text-gray-400 hover:text-white">✕</button>
               <IntelligentInputProcessor
                 sessionId={sessionId!}
                 onScriptGenerated={(result) => {
                   setLogs(prev => [...prev, 
                     {
                       type: 'info',
                       text: `AI Generated Script: "${result.userInput}"`,
                       timestamp: new Date()
                     },
                     {
                       type: 'response',
                       text: `✓ Executed automation script successfully`,
                       timestamp: new Date()
                     }
                   ]);
                 }}
                 onError={(error: Error) => {
                   setLogs(prev => [...prev, {
                     type: 'error',
                     text: `Intelligent Input Error: ${error.message}`,
                     timestamp: new Date()
                   }]);
                 }}
               />
             </div>
          </div>
        )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <Terminal className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No session selected</p>
              <p className="text-sm">Select a session from the sidebar to begin</p>
            </div>
          </div>
        )}
      </div>

      {/* Screenshot Modal - Removed */}

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
      
      </div> {/* Close main content area */}
    </div> {/* Close main container */}
  );
} 