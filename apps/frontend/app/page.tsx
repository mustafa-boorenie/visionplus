'use client';


import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useState } from 'react';

export default function Home() {
  const queryClient = useQueryClient();
  const [creatingSession, setCreatingSession] = useState(false);
  const [newSessionId, setNewSessionId] = useState<string | null>(null);

  // Create session mutation
  const createSessionMutation = useMutation({
    mutationFn: (data: Parameters<typeof apiClient.createSession>[0]) => apiClient.createSession(data),
    onMutate: () => {
      setCreatingSession(true);
    },
    onSuccess: (data) => {
      setNewSessionId(data.sessionId);
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      // Auto-select the new session after a brief delay
      setTimeout(() => {
        setCreatingSession(false);
      }, 2000);
    },
    onError: (error) => {
      console.error('Failed to create session:', error);
      setCreatingSession(false);
    },
  });

  const handleCreateSession = async (startUrl?: string) => {
    setNewSessionId(null);
    createSessionMutation.mutate({ startUrl, headless: false });
  };

  return (
    <DashboardLayout 
      onCreateSession={handleCreateSession}
      creatingSession={creatingSession}
      newSessionId={newSessionId}
      onSessionCreated={(sessionId) => setNewSessionId(sessionId)}
    />
  );
}
