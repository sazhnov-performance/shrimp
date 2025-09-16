import { promises as fs } from 'fs';
import path from 'path';
import {
  IContextStorageAdapter,
  AIContextSession,
  InvestigationResult,
  ElementDiscovery,
  WorkingMemoryState,
  StepContextSummary,
  AIContextConfig
} from './types';

// Memory Storage Implementation
export class MemoryStorageAdapter implements IContextStorageAdapter {
  private sessions = new Map<string, AIContextSession>();
  private investigations = new Map<string, Map<number, InvestigationResult[]>>();
  private elementDiscoveries = new Map<string, Map<number, ElementDiscovery[]>>();
  private workingMemory = new Map<string, WorkingMemoryState>();
  private contextSummaries = new Map<string, Map<number, StepContextSummary>>();

  async saveSession(session: AIContextSession): Promise<void> {
    this.sessions.set(session.sessionId, session);
  }

  async loadSession(sessionId: string): Promise<AIContextSession | null> {
    return this.sessions.get(sessionId) || null;
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    this.investigations.delete(sessionId);
    this.elementDiscoveries.delete(sessionId);
    this.workingMemory.delete(sessionId);
    this.contextSummaries.delete(sessionId);
  }

  async listSessions(): Promise<string[]> {
    return Array.from(this.sessions.keys());
  }

  async saveInvestigationResult(sessionId: string, stepIndex: number, result: InvestigationResult): Promise<void> {
    if (!this.investigations.has(sessionId)) {
      this.investigations.set(sessionId, new Map());
    }
    const sessionInvestigations = this.investigations.get(sessionId)!;
    
    if (!sessionInvestigations.has(stepIndex)) {
      sessionInvestigations.set(stepIndex, []);
    }
    sessionInvestigations.get(stepIndex)!.push(result);
  }

  async loadInvestigationResults(sessionId: string, stepIndex: number): Promise<InvestigationResult[]> {
    const sessionInvestigations = this.investigations.get(sessionId);
    if (!sessionInvestigations) return [];
    return sessionInvestigations.get(stepIndex) || [];
  }

  async saveElementDiscovery(sessionId: string, stepIndex: number, discovery: ElementDiscovery): Promise<void> {
    if (!this.elementDiscoveries.has(sessionId)) {
      this.elementDiscoveries.set(sessionId, new Map());
    }
    const sessionDiscoveries = this.elementDiscoveries.get(sessionId)!;
    
    if (!sessionDiscoveries.has(stepIndex)) {
      sessionDiscoveries.set(stepIndex, []);
    }
    sessionDiscoveries.get(stepIndex)!.push(discovery);
  }

  async loadElementDiscoveries(sessionId: string, stepIndex: number): Promise<ElementDiscovery[]> {
    const sessionDiscoveries = this.elementDiscoveries.get(sessionId);
    if (!sessionDiscoveries) return [];
    return sessionDiscoveries.get(stepIndex) || [];
  }

  async saveWorkingMemory(sessionId: string, memory: WorkingMemoryState): Promise<void> {
    this.workingMemory.set(sessionId, memory);
  }

  async loadWorkingMemory(sessionId: string): Promise<WorkingMemoryState | null> {
    return this.workingMemory.get(sessionId) || null;
  }

  async saveContextSummary(sessionId: string, summary: StepContextSummary): Promise<void> {
    if (!this.contextSummaries.has(sessionId)) {
      this.contextSummaries.set(sessionId, new Map());
    }
    const sessionSummaries = this.contextSummaries.get(sessionId)!;
    sessionSummaries.set(summary.stepIndex, summary);
  }

  async loadContextSummaries(sessionId: string, stepRange?: [number, number]): Promise<StepContextSummary[]> {
    const sessionSummaries = this.contextSummaries.get(sessionId);
    if (!sessionSummaries) return [];

    const summaries = Array.from(sessionSummaries.values());
    
    if (stepRange) {
      const [start, end] = stepRange;
      return summaries.filter(s => s.stepIndex >= start && s.stepIndex <= end);
    }
    
    return summaries.sort((a, b) => a.stepIndex - b.stepIndex);
  }
}

// File System Storage Implementation
export class FileSystemStorageAdapter implements IContextStorageAdapter {
  private readonly baseDir: string;

  constructor(baseDir: string = './ai-context-data') {
    this.baseDir = baseDir;
  }

  private async ensureDir(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  private getSessionPath(sessionId: string): string {
    return path.join(this.baseDir, 'sessions', `${sessionId}.json`);
  }

  private getInvestigationPath(sessionId: string, stepIndex: number): string {
    return path.join(this.baseDir, 'investigations', sessionId, `step-${stepIndex}.json`);
  }

  private getElementDiscoveryPath(sessionId: string, stepIndex: number): string {
    return path.join(this.baseDir, 'discoveries', sessionId, `step-${stepIndex}.json`);
  }

  private getWorkingMemoryPath(sessionId: string): string {
    return path.join(this.baseDir, 'memory', `${sessionId}.json`);
  }

  private getContextSummaryPath(sessionId: string): string {
    return path.join(this.baseDir, 'summaries', `${sessionId}.json`);
  }

  private async writeJSON(filePath: string, data: any): Promise<void> {
    await this.ensureDir(path.dirname(filePath));
    
    // Convert Maps to objects for JSON serialization
    const serializedData = this.serializeForJSON(data);
    await fs.writeFile(filePath, JSON.stringify(serializedData, null, 2));
  }

  private async readJSON<T>(filePath: string): Promise<T | null> {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);
      return this.deserializeFromJSON(parsed);
    } catch (error) {
      return null;
    }
  }

  private serializeForJSON(obj: any): any {
    if (obj instanceof Map) {
      return Object.fromEntries(obj);
    }
    if (obj instanceof Date) {
      return obj.toISOString();
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.serializeForJSON(item));
    }
    if (obj && typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.serializeForJSON(value);
      }
      return result;
    }
    return obj;
  }

  private deserializeFromJSON(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.deserializeFromJSON(item));
    }
    if (obj && typeof obj === 'object') {
      // Check if this looks like a WorkingMemoryState with Maps
      if (obj.knownElements && typeof obj.knownElements === 'object') {
        obj.knownElements = new Map(Object.entries(obj.knownElements));
      }
      if (obj.extractedVariables && typeof obj.extractedVariables === 'object') {
        obj.extractedVariables = new Map(Object.entries(obj.extractedVariables));
      }
      
      // Convert ISO date strings back to Date objects
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
          obj[key] = new Date(value);
        } else {
          obj[key] = this.deserializeFromJSON(value);
        }
      }
    }
    return obj;
  }

  async saveSession(session: AIContextSession): Promise<void> {
    await this.writeJSON(this.getSessionPath(session.sessionId), session);
  }

  async loadSession(sessionId: string): Promise<AIContextSession | null> {
    return await this.readJSON<AIContextSession>(this.getSessionPath(sessionId));
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      await fs.unlink(this.getSessionPath(sessionId));
    } catch (error) {
      // File might not exist
    }
    
    // Clean up related data
    try {
      await fs.rm(path.join(this.baseDir, 'investigations', sessionId), { recursive: true, force: true });
      await fs.rm(path.join(this.baseDir, 'discoveries', sessionId), { recursive: true, force: true });
      await fs.unlink(this.getWorkingMemoryPath(sessionId));
      await fs.unlink(this.getContextSummaryPath(sessionId));
    } catch (error) {
      // Files might not exist
    }
  }

  async listSessions(): Promise<string[]> {
    try {
      const sessionsDir = path.join(this.baseDir, 'sessions');
      const files = await fs.readdir(sessionsDir);
      return files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
    } catch (error) {
      return [];
    }
  }

  async saveInvestigationResult(sessionId: string, stepIndex: number, result: InvestigationResult): Promise<void> {
    const filePath = this.getInvestigationPath(sessionId, stepIndex);
    const existing = await this.readJSON<InvestigationResult[]>(filePath) || [];
    existing.push(result);
    await this.writeJSON(filePath, existing);
  }

  async loadInvestigationResults(sessionId: string, stepIndex: number): Promise<InvestigationResult[]> {
    return await this.readJSON<InvestigationResult[]>(this.getInvestigationPath(sessionId, stepIndex)) || [];
  }

  async saveElementDiscovery(sessionId: string, stepIndex: number, discovery: ElementDiscovery): Promise<void> {
    const filePath = this.getElementDiscoveryPath(sessionId, stepIndex);
    const existing = await this.readJSON<ElementDiscovery[]>(filePath) || [];
    existing.push(discovery);
    await this.writeJSON(filePath, existing);
  }

  async loadElementDiscoveries(sessionId: string, stepIndex: number): Promise<ElementDiscovery[]> {
    return await this.readJSON<ElementDiscovery[]>(this.getElementDiscoveryPath(sessionId, stepIndex)) || [];
  }

  async saveWorkingMemory(sessionId: string, memory: WorkingMemoryState): Promise<void> {
    await this.writeJSON(this.getWorkingMemoryPath(sessionId), memory);
  }

  async loadWorkingMemory(sessionId: string): Promise<WorkingMemoryState | null> {
    return await this.readJSON<WorkingMemoryState>(this.getWorkingMemoryPath(sessionId));
  }

  async saveContextSummary(sessionId: string, summary: StepContextSummary): Promise<void> {
    const filePath = this.getContextSummaryPath(sessionId);
    const existing = await this.readJSON<Record<string, StepContextSummary>>(filePath) || {};
    existing[summary.stepIndex.toString()] = summary;
    await this.writeJSON(filePath, existing);
  }

  async loadContextSummaries(sessionId: string, stepRange?: [number, number]): Promise<StepContextSummary[]> {
    const data = await this.readJSON<Record<string, StepContextSummary>>(this.getContextSummaryPath(sessionId));
    if (!data) return [];

    const summaries = Object.values(data);
    
    if (stepRange) {
      const [start, end] = stepRange;
      return summaries.filter(s => s.stepIndex >= start && s.stepIndex <= end);
    }
    
    return summaries.sort((a, b) => a.stepIndex - b.stepIndex);
  }
}

// Database Storage Implementation (placeholder for future extension)
export class DatabaseStorageAdapter implements IContextStorageAdapter {
  private connectionString: string;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  async saveSession(session: AIContextSession): Promise<void> {
    throw new Error('Database storage not yet implemented');
  }

  async loadSession(sessionId: string): Promise<AIContextSession | null> {
    throw new Error('Database storage not yet implemented');
  }

  async deleteSession(sessionId: string): Promise<void> {
    throw new Error('Database storage not yet implemented');
  }

  async listSessions(): Promise<string[]> {
    throw new Error('Database storage not yet implemented');
  }

  async saveInvestigationResult(sessionId: string, stepIndex: number, result: InvestigationResult): Promise<void> {
    throw new Error('Database storage not yet implemented');
  }

  async loadInvestigationResults(sessionId: string, stepIndex: number): Promise<InvestigationResult[]> {
    throw new Error('Database storage not yet implemented');
  }

  async saveElementDiscovery(sessionId: string, stepIndex: number, discovery: ElementDiscovery): Promise<void> {
    throw new Error('Database storage not yet implemented');
  }

  async loadElementDiscoveries(sessionId: string, stepIndex: number): Promise<ElementDiscovery[]> {
    throw new Error('Database storage not yet implemented');
  }

  async saveWorkingMemory(sessionId: string, memory: WorkingMemoryState): Promise<void> {
    throw new Error('Database storage not yet implemented');
  }

  async loadWorkingMemory(sessionId: string): Promise<WorkingMemoryState | null> {
    throw new Error('Database storage not yet implemented');
  }

  async saveContextSummary(sessionId: string, summary: StepContextSummary): Promise<void> {
    throw new Error('Database storage not yet implemented');
  }

  async loadContextSummaries(sessionId: string, stepRange?: [number, number]): Promise<StepContextSummary[]> {
    throw new Error('Database storage not yet implemented');
  }
}

// Storage Adapter Factory
export class StorageAdapterFactory {
  static createAdapter(config: AIContextConfig): IContextStorageAdapter {
    switch (config.storage.adapter) {
      case 'memory':
        return new MemoryStorageAdapter();
      
      case 'filesystem':
        return new FileSystemStorageAdapter();
      
      case 'database':
        // In a real implementation, this would use the database connection string from config
        throw new Error('Database storage adapter not yet implemented. Please use memory or filesystem.');
      
      default:
        throw new Error(`Unknown storage adapter: ${config.storage.adapter}`);
    }
  }
}

// Utility functions for storage operations
export class StorageUtils {
  static compressDOM(dom: string, threshold: number): string {
    if (dom.length <= threshold) {
      return dom;
    }
    
    // Simple compression: remove excessive whitespace and comments
    return dom
      .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
      .replace(/>\s+</g, '><') // Remove whitespace between tags
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .trim();
  }

  static truncateString(str: string, maxLength: number): string {
    if (str.length <= maxLength) {
      return str;
    }
    return str.substring(0, maxLength - 3) + '...';
  }

  static validateSessionId(sessionId: string): boolean {
    // Basic UUID validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(sessionId);
  }

  static cleanupExpiredSessions(
    sessions: Map<string, any>, 
    ttlMs: number
  ): void {
    const now = Date.now();
    for (const [sessionId, sessionData] of sessions.entries()) {
      const lastActivity = sessionData.lastActivity || sessionData.createdAt;
      if (now - lastActivity.getTime() > ttlMs) {
        sessions.delete(sessionId);
      }
    }
  }
}
