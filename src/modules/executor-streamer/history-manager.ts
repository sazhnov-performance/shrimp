/**
 * History Manager - Handles event history, persistence, and replay functionality
 * Manages event storage, retrieval, and replay capabilities for stream sessions
 */

import {
  StreamEvent,
  StreamEventType
} from '../../../types/shared-types';

import {
  StreamHistory,
  StreamReplay,
  HistoryFilter,
  StreamSession,
  StreamClient,
  ExecutorStreamerConfig
} from './types';

import { EventPublisher } from './event-publisher';

// Storage backends
interface HistoryStorage {
  save(streamId: string, events: StreamEvent[]): Promise<void>;
  load(streamId: string): Promise<StreamEvent[]>;
  append(streamId: string, event: StreamEvent): Promise<void>;
  delete(streamId: string): Promise<void>;
  compact(streamId: string, keepCount: number): Promise<void>;
  search(streamId: string, filters: HistoryFilter): Promise<StreamEvent[]>;
}

// In-memory storage implementation
class MemoryHistoryStorage implements HistoryStorage {
  private storage: Map<string, StreamEvent[]> = new Map();

  async save(streamId: string, events: StreamEvent[]): Promise<void> {
    this.storage.set(streamId, [...events]);
  }

  async load(streamId: string): Promise<StreamEvent[]> {
    return [...(this.storage.get(streamId) || [])];
  }

  async append(streamId: string, event: StreamEvent): Promise<void> {
    const existing = this.storage.get(streamId) || [];
    existing.push(event);
    this.storage.set(streamId, existing);
  }

  async delete(streamId: string): Promise<void> {
    this.storage.delete(streamId);
  }

  async compact(streamId: string, keepCount: number): Promise<void> {
    const events = this.storage.get(streamId) || [];
    if (events.length > keepCount) {
      const compacted = events.slice(-keepCount);
      this.storage.set(streamId, compacted);
    }
  }

  async search(streamId: string, filters: HistoryFilter): Promise<StreamEvent[]> {
    const events = this.storage.get(streamId) || [];
    return this.applyFilters(events, filters);
  }

  private applyFilters(events: StreamEvent[], filters: HistoryFilter): StreamEvent[] {
    let filtered = [...events];

    // Filter by event types
    if (filters.eventTypes && filters.eventTypes.length > 0) {
      filtered = filtered.filter(event => 
        filters.eventTypes!.includes(event.type)
      );
    }

    // Filter by time range
    if (filters.startTime || filters.endTime) {
      filtered = filtered.filter(event => {
        const eventTime = event.timestamp.getTime();
        if (filters.startTime && eventTime < filters.startTime.getTime()) {
          return false;
        }
        if (filters.endTime && eventTime > filters.endTime.getTime()) {
          return false;
        }
        return true;
      });
    }

    // Filter by search text (simple text search in event data)
    if (filters.searchText) {
      const searchText = filters.searchText.toLowerCase();
      filtered = filtered.filter(event => {
        const eventString = JSON.stringify(event).toLowerCase();
        return eventString.includes(searchText);
      });
    }

    // Sort by timestamp (newest first by default)
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply offset and limit
    if (filters.offset || filters.limit) {
      const start = filters.offset || 0;
      const end = filters.limit ? start + filters.limit : undefined;
      filtered = filtered.slice(start, end);
    }

    return filtered;
  }

  getStats() {
    const totalStreams = this.storage.size;
    const totalEvents = Array.from(this.storage.values())
      .reduce((sum, events) => sum + events.length, 0);
    const memoryUsage = this.estimateMemoryUsage();

    return {
      totalStreams,
      totalEvents,
      averageEventsPerStream: totalStreams > 0 ? totalEvents / totalStreams : 0,
      memoryUsage
    };
  }

  private estimateMemoryUsage(): number {
    // Rough estimation of memory usage in bytes
    let totalSize = 0;
    for (const events of this.storage.values()) {
      for (const event of events) {
        // Rough estimation: JSON.stringify length * 2 (UTF-16)
        totalSize += JSON.stringify(event).length * 2;
      }
    }
    return totalSize;
  }
}

export class HistoryManager implements StreamHistory, StreamReplay {
  private storage: HistoryStorage;
  private eventPublisher: EventPublisher;
  private config: ExecutorStreamerConfig;
  private compactionTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(eventPublisher: EventPublisher, config: ExecutorStreamerConfig) {
    this.eventPublisher = eventPublisher;
    this.config = config;
    this.storage = this.createStorage();
  }

  // StreamHistory Implementation

  async addEvent(streamId: string, event: StreamEvent): Promise<void> {
    // Validate event
    const validation = this.eventPublisher.validateEvent(event);
    if (!validation.isValid) {
      throw new Error(`Cannot add invalid event to history: ${validation.errors.join(', ')}`);
    }

    try {
      await this.storage.append(streamId, event);
      
      // Schedule compaction if needed
      this.scheduleCompaction(streamId);
    } catch (error) {
      throw new Error(`Failed to add event to history: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getEvents(streamId: string, filters?: HistoryFilter): Promise<StreamEvent[]> {
    try {
      if (filters) {
        return await this.storage.search(streamId, filters);
      } else {
        return await this.storage.load(streamId);
      }
    } catch (error) {
      console.error(`Failed to get events for stream ${streamId}:`, error);
      return [];
    }
  }

  async getEventsByTimeRange(streamId: string, start: Date, end: Date): Promise<StreamEvent[]> {
    const filters: HistoryFilter = {
      startTime: start,
      endTime: end
    };
    return await this.getEvents(streamId, filters);
  }

  async getEventsByType(streamId: string, types: StreamEventType[]): Promise<StreamEvent[]> {
    const filters: HistoryFilter = {
      eventTypes: types
    };
    return await this.getEvents(streamId, filters);
  }

  async clearHistory(streamId: string): Promise<void> {
    try {
      await this.storage.delete(streamId);
      this.clearCompactionTimer(streamId);
    } catch (error) {
      throw new Error(`Failed to clear history for stream ${streamId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async compactHistory(streamId: string, keepCount: number): Promise<void> {
    try {
      await this.storage.compact(streamId, keepCount);
    } catch (error) {
      throw new Error(`Failed to compact history for stream ${streamId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // StreamReplay Implementation

  async replayToClient(clientId: string, filters?: HistoryFilter): Promise<void> {
    // This would need to be coordinated with client manager to get the client's stream
    // For now, this is a placeholder implementation
    console.log(`Replay to client ${clientId} with filters:`, filters);
  }

  async replayFromTimestamp(clientId: string, timestamp: Date): Promise<void> {
    const filters: HistoryFilter = {
      startTime: timestamp
    };
    await this.replayToClient(clientId, filters);
  }

  async replayLastEvents(clientId: string, count: number): Promise<void> {
    const filters: HistoryFilter = {
      limit: count
    };
    await this.replayToClient(clientId, filters);
  }

  // Advanced replay methods

  async replayToClientFiltered(
    streamId: string,
    client: StreamClient,
    filters?: HistoryFilter
  ): Promise<number> {
    try {
      const events = await this.getEvents(streamId, filters);
      
      // Filter events for the specific client
      const filteredEvents = this.eventPublisher.filterEventsForClient(events, client);
      
      // Send events to client (this would need integration with client manager/handlers)
      let sentCount = 0;
      for (const event of filteredEvents) {
        try {
          // This is a placeholder - actual implementation would depend on client type
          console.log(`Replaying event ${event.id} to client ${client.id}`);
          sentCount++;
          
          // Add small delay between events to avoid overwhelming the client
          await new Promise(resolve => setTimeout(resolve, 10));
        } catch (error) {
          console.error(`Failed to replay event ${event.id} to client ${client.id}:`, error);
          break;
        }
      }
      
      return sentCount;
    } catch (error) {
      console.error(`Failed to replay events to client ${client.id}:`, error);
      return 0;
    }
  }

  async replayStreamHistory(
    streamId: string,
    client: StreamClient,
    options: {
      maxEvents?: number;
      sinceTimestamp?: Date;
      eventTypes?: StreamEventType[];
      batchSize?: number;
    } = {}
  ): Promise<{
    eventsReplayed: number;
    totalEvents: number;
    duration: number;
  }> {
    const startTime = Date.now();
    
    const filters: HistoryFilter = {
      limit: options.maxEvents,
      startTime: options.sinceTimestamp,
      eventTypes: options.eventTypes
    };

    const allEvents = await this.getEvents(streamId, filters);
    const batchSize = options.batchSize || 50;
    
    let eventsReplayed = 0;
    
    // Send events in batches
    for (let i = 0; i < allEvents.length; i += batchSize) {
      const batch = allEvents.slice(i, i + batchSize);
      const filteredBatch = this.eventPublisher.filterEventsForClient(batch, client);
      
      for (const event of filteredBatch) {
        try {
          // Placeholder for actual event sending
          console.log(`Replaying event ${event.id} to client ${client.id}`);
          eventsReplayed++;
        } catch (error) {
          console.error(`Failed to replay event ${event.id}:`, error);
        }
      }
      
      // Brief pause between batches
      if (i + batchSize < allEvents.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    const duration = Date.now() - startTime;
    
    return {
      eventsReplayed,
      totalEvents: allEvents.length,
      duration
    };
  }

  // History management and maintenance

  async getHistoryStats(streamId: string): Promise<{
    totalEvents: number;
    eventsByType: Record<StreamEventType, number>;
    timeRange: { oldest: Date; newest: Date } | null;
    memoryUsage: number;
    averageEventSize: number;
  }> {
    const events = await this.getEvents(streamId);
    
    if (events.length === 0) {
      return {
        totalEvents: 0,
        eventsByType: {} as Record<StreamEventType, number>,
        timeRange: null,
        memoryUsage: 0,
        averageEventSize: 0
      };
    }

    // Count events by type
    const eventsByType: Record<StreamEventType, number> = {} as Record<StreamEventType, number>;
    let totalSize = 0;

    for (const event of events) {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      totalSize += JSON.stringify(event).length * 2; // Rough UTF-16 estimation
    }

    // Find time range
    const timestamps = events.map(e => e.timestamp.getTime());
    const timeRange = {
      oldest: new Date(Math.min(...timestamps)),
      newest: new Date(Math.max(...timestamps))
    };

    return {
      totalEvents: events.length,
      eventsByType,
      timeRange,
      memoryUsage: totalSize,
      averageEventSize: totalSize / events.length
    };
  }

  async performMaintenance(streamId: string): Promise<{
    eventsRemoved: number;
    spaceSaved: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let eventsRemoved = 0;
    let spaceSaved = 0;

    try {
      const beforeStats = await this.getHistoryStats(streamId);
      const beforeSize = beforeStats.memoryUsage;
      
      // Apply retention policy
      const maxAge = this.config.defaultStreamConfig.persistence.retentionPeriod;
      const cutoffTime = new Date(Date.now() - maxAge);
      
      const recentEvents = await this.getEventsByTimeRange(
        streamId, 
        cutoffTime, 
        new Date()
      );
      
      // Save only recent events
      await this.storage.save(streamId, recentEvents);
      
      const afterStats = await this.getHistoryStats(streamId);
      eventsRemoved = beforeStats.totalEvents - afterStats.totalEvents;
      spaceSaved = beforeSize - afterStats.memoryUsage;

    } catch (error) {
      errors.push(`Maintenance failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      eventsRemoved,
      spaceSaved,
      errors
    };
  }

  // Private helper methods

  private createStorage(): HistoryStorage {
    switch (this.config.persistence.storageBackend) {
      case 'memory':
        return new MemoryHistoryStorage();
      case 'file':
        // TODO: Implement file-based storage
        console.warn('File storage not implemented, falling back to memory');
        return new MemoryHistoryStorage();
      case 'database':
        // TODO: Implement database storage
        console.warn('Database storage not implemented, falling back to memory');
        return new MemoryHistoryStorage();
      default:
        return new MemoryHistoryStorage();
    }
  }

  private scheduleCompaction(streamId: string): void {
    // Clear existing timer
    this.clearCompactionTimer(streamId);

    // Schedule compaction check
    const timer = setTimeout(async () => {
      try {
        const stats = await this.getHistoryStats(streamId);
        const maxEvents = this.config.defaultStreamConfig.maxHistorySize;
        
        if (stats.totalEvents > maxEvents) {
          await this.compactHistory(streamId, maxEvents);
        }
      } catch (error) {
        console.error(`Failed to compact history for stream ${streamId}:`, error);
      } finally {
        this.compactionTimers.delete(streamId);
      }
    }, 60000); // Check every minute

    this.compactionTimers.set(streamId, timer);
  }

  private clearCompactionTimer(streamId: string): void {
    const timer = this.compactionTimers.get(streamId);
    if (timer) {
      clearTimeout(timer);
      this.compactionTimers.delete(streamId);
    }
  }

  getStorageStats() {
    if (this.storage instanceof MemoryHistoryStorage) {
      return this.storage.getStats();
    }
    return {
      totalStreams: 0,
      totalEvents: 0,
      averageEventsPerStream: 0,
      memoryUsage: 0
    };
  }

  // Cleanup
  async shutdown(): Promise<void> {
    console.log('Shutting down history manager...');
    
    // Clear all compaction timers
    for (const timer of this.compactionTimers.values()) {
      clearTimeout(timer);
    }
    this.compactionTimers.clear();
    
    console.log('History manager shutdown complete');
  }
}
