import { LocalIndex } from 'vectra';
import OpenAI from 'openai';
import path from 'path';
import fs from 'fs-extra';
import { DocumentChunk, DocumentProcessor } from './DocumentProcessor';
import { Config } from '../utils/config';
import { log } from '../utils/logger';

/**
 * Search result from vector store
 */
export interface SearchResult {
  chunk: DocumentChunk;
  score: number;
}

/**
 * Vector store for Playwright documentation
 */
export class VectorStore {
  private index: LocalIndex | null = null;
  private openai: OpenAI;
  private processor: DocumentProcessor;
  private indexPath: string;
  private isInitialized = false;

  constructor() {
    this.openai = new OpenAI({ apiKey: Config.OPENAI_API_KEY });
    this.processor = new DocumentProcessor();
    this.indexPath = path.join(process.cwd(), '.vectra-index');
  }

  /**
   * Initialize the vector store
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Try to load existing index
      if (await fs.pathExists(this.indexPath)) {
        this.index = new LocalIndex(this.indexPath);
        await this.index.isIndexCreated();
        this.isInitialized = true;
        log.info('Loaded existing vector index');
        return;
      }

      // Create new index
      await this.createIndex();
      this.isInitialized = true;
    } catch (error) {
      log.error('Failed to initialize vector store', error as Error);
      throw error;
    }
  }

  /**
   * Create a new vector index
   */
  private async createIndex(): Promise<void> {
    log.info('Creating new vector index for Playwright docs...');

    // Create index
    this.index = new LocalIndex(this.indexPath);
    await this.index.createIndex();

    // Load and process documents
    const chunks = await this.processor.loadPlaywrightDocs();
    log.info(`Processing ${chunks.length} document chunks...`);

    // Add documents to index
    for (const chunk of chunks) {
      const embedding = await this.createEmbedding(chunk.content);
      await this.index.insertItem({
        vector: embedding,
        metadata: {
          id: chunk.id,
          content: chunk.content,
          source: chunk.metadata.source,
          section: chunk.metadata.section,
          type: chunk.metadata.type,
          tags: chunk.metadata.tags.join(',') // Store as comma-separated string
        }
      });
    }

    log.info('Vector index created successfully');
  }

  /**
   * Search for relevant documentation
   */
  async search(query: string, topK: number = 5): Promise<SearchResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.index) {
      throw new Error('Vector store not initialized');
    }

    // Create query embedding
    const queryEmbedding = await this.createEmbedding(query);

    // Search index
    const results = await this.index.queryItems(queryEmbedding, topK);

    // Format results
    return results.map(result => ({
      chunk: {
        id: result.item.metadata.id as string,
        content: result.item.metadata.content as string,
        metadata: {
          source: result.item.metadata.source as string,
          section: result.item.metadata.section as string,
          type: result.item.metadata.type as 'api' | 'guide' | 'example',
          tags: (result.item.metadata.tags as string).split(',')
        }
      },
      score: result.score
    }));
  }

  /**
   * Create embedding for text
   */
  private async createEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text
      });

      return response.data[0].embedding;
    } catch (error) {
      log.error('Failed to create embedding', error as Error);
      throw error;
    }
  }

  /**
   * Get relevant context for a task
   */
  async getRelevantContext(task: string, currentError?: string): Promise<string> {
    const queries: string[] = [task];

    // Add error-specific queries
    if (currentError) {
      if (currentError.includes('selector')) {
        queries.push('Playwright selector best practices');
        queries.push('Playwright modern selectors getByRole getByText');
      }
      if (currentError.includes('timeout')) {
        queries.push('Playwright wait timeout handling');
        queries.push('Playwright waitForSelector waitForLoadState');
      }
      if (currentError.includes('click')) {
        queries.push('Playwright click actions force click');
      }
      if (currentError.includes('navigation')) {
        queries.push('Playwright navigation goto waitForNavigation');
      }
    }

    // Search for each query
    const allResults: SearchResult[] = [];
    for (const query of queries) {
      const results = await this.search(query, 3);
      allResults.push(...results);
    }

    // Deduplicate and sort by score
    const uniqueResults = new Map<string, SearchResult>();
    for (const result of allResults) {
      const existing = uniqueResults.get(result.chunk.id);
      if (!existing || result.score > existing.score) {
        uniqueResults.set(result.chunk.id, result);
      }
    }

    // Format context
    const sortedResults = Array.from(uniqueResults.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    let context = 'Relevant Playwright Documentation:\n\n';
    for (const result of sortedResults) {
      context += `[${result.chunk.metadata.section}] (Score: ${result.score.toFixed(2)})\n`;
      context += result.chunk.content + '\n\n---\n\n';
    }

    return context;
  }

  /**
   * Update index with new documentation
   */
  async updateDocs(newChunks: DocumentChunk[]): Promise<void> {
    if (!this.index) {
      throw new Error('Vector store not initialized');
    }

    for (const chunk of newChunks) {
      const embedding = await this.createEmbedding(chunk.content);
      await this.index.upsertItem({
        vector: embedding,
        metadata: {
          id: chunk.id,
          content: chunk.content,
          source: chunk.metadata.source,
          section: chunk.metadata.section,
          type: chunk.metadata.type,
          tags: chunk.metadata.tags.join(',')
        }
      });
    }

    log.info(`Updated vector store with ${newChunks.length} new chunks`);
  }
}