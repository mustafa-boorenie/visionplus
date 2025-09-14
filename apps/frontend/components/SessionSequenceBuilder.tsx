'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Save, X, FileCode, Trash2, Eye, EyeOff } from 'lucide-react';

interface SessionSequenceBuilderProps {
  sessionId: string;
  sessionName: string;
  onClose: () => void;
  onSequenceCreated?: (sequenceName: string) => void;
}

interface SessionCommand {
  command: string;
  result: {
    success: boolean;
    executionTime: number;
    errors?: string[];
    script: {
      actions: Array<{
        type: string;
        selector?: string | string[];
        text?: string;
        url?: string;
        key?: string;
        duration?: number;
      }>;
    };
  };
  timestamp: Date;
  selected?: boolean;
}

export function SessionSequenceBuilder({ 
  sessionId, 
  sessionName, 
  onClose, 
  onSequenceCreated 
}: SessionSequenceBuilderProps) {
  const [commands, setCommands] = useState<SessionCommand[]>([]);
  const [sequenceName, setSequenceName] = useState('');
  const [sequenceDescription, setSequenceDescription] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  // Load session command history
  useEffect(() => {
    loadSessionHistory();
  }, [sessionId]);

  const loadSessionHistory = async () => {
    try {
      setIsLoading(true);
      const history = await apiClient.getCommandHistory(sessionId);
      
      // Only include successful commands
      const successfulCommands = history.history
        .filter(item => item.result.success)
        .map(item => ({
          ...item,
          timestamp: new Date(item.timestamp),
          selected: true // Auto-select all successful commands
        }));
      
      setCommands(successfulCommands);
      
      // Auto-generate sequence name and description
      const commandCount = successfulCommands.length;
      setSequenceName(`${sessionName} Sequence`);
      setSequenceDescription(`Automated sequence from ${sessionName} with ${commandCount} commands: ${successfulCommands.map(c => c.command).join(', ')}`);
      
    } catch (error) {
      console.error('Failed to load session history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Create sequence mutation
  const createSequenceMutation = useMutation({
    mutationFn: async () => {
      const selectedCommands = commands.filter(cmd => cmd.selected);
      
      if (selectedCommands.length === 0) {
        throw new Error('Please select at least one command');
      }

      // Combine all actions from selected commands
      const allActions = selectedCommands.flatMap(cmd => cmd.result.script.actions);
      
      // Create the original prompt from selected commands
      const originalPrompt = selectedCommands
        .map((cmd, index) => `${index + 1}. ${cmd.command}`)
        .join('\n');

      // Create execution result for the sequence
      const executionResult = {
        success: true,
        script: {
          name: sequenceName,
          description: sequenceDescription,
          url: 'https://www.google.com', // Default start URL
          actions: allActions
        },
        executionTime: selectedCommands.reduce((sum, cmd) => sum + cmd.result.executionTime, 0),
        screenshots: [],
        errors: [],
        stepResults: selectedCommands.map(cmd => ({
          step: cmd.command,
          success: true,
          duration: cmd.result.executionTime
        }))
      };

      // Save the sequence
      return apiClient.saveSequence({
        name: sequenceName,
        originalPrompt,
        executionResult,
        description: sequenceDescription,
        category: 'session-generated',
        tags: ['interactive', 'session-history']
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequences'] });
      onSequenceCreated?.(sequenceName);
      onClose();
    },
    onError: (error) => {
      console.error('Failed to create sequence:', error);
    }
  });

  const toggleCommandSelection = (index: number) => {
    setCommands(prev => prev.map((cmd, i) => 
      i === index ? { ...cmd, selected: !cmd.selected } : cmd
    ));
  };

  const selectedCount = commands.filter(cmd => cmd.selected).length;

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg p-6 w-3/4 max-w-4xl">
          <div className="flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-3 text-white">Loading session history...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-3/4 max-w-4xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <FileCode className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-bold text-white">Build Sequence from {sessionName}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {commands.length === 0 ? (
          <div className="text-center py-8">
            <FileCode className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-400 mb-2">No Commands Found</h3>
            <p className="text-gray-500">
              Execute some commands in this session first, then come back to build a sequence.
            </p>
          </div>
        ) : (
          <>
            {/* Sequence Details */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Sequence Name
                </label>
                <input
                  type="text"
                  value={sequenceName}
                  onChange={(e) => setSequenceName(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                  placeholder="Enter sequence name..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={sequenceDescription}
                  onChange={(e) => setSequenceDescription(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                  rows={3}
                  placeholder="Describe what this sequence does..."
                />
              </div>
            </div>

            {/* Commands Selection */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">
                  Select Commands ({selectedCount}/{commands.length})
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCommands(prev => prev.map(cmd => ({ ...cmd, selected: true })))}
                    className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setCommands(prev => prev.map(cmd => ({ ...cmd, selected: false })))}
                    className="text-sm px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {commands.map((command, index) => (
                  <div
                    key={index}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      command.selected
                        ? 'border-blue-500 bg-blue-900/20'
                        : 'border-gray-600 bg-gray-700/50 hover:bg-gray-700'
                    }`}
                    onClick={() => toggleCommandSelection(index)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {command.selected ? (
                          <Eye className="w-4 h-4 text-blue-400" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-gray-500" />
                        )}
                        <div>
                          <div className="text-white font-medium">{command.command}</div>
                          <div className="text-xs text-gray-400">
                            {command.result.script.actions.length} actions • {command.result.executionTime}ms
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {command.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => createSequenceMutation.mutate()}
                disabled={!sequenceName.trim() || selectedCount === 0 || createSequenceMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="w-4 h-4" />
                {createSequenceMutation.isPending ? 'Creating...' : 'Create Sequence'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

