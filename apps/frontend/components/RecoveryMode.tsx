'use client';

import { useState } from 'react';
import { AlertTriangle, RefreshCw, SkipForward, Lightbulb, X, CheckCircle } from 'lucide-react';

export interface RecoveryOption {
  id: string;
  description: string;
  confidence: number;
  reason: string;
  actions?: Array<{ type: string; [key: string]: unknown }>;
}

interface RecoveryModeProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectOption: (optionId: string, customActions?: Array<{ type: string; [key: string]: unknown }>) => void;
  failureContext: {
    step: string;
    error: string;
    screenshot?: string;
  };
  recoveryOptions: RecoveryOption[];
  sessionId?: string;
}

export function RecoveryMode({
  isOpen,
  onClose,
  onSelectOption,
  failureContext,
  recoveryOptions,
  sessionId
}: RecoveryModeProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [customCommand, setCustomCommand] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  if (!isOpen) return null;

  const handleSelectOption = (optionId: string) => {
    setSelectedOption(optionId);
    onSelectOption(optionId);
  };

  const handleCustomCommand = () => {
    if (customCommand.trim()) {
      onSelectOption('custom', [{ type: 'command', command: customCommand }]);
      setCustomCommand('');
      setShowCustomInput(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-500';
    if (confidence >= 0.6) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 0.8) return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (confidence >= 0.6) return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    return <AlertTriangle className="w-4 h-4 text-red-500" />;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-red-50 border-b border-red-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <div>
              <h2 className="text-lg font-semibold text-red-800">Automation Failed</h2>
              <p className="text-sm text-red-600">Choose a recovery option to continue</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-red-400 hover:text-red-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Failure Context */}
        <div className="p-4 bg-gray-50 border-b">
          <h3 className="font-semibold text-gray-800 mb-2">Failed Step:</h3>
          <p className="text-sm text-gray-700 mb-2">{failureContext.step}</p>
          <h4 className="font-semibold text-gray-800 mb-1">Error:</h4>
          <p className="text-sm text-red-600 font-mono bg-red-50 p-2 rounded border border-red-200">
            {failureContext.error}
          </p>
          
          {/* Screenshot if available */}
          {failureContext.screenshot && sessionId && (
            <div className="mt-4">
              <h4 className="font-semibold text-gray-800 mb-2">Current Page:</h4>
              <img
                src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/sessions/${sessionId}/screenshots/${failureContext.screenshot}`}
                alt="Failed state screenshot"
                className="max-w-full h-48 object-contain border border-gray-300 rounded"
              />
            </div>
          )}
        </div>

        {/* Recovery Options */}
        <div className="p-4">
          <h3 className="font-semibold text-gray-800 mb-4">Recovery Options:</h3>
          
          <div className="space-y-3">
            {recoveryOptions.map((option) => (
              <div
                key={option.id}
                className={`border rounded-lg p-4 cursor-pointer transition-all ${
                  selectedOption === option.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => handleSelectOption(option.id)}
              >
                <div className="flex items-start gap-3">
                  {getConfidenceIcon(option.confidence)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-800">{option.description}</span>
                      <span className={`text-sm font-medium ${getConfidenceColor(option.confidence)}`}>
                        {Math.round(option.confidence * 100)}% confidence
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{option.reason}</p>
                  </div>
                </div>
              </div>
            ))}

            {/* Custom Command Option */}
            <div className="border border-dashed border-gray-300 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <Lightbulb className="w-4 h-4 text-blue-500" />
                <span className="font-medium text-gray-800">Custom Command</span>
              </div>
              
              {!showCustomInput ? (
                <button
                  onClick={() => setShowCustomInput(true)}
                  className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                >
                  Enter a custom command to try...
                </button>
              ) : (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={customCommand}
                    onChange={(e) => setCustomCommand(e.target.value)}
                    placeholder="Enter a custom command (e.g., 'wait 5 seconds then click submit button')"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleCustomCommand()}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleCustomCommand}
                      disabled={!customCommand.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Try Command
                    </button>
                    <button
                      onClick={() => {
                        setShowCustomInput(false);
                        setCustomCommand('');
                      }}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 p-4 border-t flex justify-between items-center">
          <p className="text-sm text-gray-600">
            Select an option above to continue automation
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel Automation
          </button>
        </div>
      </div>
    </div>
  );
} 