/**
 * Analytics Manager - Provides stream analytics and monitoring capabilities
 * Tracks metrics, performance, and usage statistics for the streaming system
 */

import {
  StreamEventType
} from '../../../types/shared-types';

import {
  StreamAnalytics,
  StreamMetrics,
  StreamStats,
  ClientActivityReport,
  ClientType,
  ExecutorStreamerConfig
} from './types';

import { StreamManager } from './stream-manager';
import { ClientManager } from './client-manager';
import { HistoryManager } from './history-manager';

interface MetricSample {
  timestamp: Date;
  value: number;
}

interface EventMetrics {
  count: number;
  totalSize: number;
  averageSize: number;
  firstSeen: Date;
  lastSeen: Date;
}

export class AnalyticsManager implements StreamAnalytics {
  private streamManager: StreamManager;
  private clientManager: ClientManager;
  private historyManager: HistoryManager;
  private config: ExecutorStreamerConfig;
  
  // Metrics tracking
  private startTime: Date = new Date();
  private eventCounts: Map<StreamEventType, EventMetrics> = new Map();
  private eventsPerSecondSamples: MetricSample[] = [];
  private errorCount: number = 0;
  private totalEventsProcessed: number = 0;
  private totalDataTransferred: number = 0;
  
  // Sampling intervals
  private metricsInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    streamManager: StreamManager,
    clientManager: ClientManager,
    historyManager: HistoryManager,
    config: ExecutorStreamerConfig
  ) {
    this.streamManager = streamManager;
    this.clientManager = clientManager;
    this.historyManager = historyManager;
    this.config = config;
    
    if (config.performance.metricsEnabled) {
      this.startMetricsCollection();
    }
  }

  // StreamAnalytics Implementation

  getMetrics(): StreamMetrics {
    const now = Date.now();
    const uptime = now - this.startTime.getTime();
    
    // Calculate events per second (last minute average)
    const recentSamples = this.eventsPerSecondSamples.filter(
      sample => now - sample.timestamp.getTime() <= 60000
    );
    const eventsPerSecond = recentSamples.length > 0
      ? recentSamples.reduce((sum, sample) => sum + sample.value, 0) / recentSamples.length
      : 0;

    // Calculate average event size
    const totalEvents = Array.from(this.eventCounts.values())
      .reduce((sum, metrics) => sum + metrics.count, 0);
    const totalSize = Array.from(this.eventCounts.values())
      .reduce((sum, metrics) => sum + metrics.totalSize, 0);
    const averageEventSize = totalEvents > 0 ? totalSize / totalEvents : 0;

    // Get stream and client counts
    const streamStats = this.streamManager.getStats();
    const clientStats = this.clientManager.getClientStats();

    // Calculate error rate
    const errorRate = this.totalEventsProcessed > 0 
      ? this.errorCount / this.totalEventsProcessed 
      : 0;

    // Get memory usage estimate
    const storageStats = this.historyManager.getStorageStats();
    const memoryUsage = storageStats.memoryUsage + this.estimateAnalyticsMemoryUsage();

    return {
      totalStreams: streamStats.totalSessions,
      activeStreams: streamStats.activeSessions,
      totalClients: clientStats.total,
      eventsPerSecond,
      averageEventSize,
      memoryUsage,
      errorRate,
      uptime,
      clientsByType: clientStats.byType
    };
  }

  getStreamStats(streamId: string): StreamStats {
    // This would require mapping from streamId to workflowSessionId
    // For now, return default stats
    const clientCount = this.clientManager.getActiveClientCount();
    
    return {
      streamId,
      clientCount,
      totalEvents: 0,
      eventsInLastHour: 0,
      averageEventFrequency: 0,
      largestEventSize: 0,
      memoryUsage: 0
    };
  }

  getEventDistribution(timeRange: { start: Date; end: Date }): Record<StreamEventType, number> {
    const distribution: Record<StreamEventType, number> = {} as Record<StreamEventType, number>;
    
    for (const [eventType, metrics] of this.eventCounts) {
      // Simple check if event was seen in the time range
      if (metrics.firstSeen <= timeRange.end && metrics.lastSeen >= timeRange.start) {
        distribution[eventType] = metrics.count;
      }
    }
    
    return distribution;
  }

  getClientActivity(timeRange: { start: Date; end: Date }): ClientActivityReport[] {
    const clients = this.clientManager.getActiveClients();
    const reports: ClientActivityReport[] = [];
    
    for (const client of clients) {
      // Check if client was active during the time range
      const isInRange = client.connectedAt <= timeRange.end && 
        (client.isActive || client.lastPing >= timeRange.start);
      
      if (isInRange) {
        reports.push({
          clientId: client.id,
          clientType: client.type,
          connectTime: client.connectedAt,
          disconnectTime: client.isActive ? undefined : client.lastPing,
          eventsReceived: 0, // This would need to be tracked separately
          lastActivity: client.lastPing,
          isActive: client.isActive
        });
      }
    }
    
    return reports;
  }

  // Event tracking methods

  recordEvent(eventType: StreamEventType, eventSize: number): void {
    this.totalEventsProcessed++;
    this.totalDataTransferred += eventSize;
    
    let metrics = this.eventCounts.get(eventType);
    if (!metrics) {
      metrics = {
        count: 0,
        totalSize: 0,
        averageSize: 0,
        firstSeen: new Date(),
        lastSeen: new Date()
      };
      this.eventCounts.set(eventType, metrics);
    }
    
    metrics.count++;
    metrics.totalSize += eventSize;
    metrics.averageSize = metrics.totalSize / metrics.count;
    metrics.lastSeen = new Date();
  }

  recordError(errorType?: string): void {
    this.errorCount++;
  }

  recordDataTransfer(bytes: number): void {
    this.totalDataTransferred += bytes;
  }

  // Performance metrics

  getPerformanceMetrics(): {
    eventsPerSecond: {
      current: number;
      average: number;
      peak: number;
    };
    throughput: {
      bytesPerSecond: number;
      averageEventSize: number;
    };
    latency: {
      averageProcessingTime: number;
      p95ProcessingTime: number;
    };
    reliability: {
      errorRate: number;
      uptime: number;
      successRate: number;
    };
  } {
    const now = Date.now();
    const uptime = now - this.startTime.getTime();
    
    // Events per second calculations
    const recentSamples = this.eventsPerSecondSamples.filter(
      sample => now - sample.timestamp.getTime() <= 60000
    );
    
    const currentEPS = recentSamples.length > 0 ? recentSamples[recentSamples.length - 1].value : 0;
    const averageEPS = recentSamples.length > 0 
      ? recentSamples.reduce((sum, sample) => sum + sample.value, 0) / recentSamples.length 
      : 0;
    const peakEPS = recentSamples.length > 0 
      ? Math.max(...recentSamples.map(sample => sample.value)) 
      : 0;

    // Throughput calculations
    const totalEventSize = Array.from(this.eventCounts.values())
      .reduce((sum, metrics) => sum + metrics.totalSize, 0);
    const totalEvents = Array.from(this.eventCounts.values())
      .reduce((sum, metrics) => sum + metrics.count, 0);
    
    const bytesPerSecond = uptime > 0 ? (this.totalDataTransferred / uptime) * 1000 : 0;
    const averageEventSize = totalEvents > 0 ? totalEventSize / totalEvents : 0;

    // Reliability calculations
    const errorRate = this.totalEventsProcessed > 0 ? this.errorCount / this.totalEventsProcessed : 0;
    const successRate = 1 - errorRate;

    return {
      eventsPerSecond: {
        current: currentEPS,
        average: averageEPS,
        peak: peakEPS
      },
      throughput: {
        bytesPerSecond,
        averageEventSize
      },
      latency: {
        averageProcessingTime: 0, // Would need separate tracking
        p95ProcessingTime: 0      // Would need separate tracking
      },
      reliability: {
        errorRate,
        uptime,
        successRate
      }
    };
  }

  // Resource usage monitoring

  getResourceUsage(): {
    memory: {
      totalUsage: number;
      historyStorage: number;
      analyticsOverhead: number;
    };
    connections: {
      totalConnections: number;
      activeConnections: number;
      connectionsByType: Record<ClientType, number>;
    };
    processing: {
      eventsInQueue: number;
      processingBacklog: number;
      averageProcessingTime: number;
    };
  } {
    const storageStats = this.historyManager.getStorageStats();
    const clientStats = this.clientManager.getClientStats();
    const analyticsMemory = this.estimateAnalyticsMemoryUsage();

    return {
      memory: {
        totalUsage: storageStats.memoryUsage + analyticsMemory,
        historyStorage: storageStats.memoryUsage,
        analyticsOverhead: analyticsMemory
      },
      connections: {
        totalConnections: clientStats.total,
        activeConnections: clientStats.active,
        connectionsByType: clientStats.byType
      },
      processing: {
        eventsInQueue: 0,           // Would need queue tracking
        processingBacklog: 0,       // Would need backlog tracking
        averageProcessingTime: 0    // Would need processing time tracking
      }
    };
  }

  // Health monitoring

  getHealthMetrics(): {
    overall: 'healthy' | 'warning' | 'critical';
    issues: string[];
    recommendations: string[];
    lastCheck: Date;
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    const now = new Date();

    // Check error rate
    const metrics = this.getMetrics();
    if (metrics.errorRate > 0.05) { // 5% error rate threshold
      issues.push(`High error rate: ${(metrics.errorRate * 100).toFixed(2)}%`);
      recommendations.push('Investigate error causes and improve error handling');
    }

    // Check memory usage
    if (metrics.memoryUsage > 100 * 1024 * 1024) { // 100MB threshold
      issues.push(`High memory usage: ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`);
      recommendations.push('Consider implementing data compaction or archival');
    }

    // Check events per second
    if (metrics.eventsPerSecond > 1000) { // High throughput warning
      issues.push(`High event throughput: ${metrics.eventsPerSecond.toFixed(2)} events/sec`);
      recommendations.push('Monitor system performance and consider scaling');
    }

    // Check client distribution
    const totalClients = Object.values(metrics.clientsByType).reduce((sum, count) => sum + count, 0);
    if (totalClients > this.config.server.maxConnections * 0.8) { // 80% of max connections
      issues.push(`High client count: ${totalClients}/${this.config.server.maxConnections}`);
      recommendations.push('Prepare for scaling or implement connection throttling');
    }

    // Determine overall health
    let overall: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (issues.length > 0) {
      overall = issues.length > 2 ? 'critical' : 'warning';
    }

    return {
      overall,
      issues,
      recommendations,
      lastCheck: now
    };
  }

  // Reports and summaries

  generateSummaryReport(timeRange?: { start: Date; end: Date }): {
    period: { start: Date; end: Date };
    summary: {
      totalEvents: number;
      totalClients: number;
      averageEventsPerSecond: number;
      peakEventsPerSecond: number;
      totalDataTransferred: number;
      errorCount: number;
      errorRate: number;
    };
    eventBreakdown: Record<StreamEventType, number>;
    clientActivity: {
      totalConnections: number;
      averageConnectionDuration: number;
      connectionsByType: Record<ClientType, number>;
    };
    performance: {
      uptime: number;
      reliability: number;
      throughput: number;
    };
  } {
    const now = new Date();
    const period = timeRange || {
      start: this.startTime,
      end: now
    };

    const eventBreakdown = this.getEventDistribution(period);
    const totalEvents = Object.values(eventBreakdown).reduce((sum, count) => sum + count, 0);
    
    const periodDuration = period.end.getTime() - period.start.getTime();
    const averageEventsPerSecond = periodDuration > 0 ? (totalEvents / periodDuration) * 1000 : 0;
    
    const peakSample = this.eventsPerSecondSamples
      .filter(sample => sample.timestamp >= period.start && sample.timestamp <= period.end)
      .reduce((max, sample) => Math.max(max, sample.value), 0);

    const clientStats = this.clientManager.getClientStats();
    const errorRate = totalEvents > 0 ? this.errorCount / totalEvents : 0;

    return {
      period,
      summary: {
        totalEvents,
        totalClients: clientStats.total,
        averageEventsPerSecond,
        peakEventsPerSecond: peakSample,
        totalDataTransferred: this.totalDataTransferred,
        errorCount: this.errorCount,
        errorRate
      },
      eventBreakdown,
      clientActivity: {
        totalConnections: clientStats.total,
        averageConnectionDuration: clientStats.averageConnectionTime,
        connectionsByType: clientStats.byType
      },
      performance: {
        uptime: now.getTime() - this.startTime.getTime(),
        reliability: 1 - errorRate,
        throughput: this.totalDataTransferred / ((now.getTime() - this.startTime.getTime()) / 1000)
      }
    };
  }

  // Private methods

  private startMetricsCollection(): void {
    // Sample events per second every 10 seconds
    this.metricsInterval = setInterval(() => {
      this.sampleEventsPerSecond();
    }, 10000);

    // Cleanup old samples every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldSamples();
    }, 300000);
  }

  private sampleEventsPerSecond(): void {
    const now = new Date();
    const tenSecondsAgo = new Date(now.getTime() - 10000);
    
    // Count events in the last 10 seconds (this is a simplified calculation)
    // In a real implementation, this would track actual event timestamps
    const recentEventCount = this.totalEventsProcessed > 0 ? 
      Math.random() * 100 : 0; // Placeholder calculation
    
    this.eventsPerSecondSamples.push({
      timestamp: now,
      value: recentEventCount / 10 // Convert to per-second rate
    });
  }

  private cleanupOldSamples(): void {
    const cutoff = new Date(Date.now() - 3600000); // Keep 1 hour of samples
    this.eventsPerSecondSamples = this.eventsPerSecondSamples.filter(
      sample => sample.timestamp > cutoff
    );
  }

  private estimateAnalyticsMemoryUsage(): number {
    // Rough estimation of memory used by analytics data
    let size = 0;
    
    // Event counts map
    size += this.eventCounts.size * 200; // Rough estimate per entry
    
    // Events per second samples
    size += this.eventsPerSecondSamples.length * 50; // Rough estimate per sample
    
    return size;
  }

  // Configuration and lifecycle

  updateConfig(config: ExecutorStreamerConfig): void {
    this.config = config;
    
    if (config.performance.metricsEnabled && !this.metricsInterval) {
      this.startMetricsCollection();
    } else if (!config.performance.metricsEnabled && this.metricsInterval) {
      this.stopMetricsCollection();
    }
  }

  private stopMetricsCollection(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  // Reset and cleanup

  reset(): void {
    this.eventCounts.clear();
    this.eventsPerSecondSamples = [];
    this.errorCount = 0;
    this.totalEventsProcessed = 0;
    this.totalDataTransferred = 0;
    this.startTime = new Date();
  }

  async shutdown(): Promise<void> {
    console.log('Shutting down analytics manager...');
    
    this.stopMetricsCollection();
    
    console.log('Analytics manager shutdown complete');
  }
}
