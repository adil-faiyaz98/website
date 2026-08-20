using { finsecure.ai as db } from '../../db/schema';

/**
 * Event Processing Service
 * Manages asynchronous event processing pipeline with tenant isolation,
 * horizontal scaling, back-pressure mechanisms, and health metrics.
 *
 * All processing is fully asynchronous via SAP Event Mesh - zero impact
 * on source SAP systems (no synchronous calls that block).
 *
 * Validates: Requirements 23.1, 23.2, 23.3, 23.5, 23.6, 23.7, 23.8
 */
service EventProcessingService @(requires: 'system-user') {

  /** Event Processing Metrics entity for health dashboard */
  entity EventProcessingMetrics as projection on db.EventProcessingMetrics;

  /** Dead Letter Queue for monitoring DLQ depth */
  entity DeadLetterQueue as projection on db.DeadLetterQueue;

  /** Alerts entity for generating back-pressure and health alerts */
  entity Alerts as projection on db.Alerts;

  /**
   * Configure Event Mesh topic and subscription for a tenant.
   * Sets up tenant-isolated topic patterns and queue subscriptions.
   */
  action configureTenantTopics(
    tenantId       : String(36),
    topicPatterns  : LargeString,
    queuePrefix    : String(200)
  ) returns LargeString;

  /**
   * Scale consumer instances for a tenant.
   * Adjusts the number of event consumer instances (1-10 per tenant).
   */
  action scaleConsumers(
    tenantId       : String(36),
    desiredCount   : Integer
  ) returns LargeString;

  /**
   * Process an event asynchronously with idempotent guarantees.
   * Deduplicates using event ID, processes exactly once.
   */
  action processEventAsync(
    tenantId       : String(36),
    eventId        : String(100),
    eventType      : String(30),
    payload        : LargeString
  ) returns LargeString;

  /**
   * Get current health metrics for a tenant's event processing pipeline.
   */
  function getHealthMetrics(
    tenantId       : String(36)
  ) returns {
    throughputPerSec   : Decimal(10,2);
    latencyP50Ms       : Integer;
    latencyP95Ms       : Integer;
    latencyP99Ms       : Integer;
    dlqDepth           : Integer;
    consumerInstances  : Integer;
    backPressureActive : Boolean;
  };

  /**
   * Trigger back-pressure evaluation for a tenant.
   * Checks pipeline utilization and activates throttling if > 80%.
   */
  action evaluateBackPressure(
    tenantId       : String(36)
  ) returns LargeString;

  /**
   * Evaluate auto-scaling trigger based on p95 latency threshold.
   * Scales consumers if p95 latency exceeds configurable threshold (default 30s).
   */
  action evaluateAutoScaling(
    tenantId       : String(36),
    p95ThresholdMs : Integer
  ) returns LargeString;

  /**
   * Record event processing metrics snapshot for a tenant.
   */
  action recordMetrics(
    tenantId       : String(36)
  ) returns LargeString;
}
