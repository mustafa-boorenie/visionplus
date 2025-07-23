import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { 
  AutomationSequence, 
  SequenceMetadata, 
  SequenceConfig, 
  SequenceSearchCriteria,
  AutomationExecutionResult
} from '../types';
import { log } from './logger';

/**
 * Manager for automation sequences - saves and manages prompt+script pairs
 */
export class SequenceManager {
  private config: SequenceConfig;
  private sequences: Map<string, AutomationSequence> = new Map();

  constructor(config?: Partial<SequenceConfig>) {
    this.config = {
      sequencesPath: './sequences',
      backupPath: './sequences/backup',
      maxHistoryLength: 10,
      autoBackup: true,
      ...config
    };
  }

  /**
   * Initialize the sequence manager
   */
  async initialize(): Promise<void> {
    try {
      await fs.ensureDir(this.config.sequencesPath);
      if (this.config.backupPath) {
        await fs.ensureDir(this.config.backupPath);
      }
      await this.loadAllSequences();
      log.info('SequenceManager initialized');
    } catch (error) {
      log.error('Failed to initialize SequenceManager', error as Error);
      throw error;
    }
  }

  /**
   * Save a new automation sequence
   */
  async saveSequence(
    name: string,
    originalPrompt: string,
    executionResult: AutomationExecutionResult,
    options?: {
      description?: string;
      category?: string;
      tags?: string[];
    }
  ): Promise<AutomationSequence> {
    try {
      // Check if name already exists
      if (this.sequences.has(name)) {
        throw new Error(`Sequence with name "${name}" already exists`);
      }

      // Create sequence metadata
      const metadata: SequenceMetadata = {
        id: uuidv4(),
        name,
        description: options?.description || `Automation for: ${originalPrompt}`,
        createdAt: new Date(),
        usageCount: 0,
        tags: options?.tags || [],
        category: options?.category,
        successRate: executionResult.success ? 100 : 0
      };

      // Create the sequence
      const sequence: AutomationSequence = {
        metadata,
        originalPrompt,
        script: executionResult.script,
        executionHistory: [{
          timestamp: new Date(),
          success: executionResult.success,
          executionTime: executionResult.executionTime,
          errors: executionResult.errors
        }]
      };

      // Save to file
      const filePath = path.join(this.config.sequencesPath, `${name}.json`);
      await fs.writeJSON(filePath, sequence, { spaces: 2 });

      // Add to memory
      this.sequences.set(name, sequence);

      // Create backup if enabled
      if (this.config.autoBackup && this.config.backupPath) {
        const backupPath = path.join(this.config.backupPath, `${name}_${Date.now()}.json`);
        await fs.writeJSON(backupPath, sequence, { spaces: 2 });
      }

      log.info(`Sequence "${name}" saved successfully`);
      return sequence;

    } catch (error) {
      log.error(`Failed to save sequence "${name}"`, error as Error);
      throw error;
    }
  }

  /**
   * Load a specific sequence
   */
  async loadSequence(name: string): Promise<AutomationSequence | null> {
    try {
      if (this.sequences.has(name)) {
        return this.sequences.get(name)!;
      }

      const filePath = path.join(this.config.sequencesPath, `${name}.json`);
      if (await fs.pathExists(filePath)) {
        const rawSequence = await fs.readJSON(filePath);
        const sequence = this.normalizeSequenceDates(rawSequence);
        this.sequences.set(name, sequence);
        return sequence;
      }

      return null;
    } catch (error) {
      log.error(`Failed to load sequence "${name}"`, error as Error);
      return null;
    }
  }

  /**
   * Update sequence execution history
   */
  async updateSequenceHistory(
    name: string,
    executionResult: {
      success: boolean;
      executionTime: number;
      errors?: string[];
    }
  ): Promise<void> {
    try {
      const sequence = await this.loadSequence(name);
      if (!sequence) {
        throw new Error(`Sequence "${name}" not found`);
      }

      // Update metadata
      sequence.metadata.lastUsed = new Date();
      sequence.metadata.usageCount++;

      // Calculate new success rate
      const totalExecutions = sequence.executionHistory.length + 1;
      const successfulExecutions = sequence.executionHistory.filter(h => h.success).length + 
                                  (executionResult.success ? 1 : 0);
      sequence.metadata.successRate = Math.round((successfulExecutions / totalExecutions) * 100);

      // Add to history
      sequence.executionHistory.push({
        timestamp: new Date(),
        success: executionResult.success,
        executionTime: executionResult.executionTime,
        errors: executionResult.errors
      });

      // Trim history if needed
      if (this.config.maxHistoryLength && 
          sequence.executionHistory.length > this.config.maxHistoryLength) {
        sequence.executionHistory = sequence.executionHistory.slice(-this.config.maxHistoryLength);
      }

      // Save updated sequence
      const filePath = path.join(this.config.sequencesPath, `${name}.json`);
      await fs.writeJSON(filePath, sequence, { spaces: 2 });

      // Update in memory
      this.sequences.set(name, sequence);

      log.info(`Updated execution history for sequence "${name}"`);
    } catch (error) {
      log.error(`Failed to update sequence history for "${name}"`, error as Error);
      throw error;
    }
  }

  /**
   * List all sequences
   */
  async listSequences(criteria?: SequenceSearchCriteria): Promise<AutomationSequence[]> {
    try {
      await this.loadAllSequences();
      let sequences = Array.from(this.sequences.values());

      if (criteria) {
        sequences = sequences.filter(sequence => {
          if (criteria.name && !sequence.metadata.name.toLowerCase().includes(criteria.name.toLowerCase())) {
            return false;
          }
          if (criteria.category && sequence.metadata.category !== criteria.category) {
            return false;
          }
          if (criteria.tags && criteria.tags.length > 0) {
            if (!criteria.tags.some(tag => sequence.metadata.tags?.includes(tag))) {
              return false;
            }
          }
          if (criteria.url && !sequence.script.url.includes(criteria.url)) {
            return false;
          }
          if (criteria.prompt && !sequence.originalPrompt.toLowerCase().includes(criteria.prompt.toLowerCase())) {
            return false;
          }
          if (criteria.createdAfter && sequence.metadata.createdAt < criteria.createdAfter) {
            return false;
          }
          if (criteria.createdBefore && sequence.metadata.createdAt > criteria.createdBefore) {
            return false;
          }
          if (criteria.minSuccessRate && (sequence.metadata.successRate || 0) < criteria.minSuccessRate) {
            return false;
          }
          return true;
        });
      }

      return sequences.sort((a, b) => b.metadata.createdAt.getTime() - a.metadata.createdAt.getTime());
    } catch (error) {
      log.error('Failed to list sequences', error as Error);
      return [];
    }
  }

  /**
   * Delete a sequence
   */
  async deleteSequence(name: string): Promise<boolean> {
    try {
      const filePath = path.join(this.config.sequencesPath, `${name}.json`);
      
      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath);
        this.sequences.delete(name);
        log.info(`Sequence "${name}" deleted successfully`);
        return true;
      }

      return false;
    } catch (error) {
      log.error(`Failed to delete sequence "${name}"`, error as Error);
      return false;
    }
  }

  /**
   * Rename a sequence
   */
  async renameSequence(oldName: string, newName: string): Promise<boolean> {
    try {
      if (this.sequences.has(newName)) {
        throw new Error(`Sequence with name "${newName}" already exists`);
      }

      const sequence = await this.loadSequence(oldName);
      if (!sequence) {
        throw new Error(`Sequence "${oldName}" not found`);
      }

      // Update the name in metadata
      sequence.metadata.name = newName;

      // Save with new name
      const newFilePath = path.join(this.config.sequencesPath, `${newName}.json`);
      await fs.writeJSON(newFilePath, sequence, { spaces: 2 });

      // Delete old file
      const oldFilePath = path.join(this.config.sequencesPath, `${oldName}.json`);
      await fs.remove(oldFilePath);

      // Update in memory
      this.sequences.delete(oldName);
      this.sequences.set(newName, sequence);

      log.info(`Sequence renamed from "${oldName}" to "${newName}"`);
      return true;
    } catch (error) {
      log.error(`Failed to rename sequence from "${oldName}" to "${newName}"`, error as Error);
      return false;
    }
  }

  /**
   * Get sequence statistics
   */
  async getStatistics(): Promise<{
    totalSequences: number;
    totalExecutions: number;
    averageSuccessRate: number;
    mostUsedSequence?: string;
    categories: string[];
  }> {
    try {
      await this.loadAllSequences();
      const sequences = Array.from(this.sequences.values());

      const totalSequences = sequences.length;
      const totalExecutions = sequences.reduce((sum, seq) => sum + seq.metadata.usageCount, 0);
      const averageSuccessRate = sequences.length > 0 
        ? Math.round(sequences.reduce((sum, seq) => sum + (seq.metadata.successRate || 0), 0) / sequences.length)
        : 0;

      const mostUsed = sequences.reduce((max, seq) => 
        seq.metadata.usageCount > (max?.metadata.usageCount || 0) ? seq : max, sequences[0]);

      const categories = [...new Set(sequences
        .map(seq => seq.metadata.category)
        .filter(Boolean))] as string[];

      return {
        totalSequences,
        totalExecutions,
        averageSuccessRate,
        mostUsedSequence: mostUsed?.metadata.name,
        categories
      };
    } catch (error) {
      log.error('Failed to get sequence statistics', error as Error);
      return {
        totalSequences: 0,
        totalExecutions: 0,
        averageSuccessRate: 0,
        categories: []
      };
    }
  }

  /**
   * Load all sequences from disk
   */
  private async loadAllSequences(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.sequencesPath);
      const jsonFiles = files.filter(file => file.endsWith('.json'));

      for (const file of jsonFiles) {
        const filePath = path.join(this.config.sequencesPath, file);
        const rawSequence = await fs.readJSON(filePath);
        const sequence = this.normalizeSequenceDates(rawSequence);
        const name = path.basename(file, '.json');
        this.sequences.set(name, sequence);
      }
    } catch (error) {
      log.error('Failed to load sequences from disk', error as Error);
    }
  }

  /**
   * Normalize date fields in a sequence loaded from JSON
   */
  private normalizeSequenceDates(rawSequence: any): AutomationSequence {
    // Convert string dates back to Date objects
    const sequence = rawSequence as AutomationSequence;
    
    // Fix metadata dates
    if (sequence.metadata.createdAt && typeof sequence.metadata.createdAt === 'string') {
      sequence.metadata.createdAt = new Date(sequence.metadata.createdAt);
    }
    if (sequence.metadata.lastUsed && typeof sequence.metadata.lastUsed === 'string') {
      sequence.metadata.lastUsed = new Date(sequence.metadata.lastUsed);
    }

    // Fix execution history dates
    if (sequence.executionHistory && Array.isArray(sequence.executionHistory)) {
      sequence.executionHistory = sequence.executionHistory.map(history => ({
        ...history,
        timestamp: typeof history.timestamp === 'string' ? new Date(history.timestamp) : history.timestamp
      }));
    }

    return sequence;
  }

  /**
   * Export sequences to a backup file
   */
  async exportSequences(exportPath: string): Promise<void> {
    try {
      await this.loadAllSequences();
      const sequences = Array.from(this.sequences.values());
      await fs.writeJSON(exportPath, sequences, { spaces: 2 });
      log.info(`Exported ${sequences.length} sequences to ${exportPath}`);
    } catch (error) {
      log.error('Failed to export sequences', error as Error);
      throw error;
    }
  }

  /**
   * Import sequences from a backup file
   */
  async importSequences(importPath: string, overwrite: boolean = false): Promise<number> {
    try {
      const sequences = await fs.readJSON(importPath) as AutomationSequence[];
      let importedCount = 0;

      for (const sequence of sequences) {
        const name = sequence.metadata.name;
        
        if (this.sequences.has(name) && !overwrite) {
          log.warn(`Sequence "${name}" already exists, skipping`);
          continue;
        }

        const filePath = path.join(this.config.sequencesPath, `${name}.json`);
        await fs.writeJSON(filePath, sequence, { spaces: 2 });
        this.sequences.set(name, sequence);
        importedCount++;
      }

      log.info(`Imported ${importedCount} sequences from ${importPath}`);
      return importedCount;
    } catch (error) {
      log.error('Failed to import sequences', error as Error);
      throw error;
    }
  }

  /**
   * Append a new automation to an existing sequence
   */
  async appendToSequence(
    sequenceName: string,
    newPrompt: string,
    executionResult: AutomationExecutionResult
  ): Promise<AutomationSequence> {
    try {
      // Load the existing sequence
      const existingSequence = await this.loadSequence(sequenceName);
      if (!existingSequence) {
        throw new Error(`Sequence "${sequenceName}" not found`);
      }

      // Only append successful automations
      if (!executionResult.success) {
        throw new Error('Cannot append failed automation to sequence');
      }

      // Count current commands (split by newlines and filter empty)
      const currentCommands = existingSequence.originalPrompt.split('\n').filter(line => line.trim());
      const commandNumber = currentCommands.length + 1;

      // Append to the original prompt
      const updatedPrompt = existingSequence.originalPrompt + `\n${commandNumber}. ${newPrompt}`;

      // Combine actions from existing sequence and new automation
      const updatedActions = [...existingSequence.script.actions, ...executionResult.script.actions];

      // Update the script
      const updatedScript = {
        ...existingSequence.script,
        description: `Interactive session: ${commandNumber} commands`,
        actions: updatedActions
      };

      // Update metadata
      const updatedMetadata = {
        ...existingSequence.metadata,
        lastUsed: new Date(),
        // Keep the same usage count since this is just extending, not executing
      };

      // Create updated sequence
      const updatedSequence: AutomationSequence = {
        metadata: updatedMetadata,
        originalPrompt: updatedPrompt,
        script: updatedScript,
        executionHistory: existingSequence.executionHistory // Keep existing history
      };

      // Save the updated sequence
      const filePath = path.join(this.config.sequencesPath, `${sequenceName}.json`);
      await fs.writeJSON(filePath, updatedSequence, { spaces: 2 });

      // Update in memory
      this.sequences.set(sequenceName, updatedSequence);

      // Create backup if enabled
      if (this.config.autoBackup && this.config.backupPath) {
        const backupPath = path.join(this.config.backupPath, `${sequenceName}_append_${Date.now()}.json`);
        await fs.writeJSON(backupPath, updatedSequence, { spaces: 2 });
      }

      log.info(`Appended automation to sequence "${sequenceName}"`);
      return updatedSequence;

    } catch (error) {
      log.error(`Failed to append to sequence "${sequenceName}"`, error as Error);
      throw error;
    }
  }
} 