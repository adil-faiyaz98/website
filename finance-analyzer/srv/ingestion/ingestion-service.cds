using { finsecure.ai as db } from '../../db/schema';

/**
 * Ingestion Service
 * Receives events from SAP Event Mesh and batch data from Integration Suite,
 * normalizes to canonical format, deduplicates, and forwards to Detection Engine.
 */
service IngestionService @(requires: 'system-user') {

  /** Transactions entity for storing normalized events */
  entity Transactions as projection on db.Transactions;
  entity DeduplicationLog as projection on db.DeduplicationLog;
  entity DeadLetterQueue as projection on db.DeadLetterQueue;
  entity ConnectedSystems as projection on db.ConnectedSystems;

  /** Process a raw SAP event from Event Mesh */
  action processEvent(
    tenantId       : String(36),
    sourceSystem   : String(50),
    sourceEventId  : String(100),
    eventTimestamp : Timestamp,
    eventType      : String(30),
    payload        : LargeString
  ) returns String;

  /** Batch synchronization of historical data via Integration Suite */
  action batchSync(
    tenantId   : String(36),
    systemId   : String(50),
    fromDate   : Date,
    authMethod : String(20)
  ) returns String;

  /** Check for duplicate events */
  function checkDuplicate(
    tenantId      : String(36),
    sourceEventId : String(100),
    eventTimestamp : Timestamp
  ) returns {
    isDuplicate          : Boolean;
    existingTransactionId : String(36);
  };

  /** Route failed event to Dead Letter Queue */
  action routeToDeadLetterQueue(
    tenantId  : String(36),
    payload   : LargeString,
    reason    : String(1000)
  ) returns String;
}
