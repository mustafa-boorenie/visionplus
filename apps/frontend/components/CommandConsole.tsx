'use client';

import { useState, KeyboardEvent } from 'react';
import { Terminal, Send } from 'lucide-react';

interface CommandConsoleProps {
  onExecuteCommand: (command: string) => void;
  isExecuting: boolean;
  sessionStatus?: 'idle' | 'running' | 'error';
}

export function CommandConsole({ 
  onExecuteCommand, 
  isExecuting, 
  sessionStatus 
}: CommandConsoleProps) {
  const [command, setCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const handleSubmit = () => {
    if (command.trim() && !isExecuting) {
      onExecuteCommand(command.trim());
      setCommandHistory(prev => [...prev, command.trim()]);
      setCommand('');
      setHistoryIndex(-1);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0 && historyIndex < commandHistory.length - 1) {
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

  const getStatusColor = () => {
    switch (sessionStatus) {
      case 'running':
        return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
      case 'error':
        return 'border-red-500 bg-red-50 dark:bg-red-900/20';
      default:
        return 'border-gray-300 dark:border-gray-700';
    }
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-2 ${getStatusColor()}`}>
      <div className="flex items-center mb-4">
        <Terminal className="w-5 h-5 mr-2 text-gray-600 dark:text-gray-400" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Command Console
        </h2>
        {sessionStatus === 'running' && (
          <span className="ml-auto text-sm text-yellow-600 dark:text-yellow-400">
            Executing...
          </span>
        )}
      </div>
      
      <div className="relative">
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isExecuting || !sessionStatus}
          placeholder={
            !sessionStatus 
              ? "Create a session first..." 
              : "Enter command (e.g., 'go to amazon and search for shoes')"
          }
          className="w-full px-4 py-3 pr-12 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
        />
        <button
          onClick={handleSubmit}
          disabled={isExecuting || !command.trim() || !sessionStatus}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
      
      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        Use ↑/↓ arrows to navigate command history
      </div>
    </div>
  );
} 