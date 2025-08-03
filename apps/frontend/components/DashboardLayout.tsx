'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Terminal, Play, Plus, FileCode, Sparkles, MonitorPlay, Camera } from 'lucide-react';
import { WebRTCViewer } from './WebRTCViewer';
import { IntelligentInputProcessor } from './IntelligentInputProcessor';

interface DashboardLayoutProps {
  onCreateSession: (startUrl?: string) => void;
}

export function DashboardLayout({ onCreateSession }: DashboardLayoutProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [command, setCommand] = useState('');
  const [logs, setLogs] = useState<Array<{ type: 'command' | 'response' | 'error' | 'info'; text: string; timestamp: Date }>>([]);
  const [showAIProcessor, setShowAIProcessor] = useState(false);
  const [showSequenceBuilder, setShowSequenceBuilder] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Query sessions list
  const { data: sessionsData, refetch: refetchSessions } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => apiClient.listSessions(),
    refetchInterval: 5000,
  });

  // Query sequences list
  const { data: sequencesData } = useQuery({
    queryKey: ['sequences'],
    queryFn: () => apiClient.listSequences(),
    refetchInterval: 30000,
  });

  // Query session details
  const { data: sessionDetails } = useQuery({
    queryKey: ['session', selectedSessionId],
    queryFn: () => selectedSessionId ? apiClient.getSession(selectedSessionId) : null,
    enabled: !!selectedSessionId,
    refetchInterval: 5000,
  });

  // Execute command mutation
  const executeCommandMutation = useMutation({
    mutationFn: ({ sessionId, command }: { sessionId: string; command: string }) =>
      apiClient.executeCommand(sessionId, command),
    onSuccess: () => {
      setLogs(prev => [...prev, {
        type: 'response',
        text: `✓ Command executed successfully`,
        timestamp: new Date()
      }]);
      setCommand('');
    },
    onError: (error: unknown) => {
      setLogs(prev => [...prev, {
        type: 'error',
        text: `✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      }]);
    }
  });

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Handlers
  const handleNewSession = () => {
    onCreateSession();
    refetchSessions();
  };

  const handleSelectSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setLogs([]);
  };

  const handleExecuteSequence = async (sequenceName: string) => {
    if (selectedSessionId) {
      try {
        await apiClient.executeSequence(selectedSessionId, sequenceName);
        setLogs(prev => [...prev, {
          type: 'info',
          text: `Executing sequence: ${sequenceName}`,
          timestamp: new Date()
        }]);
        refetchSessions();
      } catch (error) {
        console.error('Error executing sequence:', error);
      }
    } else {
      try {
        await apiClient.executeSequenceWithNewSession(sequenceName);
        refetchSessions();
      } catch (error) {
        console.error('Error executing sequence with new session:', error);
      }
    }
  };

  const handleExecuteCommand = () => {
    if (!command.trim() || !selectedSessionId) return;
    
    setLogs(prev => [...prev, {
      type: 'command',
      text: `$ ${command}`,
      timestamp: new Date()
    }]);

    executeCommandMutation.mutate({ sessionId: selectedSessionId, command });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleExecuteCommand();
    }
  };

  return (
    <div className="h-screen flex bg-gray-900">
      {/* Left Sidebar */}
      <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <Terminal className="w-6 h-6 text-green-400" />
            <h1 className="text-xl font-bold text-white">metrobot ai.</h1>
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
                      ? 'bg-green-600 text-white' 
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
          <>
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
                  className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded hover:bg-blue-700 transition-colors"
                  title="Create sequence from command history"
                >
                  <FileCode className="w-4 h-4" />
                  <span className="text-sm">Build Sequence</span>
                </button>
              </div>
            </div>

            {/* Main session content - Side by side layout */}
            <div className="flex-1 flex overflow-hidden gap-4 p-4">
              {/* Left Panel - Console and Controls */}
              <div className="w-1/2 flex flex-col bg-gray-800 rounded-lg overflow-hidden">
                {/* Console Header */}
                <div className="p-4 border-b border-gray-700">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <Terminal className="w-4 h-4" />
                    Console
                  </h3>
                </div>
                
                {/* Logs */}
                <div className="flex-1 overflow-y-auto p-4 font-mono text-sm">
                  {logs.length === 0 ? (
                    <div className="text-gray-500">
                      No commands executed yet. Type a command below to get started.
                    </div>
                  ) : (
                    logs.map((log, index) => (
                      <div key={index} className={`mb-2 ${
                        log.type === 'command' ? 'text-green-400' : 
                        log.type === 'error' ? 'text-red-400' : 
                        log.type === 'info' ? 'text-blue-400' : 'text-gray-300'
                      }`}>
                        <span className="text-gray-500 mr-2">
                          [{log.timestamp.toLocaleTimeString()}]
                        </span>
                        {log.text}
                      </div>
                    ))
                  )}
                  <div ref={logsEndRef} />
                </div>

                {/* Command Input */}
                <div className="p-4 border-t border-gray-700">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <input
                        ref={inputRef}
                        type="text"
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Enter Playwright command..."
                        className="w-full px-4 py-2 bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <button
                      onClick={handleExecuteCommand}
                      disabled={!command.trim()}
                      className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Play className="w-4 h-4" />
                      Execute
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Panel - WebRTC Viewer */}
              <div className="w-1/2 flex flex-col bg-gray-800 rounded-lg overflow-hidden">
                <div className="flex-1 p-4">
                  <WebRTCViewer 
                    sessionId={selectedSessionId}
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
            </div>
          </>
        ) : (
          /* No session selected */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Terminal className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-400 mb-2">No Session Selected</h2>
              <p className="text-gray-500 mb-4">Select a session from the sidebar or create a new one to get started.</p>
              <button
                onClick={handleNewSession}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 mx-auto"
              >
                <Plus className="w-4 h-4" />
                Create New Session
              </button>
            </div>
          </div>
        )}
      </div>

      {/* AI Processor Modal */}
      {showAIProcessor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-3/4 max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">AI Script Generator</h2>
              <button
                onClick={() => setShowAIProcessor(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <IntelligentInputProcessor
              sessionId={selectedSessionId || ''}
              onScriptGenerated={(script) => {
                setLogs(prev => [...prev, {
                  type: 'info',
                  text: 'AI script generated and executed',
                  timestamp: new Date()
                }]);
                setShowAIProcessor(false);
              }}
              onError={(error) => {
                setLogs(prev => [...prev, {
                  type: 'error',
                  text: `AI Error: ${error.message}`,
                  timestamp: new Date()
                }]);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}