'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { SessionManager } from '@/components/SessionManager';
import { InteractiveMode } from '@/components/InteractiveMode';
import { SequenceManager } from '@/components/SequenceManager';
import { ProfileSettings } from '@/components/ProfileSettings';
import { Terminal, FileCode, User, Layers } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'sessions' | 'interactive' | 'sequences' | 'profile'>('sessions');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Query for sessions
  const { data: sessionsData } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => apiClient.listSessions(),
    refetchInterval: 5000,
  });

  // Query for active session
  const { data: activeSession } = useQuery({
    queryKey: ['session', activeSessionId],
    queryFn: () => activeSessionId ? apiClient.getSession(activeSessionId) : null,
    enabled: !!activeSessionId,
    refetchInterval: 3000,
  });

  // Create session mutation
  const createSessionMutation = useMutation({
    mutationFn: (data: Parameters<typeof apiClient.createSession>[0]) => apiClient.createSession(data),
    onSuccess: (data) => {
      setActiveSessionId(data.sessionId);
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      // Switch to interactive mode when session is created
      setActiveTab('interactive');
    },
    onError: (error) => {
      console.error('Failed to create session:', error);
    },
  });

  const handleCreateSession = async (startUrl?: string) => {
    createSessionMutation.mutate({ startUrl, headless: false });
  };

  const handleSequenceExecute = (sequenceName: string) => {
    // Switch to interactive mode to see the execution
    setActiveTab('interactive');
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                AI Playwright Scripter
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Web automation with AI-powered browser control
              </p>
            </div>
            
            {/* Active Session Indicator */}
            {activeSession && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <div className={`w-2 h-2 rounded-full ${
                  activeSession.status === 'running' ? 'bg-green-500' : 
                  activeSession.status === 'error' ? 'bg-red-500' : 'bg-gray-500'
                }`} />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Session: {activeSession.id.slice(0, 8)}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="container mx-auto px-4">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('sessions')}
              className={`py-4 px-1 flex items-center gap-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'sessions'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Layers className="w-4 h-4" />
              Sessions
            </button>
            
            <button
              onClick={() => setActiveTab('interactive')}
              className={`py-4 px-1 flex items-center gap-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'interactive'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Terminal className="w-4 h-4" />
              Interactive Mode
            </button>
            
            <button
              onClick={() => setActiveTab('sequences')}
              className={`py-4 px-1 flex items-center gap-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'sequences'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <FileCode className="w-4 h-4" />
              Sequences
            </button>
            
            <button
              onClick={() => setActiveTab('profile')}
              className={`py-4 px-1 flex items-center gap-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'profile'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <User className="w-4 h-4" />
              Profile & Billing
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {/* Sessions Tab */}
        {activeTab === 'sessions' && (
          <div className="container mx-auto px-4 py-8">
            <SessionManager
              sessions={sessionsData?.sessions || []}
              activeSessionId={activeSessionId}
              onSelectSession={(sessionId) => {
                setActiveSessionId(sessionId);
                setActiveTab('interactive'); // Switch to interactive mode to watch the session
              }}
              onCreateSession={handleCreateSession}
              isLoading={!sessionsData}
            />
          </div>
        )}

        {/* Interactive Mode Tab */}
        {activeTab === 'interactive' && (
          <div className="h-full">
            <InteractiveMode
              sessionId={activeSessionId}
              session={activeSession || undefined}
              onCreateSession={handleCreateSession}
            />
          </div>
        )}

        {/* Sequences Tab */}
        {activeTab === 'sequences' && (
          <div className="container mx-auto px-4 py-8 h-full overflow-auto">
            <SequenceManager
              sessionId={activeSessionId || undefined}
              onExecuteSequence={handleSequenceExecute}
            />
          </div>
        )}

        {/* Profile & Billing Tab */}
        {activeTab === 'profile' && (
          <div className="container mx-auto px-4 py-8 h-full overflow-auto">
            <ProfileSettings
              user={{
                name: 'John Doe',
                email: 'john@example.com',
                plan: 'pro'
              }}
            />
          </div>
        )}
      </main>
    </div>
  );
}
