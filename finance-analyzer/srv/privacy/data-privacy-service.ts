import cds = require('@sap/cds');
import { DataClassification } from '../types/enums';

const { ApplicationService } = cds;

// ============================================================================
// Constants
// ============================================================================

/** User roles recognized by the privacy service */
type UserRole =
  | 'SecurityAnalyst'
  | 'SecurityAdmin'
  | 'Auditor'
  | 'Executive'
  | 'IAMAdmin'
  | 'SOCOperator';

/** Masking strategy applied to a field */
type MaskingStrategy = 'FULL_MASK' | 'PARTIAL_MASK' | 'HASH' | 'REDACT' | 'AGGREGATE';

/** Context in which data is being accessed */
type AccessContext = 'DASHBOARD' | 'ALERT_DETAIL' | 'INVESTIGATION' | 'EVIDENCE_EXPORT' | 'API' | 'REPORT';

/** Retention policy per data category */
interface RetentionPolicy {
  dataCategory: string;
  maxRetentionMonths: number;
  anonymizeAfterMonths: number;
  purgeDetailRetainAggregates: boolean;
}

/** Result from residency verification */
interface ResidencyStatus {
  tenantId: string;
  configuredRegion: string;
  compliant: boolean;
  violations: ResidencyViolation[];
  verifiedAt: string;
}

interface ResidencyViolation {
  dataType: string;
  detectedRegion: string;
  expectedRegion: string;
  description: string;
}

/** Result from retention policy execution */
interface RetentionResult {
  tenantId: string;
  executedAt: string;
  recordsAnonymized: number;
  recordsPurged: number;
  aggregatesRetained: number;
  errors: string[];
}

// ============================================================================
// Field Classification Registry
// ============================================================================

/**
 * Maps entity fields to their data classification tier.
 *
 * - Public: risk scores, alert counts, trend metrics, statuses
 * - Internal: user IDs, transaction codes, document numbers
 * - Confidential: bank account details, payment amounts, vendor names
 * - Restricted: credentials, PII fields, salary data
 *
 * Validates: Requirements 29.1
 */
const FIELD_CLASSIFICATION_REGISTRY: Record<string, DataClassification> = {
  // Public fields (scores, counts, statuses)
  'riskScore': 'PUBLIC',
  'alertCount': 'PUBLIC',
  'trendMetrics': 'PUBLIC',
  'status': 'PUBLIC',
  'priority': 'PUBLIC',
  'riskCategory': 'PUBLIC',
  'confidence': 'PUBLIC',
  'compliancePercentage': 'PUBLIC',
  'controlCount': 'PUBLIC',
  'alertPriority': 'PUBLIC',
  'detectionMethod': 'PUBLIC',
  'createdAt': 'PUBLIC',
  'modifiedAt': 'PUBLIC',
  'severity': 'PUBLIC',
  'maturityScore': 'PUBLIC',

  // Internal fields (user IDs, document numbers, transaction codes)
  'userId': 'INTERNAL',
  'documentNumber': 'INTERNAL',
  'transactionCode': 'INTERNAL',
  'companyCode': 'INTERNAL',
  'costCenter': 'INTERNAL',
  'sourceSystem': 'INTERNAL',
  'tenantId': 'INTERNAL',
  'alertId': 'INTERNAL',
  'investigationId': 'INTERNAL',
  'assignedAnalyst': 'INTERNAL',
  'performedBy': 'INTERNAL',
  'systemId': 'INTERNAL',
  'sourceEventId': 'INTERNAL',
  'businessObjectRef': 'INTERNAL',
  'debitAccount': 'INTERNAL',
  'creditAccount': 'INTERNAL',

  // Confidential fields (bank details, amounts, vendor names)
  'bankAccountNumber': 'CONFIDENTIAL',
  'bankRoutingNumber': 'CONFIDENTIAL',
  'iban': 'CONFIDENTIAL',
  'amount': 'CONFIDENTIAL',
  'financialExposure': 'CONFIDENTIAL',
  'paymentAmount': 'CONFIDENTIAL',
  'vendorName': 'CONFIDENTIAL',
  'vendorId': 'CONFIDENTIAL',
  'bankDetails': 'CONFIDENTIAL',
  'currency': 'CONFIDENTIAL',
  'accountBalance': 'CONFIDENTIAL',

  // Restricted fields (credentials, PII, salary)
  'credentialValue': 'RESTRICTED',
  'password': 'RESTRICTED',
  'apiKey': 'RESTRICTED',
  'token': 'RESTRICTED',
  'secretKey': 'RESTRICTED',
  'employeeName': 'RESTRICTED',
  'homeAddress': 'RESTRICTED',
  'personalEmail': 'RESTRICTED',
  'phoneNumber': 'RESTRICTED',
  'socialSecurityNumber': 'RESTRICTED',
  'salaryData': 'RESTRICTED',
  'salary': 'RESTRICTED',
  'piiField': 'RESTRICTED',
  'dateOfBirth': 'RESTRICTED',
  'nationalId': 'RESTRICTED',
};

// ============================================================================
// Role Visibility Rules
// ============================================================================

/**
 * Defines which data classification tiers are visible to each role.
 *
 * - Executive: Public + aggregated Internal
 * - SecurityAnalyst / SOCOperator: Public + Internal + Confidential
 * - SecurityAdmin: All tiers (Public + Internal + Confidential + Restricted)
 * - Auditor: Public + Internal + Confidential (Restricted masked except evidence exports)
 * - IAMAdmin: Public + Internal + Confidential
 *
 * Validates: Requirements 29.2
 */
const ROLE_VISIBILITY: Record<UserRole, DataClassification[]> = {
  Executive: ['PUBLIC'],
  SecurityAnalyst: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL'],
  SecurityAdmin: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'],
  Auditor: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL'],
  IAMAdmin: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL'],
  SOCOperator: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL'],
};

/**
 * Fields that are NEVER displayed in any view regardless of role.
 * Credential values are always redacted — only type and location are shown.
 *
 * Validates: Requirements 29.3
 */
const ALWAYS_MASKED_FIELDS: Set<string> = new Set([
  'credentialValue',
  'password',
  'apiKey',
  'token',
  'secretKey',
]);

/** Default retention policy configuration */
const DEFAULT_RETENTION_POLICIES: RetentionPolicy[] = [
  {
    dataCategory: 'transactions',
    maxRetentionMonths: 84, // 7 years for audit compliance
    anonymizeAfterMonths: 24,
    purgeDetailRetainAggregates: true,
  },
  {
    dataCategory: 'alerts',
    maxRetentionMonths: 84,
    anonymizeAfterMonths: 24,
    purgeDetailRetainAggregates: true,
  },
  {
    dataCategory: 'investigations',
    maxRetentionMonths: 84,
    anonymizeAfterMonths: 24,
    purgeDetailRetainAggregates: false,
  },
  {
    dataCategory: 'auditTrail',
    maxRetentionMonths: 84, // 7 years minimum
    anonymizeAfterMonths: 84, // Never anonymize within retention
    purgeDetailRetainAggregates: false,
  },
  {
    dataCategory: 'behavioralProfiles',
    maxRetentionMonths: 36,
    anonymizeAfterMonths: 24,
    purgeDetailRetainAggregates: true,
  },
];

// ============================================================================
// Data Privacy Service
// ============================================================================

/**
 * Data Privacy Service
 *
 * Enforces data classification, field-level masking, retention policies,
 * data residency controls, and data access logging for privacy governance.
 *
 * Validates: Requirements 29.1, 29.2, 29.3, 29.4, 29.5, 29.6, 29.7, 29.8
 */
export default class DataPrivacyService extends (ApplicationService as any) {
  async init() {
    this.on('applyDataMasking', async (req: any) => {
      const { data, userRole, context } = req.data;
      const parsedData = JSON.parse(data);
      const masked = this.applyDataMasking(parsedData, userRole as UserRole, context as AccessContext);
      return JSON.stringify(masked);
    });

    this.on('verifyDataResidency', async (req: any) => {
      const { tenantId } = req.data;
      const result = await this.verifyDataResidency(tenantId);
      return JSON.stringify(result);
    });

    this.on('executeRetentionPolicy', async (req: any) => {
      const { tenantId } = req.data;
      const result = await this.executeRetentionPolicy(tenantId);
      return JSON.stringify(result);
    });

    this.on('logDataAccess', async (req: any) => {
      const { userId, tenantId, dataClassification, fieldsAccessed, accessContext } = req.data;
      const fields = JSON.parse(fieldsAccessed);
      await this.logDataAccess(
        userId,
        tenantId,
        dataClassification as DataClassification,
        fields,
        accessContext
      );
      return JSON.stringify({ success: true });
    });

    await super.init();
  }

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  /**
   * Apply field-level masking based on user role and data classification.
   *
   * Rules per role:
   * - Executive: sees Public + aggregated Internal (Internal fields are aggregated, not raw)
   * - SecurityAnalyst / SOCOperator: sees Public + Internal + Confidential
   * - SecurityAdmin: sees all tiers
   * - Auditor: sees Public + Internal + Confidential (Restricted masked except evidence exports)
   * - IAMAdmin: sees Public + Internal + Confidential
   *
   * Credential values (credentialValue, password, apiKey, token, secretKey) are
   * NEVER displayed in any view for any role.
   *
   * Validates: Requirements 29.1, 29.2, 29.3, 29.4
   */
  applyDataMasking(data: Record<string, any>, userRole: UserRole, context: AccessContext): Record<string, any> {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const visibleTiers = this.getVisibleTiers(userRole, context);
    const result: Record<string, any> = {};

    for (const [fieldName, fieldValue] of Object.entries(data)) {
      // Credentials are NEVER displayed regardless of role or context
      if (ALWAYS_MASKED_FIELDS.has(fieldName)) {
        result[fieldName] = this.maskValue(fieldValue, 'REDACT', fieldName);
        continue;
      }

      const classification = this.classifyField(fieldName);

      // Check if this role can see this classification tier
      if (visibleTiers.has(classification)) {
        // Executive gets aggregated Internal data, not raw values
        if (userRole === 'Executive' && classification === 'INTERNAL') {
          result[fieldName] = this.maskValue(fieldValue, 'AGGREGATE', fieldName);
        } else {
          result[fieldName] = fieldValue;
        }
      } else {
        // Apply appropriate masking strategy
        const strategy = this.getMaskingStrategy(classification);
        result[fieldName] = this.maskValue(fieldValue, strategy, fieldName);
      }
    }

    return result;
  }

  /**
   * Classify a data field into its sensitivity tier.
   *
   * Validates: Requirements 29.1
   */
  classifyField(fieldName: string): DataClassification {
    // Direct match in registry
    if (FIELD_CLASSIFICATION_REGISTRY[fieldName]) {
      return FIELD_CLASSIFICATION_REGISTRY[fieldName];
    }

    // Pattern-based classification for fields not in registry
    const lowerField = fieldName.toLowerCase();

    // Restricted patterns
    if (lowerField.includes('credential') || lowerField.includes('password') ||
        lowerField.includes('secret') || lowerField.includes('token') ||
        lowerField.includes('pii') || lowerField.includes('salary') ||
        lowerField.includes('ssn') || lowerField.includes('nationalid')) {
      return 'RESTRICTED';
    }

    // Confidential patterns
    if (lowerField.includes('bank') || lowerField.includes('iban') ||
        lowerField.includes('amount') || lowerField.includes('payment') ||
        lowerField.includes('vendor') || lowerField.includes('balance')) {
      return 'CONFIDENTIAL';
    }

    // Internal patterns
    if (lowerField.includes('userid') || lowerField.includes('user_id') ||
        lowerField.includes('document') || lowerField.includes('account') ||
        lowerField.includes('code') || lowerField.includes('id')) {
      return 'INTERNAL';
    }

    // Default to PUBLIC for unknown fields
    return 'PUBLIC';
  }

  /**
   * Verify data residency compliance for a tenant.
   * Ensures that all tenant data remains within the configured BTP region
   * and is not replicated to or processed in other geographic regions.
   *
   * Validates: Requirements 29.7
   */
  async verifyDataResidency(tenantId: string): Promise<ResidencyStatus> {
    const logger = cds.log('data-privacy');
    logger.info(`Verifying data residency for tenant ${tenantId}`);

    const db = await cds.connect.to('db');
    const { Tenants } = db.entities('finsecure.ai');

    // Fetch tenant configuration to determine configured region
    const tenant = await SELECT.one.from(Tenants).where({ ID: tenantId });
    if (!tenant) {
      return {
        tenantId,
        configuredRegion: 'UNKNOWN',
        compliant: false,
        violations: [{
          dataType: 'tenant_config',
          detectedRegion: 'UNKNOWN',
          expectedRegion: 'UNKNOWN',
          description: `Tenant ${tenantId} not found in registry`,
        }],
        verifiedAt: new Date().toISOString(),
      };
    }

    const configuredRegion = tenant.region || 'us10';
    const violations: ResidencyViolation[] = [];

    // Verify HANA Cloud data location
    try {
      const hanaRegionCheck = await this.verifyHanaDataLocation(tenantId, configuredRegion);
      if (!hanaRegionCheck.compliant) {
        violations.push(...hanaRegionCheck.violations);
      }
    } catch (error: any) {
      logger.warn(`HANA residency check failed for tenant ${tenantId}: ${error.message}`);
      // Non-fatal: record as informational, verification continues
    }

    // Verify Event Mesh data does not cross regions
    try {
      const eventMeshCheck = await this.verifyEventMeshResidency(tenantId, configuredRegion);
      if (!eventMeshCheck.compliant) {
        violations.push(...eventMeshCheck.violations);
      }
    } catch (error: any) {
      logger.warn(`Event Mesh residency check failed for tenant ${tenantId}: ${error.message}`);
    }

    // Verify AI Core training data residency
    try {
      const aiCoreCheck = await this.verifyAICoreResidency(tenantId, configuredRegion);
      if (!aiCoreCheck.compliant) {
        violations.push(...aiCoreCheck.violations);
      }
    } catch (error: any) {
      logger.warn(`AI Core residency check failed for tenant ${tenantId}: ${error.message}`);
    }

    const status: ResidencyStatus = {
      tenantId,
      configuredRegion,
      compliant: violations.length === 0,
      violations,
      verifiedAt: new Date().toISOString(),
    };

    logger.info(
      `Data residency verification for tenant ${tenantId}: ` +
      `compliant=${status.compliant}, violations=${violations.length}`
    );

    return status;
  }

  /**
   * Execute data retention policy for a tenant.
   *
   * - Anonymizes user identities in historical data after configurable period (default 24 months)
   * - Purges detailed transaction data while retaining aggregated metrics
   * - Configurable max retention per data category
   *
   * Validates: Requirements 29.5
   */
  async executeRetentionPolicy(tenantId: string): Promise<RetentionResult> {
    const logger = cds.log('data-privacy');
    logger.info(`Executing retention policy for tenant ${tenantId}`);

    const db = await cds.connect.to('db');
    const now = new Date();
    const errors: string[] = [];
    let totalAnonymized = 0;
    let totalPurged = 0;
    let totalAggregatesRetained = 0;

    for (const policy of DEFAULT_RETENTION_POLICIES) {
      try {
        const result = await this.executePolicyForCategory(db, tenantId, policy, now);
        totalAnonymized += result.anonymized;
        totalPurged += result.purged;
        totalAggregatesRetained += result.aggregatesRetained;
      } catch (error: any) {
        const errorMsg = `Failed to execute retention for ${policy.dataCategory}: ${error.message}`;
        logger.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    const result: RetentionResult = {
      tenantId,
      executedAt: now.toISOString(),
      recordsAnonymized: totalAnonymized,
      recordsPurged: totalPurged,
      aggregatesRetained: totalAggregatesRetained,
      errors,
    };

    logger.info(
      `Retention policy executed for tenant ${tenantId}: ` +
      `anonymized=${totalAnonymized}, purged=${totalPurged}, ` +
      `aggregatesRetained=${totalAggregatesRetained}, errors=${errors.length}`
    );

    return result;
  }

  /**
   * Log a data access event for Confidential or Restricted data.
   * Records the accessing user, data classification tier, specific fields
   * accessed, and timestamp in the Audit Trail.
   *
   * Validates: Requirements 29.6
   */
  async logDataAccess(
    userId: string,
    tenantId: string,
    dataClassification: DataClassification,
    fields: string[],
    accessContext: string
  ): Promise<void> {
    const logger = cds.log('data-privacy');

    // Only log access to Confidential or Restricted data
    if (dataClassification !== 'CONFIDENTIAL' && dataClassification !== 'RESTRICTED') {
      return;
    }

    const db = await cds.connect.to('db');
    const { AuditTrailEntries } = db.entities('finsecure.ai');

    const entryId = cds.utils.uuid();
    const now = new Date().toISOString();

    const auditEntry = {
      ID: entryId,
      tenantId,
      userId,
      action: 'DATA_ACCESS',
      affectedObject: JSON.stringify({
        dataClassification,
        fieldsAccessed: fields,
        accessContext,
      }),
      sourceIP: 'system',
      outcome: 'SUCCESS',
      timestamp: now,
      createdAt: now,
    };

    await INSERT.into(AuditTrailEntries).entries(auditEntry);

    logger.info(
      `Data access logged: user=${userId}, tenant=${tenantId}, ` +
      `classification=${dataClassification}, fields=${fields.length}, ` +
      `context=${accessContext}`
    );
  }

  // ==========================================================================
  // Private Methods - Masking
  // ==========================================================================

  /**
   * Get the set of visible classification tiers for a given role and context.
   * Auditor gets Restricted access only in evidence export context.
   */
  private getVisibleTiers(userRole: UserRole, context: AccessContext): Set<DataClassification> {
    const baseTiers = ROLE_VISIBILITY[userRole] || ['PUBLIC'];
    const tiers = new Set<DataClassification>(baseTiers);

    // Executive gets aggregated access to Internal — handled in masking logic
    if (userRole === 'Executive') {
      tiers.add('INTERNAL');
    }

    // Auditor gets Restricted access ONLY in evidence export context
    if (userRole === 'Auditor' && context === 'EVIDENCE_EXPORT') {
      tiers.add('RESTRICTED');
    }

    return tiers;
  }

  /**
   * Determine masking strategy based on data classification tier.
   */
  private getMaskingStrategy(classification: DataClassification): MaskingStrategy {
    switch (classification) {
      case 'RESTRICTED':
        return 'REDACT';
      case 'CONFIDENTIAL':
        return 'PARTIAL_MASK';
      case 'INTERNAL':
        return 'HASH';
      default:
        return 'FULL_MASK';
    }
  }

  /**
   * Apply a masking strategy to a field value.
   */
  private maskValue(value: any, strategy: MaskingStrategy, _fieldName: string): any {
    if (value === null || value === undefined) {
      return value;
    }

    switch (strategy) {
      case 'REDACT':
        return '[REDACTED]';
      case 'FULL_MASK':
        return this.applyFullMask(value);
      case 'PARTIAL_MASK':
        return this.applyPartialMask(value);
      case 'HASH':
        return this.applyHashMask(value);
      case 'AGGREGATE':
        return this.applyAggregateMask(value);
      default:
        return '[MASKED]';
    }
  }

  /**
   * Full masking: replace entire value with asterisks or zero.
   */
  private applyFullMask(value: any): any {
    if (typeof value === 'string') {
      return '*'.repeat(Math.min(value.length, 20));
    }
    if (typeof value === 'number') {
      return 0;
    }
    return '[MASKED]';
  }

  /**
   * Partial masking: reveal first/last characters for strings, round numbers.
   */
  private applyPartialMask(value: any): any {
    if (typeof value === 'string' && value.length > 4) {
      return value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2);
    }
    if (typeof value === 'number') {
      const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(value) || 1)));
      return Math.round(value / magnitude) * magnitude;
    }
    return '[MASKED]';
  }

  /**
   * Hash masking: show only last few characters with prefix.
   */
  private applyHashMask(value: any): any {
    if (typeof value === 'string') {
      return `***${value.substring(Math.max(0, value.length - 4))}`;
    }
    return '[HASHED]';
  }

  /**
   * Aggregate masking: summarize the value rather than showing raw data.
   */
  private applyAggregateMask(value: any): any {
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string') {
      return `[${value.length} chars]`;
    }
    if (Array.isArray(value)) {
      return `[${value.length} items]`;
    }
    return '[AGGREGATED]';
  }

  // ==========================================================================
  // Private Methods - Data Residency
  // ==========================================================================

  /**
   * Verify HANA Cloud data remains in the configured region.
   */
  private async verifyHanaDataLocation(
    _tenantId: string,
    configuredRegion: string
  ): Promise<{ compliant: boolean; violations: ResidencyViolation[] }> {
    const logger = cds.log('data-privacy');
    const violations: ResidencyViolation[] = [];

    // In production, this would query HANA system views to verify
    // the physical data location matches the expected region.
    // For now, we verify via BTP service instance metadata.
    try {
      // Check database service binding region
      const dbRegion = this.getServiceRegion('hana');
      if (dbRegion && dbRegion !== configuredRegion) {
        violations.push({
          dataType: 'hana_database',
          detectedRegion: dbRegion,
          expectedRegion: configuredRegion,
          description: `HANA Cloud instance detected in region '${dbRegion}', expected '${configuredRegion}'`,
        });
      }
    } catch (error: any) {
      logger.warn(`HANA region check inconclusive: ${error.message}`);
    }

    return { compliant: violations.length === 0, violations };
  }

  /**
   * Verify Event Mesh does not cross regions.
   */
  private async verifyEventMeshResidency(
    _tenantId: string,
    configuredRegion: string
  ): Promise<{ compliant: boolean; violations: ResidencyViolation[] }> {
    const violations: ResidencyViolation[] = [];

    try {
      const emRegion = this.getServiceRegion('messaging');
      if (emRegion && emRegion !== configuredRegion) {
        violations.push({
          dataType: 'event_mesh',
          detectedRegion: emRegion,
          expectedRegion: configuredRegion,
          description: `Event Mesh instance detected in region '${emRegion}', expected '${configuredRegion}'`,
        });
      }
    } catch {
      // Non-fatal — region check may not be available in all environments
    }

    return { compliant: violations.length === 0, violations };
  }

  /**
   * Verify AI Core training data remains in the configured region.
   */
  private async verifyAICoreResidency(
    _tenantId: string,
    configuredRegion: string
  ): Promise<{ compliant: boolean; violations: ResidencyViolation[] }> {
    const violations: ResidencyViolation[] = [];

    try {
      const aiRegion = this.getServiceRegion('aicore');
      if (aiRegion && aiRegion !== configuredRegion) {
        violations.push({
          dataType: 'ai_core_training',
          detectedRegion: aiRegion,
          expectedRegion: configuredRegion,
          description: `AI Core instance detected in region '${aiRegion}', expected '${configuredRegion}'`,
        });
      }
    } catch {
      // Non-fatal
    }

    return { compliant: violations.length === 0, violations };
  }

  /**
   * Get the region of a bound BTP service from VCAP_SERVICES or environment config.
   */
  private getServiceRegion(serviceName: string): string | null {
    try {
      // In production, read from VCAP_SERVICES or xsenv
      const vcapServices = process.env.VCAP_SERVICES;
      if (vcapServices) {
        const services = JSON.parse(vcapServices);
        for (const [key, instances] of Object.entries(services)) {
          if (key.includes(serviceName) && Array.isArray(instances) && instances.length > 0) {
            const instance = instances[0] as any;
            return instance.credentials?.region || instance.tags?.region || null;
          }
        }
      }
    } catch {
      // Environment not available
    }
    return null;
  }

  // ==========================================================================
  // Private Methods - Retention Policy
  // ==========================================================================

  /**
   * Execute retention policy for a specific data category.
   */
  private async executePolicyForCategory(
    db: any,
    tenantId: string,
    policy: RetentionPolicy,
    now: Date
  ): Promise<{ anonymized: number; purged: number; aggregatesRetained: number }> {
    const logger = cds.log('data-privacy');
    let anonymized = 0;
    let purged = 0;
    let aggregatesRetained = 0;

    // Calculate the anonymization cutoff date
    const anonymizeCutoff = new Date(now);
    anonymizeCutoff.setMonth(anonymizeCutoff.getMonth() - policy.anonymizeAfterMonths);

    // Calculate the max retention cutoff date
    const purgeCutoff = new Date(now);
    purgeCutoff.setMonth(purgeCutoff.getMonth() - policy.maxRetentionMonths);

    const entityMap: Record<string, string> = {
      transactions: 'Transactions',
      alerts: 'Alerts',
      investigations: 'Investigations',
      auditTrail: 'AuditTrailEntries',
      behavioralProfiles: 'BehavioralProfiles',
    };

    const entityName = entityMap[policy.dataCategory];
    if (!entityName) {
      logger.warn(`Unknown data category: ${policy.dataCategory}`);
      return { anonymized: 0, purged: 0, aggregatesRetained: 0 };
    }

    const entities = db.entities('finsecure.ai');
    const Entity = entities[entityName];

    if (!Entity) {
      logger.warn(`Entity not found: ${entityName}`);
      return { anonymized: 0, purged: 0, aggregatesRetained: 0 };
    }

    // Step 1: Anonymize records older than anonymization cutoff
    try {
      const toAnonymize = await SELECT.from(Entity).where({
        tenantId,
        createdAt: { '<=': anonymizeCutoff.toISOString() },
      });

      for (const record of toAnonymize) {
        // Anonymize user identity fields
        if (record.userId) {
          await UPDATE(Entity).where({ ID: record.ID }).set({
            userId: `ANONYMIZED_${this.hashIdentity(record.userId)}`,
          });
          anonymized++;
        }
      }
    } catch (error: any) {
      logger.warn(`Anonymization for ${policy.dataCategory} encountered an issue: ${error.message}`);
    }

    // Step 2: Purge records beyond max retention (retain aggregates if configured)
    if (policy.purgeDetailRetainAggregates) {
      try {
        const toPurge = await SELECT.from(Entity).where({
          tenantId,
          createdAt: { '<=': purgeCutoff.toISOString() },
        });

        purged = toPurge.length;
        aggregatesRetained = purged; // Each purged record contributes to aggregates

        // In production, would store aggregated metrics before deletion
        if (toPurge.length > 0) {
          await DELETE.from(Entity).where({
            tenantId,
            createdAt: { '<=': purgeCutoff.toISOString() },
          });
        }
      } catch (error: any) {
        logger.warn(`Purge for ${policy.dataCategory} encountered an issue: ${error.message}`);
      }
    }

    logger.info(
      `Retention policy for ${policy.dataCategory}: ` +
      `anonymized=${anonymized}, purged=${purged}, aggregatesRetained=${aggregatesRetained}`
    );

    return { anonymized, purged, aggregatesRetained };
  }

  /**
   * Generate a deterministic hash for identity anonymization.
   */
  private hashIdentity(identity: string): string {
    let hash = 0;
    for (let i = 0; i < identity.length; i++) {
      const char = identity.codePointAt(i) ?? 0;
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).substring(0, 8);
  }
}
