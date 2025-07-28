'use client';

import { useRef, useEffect } from 'react';
import { FileText, Download, Trash2 } from 'lucide-react';

interface LogViewerProps {
  logs: string[];
  onClear?: () => void;
}

export function LogViewer({ logs, onClear }: LogViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogColor = (log: string) => {
    if (log.includes('[error]') || log.includes('[Error]')) {
      return 'text-red-600 dark:text-red-400';
    } else if (log.includes('[warn]') || log.includes('[Warning]')) {
      return 'text-yellow-600 dark:text-yellow-400';
    } else if (log.includes('[info]')) {
      return 'text-blue-600 dark:text-blue-400';
    } else if (log.includes('[success]') || log.includes('✓')) {
      return 'text-green-600 dark:text-green-400';
    } else if (log.startsWith('>')) {
      return 'text-purple-600 dark:text-purple-400 font-semibold';
    } else if (log.includes('[WS]')) {
      return 'text-gray-500 dark:text-gray-400 italic';
    }
    return 'text-gray-800 dark:text-gray-200';
  };

  const downloadLogs = () => {
    const content = logs.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `automation-logs-${new Date().toISOString()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center">
          <FileText className="w-5 h-5 mr-2 text-gray-600 dark:text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Logs
          </h2>
          <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
            ({logs.length} entries)
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={downloadLogs}
            disabled={logs.length === 0}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Download logs"
          >
            <Download className="w-4 h-4" />
          </button>
          {onClear && (
            <button
              onClick={onClear}
              disabled={logs.length === 0}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Clear logs"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      
      <div 
        ref={scrollRef}
        className="h-96 overflow-y-auto p-4 font-mono text-sm bg-gray-50 dark:bg-gray-900"
      >
        {logs.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            No logs yet. Execute a command to see output.
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map((log, index) => (
              <div 
                key={index}
                className={`whitespace-pre-wrap break-all ${getLogColor(log)}`}
              >
                {log}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 