using { finsecure.ai as db } from '../../db/schema';

/**
 * Detection Engine Service
 * Orchestrates all detection mechanisms (ML scoring, rule-based, behavioral analysis)
 * and produces risk events. Completes analysis within 10 seconds of ingestion.
 */
service DetectionEngineService @(requires: 'system-user') {

  /** Transactions for analysis */
  entity Transactions as projection on db.Transactions;
  entity BehavioralProfiles as projection on db.BehavioralProfiles;
  entity ProfileDimensions as projection on db.ProfileDimensions;
  entity TenantThresholds as projection on db.TenantThresholds;
  entity Alerts as projection on db.Alerts;
  entity Tenants as projection on db.Tenants;

  /** Analyze a normalized transaction for risk indicators */
  action analyzeTransaction(
    transactionId   : String(36),
    tenantId        : String(36),
    sourceSystem    : String(50),
    sourceEventId   : String(100),
    documentNumber  : String(20),
    documentType    : String(30),
    postingDate     : Date,
    entryDate       : Date,
    amount          : Decimal(23,2),
    currency        : String(3),
    userId          : String(12),
    companyCode     : String(4),
    debitAccount    : String(10),
    creditAccount   : String(10),
    costCenter      : String(10),
    vendorId        : String(10),
    businessObjectRef : String(100),
    metadata        : LargeString
  ) returns LargeString;

  /** Score a transaction with the ML model via AI Core */
  action scoreWithMLModel(
    tenantId      : String(36),
    transactionId : String(36),
    amount        : Decimal(23,2),
    documentType  : String(30),
    userId        : String(12),
    debitAccount  : String(10),
    creditAccount : String(10),
    companyCode   : String(4)
  ) returns {
    riskScore  : Integer;
    confidence : Integer;
    available  : Boolean;
  };

  /** Re-evaluate transactions that were previously unscored */
  action reEvaluateUnscored(
    tenantId : String(36)
  ) returns Integer;
}
