'use client';


import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { DashboardLayout } from '@/components/DashboardLayout';

export default function Home() {
  const queryClient = useQueryClient();

  // Create session mutation
  const createSessionMutation = useMutation({
    mutationFn: (data: Parameters<typeof apiClient.createSession>[0]) => apiClient.createSession(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
    onError: (error) => {
      console.error('Failed to create session:', error);
    },
  });

  const handleCreateSession = async (startUrl?: string) => {
    createSessionMutation.mutate({ startUrl, headless: false });
  };

  return <DashboardLayout onCreateSession={handleCreateSession} />;
}
