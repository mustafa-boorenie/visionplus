'use client';

import React, { useState, useRef } from 'react';

interface IntelligentInputProcessorProps {
  sessionId: string;
  onScriptGenerated?: (script: Record<string, unknown>) => void;
  onError?: (error: Error) => void;
}

export function IntelligentInputProcessor({ 
  sessionId, 
  onScriptGenerated, 
  onError 
}: IntelligentInputProcessorProps) {
  const [userInput, setUserInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastScript, setLastScript] = useState<Record<string, unknown> | null>(null);
  const [processingStage, setProcessingStage] = useState<string>('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const processIntelligentInput = async () => {
    if (!userInput.trim() || isProcessing) return;

    setIsProcessing(true);
    setProcessingStage('Capturing context...');

    try {
      // Step 1: Get current HTML and screenshot
      setProcessingStage('Analyzing page context...');
      const contextResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/sessions/${sessionId}/context`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        }
      );

      if (!contextResponse.ok) {
        throw new Error('Failed to get page context');
      }

      const context = await contextResponse.json();
      
      // Step 2: Send to OpenAI API for intelligent processing
      setProcessingStage('Processing with AI...');
      const aiResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/intelligent/process-input`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            userInput: userInput.trim(),
            html: context.html,
            screenshot: context.screenshot,
            url: context.url,
            timestamp: Date.now()
          })
        }
      );

      if (!aiResponse.ok) {
        const errorData = await aiResponse.json();
        throw new Error(errorData.error || 'Failed to process input with AI');
      }

      const aiResult = await aiResponse.json();
      
      // Step 3: Execute the generated script
      setProcessingStage('Executing automation script...');
      const executionResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/intelligent/execute-script`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            script: aiResult.script,
            executionId: aiResult.executionId
          })
        }
      );

      if (!executionResponse.ok) {
        const errorData = await executionResponse.json();
        throw new Error(errorData.error || 'Failed to execute automation script');
      }

      const executionResult = await executionResponse.json();
      
      setLastScript(aiResult.script);
      setUserInput(''); // Clear input after successful processing
      
      if (onScriptGenerated) {
        onScriptGenerated({
          script: aiResult.script,
          execution: executionResult,
          userInput: userInput.trim()
        });
      }

      setProcessingStage('Complete! 🎉');
      setTimeout(() => setProcessingStage(''), 2000);

    } catch (error) {
      console.error('Intelligent processing error:', error);
      setProcessingStage('Error occurred');
      
      if (onError) {
        onError(error instanceof Error ? error : new Error('Unknown error'));
      }
      
      setTimeout(() => setProcessingStage(''), 3000);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      processIntelligentInput();
    }
  };

  return (
    <div className="bg-white border rounded-lg shadow-sm">
      <div className="border-b px-4 py-3">
        <h3 className="text-lg font-semibold text-gray-900">
          Intelligent Browser Control
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Describe what you want to do, and AI will generate and execute the automation script
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* Input Area */}
        <div className="space-y-2">
          <label htmlFor="user-input" className="block text-sm font-medium text-gray-700">
            What would you like to do?
          </label>
          <textarea
            ref={inputRef}
            id="user-input"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="e.g., 'Search for red socks on Amazon', 'Fill out the contact form', 'Click the login button'"
            className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            disabled={isProcessing}
          />
      
        </div>

        {/* Processing Status */}
        {isProcessing && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-blue-800 text-sm font-medium">{processingStage}</span>
            </div>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={processIntelligentInput}
          disabled={!userInput.trim() || isProcessing}
          className={`w-full py-2 px-4 rounded-md font-medium text-sm transition-colors ${
            !userInput.trim() || isProcessing
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
          }`}
        >
          {isProcessing ? 'Processing...' : 'Generate & Execute Automation'}
        </button>

        {/* Last Script Display */}
        {lastScript && (
          <div className="bg-gray-50 border rounded-md p-3">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Last Generated Script:</h4>
            <div className="text-xs font-mono bg-white border rounded p-2 max-h-32 overflow-y-auto">
              <pre className="whitespace-pre-wrap text-gray-600">
                {JSON.stringify(lastScript, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 