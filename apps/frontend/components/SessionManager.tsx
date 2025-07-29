'use client';

import { Session } from '@/lib/api-client';
import { Plus, Globe, Clock, Activity, X, Trash2, Play, AlertCircle } from 'lucide-react';
import { useState } from 'react';

interface SessionManagerProps {
  sessions: Session[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: (startUrl?: string) => void;
  onClearInactiveSessions?: () => void;
  isLoading: boolean;
}

export function SessionManager({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onClearInactiveSessions,
  isLoading
}: SessionManagerProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [startUrl, setStartUrl] = useState('');

  const handleCreateSession = () => {
    onCreateSession(startUrl || undefined);
    setStartUrl('');
    setShowCreateModal(false);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleTimeString();
  };

  const getStatusIcon = (status: Session['status']) => {
    switch (status) {
      case 'running':
        return <Activity className="w-4 h-4 text-yellow-500 animate-pulse" />;
      case 'error':
        return <X className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-green-500" />;
    }
  };

  // Filter to only show active sessions (running or recently created)
  const activeSessions = sessions.filter(s => s.status === 'running' || s.status === 'idle');
  const inactiveSessions = sessions.filter(s => s.status === 'error' || (s.status === 'idle' && isSessionOld(s)));
  
  // Helper function to determine if a session is old (more than 5 minutes idle)
  function isSessionOld(session: Session): boolean {
    const now = new Date().getTime();
    const sessionTime = new Date(session.createdAt).getTime();
    const fiveMinutes = 5 * 60 * 1000;
    return (now - sessionTime) > fiveMinutes && session.status === 'idle';
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Sessions
        </h2>
        <div className="flex items-center gap-2">
          {inactiveSessions.length > 0 && onClearInactiveSessions && (
            <button
              onClick={onClearInactiveSessions}
              className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              title={`Clear ${inactiveSessions.length} inactive session${inactiveSessions.length > 1 ? 's' : ''}`}
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
          ))}
        </div>
      ) : activeSessions.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4">
            <Play className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No Active Sessions
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
            Start your browser automation journey by creating a new session. You can begin with any website or let the AI guide you.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            Create Your First Session
          </button>
          {inactiveSessions.length > 0 && (
            <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {inactiveSessions.length} inactive session{inactiveSessions.length > 1 ? 's' : ''} found
                </span>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                These sessions are not shown in the list. Use the cleanup button to remove them.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {activeSessions.map((session) => (
            <button
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className={`w-full p-4 rounded-lg border-2 transition-all ${
                activeSessionId === session.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(session.status)}
                    <span className="font-medium text-gray-900 dark:text-white">
                      Session {session.id.slice(0, 8)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Created: {formatDate(session.createdAt)}
                  </div>
                  {session.currentUrl && (
                    <div className="flex items-center gap-1 mt-1">
                      <Globe className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-600 dark:text-gray-300 truncate">
                        {new URL(session.currentUrl).hostname}
                      </span>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {session.historyCount} commands
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Create Session Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Create New Session
            </h3>
            <input
              type="text"
              value={startUrl}
              onChange={(e) => setStartUrl(e.target.value)}
              placeholder="Starting URL (optional)"
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleCreateSession}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 