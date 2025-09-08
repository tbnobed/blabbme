import { storage } from "./storage";

// Production health monitoring class for hundreds of users
export class HealthMonitor {
  private metrics = new Map<string, number>();
  private connectionMetrics = new Map<string, number>();
  private startTime = Date.now();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Initialize core metrics
    this.metrics.set('server_starts', 1);
    this.metrics.set('room_creation_requests', 0);
    this.metrics.set('rooms_created', 0);
    this.metrics.set('room_creation_errors', 0);
    this.metrics.set('push_notifications_sent', 0);
    this.metrics.set('push_notifications_failed', 0);
    this.metrics.set('websocket_connections', 0);
    this.metrics.set('websocket_disconnections', 0);
    this.metrics.set('messages_sent', 0);
    this.metrics.set('messages_filtered', 0);
    this.metrics.set('active_connections', 0);
    
    // Start periodic health reporting
    this.startHealthReporting();
    
    console.log('🏥 Production Health Monitor initialized');
  }

  // Record a metric value
  recordMetric(metric: string, value: number) {
    this.metrics.set(metric, value);
    
    // Log critical metrics
    if (['active_connections', 'active_rooms', 'push_notifications_failed'].includes(metric)) {
      console.log(`📊 Health Metric - ${metric}: ${value}`);
    }
  }

  // Increment a counter metric
  incrementMetric(key: string, delta = 1) {
    const current = this.metrics.get(key) || 0;
    this.metrics.set(key, current + delta);
    
    // Log important increments
    if (['push_notifications_failed', 'room_creation_errors', 'websocket_disconnections'].includes(key)) {
      console.log(`⚠️ Health Alert - ${key}: ${current + delta}`);
    }
  }

  // Record connection-specific metrics
  recordConnection(event: 'connect' | 'disconnect' | 'error', sessionId?: string) {
    switch (event) {
      case 'connect':
        this.incrementMetric('websocket_connections');
        break;
      case 'disconnect':
        this.incrementMetric('websocket_disconnections');
        break;
      case 'error':
        this.incrementMetric('connection_errors');
        break;
    }
  }

  // Record push notification metrics
  recordPushNotification(success: boolean, responseStatus?: number) {
    if (success && responseStatus === 201) {
      this.incrementMetric('push_notifications_sent');
      this.incrementMetric('push_success_total');
    } else {
      this.incrementMetric('push_notifications_failed');
      console.log(`🚨 Push notification failed with status: ${responseStatus}`);
    }
  }

  // Get comprehensive system health
  async getSystemHealth() {
    try {
      const uptime = Math.round((Date.now() - this.startTime) / 1000);
      const memoryUsage = process.memoryUsage();
      
      // Get real-time data from storage
      const rooms = await storage.getAllRooms();
      const activeRooms = rooms.filter(room => room.isActive).length;
      
      const health = {
        status: 'healthy',
        uptime: uptime,
        uptimeFormatted: this.formatUptime(uptime),
        memory: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          external: Math.round(memoryUsage.external / 1024 / 1024),
          rss: Math.round(memoryUsage.rss / 1024 / 1024)
        },
        database: {
          totalRooms: rooms.length,
          activeRooms: activeRooms,
          expiredRooms: rooms.length - activeRooms
        },
        metrics: Object.fromEntries(this.metrics),
        performance: {
          pushSuccessRate: this.calculateSuccessRate('push_notifications_sent', 'push_notifications_failed'),
          connectionStability: this.calculateStability(),
          averageRoomSize: activeRooms > 0 ? Math.round(this.metrics.get('total_participants') || 0 / activeRooms) : 0
        },
        alerts: this.generateHealthAlerts(),
        timestamp: new Date().toISOString()
      };

      // Update active connections metric
      this.recordMetric('active_rooms', activeRooms);
      
      return health;
    } catch (error) {
      console.error('❌ Health check failed:', error);
      return {
        status: 'unhealthy',
        error: error.message || 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  // Calculate success rate percentage
  private calculateSuccessRate(successKey: string, failKey: string): number {
    const success = this.metrics.get(successKey) || 0;
    const fail = this.metrics.get(failKey) || 0;
    const total = success + fail;
    return total > 0 ? Math.round((success / total) * 100) : 100;
  }

  // Calculate connection stability
  private calculateStability(): number {
    const connects = this.metrics.get('websocket_connections') || 0;
    const disconnects = this.metrics.get('websocket_disconnections') || 0;
    const errors = this.metrics.get('connection_errors') || 0;
    
    if (connects === 0) return 100;
    
    const stability = Math.max(0, 100 - ((disconnects + errors * 2) / connects) * 100);
    return Math.round(stability);
  }

  // Generate health alerts for critical issues
  private generateHealthAlerts(): string[] {
    const alerts: string[] = [];
    
    const memoryUsage = process.memoryUsage();
    const memoryUsedMB = memoryUsage.heapUsed / 1024 / 1024;
    
    if (memoryUsedMB > 500) {
      alerts.push(`High memory usage: ${Math.round(memoryUsedMB)}MB`);
    }
    
    const pushFailRate = 100 - this.calculateSuccessRate('push_notifications_sent', 'push_notifications_failed');
    if (pushFailRate > 10) {
      alerts.push(`High push notification failure rate: ${pushFailRate}%`);
    }
    
    const connectionStability = this.calculateStability();
    if (connectionStability < 90) {
      alerts.push(`Low connection stability: ${connectionStability}%`);
    }
    
    const activeConnections = this.metrics.get('active_connections') || 0;
    if (activeConnections > 200) {
      alerts.push(`High connection count: ${activeConnections} active connections`);
    }
    
    return alerts;
  }

  // Format uptime in human readable format
  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m ${seconds % 60}s`;
    }
  }

  // Start periodic health reporting
  private startHealthReporting() {
    // Report health every 5 minutes
    this.healthCheckInterval = setInterval(async () => {
      const health = await this.getSystemHealth();
      
      if (health.alerts && health.alerts.length > 0) {
        console.log('🚨 HEALTH ALERTS:', health.alerts);
      }
      
      // Log key metrics every 5 minutes
      console.log(`📊 Health Report - Uptime: ${health.uptimeFormatted}, Memory: ${health.memory?.used}MB, Active Rooms: ${health.database?.activeRooms}, Push Success: ${health.performance?.pushSuccessRate}%`);
    }, 5 * 60 * 1000); // 5 minutes
  }

  // Cleanup method
  destroy() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    console.log('🏥 Health Monitor stopped');
  }
}

// Export singleton instance
export const healthMonitor = new HealthMonitor();