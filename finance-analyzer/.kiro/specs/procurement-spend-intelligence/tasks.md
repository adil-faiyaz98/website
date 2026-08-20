# Implementation Plan: Procurement Spend Intelligence

## Overview

Implement a multi-tenant SaaS procurement spend analytics application on SAP BTP Cloud Foundry using SAP CAP (Node.js), SAP HANA Cloud, and SAP Fiori/UI5. The implementation follows an incremental approach: project scaffolding and data model first, then core services (provisioning, sync, analytics), followed by alerting, dashboard exposure, and finally the Fiori frontend.

## Tasks

- [ ] 1. Set up project structure, CDS data model, and core utilities
  - [ ] 1.1 Initialize SAP CAP project and define CDS schema
    - Initialize CAP project with `cds init` including Node.js runtime
    - Create `db/schema.cds` with all entities: SpendRecords, Contracts, Invoices, Budgets, Alerts, WorkflowTasks, ThresholdConfigurations, TenantRegistry, SyncStatus
    - Define associations and type constraints as specified in the design data model
    - Configure `package.json` with required dependencies (`@sap/cds`, `@sap/xssec`, `@sap/hdi-deploy`, `@sap/cds-mtx`)
    - Create `mta.yaml` with modules for srv, db, app router, and required BTP service bindings (XSUAA, SaaS Registry, Credential Store, Job Scheduler, HANA)
    - _Requirements: 1.1, 1.2, 2.2_

  - [ ] 1.2 Implement retry utility and common helpers
    - Create `srv/common/retry.js` implementing `withRetry` function with configurable max retries (default 3) and exponential backoff (baseDelay × 2^attempt)
    - Create `srv/common/uuid.js` for UUID generation
    - Create `srv/common/date-utils.js` with `daysBetween`, `hoursSince`, and ISO date parsing helpers
    - _Requirements: 2.5, 2.6_

  - [ ]* 1.3 Write property test for retry with exponential backoff
    - **Property 3: Retry with Exponential Backoff**
    - Test that for any failing operation, retry executes at most 3 attempts with delays following baseDelay × 2^attempt pattern, and if all fail, exactly one failure alert is generated
    - **Validates: Requirements 2.5, 2.6**

- [ ] 2. Implement tenant provisioning service
  - [ ] 2.1 Create tenant provisioning lifecycle handlers
    - Create `srv/provisioning.js` implementing SaaS Provisioning Service callbacks
    - Implement `onSubscribe` handler: create HDI container via Service Manager API, deploy schema artifacts, register tenant in TenantRegistry, initialize default ThresholdConfigurations
    - Implement `onUnsubscribe` handler: schedule tenant cleanup (mark as DEPROVISIONING, enqueue deletion job)
    - Implement `getDependencies` handler returning required BTP service dependencies
    - Implement rollback logic: on any provisioning failure, reverse all completed steps (delete registry entry, remove credentials, drop HDI container)
    - Create `srv/provisioning/credential-manager.js` for storing/retrieving tenant Ariba credentials from SAP Credential Store
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 2.2 Write property test for tenant data isolation
    - **Property 1: Tenant Data Isolation**
    - Generate pairs of tenant IDs and data sets; verify that queries scoped to one tenant never return records belonging to another tenant across all entity types
    - **Validates: Requirements 1.4, 10.6**

  - [ ]* 2.3 Write unit tests for provisioning rollback
    - Test rollback on HDI container creation failure
    - Test rollback after schema deploy failure
    - Test rollback after registry insert failure
    - Test cleanup scheduling on unsubscription
    - _Requirements: 1.5, 1.3_

- [ ] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement Ariba synchronization engine
  - [ ] 4.1 Create Ariba API connector with OAuth 2.0 authentication
    - Create `srv/sync/ariba-connector.js` class with `authenticate()` method implementing OAuth 2.0 client credentials flow
    - Implement `fetchSpendRecords(sinceTimestamp)` for batch retrieval from Analytical Reporting API
    - Implement `fetchContracts()` for retrieving active contract catalog
    - Implement `fetchInvoices(sinceTimestamp)` for payment/invoice data retrieval
    - Use tenant-specific credentials retrieved from Credential Store
    - _Requirements: 2.4, 2.1_

  - [ ] 4.2 Implement data normalization and persistence
    - Create `srv/sync/normalizer.js` implementing the Ariba-to-internal field mapping as defined in the design (DocumentId → aribaDocumentId, Commodity.Path → categoryHierarchy joined with `/`, etc.)
    - Validate all required fields (supplierId, categoryId, amount, currency, purchaseDate) are non-null and amount is non-negative
    - Reject and log invalid records; exclude from metric calculations
    - Create `srv/sync/persistence.js` for upserting normalized SpendRecords, Contracts, and Invoices into HANA
    - _Requirements: 2.2_

  - [ ] 4.3 Implement batch sync handler with scheduling
    - Create `srv/sync/batch-sync-handler.js` orchestrating full batch sync: fetch → normalize → persist → update SyncStatus
    - Integrate `withRetry` for the sync operation (3 retries, exponential backoff)
    - On all retries exhausted, call alert generation for sync failure
    - Create `srv/sync/scheduler.js` to register batch sync job with SAP Job Scheduling Service (default 4-hour interval, configurable per tenant)
    - Update `SyncStatus` entity with last sync timestamp, record count, and status
    - _Requirements: 2.1, 2.2, 2.5, 2.6_

  - [ ] 4.4 Implement near-real-time sync for maverick spend events
    - Create `srv/sync/realtime-sync-handler.js` for event-driven sync with target latency ≤ 5 minutes
    - On new spend record received, immediately evaluate against active contracts for maverick classification
    - On maverick detection, generate alert within 5 minutes
    - Register near-real-time sync job with shorter interval in Job Scheduling Service
    - _Requirements: 2.3, 5.1, 5.2_

  - [ ]* 4.5 Write property test for record normalization validity
    - **Property 2: Record Normalization Validity**
    - Generate arbitrary Ariba response objects; verify normalization produces valid Spend_Records with all required fields or rejects invalid ones
    - **Validates: Requirements 2.2**

- [ ] 5. Implement spend analytics engine
  - [ ] 5.1 Implement category spend aggregation
    - Create `srv/analytics/spend-aggregator.js` with `aggregateByCategory(spendRecords)` function
    - Calculate total spend, percentage of overall spend, and record count per category
    - Implement period-over-period change calculation comparing current period totals to previous period
    - Support date range filtering for recalculation
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ] 5.2 Implement supplier concentration calculation
    - Add `calculateSupplierConcentration(spendRecords, category)` to analytics module
    - Calculate each supplier's percentage of total category spend
    - Return ranked list sorted by spend share descending
    - Flag categories where any single supplier exceeds configurable threshold (default 40%)
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ] 5.3 Implement maverick spend detection logic
    - Create `srv/analytics/maverick-detector.js` with `detectMaverickSpend(spendRecord, activeContracts)` function
    - Match records against active contracts by supplier, category, and date within contract validity period
    - Mark unmatched records as maverick (`isMaverick = true`)
    - Calculate total maverick spend as percentage of overall spend
    - _Requirements: 5.1, 5.3_

  - [ ] 5.4 Implement savings calculation
    - Create `srv/analytics/savings-calculator.js` with `calculateSavings(spendRecord, contractPrice)` function
    - For matched records: savings = contractPrice - actualAmount
    - For unmatched records: exclude from savings, flag as `matchedToContract = false`
    - Aggregate savings by category, supplier, and time period
    - Calculate cumulative savings with period-over-period trend
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ] 5.5 Implement budget variance computation
    - Create `srv/analytics/budget-variance.js` with `calculateBudgetVariance(actualSpend, budgetAmount)` function
    - Calculate absolute variance (actual - budget) and percentage (actual/budget × 100)
    - Support drill-down to show spend breakdown by category and supplier within a cost center
    - _Requirements: 7.1, 7.2, 7.4_

  - [ ] 5.6 Implement payment performance metrics
    - Create `srv/analytics/payment-performance.js` with `calculatePaymentPerformance(invoices)` function
    - Calculate on-time payment rate, average days-to-pay, and early payment discount capture rate
    - Calculate unrealized savings from missed early payment discounts
    - Support trend indicators over configurable time periods
    - _Requirements: 8.1, 8.2, 8.5_

  - [ ]* 5.7 Write property test for aggregation consistency
    - **Property 4: Aggregation Consistency**
    - For any set of spend records grouped by any dimension, verify sum of group amounts equals total and percentages sum to 100% (within floating-point tolerance)
    - **Validates: Requirements 3.1, 3.3, 4.1, 6.2**

  - [ ]* 5.8 Write property test for maverick spend classification
    - **Property 9: Maverick Spend Classification**
    - Generate spend records and contract sets; verify a record is classified as maverick if and only if no matching active contract exists
    - **Validates: Requirements 5.1, 5.3**

  - [ ]* 5.9 Write property test for metric calculation correctness
    - **Property 10: Metric Calculation Correctness**
    - Verify savings = contract_price - actual_amount for matched records, budget_variance = actual - budget, on-time rate = on-time-count / total × 100, unrealized savings = sum of missed discount amounts
    - **Validates: Requirements 5.3, 6.1, 6.4, 7.1, 7.2, 8.1, 8.5**

  - [ ]* 5.10 Write property test for unmatched record exclusion
    - **Property 11: Unmatched Record Exclusion**
    - Verify records without matching contract price contribute zero to savings and are flagged with matchedToContract = false
    - **Validates: Requirements 6.5**

  - [ ]* 5.11 Write property test for supplier ranking order
    - **Property 7: Supplier Ranking Order**
    - For any category's supplier concentration list, verify spend share at position i >= spend share at position i+1 for all consecutive indices
    - **Validates: Requirements 4.3**

- [ ] 6. Implement filter engine and drill-down support
  - [ ] 6.1 Create centralized filter engine
    - Create `srv/analytics/filter-engine.js` implementing `applyFilters(records, filters)` function
    - Support filter predicates: date range, category, supplier, cost center, contract status
    - Ensure all active filters are applied conjunctively (AND logic)
    - Ensure filtered results update all dashboard components simultaneously
    - _Requirements: 10.2, 10.3, 3.2, 6.3_

  - [ ]* 6.2 Write property test for filter correctness
    - **Property 5: Filter Correctness**
    - For any filter criteria applied to any dataset, verify every included record satisfies all predicates and every excluded record violates at least one
    - **Validates: Requirements 3.2, 6.3, 10.2**

  - [ ]* 6.3 Write property test for drill-down consistency
    - **Property 6: Drill-Down Consistency**
    - For any aggregated metric, verify drill-down detail records aggregate to the parent value (within rounding tolerance) and all belong to the parent entity
    - **Validates: Requirements 3.4, 4.4, 5.4, 7.4, 8.4, 10.4**

- [ ] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement threshold monitoring and alert service
  - [ ] 8.1 Create threshold evaluation and alert generation
    - Create `srv/alerts/threshold-monitor.js` with `evaluateThresholdBreach(metricValue, threshold, direction)` function
    - Create `createAlert(breach)` function generating alerts with metricName, currentValue, thresholdValue, affectedEntity, entityType, severity
    - Implement threshold checks for: supplier concentration > 40%, budget consumption > 90%, on-time payment rate < 85%, maverick spend detection
    - Integrate threshold monitoring into analytics computation pipeline (evaluated after each sync)
    - _Requirements: 4.2, 7.3, 8.3, 9.1_

  - [ ] 8.2 Implement alert delivery and escalation
    - Create `srv/alerts/alert-delivery.js` for delivering alerts through configurable channels (in-app notification, email)
    - Implement `processAlertEscalation(alert, escalationConfig)`: escalate unacknowledged alerts after 24 hours
    - Implement alert acknowledgment recording (acknowledgedAt timestamp, acknowledgedBy user identity)
    - Ensure alert history retained for minimum 12 months per tenant
    - _Requirements: 9.2, 9.5, 9.6, 5.5_

  - [ ] 8.3 Implement workflow trigger for critical alerts
    - Create `srv/alerts/workflow-trigger.js` with `initiateWorkflowTrigger(alert, workflowConfig)` function
    - For critical severity breaches, create approval task assigned to configured approver
    - Create WorkflowTasks entity records with PENDING status
    - _Requirements: 9.3_

  - [ ] 8.4 Create threshold configuration administration
    - Create `srv/alerts/threshold-config.js` for CRUD operations on ThresholdConfigurations
    - Support configuring threshold values, alert channels, escalation contacts, and workflow assignments per tenant
    - Initialize default thresholds on tenant provisioning (40% concentration, 90% budget, 85% payment rate)
    - _Requirements: 9.4_

  - [ ]* 8.5 Write property test for threshold breach detection
    - **Property 8: Threshold Breach Detection**
    - Verify: if value exceeds threshold, exactly one alert generated; if critical, exactly one workflow task created; if unacknowledged > 24h, escalation triggers
    - **Validates: Requirements 4.2, 5.5, 7.3, 8.3, 9.3**

  - [ ]* 8.6 Write property test for alert completeness and audit
    - **Property 12: Alert Completeness and Audit**
    - Verify all generated alerts have non-null metricName, currentValue, thresholdValue, entityType, entityId; and acknowledgment records non-null timestamps and user identity
    - **Validates: Requirements 9.1, 9.5**

- [ ] 9. Expose OData V4 dashboard service
  - [ ] 9.1 Define CDS service model for dashboard
    - Create `srv/dashboard-service.cds` defining OData V4 service with entity sets: SpendByCategory, SupplierConcentration, MaverickSpend, SavingsSummary, BudgetVariance, PaymentPerformance, Alerts, ThresholdConfigurations, Budgets
    - Define query parameters: `$filter`, `$orderby`, `$top`/`$skip`, `$expand` for drill-down navigation
    - Apply `@requires: 'authenticated-user'` annotation for role-based access control
    - _Requirements: 10.1, 10.4, 10.6_

  - [ ] 9.2 Implement OData service handlers with analytics integration
    - Create `srv/dashboard-service.js` implementing custom handlers for each entity set
    - Wire read handlers to analytics engine functions (aggregation, concentration, maverick, savings, budget variance, payment performance)
    - Apply centralized filter engine to all read operations
    - Implement `$expand` handling for drill-down to detail records
    - Implement PATCH handler for Alerts (acknowledgment)
    - Implement CRUD handlers for ThresholdConfigurations and Budgets
    - Ensure all queries are scoped to the requesting tenant (XSUAA tenant context)
    - Target response time < 3 seconds for filtered dashboard queries
    - _Requirements: 10.2, 10.3, 10.4, 10.6, 7.5, 9.4_

  - [ ]* 9.3 Write unit tests for OData service handlers
    - Test filter application across all entity sets
    - Test drill-down navigation via $expand
    - Test alert acknowledgment PATCH operation
    - Test tenant scoping (no cross-tenant data leakage)
    - _Requirements: 10.2, 10.3, 10.4, 10.6_

- [ ] 10. Implement SAP Fiori/UI5 dashboard frontend
  - [ ] 10.1 Create Fiori/UI5 application shell and app router configuration
    - Create `app/` directory with UI5 application structure
    - Configure SAP App Router (`app/router/`) with authentication (XSUAA), tenant resolution, and routes to UI and backend service
    - Create `app/webapp/manifest.json` with OData V4 model binding to DashboardService
    - Set up SAP Fiori Launchpad configuration for the application tile
    - _Requirements: 10.5, 10.6_

  - [ ] 10.2 Build unified dashboard view with all analytics components
    - Create main dashboard view (`app/webapp/view/Dashboard.view.xml`) with SAP Fiori layout
    - Implement category spend breakdown section with chart and table visualization
    - Implement supplier concentration risk section with ranked supplier list and risk indicators
    - Implement maverick spend section with percentage display and visual indicator
    - Implement savings totals section with trend indicators and period-over-period change
    - Implement budget variance summary section with absolute and percentage display
    - Implement payment performance overview section with on-time rate, avg days-to-pay, discount capture rate
    - Create corresponding controller (`app/webapp/controller/Dashboard.controller.js`) binding all sections to OData model
    - _Requirements: 10.1, 10.5_

  - [ ] 10.3 Implement filter bar and drill-down navigation
    - Create filter bar component with controls for: date range, category, supplier, cost center, contract status
    - Bind filter changes to OData `$filter` parameters across all dashboard entity sets
    - Ensure all visible components update simultaneously on filter change
    - Implement drill-down navigation: clicking aggregated metrics navigates to detail views
    - Create detail views for category drill-down, supplier drill-down, cost center drill-down, and payment detail
    - _Requirements: 10.2, 10.3, 10.4, 3.4, 4.4, 5.4, 7.4, 8.4_

  - [ ] 10.4 Implement alerts management view
    - Create alerts list view showing active and historical alerts
    - Implement alert acknowledgment action (PATCH to OData service)
    - Display alert details: metric name, current value, threshold, affected entity, severity, timestamps
    - Show escalation status and workflow task linkage
    - _Requirements: 9.1, 9.5, 9.6_

  - [ ] 10.5 Implement administration views
    - Create threshold configuration view for CRUD operations on thresholds
    - Create budget configuration view for managing cost center budgets per fiscal period
    - Create Ariba credentials configuration view (store via backend to Credential Store)
    - Apply role-based visibility (admin-only views)
    - _Requirements: 9.4, 7.5_

- [ ] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Integration wiring and deployment configuration
  - [ ] 12.1 Wire all components and configure multi-tenancy end-to-end
    - Connect provisioning service to SaaS Provisioning Service callbacks in `mta.yaml`
    - Wire Job Scheduling Service to batch sync handler (4-hour default) and near-real-time handler
    - Connect alert delivery to email service (SAP BTP mail service or destination-based)
    - Ensure XSUAA tenant context propagation from app router through CAP service to HANA
    - Configure `@sap/cds-mtx` for multi-tenant schema deployment
    - Verify all service bindings in `mta.yaml` are complete (XSUAA, SaaS Registry, Credential Store, Job Scheduler, HANA, HTML5 Repo)
    - _Requirements: 1.1, 1.2, 1.4, 2.1, 2.3, 2.4_

  - [ ] 12.2 Configure security and role-based access control
    - Define XSUAA scopes and role templates in `xs-security.json` (Admin, ProcurementAnalyst, FinanceController, ComplianceOfficer)
    - Apply scope checks in CAP service annotations (`@requires`)
    - Configure app router to enforce authentication for all routes
    - Ensure tenant isolation at XSUAA token level
    - _Requirements: 10.6, 1.4_

  - [ ]* 12.3 Write integration tests for end-to-end flows
    - Test tenant provisioning → Ariba sync → analytics computation → dashboard query flow
    - Test threshold breach → alert generation → delivery → acknowledgment flow
    - Test filter application end-to-end from UI OData request through analytics to response
    - Mock Ariba API responses for deterministic testing
    - _Requirements: 1.1, 2.1, 2.2, 9.1, 10.2_

- [ ] 13. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties defined in the design (12 properties total)
- Unit tests validate specific examples and edge cases
- The tech stack is SAP CAP (Node.js) with SAP HANA Cloud, SAP Fiori/UI5, and SAP BTP services
- Multi-tenancy is handled via `@sap/cds-mtx` with HDI container-per-tenant isolation
- All Ariba API integration uses OAuth 2.0 client credentials flow with tenant-specific credentials from SAP Credential Store

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "4.1"] },
    { "id": 4, "tasks": ["4.2", "4.3"] },
    { "id": 5, "tasks": ["4.4", "4.5", "5.1", "5.2", "5.3", "5.4", "5.5", "5.6"] },
    { "id": 6, "tasks": ["5.7", "5.8", "5.9", "5.10", "5.11", "6.1"] },
    { "id": 7, "tasks": ["6.2", "6.3", "8.1"] },
    { "id": 8, "tasks": ["8.2", "8.3", "8.4"] },
    { "id": 9, "tasks": ["8.5", "8.6", "9.1"] },
    { "id": 10, "tasks": ["9.2"] },
    { "id": 11, "tasks": ["9.3", "10.1"] },
    { "id": 12, "tasks": ["10.2", "10.3", "10.4", "10.5"] },
    { "id": 13, "tasks": ["12.1", "12.2"] },
    { "id": 14, "tasks": ["12.3"] }
  ]
}
```
