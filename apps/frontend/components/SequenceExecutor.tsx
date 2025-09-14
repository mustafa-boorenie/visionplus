'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, Sequence } from '@/lib/api-client';
import { Play, X, AlertCircle, Loader2 } from 'lucide-react';

interface SequenceExecutorProps {
  sequence: Sequence;
  onClose: () => void;
  onExecutionStarted?: (sessionId: string) => void;
  onExecutionComplete?: (result: any) => void;
}

export function SequenceExecutor({ 
  sequence, 
  onClose, 
  onExecutionStarted,
  onExecutionComplete 
}: SequenceExecutorProps) {
  const [arguments_, setArguments] = useState<Record<string, string>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [requiredArgs, setRequiredArgs] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // Analyze sequence for required arguments
  useState(() => {
    const extractArguments = () => {
      const args = new Set<string>();
      
      // Check original prompt for placeholders
      if (sequence.originalPrompt) {
        const matches = sequence.originalPrompt.match(/\{(\w+)\}|\$\{(\w+)\}/g) || [];
        matches.forEach(match => {
          const argName = match.replace(/[\{\}$]/g, '');
          args.add(argName);
        });
      }
      
      // Check script actions for placeholders
      sequence.script.actions?.forEach(action => {
        // Check selector
        if (typeof action.selector === 'string') {
          const matches = action.selector.match(/\{(\w+)\}|\$\{(\w+)\}/g) || [];
          matches.forEach(match => {
            const argName = match.replace(/[\{\}$]/g, '');
            args.add(argName);
          });
        } else if (Array.isArray(action.selector)) {
          action.selector.forEach(sel => {
            const matches = sel.match(/\{(\w+)\}|\$\{(\w+)\}/g) || [];
            matches.forEach(match => {
              const argName = match.replace(/[\{\}$]/g, '');
              args.add(argName);
            });
          });
        }
        
        // Check text field
        if (action.text) {
          const matches = action.text.match(/\{(\w+)\}|\$\{(\w+)\}/g) || [];
          matches.forEach(match => {
            const argName = match.replace(/[\{\}$]/g, '');
            args.add(argName);
          });
        }
        
        // Check URL field
        if (action.url) {
          const matches = action.url.match(/\{(\w+)\}|\$\{(\w+)\}/g) || [];
          matches.forEach(match => {
            const argName = match.replace(/[\{\}$]/g, '');
            args.add(argName);
          });
        }
      });
      
      const argsList = Array.from(args);
      setRequiredArgs(argsList);
      
      // Initialize arguments state
      const initialArgs: Record<string, string> = {};
      argsList.forEach(arg => {
        initialArgs[arg] = '';
      });
      setArguments(initialArgs);
      
      setIsAnalyzing(false);
    };
    
    extractArguments();
  });

  // Execute sequence mutation
  const executeSequenceMutation = useMutation({
    mutationFn: async () => {
      // Validate required arguments
      const missingArgs = requiredArgs.filter(arg => !arguments_[arg]?.trim());
      if (missingArgs.length > 0) {
        throw new Error(`Missing required arguments: ${missingArgs.join(', ')}`);
      }

      // Create new session and execute sequence
      const result = await apiClient.executeSequenceWithNewSession(sequence.metadata.name, {
        arguments: arguments_,
        startUrl: sequence.script.url
      });
      
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      
      // Notify parent about the new session
      if (result.sessionId) {
        onExecutionStarted?.(result.sessionId);
      }
      
      onExecutionComplete?.(result);
      onClose();
    },
    onError: (error) => {
      console.error('Failed to execute sequence:', error);
    }
  });

  const handleArgumentChange = (argName: string, value: string) => {
    setArguments(prev => ({
      ...prev,
      [argName]: value
    }));
  };

  const canExecute = requiredArgs.length === 0 || requiredArgs.every(arg => arguments_[arg]?.trim());

  if (isAnalyzing) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg p-6 w-96">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin mr-3" />
            <span className="text-white">Analyzing sequence...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <Play className="w-6 h-6 text-green-400" />
            <h2 className="text-xl font-bold text-white">Execute Sequence</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Sequence Info */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-2">{sequence.metadata.name}</h3>
          <p className="text-gray-400 text-sm mb-3">{sequence.metadata.description}</p>
          
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>{sequence.script.actions?.length || 0} actions</span>
            <span>Success rate: {sequence.metadata.successRate || 0}%</span>
            {sequence.metadata.usageCount && (
              <span>Used {sequence.metadata.usageCount} times</span>
            )}
          </div>
        </div>

        {/* Arguments Collection */}
        {requiredArgs.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5 text-yellow-400" />
              <h4 className="text-white font-semibold">Required Arguments</h4>
            </div>
            
            <div className="space-y-3">
              {requiredArgs.map(argName => (
                <div key={argName}>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    {argName.charAt(0).toUpperCase() + argName.slice(1)}
                  </label>
                  <input
                    type="text"
                    value={arguments_[argName] || ''}
                    onChange={(e) => handleArgumentChange(argName, e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                    placeholder={`Enter ${argName}...`}
                  />
                </div>
              ))}
            </div>
            
            <div className="mt-3 p-3 bg-yellow-900/20 border border-yellow-600/30 rounded">
              <p className="text-yellow-200 text-sm">
                <AlertCircle className="w-4 h-4 inline mr-2" />
                This sequence contains placeholders that need to be filled before execution.
              </p>
            </div>
          </div>
        )}

        {/* Preview */}
        <div className="mb-6">
          <h4 className="text-white font-semibold mb-2">Execution Preview</h4>
          <div className="bg-gray-900 rounded p-3 text-sm">
            <div className="text-gray-400 mb-2">Will create new session and execute:</div>
            <div className="text-green-400 font-mono">
              {sequence.originalPrompt?.split('\n').map((line, index) => (
                <div key={index}>{line}</div>
              )) || 'No preview available'}
            </div>
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
            onClick={() => executeSequenceMutation.mutate()}
            disabled={!canExecute || executeSequenceMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {executeSequenceMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating Session...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Execute Sequence
              </>
            )}
          </button>
        </div>

        {/* Error Display */}
        {executeSequenceMutation.error && (
          <div className="mt-4 p-3 bg-red-900/20 border border-red-600/30 rounded">
            <p className="text-red-200 text-sm">
              <AlertCircle className="w-4 h-4 inline mr-2" />
              {executeSequenceMutation.error instanceof Error 
                ? executeSequenceMutation.error.message 
                : 'Failed to execute sequence'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
