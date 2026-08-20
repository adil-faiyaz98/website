# Implementation Plan: FinSecure AI

## Overview

Implementation of the FinSecure AI platform — an AI-powered Financial Transaction Risk Intelligence and Application Security system built on SAP BTP Cloud Foundry using CAP Node.js, SAP HANA Cloud, Fiori Elements, and SAP AI Core. The plan is structured as incremental modules: project scaffolding and data layer first, then core detection services, followed by AI/GenAI integration, UI layer, and finally integration wiring and governance features.

## Tasks

- [x] 1. Project scaffolding, CDS data models, and core interfaces
  - [x] 1.1 Initialize CAP Node.js project with MTA configuration
    - Create the MTA project structure with `mta.yaml` declaring all BTP service dependencies (HANA Cloud, Event Mesh, AI Core, IAS, XSUAA, Audit Log, Credential Store, SaaS Provisioning, Alert Notification Service)
    - Set up `package.json` with CAP dependencies, fast-check for testing, and TypeScript configuration
    - Create directory structure: `srv/`, `db/`, `app/`, `test/`
    - Configure XSUAA `xs-security.json` with role templates: SecurityAnalyst, SecurityAdmin, Auditor, Executive, IAMAdmin, SOCOperator
    - _Requirements: 31.1, 31.7, 31.8, 17.3_

  - [x] 1.2 Define CDS data models for all core entities
    - Create `db/schema.cds` with all entity definitions: Tenants, TenantThresholds, ConnectedSystems, TenantCompliancePacks, Transactions, DeduplicationLog, DeadLetterQueue, BehavioralProfiles, ProfileDimensions, SoDRules, SoDViolations, Alerts, Investigations, InvestigationNotes, EvidenceItems, Playbooks, PlaybookExecutions, ComplianceControls, ControlEvidence, VulnerabilityFindings, MLModels, MLModelFeedback, VendorBankChanges, AccessReviewCampaigns, AccessReviewTasks, CustomAgents, AuditTrailEntries, ScheduledReports, GeneratedReports, AIGeneratedContent, EventProcessingMetrics
    - Define all associations, compositions, and data types as specified in the design
    - _Requirements: 1.1, 31.2_

  - [x] 1.3 Define TypeScript interfaces for all service contracts
    - Create `srv/types/` directory with interface files for: CanonicalTransaction, RiskEvent, Alert, Investigation, Playbook, ComplianceControl, BehavioralProfile, VulnerabilityFinding, IAMEvent, MLModel, TenantConfig
    - Define type unions for RiskCategory, DocumentType, DetectionMethod, PlaybookActionType, IAMEventType, VulnerabilityCategory, DataClassification
    - Define state machine transition maps for Alert and Investigation lifecycles
    - _Requirements: 2.2, 3.1, 9.1, 9.4_

  - [x] 1.4 Define OData service definitions with annotations
    - Create `srv/services.cds` exposing OData V4 services with Fiori annotations for each entity group
    - Define service-level authorization restrictions per role (SecurityAnalyst, SecurityAdmin, Auditor, Executive, IAMAdmin, SOCOperator)
    - Add pagination annotations (max 50 per page for violations, max 200 per page for audit trail)
    - _Requirements: 13.6, 5.5, 12.4, 31.1_

- [x] 2. Tenant Manager and provisioning
  - [x] 2.1 Implement Tenant Manager Service
    - Create `srv/tenant-manager/tenant-manager-service.ts`
    - Implement `onSubscribe`: create HANA schema, register in tenant registry, provision AI Core pipeline, complete within 300 seconds or rollback
    - Implement `onUnsubscribe`: schedule tenant data removal within 72 hours, retry up to 3 times on failure, flag for manual remediation if exhausted
    - Implement `registerSystem`: store credentials in Credential Store with tenant-scoped namespace
    - Implement `manageCompliancePacks` and `updateThresholds`
    - Implement rollback logic: if provisioning fails or exceeds 300s, clean up within 120 seconds
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6_

  - [ ]* 2.2 Write property test for tenant data isolation (Property 1)
    - **Property 1: Tenant Data Isolation**
    - Verify that for any two distinct tenants, queries in one tenant context never return data from another tenant across all entity types
    - **Validates: Requirements 1.3**

  - [ ]* 2.3 Write unit tests for Tenant Manager Service
    - Test provisioning timeout rollback behavior
    - Test deletion retry logic with partial failure scenarios
    - Test credential store namespace isolation
    - _Requirements: 1.1, 1.4, 1.5, 1.6_

- [x] 3. Ingestion Service and event processing
  - [x] 3.1 Implement Ingestion Service
    - Create `srv/ingestion/ingestion-service.ts`
    - Implement `processEvent`: receive Event Mesh messages, normalize within 5 seconds
    - Implement `normalize`: handle format differences for S4HC (OData V4), S4OP (RFC/OData/SOAP), ECC (BAPI/RFC/IDoc)
    - Implement `checkDuplicate`: deduplication via composite key (sourceEventId + timestamp)
    - Implement `batchSync`: configurable schedule (default 6 hours), OAuth 2.0 / certificate-based auth
    - Implement `routeToDeadLetterQueue`: store failed events with payload, reason, timestamp; retain 30 days
    - Implement retry logic: 3 retries with exponential backoff (5s, 10s, 20s, max 60s)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 23.4_

  - [ ]* 3.2 Write property test for transaction normalization completeness (Property 2)
    - **Property 2: Transaction Normalization Completeness**
    - Verify that normalizing any valid raw SAP event produces a CanonicalTransaction with all mandatory fields non-null and well-typed
    - **Validates: Requirements 2.2**

  - [ ]* 3.3 Write property test for event deduplication idempotency (Property 3)
    - **Property 3: Event Deduplication Idempotency**
    - Verify that processing the same event N times (N >= 1) creates exactly one CanonicalTransaction and at most one Alert
    - **Validates: Requirements 2.8, 23.6**

  - [ ]* 3.4 Write property test for dead letter queue routing (Property 24)
    - **Property 24: Dead Letter Queue Routing**
    - Verify that events failing processing are routed to DLQ with complete payload, failure reason, and timestamp
    - **Validates: Requirements 23.4**

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Detection Engine and risk scoring
  - [x] 5.1 Implement Detection Engine core orchestration
    - Create `srv/detection/detection-engine.ts`
    - Implement `analyzeTransaction`: orchestrate ML scoring + rule checks + behavioral analysis in parallel, complete within 10 seconds
    - Implement `scoreWithMLModel`: invoke AI Core serving endpoint, return Risk_Score 0-100
    - Implement fallback: if ML unavailable, flag as unscored, queue for re-evaluation, notify within 60s
    - Implement anomaly indicator checks: business hours, round-number amounts, dormant accounts, unknown account combinations, approval bypass
    - _Requirements: 3.1, 3.2, 3.3, 3.6_

  - [ ]* 5.2 Write property test for risk score bounds invariant (Property 4)
    - **Property 4: Risk Score Bounds Invariant**
    - Verify all assigned scores are integers in [0, 100] for any entity evaluated
    - **Validates: Requirements 3.1, 6.4, 7.1, 14.4, 20.8, 33.6**

  - [ ]* 5.3 Write property test for threshold-based alert generation (Property 5)
    - **Property 5: Threshold-Based Alert Generation**
    - Verify Alert generated iff Risk_Score >= threshold; no alert when below
    - **Validates: Requirements 3.2**

  - [ ]* 5.4 Write property test for anomaly indicator detection correctness (Property 6)
    - **Property 6: Anomaly Indicator Detection Correctness**
    - Verify each indicator fires if and only if its condition is met (business hours, round numbers, dormancy, unknown combinations)
    - **Validates: Requirements 3.3**

  - [x] 5.5 Implement fraud pattern detection
    - Implement `detectFraudPatterns`: duplicate payments, vendor bank manipulation, round-tripping, split payments, no-PO vendors
    - Calculate fraud Risk_Score from ML confidence and financial exposure
    - Route low-confidence findings (< 50) to manual review without playbook
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 5.6 Implement payment run analysis
    - Implement `analyzePaymentRun`: score all payments within 60 seconds
    - Flag payments exceeding historical average by configurable factor (default 3x)
    - Publish clearance event if no payments flagged
    - Generate aggregate Alert for flagged payments
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 5.7 Implement vendor master tampering detection
    - Create correlation logic for bank detail changes followed by payments within configurable window (default 48 hours)
    - Calculate vendor risk score (0-100) based on change frequency, time proximity, correlation history, unusual maintainer
    - Flag high-risk changes from first-time maintainers
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

- [ ] 6. UEBA Engine and behavioral profiling
  - [x] 6.1 Implement UEBA Engine
    - Create `srv/detection/ueba-engine.ts`
    - Implement `updateProfile`: incremental profile calculation within 5 minutes of ingestion
    - Implement `checkDeviation`: compare transaction against profile dimensions with sensitivity threshold
    - Track dimensions: posting frequency, posting times, account combinations, amounts, cost centers, vendor relationships, transaction codes, data access volume
    - Mark profiles with < 30 days as "LEARNING" — suppress deviation alerts
    - Implement cost center deviation: flag any transaction to unobserved cost center
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.7_

  - [ ]* 6.2 Write property test for behavioral profile learning status (Property 7)
    - **Property 7: Behavioral Profile Learning Status**
    - Verify profiles with daysCovered < 30 are LEARNING with no deviation alerts; >= 30 are ACTIVE with checks enabled
    - **Validates: Requirements 4.3**

  - [ ]* 6.3 Write property test for behavioral deviation detection (Property 8)
    - **Property 8: Behavioral Deviation Detection**
    - Verify deviation alert generated iff observed value exceeds mean + sensitivity_factor * stdDev, and cost center flags always fire for unknown cost centers
    - **Validates: Requirements 4.4, 4.5**

  - [x] 6.4 Implement insider threat detection
    - Implement `calculateInsiderThreatScore`: weighted combination of data access anomalies, temporal anomalies, sensitive data access, authorization usage deviations
    - Implement mass data extraction detection (> configurable records or > configurable volume in 1 hour)
    - Implement HR risk multiplier elevation with configurable period
    - Detect spool file access anomalies and abnormal transaction code usage
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8_

  - [ ]* 6.5 Write property test for HR risk sensitivity elevation (Property 23)
    - **Property 23: HR Risk Sensitivity Elevation**
    - Verify multiplier applied for configured period then reverts to 1.0; only risk classification stored, not HR event details
    - **Validates: Requirements 27.2, 27.7**

- [ ] 7. SoD detection and P2P controls
  - [x] 7.1 Implement SoD violation detection
    - Create SoD rule library with minimum 4 predefined rules (create vendor/approve payment, post JE/approve JE, maintain bank/execute payment, create PO/approve GR)
    - Implement real-time detection within 30 seconds of triggering event
    - Implement custom rule creation (max 50 per tenant) with validation: reject same-activity or duplicate rules
    - Implement severity classification logic: CRITICAL (both payment/bank), HIGH (one financial approval), MEDIUM (other)
    - Implement acknowledgment workflow
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.7, 5.8_

  - [ ]* 7.2 Write property test for SoD violation detection (Property 9)
    - **Property 9: SoD Violation Detection**
    - Verify SoD violation detected iff same user performs conflicting actions within lookback window
    - **Validates: Requirements 5.2**

  - [ ]* 7.3 Write property test for SoD rule validation (Property 10)
    - **Property 10: SoD Rule Validation**
    - Verify rejection when activity1 == activity2 or duplicate rule exists; acceptance when valid and under 50 custom rules
    - **Validates: Requirements 5.4**

  - [ ]* 7.4 Write property test for SoD severity classification (Property 11)
    - **Property 11: SoD Severity Classification**
    - Verify deterministic severity: CRITICAL if both involve payment/bank, HIGH if one involves financial approval, MEDIUM otherwise
    - **Validates: Requirements 5.7**

  - [x] 7.5 Implement P2P segregation controls
    - Monitor full P2P lifecycle (requisition → PO → GR → invoice → payment)
    - Implement three-way match validation (configurable tolerance, default 2%)
    - Detect retroactive PO creation, GR/IR clearing aging, suspicious vendor-invoice patterns
    - Detect vendor-payment collusion (create vendor → process payment within window)
    - Calculate P2P control effectiveness score
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7, 21.8_

  - [ ]* 7.6 Write property test for P2P segregation violation detection (Property 21)
    - **Property 21: P2P Segregation Violation Detection**
    - Verify SoD violation detected for same user in conflicting P2P roles; three-way match failure when tolerance exceeded
    - **Validates: Requirements 21.1, 21.2**

- [x] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Alert Manager and investigation workflow
  - [x] 9.1 Implement Alert Manager Service
    - Create `srv/alerts/alert-manager-service.ts`
    - Implement `createAlert`: classify priority per rules (CRITICAL >= 90 or >= 1M, HIGH >= 70 or >= 100K, MEDIUM >= 40, LOW otherwise)
    - Implement `deliverAlert`: in-app notification, email, SAP ANS push within 60 seconds
    - Implement `transitionState`: validate state transitions per state machine, reject invalid
    - Implement `checkSLAEscalation`: auto-escalate critical alerts exceeding SLA (default 4h)
    - Implement `clusterRelatedAlerts`: AI-powered grouping of related alerts
    - _Requirements: 9.1, 9.2, 9.3, 9.6, 9.7, 9.8_

  - [ ]* 9.2 Write property test for alert priority classification (Property 12)
    - **Property 12: Alert Priority Classification**
    - Verify deterministic priority assignment: CRITICAL if score >= 90 OR exposure >= 1M, HIGH if >= 70 OR >= 100K, MEDIUM if >= 40, LOW otherwise
    - **Validates: Requirements 9.1**

  - [x] 9.3 Implement Investigation Service
    - Create `srv/investigations/investigation-service.ts`
    - Implement `createInvestigation`: create from alert with analyst assignment
    - Implement `transitionState`: validate state transitions per state machine
    - Implement `resolve`: require resolution notes (1-5000 chars), record elapsed time
    - Implement `generateAIBrief`: invoke GenAI Hub for investigation brief
    - Implement `exportEvidencePackage`: generate signed PDF
    - _Requirements: 9.4, 9.5, 15.5_

  - [ ]* 9.4 Write property test for investigation state machine (Property 13)
    - **Property 13: Investigation State Machine**
    - Verify transitions succeed only for valid source→target pairs; all others rejected
    - **Validates: Requirements 9.4, 9.8**

  - [ ]* 9.5 Write property test for investigation resolution validation (Property 14)
    - **Property 14: Investigation Resolution Validation**
    - Verify resolution accepted iff notes length 1-5000 and state is IN_PROGRESS or ESCALATED
    - **Validates: Requirements 9.5**

- [x] 10. Playbook Executor
  - [x] 10.1 Implement Playbook Executor Service
    - Create `srv/playbooks/playbook-executor.ts`
    - Implement `evaluateAndExecute`: match alert to playbook triggers, execute within 60 seconds
    - Implement `executeStep`: 30-second timeout per step, retry once on failure, halt on second failure
    - Implement `requestApproval`: require confirmation for high-impact actions (block payment, lock user), 15-minute timeout
    - Implement execution queuing: queue when same playbook in progress for same entity
    - Provide predefined playbook library (block payment on vendor fraud, notify on SoD, create ticket on anomaly, request approval on threshold payments)
    - Support custom playbook creation (max 50 per tenant, max 20 steps)
    - Record all executions in Audit Trail
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8_

  - [ ]* 10.2 Write property test for playbook high-impact approval (Property 15)
    - **Property 15: Playbook High-Impact Approval Requirement**
    - Verify BLOCK_PAYMENT and LOCK_USER_ACCOUNT steps require approval; other action types do not
    - **Validates: Requirements 10.7**

- [x] 11. IAM Monitor and privilege escalation detection
  - [x] 11.1 Implement IAM Monitor Service
    - Create `srv/iam/iam-monitor-service.ts`
    - Implement `processIAMEvent`: handle role assignments, auth changes, profile modifications
    - Implement `detectCriticalAuthGrant`: alert within 60 seconds for SAP_ALL, S_DEVELOP, unrestricted access
    - Implement `identifyDormantAccounts`: detect accounts with no logon within configurable period (default 90 days)
    - Detect service account dialog logon (user type B with interactive use)
    - Detect IAM misconfigurations (debug access in production, unrestricted table access, RFC dialog capability, OS command execution)
    - Implement `calculatePrivilegeRiskScores`: IAM risk heatmap scores
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8_

  - [x] 11.2 Implement privilege escalation detection
    - Create `srv/detection/privilege-escalation.ts`
    - Implement escalation sequence detection: SU01 → PFCG → self-assignment within configurable window (default 60 min)
    - Implement firefighter access monitoring: alert if not revoked within max duration (default 8 hours)
    - Detect critical transaction execution by users without historical profile
    - Track temporary access grants and alert on overdue revocation (24 hours post-expiry)
    - Detect self-escalation: immediate CRITICAL alert + playbook trigger
    - Implement correlation: new auth + privileged transaction within 4 hours
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8_

  - [ ]* 11.3 Write property test for privilege escalation sequence detection (Property 22)
    - **Property 22: Privilege Escalation Sequence Detection**
    - Verify SU01→PFCG→self-assign within window is detected; self-assignment of critical auths generates immediate CRITICAL alert
    - **Validates: Requirements 19.2, 19.8**

  - [x] 11.4 Implement access governance and review workflows
    - Create `srv/iam/access-review-service.ts`
    - Implement campaign triggers: calendar-based, role change, compliance deadline, alert threshold
    - Generate review tasks with context: user, roles, last activity, risk classification, related alerts
    - Implement reviewer decisions: approve (with justification min 10 chars for high-risk), revoke, flag
    - Implement automatic role removal via Integration Suite API within 24 hours
    - Implement peer group analysis: flag users > 2 std dev above peer group median
    - Track completion rates with escalation alerts
    - _Requirements: 30.1, 30.2, 30.3, 30.4, 30.5, 30.6, 30.7, 30.8_

- [x] 12. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Compliance Engine and industry packs
  - [x] 13.1 Implement Compliance Engine
    - Create `srv/compliance/compliance-engine.ts`
    - Implement `evaluateControl`: execute test procedure, record evidence (PASS/FAIL/WARNING)
    - Implement `runScheduledEvaluations`: configurable intervals (1 hour to 30 days, default daily)
    - Implement evidence retention (minimum 7 years)
    - Implement `generateReport`: within 60s for <= 12 months, within 5 min for > 12 months
    - Implement `calculateCompliancePercentage`: pass / (pass + fail + warning) * 100
    - Generate alert within 5 minutes on control failure
    - Implement `calculateGRCMaturityScore`: CMMI 1-5 scale
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 25.4, 25.5, 25.7_

  - [ ]* 13.2 Write property test for compliance percentage calculation (Property 20)
    - **Property 20: Compliance Percentage Calculation**
    - Verify percentage = P / (P + F + W) * 100 rounded to 2 decimals; 0 when no active controls
    - **Validates: Requirements 8.6, 21.8**

  - [x] 13.3 Implement industry-specific compliance packs
    - Create compliance pack definitions for: NERC_CIP (15+ controls), CMMC_ITAR, FEDRAMP_NIST, SOX_DORA_PCI, PIPEDA_OSFI
    - Each pack includes: pre-configured controls with automated evaluation logic, dashboard view config, report templates, remediation playbooks
    - Implement `activateCompliancePack`: allow multiple simultaneous packs per tenant
    - Implement GRC control matrices (min 30 controls per pack)
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.7, 22.8, 25.4_

  - [x] 13.4 Implement GRC Automation Service
    - Create `srv/grc/grc-automation-service.ts`
    - Implement security parameter monitoring: alert within 5 minutes of deviation from baseline
    - Implement security audit log analysis: failed logons, unusual client logons, user lock/unlock, RFC rejections
    - Implement transport monitoring: detect production bypass, auth table modifications, security code changes
    - Implement MITRE ATT&CK for SAP mapping
    - _Requirements: 25.1, 25.2, 25.3, 25.6, 25.8_

- [x] 14. Vulnerability Scanner
  - [x] 14.1 Implement Vulnerability Scanner Service
    - Create `srv/vulnerability/vulnerability-scanner-service.ts`
    - Implement `scanABAPCode`: detect SQL injection, auth check bypass, hardcoded credentials, insecure RFC, directory traversal
    - Implement `scanTransportRequest`: detect auth table modifications, credential patterns, security parameter changes
    - Implement `detectExposedCredentials`: scan ABAP source, string literals, custom tables, RFC destinations
    - Implement `scanAttachments`: malware signature matching with daily-updated threat intelligence
    - Implement severity classification and remediation priority
    - Configurable schedule (default weekly, min daily, max monthly)
    - Implement 30-minute scan timeout with incomplete scan recording
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8_

  - [x] 14.2 Implement CVA integration and correlation
    - Ingest CVA findings via Integration Suite
    - Correlate with runtime execution data: execution frequency, user population, data sensitivity
    - Calculate exploitation risk score
    - Track vulnerability lifecycle (open, acknowledged, in-remediation, resolved, risk-accepted)
    - Generate escalation alerts for overdue critical findings (default 14 days)
    - _Requirements: 28.1, 28.2, 28.3, 28.4, 28.5, 28.6, 28.7_

- [x] 15. ML Model Management
  - [x] 15.1 Implement ML Model Management Service
    - Create `srv/ml/ml-model-service.ts`
    - Implement initial model training trigger: after 90 days + 1000 transactions threshold met
    - Implement configurable retraining schedule (min daily, max monthly, default weekly)
    - Track model metrics: precision, recall, F1-score, false positive rate
    - Implement model promotion gate: reject if any metric drops > 5% or FPR increases > 10%
    - Implement A/B testing (shadow mode): minimum 7 days or 500 scored transactions before promotion
    - Implement training failure handling: retain production model, alert admin, retry 3x with 1h interval
    - Implement feedback loop: incorporate true positive / false positive analyst feedback
    - Implement baseline model fallback for insufficient data
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8_

  - [ ]* 15.2 Write property test for ML model promotion gate (Property 16)
    - **Property 16: ML Model Promotion Gate**
    - Verify promotion only when precision/recall/F1 drop <= 5% and FPR increase <= 10%; previous model retained otherwise
    - **Validates: Requirements 11.5**

- [-] 16. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. GenAI Service and Joule integration
  - [x] 17.1 Implement GenAI Service
    - Create `srv/genai/genai-service.ts`
    - Implement `generateAlertSummary`: RAG-grounded summaries with triage recommendations
    - Implement `generateInvestigationBrief`: timeline reconstruction, affected objects, evidence suggestions
    - Implement `explainRiskScore`: combine ML feature importance + rules + historical context
    - Implement `generateComplianceNarrative`: period assessment with evidence references
    - Implement `generateRootCauseAnalysis`: control failure explanation with remediation steps
    - Implement `ragQuery`: HANA vector store queries against tenant historical data
    - Implement `generateAuditResponse`: AI-drafted auditor question responses
    - Implement `generateExecutiveBriefing`: weekly risk briefing generation
    - All outputs include AI-generated indicator, model used, timestamp, disclaimer, confidence score (0-100)
    - _Requirements: 33.1, 33.2, 33.3, 33.5, 33.6, 33.7, 33.8, 34.1, 34.2, 34.3, 34.4, 34.5, 34.6, 34.7_

  - [x] 17.2 Implement Joule Agent Service
    - Create `srv/joule/joule-agent-service.ts`
    - Implement `processQuery`: translate natural language to OData filters, return within 5 seconds
    - Support intents: query alerts, summarize investigation, explain flagging, recommend steps, compliance status, compare risk posture
    - Implement `executeAction`: acknowledge alert, change investigation status, assign alert, request report, initiate access review
    - Register as Joule Agent via A2A protocol
    - Implement `sanitizeResponse`: enforce data classification, never expose Restricted-tier data
    - Apply same RBAC and MFA controls as dashboard interactions
    - _Requirements: 32.1, 32.2, 32.3, 32.4, 32.5, 32.6, 32.7, 32.8_

- [ ] 18. Data Privacy and Audit Trail
  - [x] 18.1 Implement Data Privacy Service
    - Create `srv/privacy/data-privacy-service.ts`
    - Implement `applyDataMasking`: field-level masking based on user role and data classification
    - Classify fields: Public (scores, counts), Internal (user IDs, doc numbers), Confidential (bank details, amounts), Restricted (credentials, PII, salary)
    - Implement masking rules per role: Executive (Public + aggregated Internal), Analyst (Public + Internal + Confidential), Admin (all), Auditor (PIC + Internal + Confidential, Restricted masked except in evidence exports)
    - Implement `verifyDataResidency`: ensure no cross-region replication
    - Implement `executeRetentionPolicy`: configurable max retention, anonymization after 24 months default, purge detail retain aggregates
    - Implement `logDataAccess`: log all Confidential/Restricted data access events
    - _Requirements: 29.1, 29.2, 29.3, 29.4, 29.5, 29.6, 29.7, 29.8_

  - [ ]* 18.2 Write property test for data masking by role (Property 19)
    - **Property 19: Data Masking by Role**
    - Verify Restricted fields masked for Executive/Analyst/Auditor; Confidential masked for Executive; credentials never displayed in any view for any role
    - **Validates: Requirements 29.2, 29.3, 29.4, 32.7**

  - [x] 18.3 Implement Audit Trail Service
    - Create `srv/audit/audit-trail-service.ts`
    - Log all actions to SAP Audit Log Service: user actions, alert generations, investigation state changes, playbook executions, config changes
    - Each entry includes: timestamp (UTC ms precision), tenantId, userId, action, affectedObject, sourceIP, outcome (SUCCESS/FAILURE/DENIED)
    - Implement cryptographic integrity verification (tamper-evident)
    - Implement 7-year retention
    - Implement local buffering when Audit Log Service unavailable; replay in order on recovery
    - Alert at 90% buffer capacity
    - Implement query with filtering (date, user, event type, risk category, object) with pagination (max 200/page, first page within 5s)
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [ ]* 18.4 Write property test for audit trail entry completeness (Property 17)
    - **Property 17: Audit Trail Entry Completeness**
    - Verify all audit entries contain required fields (timestamp, tenantId, userId, action, affectedObject, sourceIP, outcome) with no nulls
    - **Validates: Requirements 12.5, 25.5**

  - [ ]* 18.5 Write property test for audit trail pagination bound (Property 18)
    - **Property 18: Audit Trail Pagination Bound**
    - Verify no page ever contains more than 200 entries
    - **Validates: Requirements 12.4**

- [x] 19. Report Generator
  - [x] 19.1 Implement Report Generator Service
    - Create `srv/reports/report-generator-service.ts`
    - Implement `generateReport`: PDF with digital signature and CSV for data analysis
    - Support report types: risk summary, compliance, fraud detection, SoD violations, investigation evidence, access review, executive briefing, vulnerability
    - Enforce timing: <= 60s for periods up to 12 months, <= 5 min for > 12 months, max 24 months
    - Implement max file size limit: 500 MB
    - Implement `scheduleReport`: configurable frequency (daily/weekly/monthly), max 50 recipients
    - Implement scheduled report retry: retry once after 15 minutes on failure
    - Implement `exportEvidencePackage`: signed PDF with transaction, alert, notes, resolution, audit trail
    - Implement `signReport`: digital signature with ISO 8601 timestamp
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7_

- [~] 20. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 21. SuccessFactors HCM Integration
  - [x] 21.1 Implement SuccessFactors HCM Integration
    - Create `srv/integrations/successfactors-integration.ts`
    - Receive HR lifecycle events via Integration Suite: termination, resignation, PIP, demotion, transfer, leave, contractor end-date
    - Implement risk sensitivity elevation: configurable multiplier (default 1.5x) for configurable period (default 30 days, range 7-90)
    - Implement offboarding verification: check user account locked/deleted within SLA (default 24 hours), critical alert if persists
    - Cross-reference org assignments with SAP authorizations for over-provisioned detection
    - Privacy-preserving: store only risk classification and monitoring period, not specific HR event type
    - Graceful degradation if integration unavailable
    - _Requirements: 27.1, 27.2, 27.3, 27.4, 27.5, 27.6, 27.7_

- [x] 22. Custom Agent Extension Platform
  - [x] 22.1 Implement Agent Extension Service
    - Create `srv/agents/agent-extension-service.ts`
    - Implement `registerAgent`: register Joule Studio or SDK pro-code agents with event subscriptions and output schema
    - Implement `processAgentOutput`: route through standard Alert Management with same RBAC
    - Implement `checkRateLimit`: configurable max alerts/hour per agent (default 100)
    - Implement `quarantineAgent`: stop processing on rate limit breach, schema validation failure, or unhandled errors
    - Implement event stream subscription for agents
    - Provide pre-built agent templates: industry pattern detection, custom fraud rule, document classification, custom compliance control
    - _Requirements: 35.1, 35.2, 35.3, 35.4, 35.5, 35.6, 35.7, 35.8_

  - [x]* 22.2 Write property test for custom agent governance (Property 25)
    - **Property 25: Custom Agent Governance**
    - Verify outputs processed through standard workflow with RBAC; rejected when rate limit exceeded; agent quarantined on schema validation failure; no outputs processed from quarantined agents
    - **Validates: Requirements 35.4, 35.5, 35.8**

- [x] 23. Authentication, SSO, and session management
  - [x] 23.1 Implement authentication and principal propagation
    - Configure IAS as proxy to corporate IdP (Entra ID, Okta, PingIdentity)
    - Implement Principal Propagation via OAuth2SAMLBearer assertion flow (IAS → XSUAA → backend SAP)
    - Map IdP group memberships to BTP role collections
    - Implement MFA enforcement for high-risk operations (acknowledge critical alerts, approve playbook containment, modify SoD rules, change thresholds, access audit trail export)
    - Implement session management: idle timeout (default 30 min, 5-480), absolute duration (default 8h), max concurrent sessions (default 3)
    - Handle IdP session revocation: terminate sessions within 5 minutes
    - Log all authentication events to Audit Trail
    - Handle principal propagation failures: deny operation, display error, log without credential exposure
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8_

- [x] 24. Event processing infrastructure
  - [~] 24.1 Implement asynchronous event processing pipeline
    - Configure Event Mesh topics and subscriptions for tenant isolation
    - Implement horizontally scalable consumers (1-10 instances per tenant)
    - Implement back-pressure mechanism: throttle at 80% capacity, buffer in queue, alert on activation
    - Implement auto-scaling trigger when p95 latency exceeds threshold (default 30 seconds)
    - Implement event processing health metrics: throughput, latency (p50/p95/p99), DLQ depth, consumer count, back-pressure status
    - Ensure zero impact on source SAP systems (no synchronous calls that block)
    - Guarantee at-least-once delivery with idempotent processing
    - Target: >= 1000 events/second per tenant with < 100ms additional latency on source
    - _Requirements: 23.1, 23.2, 23.3, 23.5, 23.6, 23.7, 23.8_

- [x] 25. UI Layer - Fiori Elements dashboards
  - [-] 25.1 Implement Risk Intelligence Dashboard
    - Create Fiori Elements Overview Page with risk posture score (0-100), active alerts by priority, anomaly trends, SoD count, fraud detections, compliance status
    - Implement auto-refresh at max 60-second intervals
    - Implement filter controls: date range (1 day-12 months, default 30 days), risk category, user, business unit, severity
    - Filter updates must reflect across all components within 3 seconds
    - Implement time-series trend charts (daily granularity <= 90 days, weekly > 90 days)
    - Implement drill-down from summary metrics to individual transactions
    - Handle component failures independently (show error in affected component, others continue)
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.7, 13.8_

  - [-] 25.2 Implement SOC Command Center Dashboard
    - Create custom Fiori extension for unified security operations view
    - Implement multi-system landscape view with system nodes (Green/Yellow/Orange/Red status)
    - Implement SOC KPI panels: MTTD, MTTR, alert volume trends, false positive rate, compliance coverage
    - Implement role-specific views: SOC Analyst, IAM Admin, Compliance Officer, CISO Executive
    - Implement geographic view with alert density map
    - Implement dark mode, visual alert notifications, browser notification API
    - Implement real-time threat feed (latest 100 events with one-click navigation)
    - Implement dashboard sharing with saved configurations and shareable URLs respecting RBAC
    - _Requirements: 26.1, 26.2, 26.3, 26.4, 26.5, 26.6, 26.7, 26.8_

  - [-] 25.3 Implement domain-specific dashboard views
    - Implement SoD violations view: paginated (max 50/page), user, conflicting actions, timestamps, severity, daily count time-series
    - Implement vendor master change monitoring view with risk indicators
    - Implement behavioral profile summaries with deviation history trends
    - Implement IAM risk heatmap with privilege risk scores
    - Implement compliance dashboard with per-framework percentage and drill-down
    - Implement P2P process compliance view: three-way match rate, retroactive POs, GR/IR aging, segregation trends
    - Implement insider threat risk score per user view
    - Implement vulnerability management dashboard: severity distribution, exploitability, remediation progress, aging
    - Implement event processing health dashboard
    - Implement privacy impact dashboard
    - _Requirements: 5.5, 5.6, 4.6, 14.3, 16.8, 8.6, 21.6, 20.8, 28.4, 23.7, 29.8_

  - [-] 25.4 Implement alert and investigation views
    - Implement Alert detail view: triggering transaction, Risk_Score rationale, up to 50 related historical alerts (12 months), recommended investigation steps
    - Implement Alert dashboard: open alerts by priority, age, category, analyst with SLA tracking
    - Implement Investigation workflow UI: state transitions, notes, evidence, resolution
    - Implement access review campaign reviewer interface
    - _Requirements: 9.3, 9.6, 9.4, 30.3_

- [x] 26. Deployment model and system connectivity
  - [x] 26.1 Implement deployment topology and system registration
    - Configure multi-tenant deployment with schema-level HANA isolation
    - Configure single-tenant deployment with dedicated BTP subaccount resources
    - Implement system registration interface: up to 20 connected SAP systems per tenant
    - Configure region deployability: ca10 (Montreal), us10 (US East VA), us20 (US West WA)
    - Support parallel ECC + S/4HANA monitoring during migration
    - Configure Cloud Connector for on-premise connectivity (no inbound firewall rules)
    - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5, 24.6, 24.7, 24.8, 24.9_

- [x] 27. Final integration wiring and end-to-end flows
  - [x] 27.1 Wire all services together end-to-end
    - Connect Ingestion → Detection Engine → Alert Manager → Playbook Executor flow
    - Connect Detection Engine → UEBA Engine bidirectional flow
    - Connect Alert Manager → Investigation Service → Report Generator flow
    - Connect all services → Audit Trail Service for logging
    - Connect Data Privacy Service as middleware for all data access operations
    - Connect GenAI Service to Alert Manager, Investigation, and Compliance Engine
    - Connect Joule Agent to all CAP services via OData
    - Connect Agent Extension to Event Mesh and Alert pipeline
    - Wire SuccessFactors integration to UEBA Engine for HR risk multiplier
    - Wire CVA integration to Vulnerability Scanner for enrichment
    - _Requirements: All requirements (integration completeness)_

  - [ ]* 27.2 Write integration tests for end-to-end event flow
    - Test complete flow: raw event → ingestion → detection → alert → playbook
    - Test ML scoring fallback to rule-based when unavailable
    - Test GenAI unavailability graceful degradation
    - Test principal propagation token flow
    - _Requirements: 2.1, 3.1, 10.2, 33.8, 17.2_

- [~] 28. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at logical boundaries
- Property tests validate universal correctness properties using fast-check with 100+ iterations
- Unit tests validate specific examples, edge cases, and boundary conditions
- The design uses TypeScript with CAP Node.js throughout — all implementation follows this stack
- All SAP BTP service dependencies are declared in mta.yaml for MTA deployment
- RBAC enforcement is implemented at both the OData annotation level and programmatic service level

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4", "2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "3.1"] },
    { "id": 4, "tasks": ["3.2", "3.3", "3.4", "5.1"] },
    { "id": 5, "tasks": ["5.2", "5.3", "5.4", "5.5", "5.6", "5.7", "6.1"] },
    { "id": 6, "tasks": ["6.2", "6.3", "6.4", "7.1"] },
    { "id": 7, "tasks": ["6.5", "7.2", "7.3", "7.4", "7.5"] },
    { "id": 8, "tasks": ["7.6", "9.1"] },
    { "id": 9, "tasks": ["9.2", "9.3", "10.1"] },
    { "id": 10, "tasks": ["9.4", "9.5", "10.2", "11.1"] },
    { "id": 11, "tasks": ["11.2", "11.3", "11.4"] },
    { "id": 12, "tasks": ["13.1", "13.3", "14.1"] },
    { "id": 13, "tasks": ["13.2", "13.4", "14.2", "15.1"] },
    { "id": 14, "tasks": ["15.2", "17.1"] },
    { "id": 15, "tasks": ["17.2", "18.1"] },
    { "id": 16, "tasks": ["18.2", "18.3", "19.1"] },
    { "id": 17, "tasks": ["18.4", "18.5", "21.1", "22.1"] },
    { "id": 18, "tasks": ["22.2", "23.1", "24.1"] },
    { "id": 19, "tasks": ["25.1", "25.2", "25.3", "25.4"] },
    { "id": 20, "tasks": ["26.1"] },
    { "id": 21, "tasks": ["27.1"] },
    { "id": 22, "tasks": ["27.2"] }
  ]
}
```
