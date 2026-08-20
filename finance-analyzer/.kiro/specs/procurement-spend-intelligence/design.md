# Design Document

## Overview

Procurement Spend Intelligence is a multi-tenant SaaS application on SAP BTP Cloud Foundry that aggregates procurement data from SAP Ariba, computes spend analytics (category breakdowns, supplier concentration, maverick spend, savings, budget variance, payment performance), monitors thresholds, and delivers a unified Fiori/UI5 dashboard with drill-down capabilities. The system uses SAP CAP (Node.js) for business logic, SAP HANA Cloud for tenant-isolated persistence, and integrates with Ariba Analytical/Operational Reporting APIs via OAuth 2.0.

## Architecture

The Procurement Spend Intelligence application follows a side-by-side extension pattern on SAP BTP Cloud Foundry, structured as a multi-tenant SaaS solution. The architecture separates concerns into four layers:

1. **Presentation Layer** — SAP Fiori/UI5 application served via HTML5 Application Repository
2. **Service Layer** — SAP CAP (Node.js) application providing OData V4 services and business logic
3. **Integration Layer** — Ariba API connector handling OAuth 2.0 authentication, data retrieval, and synchronization
4. **Persistence Layer** — SAP HANA Cloud with tenant-isolated schemas managed via HDI containers

```
┌─────────────────────────────────────────────────────────────────┐
│                    SAP BTP Cloud Foundry                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌────────────┐   ┌──────────────────┐   ┌──────────────────┐  │
│  │  Fiori/UI5 │──▶│  CAP Service     │──▶│  HANA Cloud      │  │
│  │  (approuter│   │  (Node.js)       │   │  (HDI Containers)│  │
│  │   + UI5)   │   │                  │   │                  │  │
│  └────────────┘   │  ┌────────────┐  │   └──────────────────┘  │
│                    │  │ Ariba      │  │                          │
│                    │  │ Connector  │──┼──▶ SAP Ariba APIs        │
│                    │  └────────────┘  │                          │
│                    │  ┌────────────┐  │                          │
│                    │  │ Job        │  │                          │
│                    │  │ Scheduler  │  │                          │
│                    │  └────────────┘  │                          │
│                    └──────────────────┘                          │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  BTP Services: SaaS Provisioning, Credential Store,      │   │
│  │  Job Scheduling, Connectivity, Destination, XSUAA        │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Deployment Topology

- **App Router** — Manages authentication (XSUAA), tenant resolution, and routes to UI/service
- **CAP Service Module** — Stateless Node.js application hosting OData services, business logic, and background jobs
- **HANA HDI Deployer** — Deploys schema artifacts per tenant on subscription
- **SAP Job Scheduling Service** — Triggers Batch_Sync at configurable intervals

### Multi-Tenancy Strategy

Each tenant receives:
- A dedicated HDI container (schema isolation in HANA Cloud)
- Tenant-specific entries in the SAP Credential Store for Ariba API credentials
- Independent threshold and alert configurations
- Isolated job scheduling entries for sync operations

---

## Components and Interfaces

### 1. Tenant Provisioning Service

Handles subscription lifecycle events from SAP SaaS Provisioning Service.

**Responsibilities:**
- Create HDI container on new subscription
- Register tenant in the central tenant registry table
- Store Ariba credentials in SAP Credential Store
- Tear down resources on unsubscription
- Rollback on partial failure

```javascript
// srv/provisioning.js
const cds = require('@sap/cds');

module.exports = cds.server.impl(async function () {
  this.on('UPDATE', 'tenant', async (req, next) => {
    const { subscribedTenantId, subscribedSubdomain } = req.data;
    const tx = cds.tx(req);
    try {
      // 1. Create HDI container via Service Manager
      const hdiContainer = await createHDIContainer(subscribedTenantId);
      // 2. Deploy schema artifacts
      await deploySchema(hdiContainer);
      // 3. Register tenant in registry
      await tx.run(INSERT.into('TenantRegistry').entries({
        tenantId: subscribedTenantId,
        subdomain: subscribedSubdomain,
        status: 'ACTIVE',
        provisionedAt: new Date()
      }));
      // 4. Initialize default configurations
      await initializeTenantDefaults(tx, subscribedTenantId);
      return next();
    } catch (error) {
      await rollbackProvisioning(subscribedTenantId, hdiContainer);
      req.error(500, `Provisioning failed: ${error.message}`);
    }
  });

  this.on('DELETE', 'tenant', async (req, next) => {
    const { subscribedTenantId } = req.data;
    await scheduleTenantCleanup(subscribedTenantId);
    return next();
  });
});
```

### 2. Ariba Synchronization Engine

Manages data retrieval from SAP Ariba Analytical and Operational Reporting APIs.

**Responsibilities:**
- OAuth 2.0 token management per tenant
- Batch synchronization on schedule
- Near-real-time synchronization for critical events
- Data normalization from Ariba format to internal Spend_Record model
- Retry with exponential backoff on failure

```javascript
// srv/sync/ariba-connector.js
class AribaConnector {
  constructor(tenantId, credentials) {
    this.tenantId = tenantId;
    this.credentials = credentials;
    this.baseUrl = credentials.apiBaseUrl;
  }

  async authenticate() {
    const tokenResponse = await fetch(`${this.credentials.tokenUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.credentials.clientId,
        client_secret: this.credentials.clientSecret
      })
    });
    return tokenResponse.json();
  }

  async fetchSpendRecords(sinceTimestamp) {
    const token = await this.authenticate();
    const response = await fetch(
      `${this.baseUrl}/analytics/v1/spend?since=${sinceTimestamp}`,
      { headers: { Authorization: `Bearer ${token.access_token}`, apiKey: this.credentials.apiKey } }
    );
    return response.json();
  }
}
```

```javascript
// srv/sync/batch-sync-handler.js
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

async function executeBatchSync(tenantId) {
  const lastSync = await getLastSyncTimestamp(tenantId);
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      const connector = await createConnectorForTenant(tenantId);
      const rawRecords = await connector.fetchSpendRecords(lastSync);
      const normalizedRecords = rawRecords.map(normalizeSpendRecord);
      await persistSpendRecords(tenantId, normalizedRecords);
      await updateSyncTimestamp(tenantId, new Date());
      return { success: true, recordCount: normalizedRecords.length };
    } catch (error) {
      attempt++;
      if (attempt >= MAX_RETRIES) {
        await generateSyncFailureAlert(tenantId, error);
        throw error;
      }
      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      await sleep(delay);
    }
  }
}
```

### 3. Spend Analytics Engine

Core business logic for calculating metrics, detecting thresholds, and generating alerts.

**Responsibilities:**
- Category spend aggregation
- Supplier concentration calculation
- Maverick spend detection
- Savings calculation
- Budget variance computation
- Payment performance metrics
- Threshold monitoring and alert generation

```javascript
// srv/analytics/spend-aggregator.js

function aggregateByCategory(spendRecords) {
  const totals = {};
  let overallSpend = 0;

  for (const record of spendRecords) {
    const category = record.categoryHierarchy;
    if (!totals[category]) {
      totals[category] = { amount: 0, records: [] };
    }
    totals[category].amount += record.amount;
    totals[category].records.push(record);
    overallSpend += record.amount;
  }

  return Object.entries(totals).map(([category, data]) => ({
    category,
    totalSpend: data.amount,
    percentOfTotal: overallSpend > 0 ? (data.amount / overallSpend) * 100 : 0,
    recordCount: data.records.length
  }));
}

function calculateSupplierConcentration(spendRecords, category) {
  const categoryRecords = spendRecords.filter(r => r.categoryHierarchy === category);
  const categoryTotal = categoryRecords.reduce((sum, r) => sum + r.amount, 0);
  const supplierTotals = {};

  for (const record of categoryRecords) {
    supplierTotals[record.supplierId] = (supplierTotals[record.supplierId] || 0) + record.amount;
  }

  return Object.entries(supplierTotals)
    .map(([supplierId, amount]) => ({
      supplierId,
      amount,
      concentration: categoryTotal > 0 ? (amount / categoryTotal) * 100 : 0
    }))
    .sort((a, b) => b.concentration - a.concentration);
}

function detectMaverickSpend(spendRecord, activeContracts) {
  const matchingContract = activeContracts.find(contract =>
    contract.supplierId === spendRecord.supplierId &&
    contract.categoryId === spendRecord.categoryId &&
    contract.startDate <= spendRecord.purchaseDate &&
    contract.endDate >= spendRecord.purchaseDate &&
    contract.status === 'ACTIVE'
  );
  return matchingContract === undefined;
}

function calculateSavings(spendRecord, contractPrice) {
  if (contractPrice === null || contractPrice === undefined) {
    return { savings: null, matched: false };
  }
  return {
    savings: contractPrice - spendRecord.amount,
    matched: true
  };
}

function calculateBudgetVariance(actualSpend, budgetAmount) {
  return {
    absolute: actualSpend - budgetAmount,
    percentage: budgetAmount > 0 ? (actualSpend / budgetAmount) * 100 : null
  };
}
```

```javascript
// srv/analytics/payment-performance.js

function calculatePaymentPerformance(invoices) {
  if (invoices.length === 0) return null;

  const onTimeCount = invoices.filter(inv =>
    inv.paymentDate <= inv.dueDate
  ).length;

  const totalDays = invoices.reduce((sum, inv) => {
    const days = daysBetween(inv.invoiceDate, inv.paymentDate);
    return sum + days;
  }, 0);

  const discountEligible = invoices.filter(inv => inv.discountTerms !== null);
  const discountsCaptured = discountEligible.filter(inv =>
    inv.paymentDate <= inv.discountDueDate
  );

  const missedDiscountValue = discountEligible
    .filter(inv => inv.paymentDate > inv.discountDueDate)
    .reduce((sum, inv) => sum + inv.discountAmount, 0);

  return {
    onTimeRate: (onTimeCount / invoices.length) * 100,
    avgDaysToPay: totalDays / invoices.length,
    discountCaptureRate: discountEligible.length > 0
      ? (discountsCaptured.length / discountEligible.length) * 100
      : 100,
    unrealizedSavings: missedDiscountValue
  };
}
```

### 4. Threshold Monitoring & Alert Service

Monitors metric values against configured thresholds and triggers alerts/workflows.

```javascript
// srv/alerts/threshold-monitor.js

function evaluateThresholdBreach(metricValue, threshold, direction = 'above') {
  if (direction === 'above') {
    return metricValue > threshold.value;
  }
  return metricValue < threshold.value;
}

function createAlert(breach) {
  return {
    id: generateUUID(),
    metricName: breach.metricName,
    currentValue: breach.currentValue,
    thresholdValue: breach.threshold.value,
    affectedEntity: breach.entity,
    entityType: breach.entityType,
    severity: breach.threshold.severity,
    createdAt: new Date(),
    acknowledgedAt: null,
    acknowledgedBy: null,
    escalated: false
  };
}

async function processAlertEscalation(alert, escalationConfig) {
  const ageHours = hoursSince(alert.createdAt);
  if (!alert.acknowledgedAt && ageHours > 24) {
    await sendEscalation(alert, escalationConfig.escalationContact);
    return { ...alert, escalated: true };
  }
  return alert;
}

async function initiateWorkflowTrigger(alert, workflowConfig) {
  if (alert.severity === 'CRITICAL') {
    return {
      taskId: generateUUID(),
      alertId: alert.id,
      assignedTo: workflowConfig.approver,
      taskType: 'APPROVAL',
      createdAt: new Date(),
      status: 'PENDING'
    };
  }
  return null;
}
```

### 5. Dashboard OData Service

Exposes analytics data via OData V4 for the Fiori/UI5 frontend.

```javascript
// srv/dashboard-service.cds (CDS model excerpt)
// Defined in CDS for SAP CAP OData service exposure
```

### 6. Filter Engine

Centralized filtering that applies consistently across all dashboard components.

```javascript
// srv/analytics/filter-engine.js

function applyFilters(records, filters) {
  return records.filter(record => {
    if (filters.dateRange) {
      if (record.purchaseDate < filters.dateRange.start ||
          record.purchaseDate > filters.dateRange.end) {
        return false;
      }
    }
    if (filters.category && record.categoryHierarchy !== filters.category) {
      return false;
    }
    if (filters.supplier && record.supplierId !== filters.supplier) {
      return false;
    }
    if (filters.costCenter && record.costCenterId !== filters.costCenter) {
      return false;
    }
    if (filters.contractStatus && record.contractStatus !== filters.contractStatus) {
      return false;
    }
    return true;
  });
}
```

---

### External API Interfaces

#### SAP Ariba Analytical Reporting API

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/oauth/token` | Acquire OAuth 2.0 access token |
| GET | `/analytics/v1/spend` | Retrieve spend records (batch) |
| GET | `/analytics/v1/contracts` | Retrieve active contract catalog |
| GET | `/analytics/v1/invoices` | Retrieve invoice/payment data |

#### SAP SaaS Provisioning Service Callbacks

| Event | Handler | Purpose |
|-------|---------|---------|
| PUT `/callback/v1.0/tenants/{tenantId}` | onSubscribe | Provision tenant resources |
| DELETE `/callback/v1.0/tenants/{tenantId}` | onUnsubscribe | Schedule tenant cleanup |
| GET `/callback/v1.0/dependencies` | getDependencies | Return service dependencies |

### Internal OData V4 Service Interface

#### DashboardService

| Entity Set | Methods | Purpose |
|-----------|---------|---------|
| `/SpendByCategory` | GET | Category spend aggregation |
| `/SupplierConcentration` | GET | Supplier concentration per category |
| `/MaverickSpend` | GET | Off-contract transactions |
| `/SavingsSummary` | GET | Savings by category/supplier/period |
| `/BudgetVariance` | GET | Budget vs actual by cost center |
| `/PaymentPerformance` | GET | Supplier payment metrics |
| `/Alerts` | GET, PATCH | Alert management and acknowledgment |
| `/ThresholdConfigurations` | GET, PUT, POST, DELETE | Threshold CRUD |
| `/Budgets` | GET, PUT, POST, DELETE | Budget configuration CRUD |

**Common Query Parameters (applied across all read endpoints):**
- `$filter` — OData filter expression (date range, category, supplier, cost center, contract status)
- `$orderby` — Sort expression
- `$top` / `$skip` — Pagination
- `$expand` — Navigate to detail records (drill-down)

---

## Data Models

### Core CDS Domain Model

```cds
// db/schema.cds
namespace procurement.spend;

using { cuid, managed } from '@sap/cds/common';

entity SpendRecords : cuid, managed {
  supplierId        : String(64) not null;
  supplierName      : String(256);
  categoryId        : String(64) not null;
  categoryHierarchy : String(512);
  costCenterId      : String(64);
  costCenterName    : String(256);
  contractId        : String(64);
  contractStatus    : String(20); // ACTIVE, EXPIRED, NONE
  amount            : Decimal(15,2) not null;
  currency          : String(3) not null;
  purchaseDate      : Date not null;
  isMaverick        : Boolean default false;
  savingsAmount     : Decimal(15,2);
  matchedToContract : Boolean default false;
  sourceSystem      : String(64) default 'ARIBA';
  aribaDocumentId   : String(128);
}

entity Contracts : cuid, managed {
  supplierId    : String(64) not null;
  categoryId    : String(64) not null;
  contractPrice : Decimal(15,2);
  startDate     : Date not null;
  endDate       : Date not null;
  status        : String(20) not null; // ACTIVE, EXPIRED
}

entity Invoices : cuid, managed {
  supplierId       : String(64) not null;
  invoiceNumber    : String(128);
  invoiceDate      : Date not null;
  dueDate          : Date not null;
  paymentDate      : Date;
  amount           : Decimal(15,2) not null;
  currency         : String(3) not null;
  discountTerms    : String(128);
  discountDueDate  : Date;
  discountAmount   : Decimal(15,2);
  discountCaptured : Boolean default false;
}

entity Budgets : cuid, managed {
  costCenterId : String(64) not null;
  fiscalYear   : Integer not null;
  fiscalPeriod : Integer not null;
  amount       : Decimal(15,2) not null;
  currency     : String(3) not null;
}

entity Alerts : cuid, managed {
  metricName     : String(128) not null;
  currentValue   : Decimal(15,4) not null;
  thresholdValue : Decimal(15,4) not null;
  entityType     : String(64) not null; // SUPPLIER, CATEGORY, COST_CENTER
  entityId       : String(64) not null;
  entityName     : String(256);
  severity       : String(20) not null; // INFO, WARNING, CRITICAL
  channel        : String(20); // IN_APP, EMAIL
  acknowledgedAt : Timestamp;
  acknowledgedBy : String(256);
  escalated      : Boolean default false;
  escalatedAt    : Timestamp;
}

entity WorkflowTasks : cuid, managed {
  alertId    : String(36) not null;
  assignedTo : String(256) not null;
  taskType   : String(64) not null;
  status     : String(20) default 'PENDING'; // PENDING, COMPLETED, CANCELLED
}

entity ThresholdConfigurations : cuid, managed {
  metricName       : String(128) not null;
  thresholdValue   : Decimal(15,4) not null;
  direction        : String(10) not null; // ABOVE, BELOW
  severity         : String(20) not null; // INFO, WARNING, CRITICAL
  enabled          : Boolean default true;
  escalationContact: String(256);
  approver         : String(256);
}

entity TenantRegistry : cuid, managed {
  tenantId      : String(64) not null;
  subdomain     : String(128);
  status        : String(20) not null; // ACTIVE, DEPROVISIONING, DELETED
  provisionedAt : Timestamp;
}

entity SyncStatus : cuid, managed {
  syncType        : String(20) not null; // BATCH, NEAR_REAL_TIME
  lastSuccessAt   : Timestamp;
  lastAttemptAt   : Timestamp;
  status          : String(20) not null; // SUCCESS, FAILED, RUNNING
  recordsProcessed: Integer;
  errorMessage    : String(1024);
}
```

### Normalization Mapping

| Ariba Field | Internal Field | Transformation |
|-------------|---------------|----------------|
| `DocumentId` | `aribaDocumentId` | Direct map |
| `Supplier.UniqueName` | `supplierId` | Direct map |
| `Supplier.Name` | `supplierName` | Direct map |
| `Commodity.UniqueName` | `categoryId` | Direct map |
| `Commodity.Path` | `categoryHierarchy` | Join path segments with `/` |
| `AccountingInfo.CostCenter` | `costCenterId` | Direct map |
| `Amount.Amount` | `amount` | Parse to Decimal |
| `Amount.Currency` | `currency` | ISO 4217 code |
| `CreatedDate` | `purchaseDate` | ISO 8601 date parse |
| `Contract.UniqueName` | `contractId` | Direct map, null if absent |

---

## Error Handling

### Error Categories and Responses

| Category | HTTP Status | Retry | Alert |
|----------|-------------|-------|-------|
| Ariba API authentication failure | N/A (background) | Yes (3x) | Yes (after exhaustion) |
| Ariba API rate limiting (429) | N/A (background) | Yes (respect Retry-After) | No |
| Ariba API server error (5xx) | N/A (background) | Yes (3x exponential) | Yes (after exhaustion) |
| Normalization validation error | N/A (background) | No (skip record, log) | Yes (batch summary) |
| HANA connection failure | 503 | Yes (3x) | Yes (after exhaustion) |
| Provisioning partial failure | 500 | No (rollback) | No (error returned to SaaS service) |
| Authorization failure | 403 | No | No |
| Invalid filter parameters | 400 | No | No |
| Threshold configuration error | 422 | No | No |

### Retry Strategy

```javascript
// srv/common/retry.js
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;

async function withRetry(operation, options = {}) {
  const maxRetries = options.maxRetries || DEFAULT_MAX_RETRIES;
  const baseDelay = options.baseDelayMs || DEFAULT_BASE_DELAY_MS;
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}
```

### Provisioning Rollback

On any failure during tenant provisioning, the system executes compensating actions in reverse order:
1. Delete tenant registry entry (if created)
2. Remove credentials from Credential Store (if stored)
3. Drop HDI container (if created)
4. Return error status to SaaS Provisioning Service

### Data Validation

Records that fail normalization validation are:
- Logged with full error context
- Excluded from metric calculations
- Counted in sync status summary
- Reported in batch sync completion alert if count exceeds threshold

---

## Testing Strategy

### Unit Tests
- Test individual metric calculation functions (savings, budget variance, payment performance) with specific examples
- Test normalization of Ariba records with known input/output pairs
- Test filter engine with edge cases (empty filters, all filters active, no matching records)
- Test alert generation with specific threshold configurations

### Property-Based Tests
- Validate all 12 correctness properties defined above with minimum 100 iterations per property
- Use generators for Spend_Records, Contracts, Invoices, filter combinations, and tenant contexts
- Focus on pure computation functions: aggregation, classification, calculation, filtering, sorting

### Integration Tests
- Tenant provisioning and deprovisioning lifecycle (1-2 test tenants)
- Ariba API connectivity and OAuth token acquisition
- HANA Cloud schema isolation verification
- End-to-end sync pipeline with mock Ariba responses
- Alert delivery through configured channels

### Performance Tests
- Dashboard response time under filter application (< 3 seconds target)
- Near-real-time sync latency (< 5 minutes target)
- Batch sync throughput with large record volumes

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Tenant Data Isolation

For any two distinct tenants T1 and T2, and for any data query executed in the context of T1, the result set shall contain zero records belonging to T2. This applies to Spend_Records, Alerts, Configurations, and all other tenant-scoped entities.

**Validates: Requirements 1.4, 10.6**

### Property 2: Record Normalization Validity

For any raw Ariba API response record, the normalization function shall produce a Spend_Record with all required fields populated (supplierId, categoryId, amount, currency, purchaseDate) and amount parsed as a valid non-negative decimal value, or the record shall be rejected and flagged as invalid.

**Validates: Requirements 2.2**

### Property 3: Retry with Exponential Backoff

For any synchronization operation that fails, the retry mechanism shall execute at most 3 attempts with delays following the pattern baseDelay × 2^attempt (i.e., 1s, 2s, 4s), and if all attempts fail, exactly one failure alert shall be generated.

**Validates: Requirements 2.5, 2.6**

### Property 4: Aggregation Consistency

For any set of Spend_Records and any grouping dimension (Category, supplier, or Cost_Center), the sum of all group-level amounts shall equal the total spend across all records, and all group percentages shall sum to 100% (within floating-point tolerance).

**Validates: Requirements 3.1, 3.3, 4.1, 6.2**

### Property 5: Filter Correctness

For any set of filter criteria (date range, category, supplier, cost center, contract status) applied to any dataset, every record in the result set shall satisfy all active filter predicates, and every record excluded shall violate at least one active filter predicate.

**Validates: Requirements 3.2, 6.3, 10.2**

### Property 6: Drill-Down Consistency

For any aggregated metric value displayed on the dashboard, navigating the drill-down shall produce a set of detail records whose aggregate equals the parent metric value (within rounding tolerance), and every detail record shall belong to the parent entity.

**Validates: Requirements 3.4, 4.4, 5.4, 7.4, 8.4, 10.4**

### Property 7: Supplier Ranking Order

For any category's supplier concentration list containing N suppliers, for all indices i where 0 ≤ i < N-1, the spend share at position i shall be greater than or equal to the spend share at position i+1.

**Validates: Requirements 4.3**

### Property 8: Threshold Breach Detection

For any monitored metric value and its configured threshold, if the value exceeds the threshold (in the configured direction), exactly one alert shall be generated. If the threshold is configured as critical severity, exactly one workflow task shall be created. If the alert remains unacknowledged for more than 24 hours, escalation shall trigger.

**Validates: Requirements 4.2, 5.5, 7.3, 8.3, 9.3**

### Property 9: Maverick Spend Classification

For any Spend_Record and any set of active contracts, the record shall be classified as maverick if and only if no active contract exists matching the record's supplier, category, and purchase date within the contract's validity period.

**Validates: Requirements 5.1, 5.3**

### Property 10: Metric Calculation Correctness

For any set of Spend_Records with associated contract prices and invoice data: (a) savings for a matched record equals contract_price minus actual_amount, (b) budget variance equals actual_spend minus budget_amount, (c) on-time payment rate equals count of invoices paid on or before due date divided by total invoices × 100, (d) unrealized savings equals the sum of discount amounts for eligible invoices where payment occurred after the discount due date.

**Validates: Requirements 5.3, 6.1, 6.4, 7.1, 7.2, 8.1, 8.5**

### Property 11: Unmatched Record Exclusion

For any Spend_Record that cannot be matched to a contract price, the record shall be excluded from all savings calculations (contributing zero to savings totals) and shall be flagged with matchedToContract = false.

**Validates: Requirements 6.5**

### Property 12: Alert Completeness and Audit

For any threshold breach event, the generated alert shall contain non-null values for metricName, currentValue, thresholdValue, entityType, and entityId. For any alert acknowledgment action, the system shall record a non-null acknowledgedAt timestamp and a non-null acknowledgedBy user identity.

**Validates: Requirements 9.1, 9.5**
