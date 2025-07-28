'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, Sequence } from '@/lib/api-client';
import { Trash2, Edit, Play, Plus, Save, X } from 'lucide-react';

interface SequenceManagerProps {
  sessionId?: string;
  onExecuteSequence?: (sequenceName: string) => void;
}

export function SequenceManager({ sessionId, onExecuteSequence }: SequenceManagerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingSequence, setEditingSequence] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    url?: string;
    actions: Array<{
      type: string;
      selector?: string | string[];
      text?: string;
      url?: string;
      key?: string;
      duration?: number;
    }>;
  }>({
    name: '',
    description: '',
    url: '',
    actions: []
  });
  const queryClient = useQueryClient();

  // Query sequences
  const { data: sequencesData, isLoading } = useQuery({
    queryKey: ['sequences'],
    queryFn: () => apiClient.listSequences(),
  });

  // Create sequence mutation
  const createMutation = useMutation({
    mutationFn: (data: { name: string; description: string; url?: string; actions: Array<{
      type: string;
      selector?: string | string[];
      text?: string;
      url?: string;
      key?: string;
      duration?: number;
    }> }) => 
      apiClient.saveSequence({
        metadata: {
          id: '',
          name: data.name,
          description: data.description,
          createdAt: new Date().toISOString()
        },
        script: {
          name: data.name,
          description: data.description,
          url: data.url,
          actions: data.actions
        }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequences'] });
      setIsCreating(false);
      resetForm();
    },
  });

  // Update sequence mutation
  const updateMutation = useMutation({
    mutationFn: ({ name, data }: { name: string; data: {
      name: string;
      description: string;
      url?: string;
      actions: Array<{
        type: string;
        selector?: string | string[];
        text?: string;
        url?: string;
        key?: string;
        duration?: number;
      }>
    } }) =>
      apiClient.updateSequence(name, {
        metadata: {
          id: '',
          name: data.name,
          description: data.description,
          createdAt: new Date().toISOString()
        },
        script: {
          name: data.name,
          description: data.description,
          url: data.url,
          actions: data.actions
        }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequences'] });
      setEditingSequence(null);
      resetForm();
    },
  });

  // Delete sequence mutation
  const deleteMutation = useMutation({
    mutationFn: (name: string) => apiClient.deleteSequence(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequences'] });
    },
  });

  // Execute sequence mutation
  const executeMutation = useMutation({
    mutationFn: (sequenceName: string) => {
      // Always create a new session for sequence execution
      return apiClient.executeSequenceWithNewSession(sequenceName);
    },
    onSuccess: (_, sequenceName) => {
      onExecuteSequence?.(sequenceName);
      // Refresh sessions list if available
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      url: '',
      actions: []
    });
  };

  const handleEdit = (sequence: Sequence) => {
    setEditingSequence(sequence.metadata.name);
    setFormData({
      name: sequence.metadata.name,
      description: sequence.metadata.description,
      url: sequence.script.url || '',
      actions: sequence.script.actions || []
    });
  };

  const handleSave = () => {
    if (editingSequence) {
      updateMutation.mutate({ name: editingSequence, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleAddStep = () => {
    setFormData(prev => ({
      ...prev,
      actions: [...(prev.actions || []), {
        type: 'click',
        selector: ''
      }]
    }));
  };

  const handleStepChange = (index: number, field: string, value: string | Record<string, string | string[] | number | undefined>) => {
    setFormData(prev => ({
      ...prev,
      actions: prev.actions?.map((action, i) => 
        i === index ? { ...action, [field]: value } : action
      ) || []
    }));
  };

  const handleRemoveStep = (index: number) => {
    setFormData(prev => ({
      ...prev,
      actions: prev.actions?.filter((_, i) => i !== index) || []
    }));
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Sequences</h2>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          New Sequence
        </button>
      </div>

      {/* Sequence Form */}
      {(isCreating || editingSequence) && (
        <div className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Sequence Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              disabled={!!editingSequence}
            />
            <textarea
              placeholder="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              rows={2}
            />
            <input
              type="text"
              placeholder="Start URL (optional)"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            
            {/* Steps */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h4 className="font-semibold text-gray-900 dark:text-white">Actions</h4>
                <button
                  onClick={handleAddStep}
                  className="text-sm px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Add Action
                </button>
              </div>
              
              {formData.actions?.map((action, index) => (
                <div key={index} className="p-3 border border-gray-200 dark:border-gray-700 rounded">
                  <div className="flex gap-2">
                    <select
                      value={action.type}
                      onChange={(e) => handleStepChange(index, 'type', e.target.value)}
                      className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    >
                      <option value="click">Click</option>
                      <option value="type">Type</option>
                      <option value="navigate">Navigate</option>
                      <option value="wait">Wait</option>
                      <option value="screenshot">Screenshot</option>
                    </select>
                    {action.type !== 'wait' && action.type !== 'screenshot' && (
                      <input
                        type="text"
                        placeholder={action.type === 'navigate' ? 'URL' : action.type === 'type' ? 'Text' : 'Selector'}
                        value={
                          action.type === 'navigate' ? action.url || '' :
                          action.type === 'type' ? action.text || '' :
                          Array.isArray(action.selector) ? action.selector[0] : action.selector || ''
                        }
                        onChange={(e) => {
                          const key = action.type === 'navigate' ? 'url' : 
                                     action.type === 'type' ? 'text' : 'selector';
                          handleStepChange(index, key, e.target.value);
                        }}
                        className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      />
                    )}
                    {action.type === 'wait' && (
                      <input
                        type="number"
                        placeholder="Duration (ms)"
                        value={action.duration || ''}
                        onChange={(e) => handleStepChange(index, 'duration', { duration: parseInt(e.target.value) })}
                        className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      />
                    )}
                    <button
                      onClick={() => handleRemoveStep(index)}
                      className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={!formData.name || !formData.actions?.length}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setEditingSequence(null);
                  resetForm();
                }}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sequences List */}
      <div className="space-y-2">
        {isLoading ? (
          <p className="text-gray-500 dark:text-gray-400">Loading sequences...</p>
        ) : !sequencesData?.sequences || sequencesData.sequences.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No sequences found. Create your first sequence!</p>
        ) : (
          sequencesData.sequences.map((sequence) => (
            <div
              key={sequence.metadata.id}
              className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white">{sequence.metadata.name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{sequence.metadata.description}</p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {sequence.script?.actions?.length || 0} actions
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => executeMutation.mutate(sequence.metadata.name)}
                  disabled={executeMutation.isPending}
                  className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Execute sequence"
                >
                  <Play className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleEdit(sequence)}
                  className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete sequence "${sequence.metadata.name}"?`)) {
                      deleteMutation.mutate(sequence.metadata.name);
                    }
                  }}
                  className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
} 