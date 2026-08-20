// @ts-check
/**
 * @fileoverview Reconciliation validators for month-end close, PO reconciliation,
 * accrual identification, and payment forecasting.
 * Provides high-confidence derivations using invoice data and PO history.
 */

const cds = require('@sap/cds');
const { normalizeVendorNumberPadded, normalizePONumberPadded, normalizeAmount } = require('./utils/normalizers');
const { createValidationResult } = require('./utils/confidence');
const cache = require('./cache');

/**
 * Get the ECC integration service.
 * @returns {Promise<any>} ECC service instance
 */
async function getEccService() {
  return await cds.connect.to('vim_ecc_integration');
}

// ============================================================================
// PO RECONCILIATION
// ============================================================================

/**
 * PO Reconciliation item.
 * @typedef {Object} POReconciliationItem
 * @property {string} poNumber - PO number
 * @property {string} poItem - PO item number
 * @property {number} poValue - Original PO value
 * @property {number} invoicedAmount - Amount already invoiced
 * @property {number} remainingAmount - Remaining to invoice
 * @property {number} percentInvoiced - Percentage invoiced
 * @property {string} status - FULLY_INVOICED, PARTIALLY_INVOICED, NOT_INVOICED, OVER_INVOICED
 * @property {number} variance - Over/under amount
 * @property {string} currency - Currency
 */

/**
 * Reconcile a single PO against invoice data.
 * High confidence when invoice data is provided directly.
 * @param {Object} params - Reconciliation parameters
 * @param {string} params.poNumber - PO number
 * @param {string} [params.poItem] - Specific PO item (optional)
 * @param {Object[]} [params.invoices] - Invoice data to reconcile against
 * @param {string} params.invoices[].invoiceNumber - Invoice number
 * @param {number} params.invoices[].amount - Invoice amount
 * @param {string} params.invoices[].invoiceDate - Invoice date
 * @param {string} [params.invoices[].poItem] - PO item on invoice
 * @returns {Promise<{reconciliation: POReconciliationItem[], confidence: number, summary: Object}>}
 */
async function reconcilePOWithInvoices(params) {
  const { poNumber, poItem, invoices = [] } = params;
  
  try {
    const ecc = await getEccService();
    const paddedPO = normalizePONumberPadded(poNumber);
    
    // Fetch PO with history
    const poDetail = await ecc.getPODetail1({
      PURCHASEORDER: paddedPO,
      ITEMS: 'X',
      HISTORY: 'X',
      ACCOUNT_ASSIGNMENT: 'X'
    });
    
    if (!poDetail || poDetail.RETURN?.some(r => r.TYPE === 'E')) {
      return {
        reconciliation: [],
        confidence: 0,
        summary: { error: 'PO not found' }
      };
    }
    
    const items = poDetail.POITEM || [];
    const historyTotals = poDetail.POHISTORY_TOTALS || [];
    const history = poDetail.POHISTORY || [];
    const currency = poDetail.POHEADER?.CURRENCY || '';
    
    // Filter items if specific item requested
    const relevantItems = poItem
      ? items.filter(i => i.PO_ITEM === poItem.toString().padStart(5, '0'))
      : items;
    
    const reconciliation = [];
    let totalPOValue = 0;
    let totalInvoiced = 0;
    let totalFromECC = 0;
    let totalFromInput = 0;

    for (const item of relevantItems) {
      const itemNumber = item.PO_ITEM;
      
      // Calculate PO item value
      const qty = Number.parseFloat(item.QUANTITY) || Number.parseFloat(item.PO_QUANTITY) || 0;
      const price = Number.parseFloat(item.NET_PRICE) || 0;
      const priceUnit = Number.parseFloat(item.PRICE_UNIT) || 1;
      const poValue = (qty * price) / priceUnit;
      totalPOValue += poValue;
      
      // Get invoiced amount from ECC history
      let eccInvoicedAmount = 0;
      const itemHistory = historyTotals.find(h => h.PO_ITEM === itemNumber);
      if (itemHistory) {
        eccInvoicedAmount = Number.parseFloat(itemHistory.IV_VAL) || 0;
      } else {
        // Fall back to detailed history
        const detailedHistory = history.filter(h => h.PO_ITEM === itemNumber);
        for (const hist of detailedHistory) {
          if (hist.DOC_TYPE === 'RE') {
            eccInvoicedAmount += Number.parseFloat(hist.NET_VALUE) || 0;
          }
        }
      }
      totalFromECC += eccInvoicedAmount;
      
      // Add invoiced amount from provided invoice data
      let inputInvoicedAmount = 0;
      const matchingInvoices = invoices.filter(inv => 
        !inv.poItem || inv.poItem === itemNumber || 
        inv.poItem.toString().padStart(5, '0') === itemNumber
      );
      
      for (const inv of matchingInvoices) {
        inputInvoicedAmount += normalizeAmount(inv.amount);
      }
      totalFromInput += inputInvoicedAmount;
      
      // Total invoiced = ECC history + new invoices being processed
      const invoicedAmount = eccInvoicedAmount + inputInvoicedAmount;
      totalInvoiced += invoicedAmount;
      
      const remainingAmount = poValue - invoicedAmount;
      const percentInvoiced = poValue > 0 ? (invoicedAmount / poValue) * 100 : 0;
      const variance = invoicedAmount - poValue;

      // Determine status
      let status;
      if (percentInvoiced >= 100 && variance <= 0.01 * poValue) {
        status = 'FULLY_INVOICED';
      } else if (percentInvoiced > 100) {
        status = 'OVER_INVOICED';
      } else if (percentInvoiced > 0) {
        status = 'PARTIALLY_INVOICED';
      } else {
        status = 'NOT_INVOICED';
      }
      
      reconciliation.push({
        poNumber: paddedPO,
        poItem: itemNumber,
        poValue: Math.round(poValue * 100) / 100,
        invoicedAmount: Math.round(invoicedAmount * 100) / 100,
        eccInvoicedAmount: Math.round(eccInvoicedAmount * 100) / 100,
        newInvoicesAmount: Math.round(inputInvoicedAmount * 100) / 100,
        remainingAmount: Math.round(remainingAmount * 100) / 100,
        percentInvoiced: Math.round(percentInvoiced * 100) / 100,
        status,
        variance: Math.round(variance * 100) / 100,
        currency,
        material: item.MATERIAL,
        description: item.SHORT_TEXT
      });
    }
    
    // Calculate confidence based on data sources
    // High confidence when we have both ECC history and invoice input
    let confidence = 0.7; // Base from ECC data
    if (invoices.length > 0) {
      confidence = 0.95; // High confidence with invoice data
    }
    if (historyTotals.length > 0) {
      confidence = Math.min(1.0, confidence + 0.05); // Boost for totals data
    }
    
    return {
      reconciliation,
      confidence,
      summary: {
        poNumber: paddedPO,
        totalItems: reconciliation.length,
        totalPOValue: Math.round(totalPOValue * 100) / 100,
        totalInvoiced: Math.round(totalInvoiced * 100) / 100,
        totalFromECC: Math.round(totalFromECC * 100) / 100,
        totalFromNewInvoices: Math.round(totalFromInput * 100) / 100,
        remainingLiability: Math.round((totalPOValue - totalInvoiced) * 100) / 100,
        percentComplete: totalPOValue > 0 ? Math.round((totalInvoiced / totalPOValue) * 10000) / 100 : 0,
        currency,
        statusBreakdown: {
          fullyInvoiced: reconciliation.filter(r => r.status === 'FULLY_INVOICED').length,
          partiallyInvoiced: reconciliation.filter(r => r.status === 'PARTIALLY_INVOICED').length,
          notInvoiced: reconciliation.filter(r => r.status === 'NOT_INVOICED').length,
          overInvoiced: reconciliation.filter(r => r.status === 'OVER_INVOICED').length
        }
      }
    };
  } catch (error) {
    return {
      reconciliation: [],
      confidence: 0,
      summary: { error: error.message }
    };
  }
}


// ============================================================================
// INVOICE AGING ANALYSIS
// ============================================================================

/**
 * Invoice aging bucket.
 * @typedef {Object} AgingBucket
 * @property {string} bucket - Bucket name
 * @property {number} count - Number of invoices
 * @property {number} amount - Total amount
 * @property {Object[]} invoices - Invoice details
 */

/**
 * Analyze invoice aging relative to period end.
 * Uses invoice data directly for high confidence.
 * @param {Object} params - Analysis parameters
 * @param {Date|string} params.periodEndDate - Period end date (e.g., "2024-01-31")
 * @param {Object[]} params.invoices - Invoices to analyze
 * @param {string} params.invoices[].invoiceNumber - Invoice number
 * @param {string|Date} params.invoices[].invoiceDate - Invoice date
 * @param {string|Date} [params.invoices[].postingDate] - Posting date
 * @param {string|Date} [params.invoices[].dueDate] - Payment due date
 * @param {number} params.invoices[].grossAmount - Gross amount
 * @param {string} params.invoices[].vendorId - Vendor ID
 * @param {string} [params.invoices[].currency] - Currency
 * @param {boolean} [params.invoices[].isPaid] - Whether invoice is paid
 * @returns {{aging: AgingBucket[], summary: Object, confidence: number}}
 */
function analyzeInvoiceAging(params) {
  const { periodEndDate, invoices } = params;
  const periodEnd = new Date(periodEndDate);
  periodEnd.setHours(23, 59, 59, 999);
  
  const periodStart = new Date(periodEnd);
  periodStart.setDate(1);
  periodStart.setHours(0, 0, 0, 0);
  
  // Initialize buckets
  const buckets = {
    currentPeriod: { bucket: 'CURRENT_PERIOD', count: 0, amount: 0, invoices: [] },
    priorPeriod: { bucket: 'PRIOR_PERIOD', count: 0, amount: 0, invoices: [] },
    futureDated: { bucket: 'FUTURE_DATED', count: 0, amount: 0, invoices: [] },
    overdue0to30: { bucket: 'OVERDUE_0_30', count: 0, amount: 0, invoices: [] },
    overdue31to60: { bucket: 'OVERDUE_31_60', count: 0, amount: 0, invoices: [] },
    overdue61to90: { bucket: 'OVERDUE_61_90', count: 0, amount: 0, invoices: [] },
    overdueOver90: { bucket: 'OVERDUE_OVER_90', count: 0, amount: 0, invoices: [] }
  };

  let totalAmount = 0;
  let totalOverdue = 0;
  
  for (const invoice of invoices) {
    const invDate = new Date(invoice.invoiceDate);
    const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
    const amount = normalizeAmount(invoice.grossAmount);
    const isPaid = invoice.isPaid || false;
    
    totalAmount += amount;
    
    const invDetail = {
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invDate.toISOString().split('T')[0],
      dueDate: dueDate ? dueDate.toISOString().split('T')[0] : null,
      amount,
      vendorId: invoice.vendorId,
      currency: invoice.currency || 'USD'
    };
    
    // Categorize by invoice date relative to period
    if (invDate > periodEnd) {
      buckets.futureDated.count++;
      buckets.futureDated.amount += amount;
      buckets.futureDated.invoices.push({ ...invDetail, issue: 'Invoice dated after period end' });
    } else if (invDate >= periodStart && invDate <= periodEnd) {
      buckets.currentPeriod.count++;
      buckets.currentPeriod.amount += amount;
      buckets.currentPeriod.invoices.push(invDetail);
    } else {
      buckets.priorPeriod.count++;
      buckets.priorPeriod.amount += amount;
      buckets.priorPeriod.invoices.push({ ...invDetail, issue: 'Invoice dated in prior period' });
    }
    
    // Also categorize by payment due date (for unpaid invoices)
    if (!isPaid && dueDate && dueDate < periodEnd) {
      const daysOverdue = Math.floor((periodEnd.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      totalOverdue += amount;
      
      if (daysOverdue <= 30) {
        buckets.overdue0to30.count++;
        buckets.overdue0to30.amount += amount;
        buckets.overdue0to30.invoices.push({ ...invDetail, daysOverdue });
      } else if (daysOverdue <= 60) {
        buckets.overdue31to60.count++;
        buckets.overdue31to60.amount += amount;
        buckets.overdue31to60.invoices.push({ ...invDetail, daysOverdue });
      } else if (daysOverdue <= 90) {
        buckets.overdue61to90.count++;
        buckets.overdue61to90.amount += amount;
        buckets.overdue61to90.invoices.push({ ...invDetail, daysOverdue });
      } else {
        buckets.overdueOver90.count++;
        buckets.overdueOver90.amount += amount;
        buckets.overdueOver90.invoices.push({ ...invDetail, daysOverdue });
      }
    }
  }
  
  // Confidence is 100% when using direct invoice data
  const confidence = 1.0;
  
  return {
    aging: Object.values(buckets).map(b => ({
      ...b,
      amount: Math.round(b.amount * 100) / 100
    })),
    summary: {
      periodEndDate: periodEnd.toISOString().split('T')[0],
      totalInvoices: invoices.length,
      totalAmount: Math.round(totalAmount * 100) / 100,
      totalOverdue: Math.round(totalOverdue * 100) / 100,
      currentPeriodCount: buckets.currentPeriod.count,
      priorPeriodCount: buckets.priorPeriod.count,
      futureDatedCount: buckets.futureDated.count,
      overdueCount: buckets.overdue0to30.count + buckets.overdue31to60.count + 
                    buckets.overdue61to90.count + buckets.overdueOver90.count,
      issues: [
        ...(buckets.priorPeriod.count > 0 ? [`${buckets.priorPeriod.count} invoices dated in prior period`] : []),
        ...(buckets.futureDated.count > 0 ? [`${buckets.futureDated.count} invoices dated in future`] : []),
        ...(buckets.overdueOver90.count > 0 ? [`${buckets.overdueOver90.count} invoices overdue > 90 days`] : [])
      ]
    },
    confidence
  };
}


// ============================================================================
// ACCRUAL IDENTIFICATION
// ============================================================================

/**
 * Accrual candidate.
 * @typedef {Object} AccrualCandidate
 * @property {string} type - GOODS_RECEIVED_NOT_INVOICED, SERVICE_RECEIVED_NOT_INVOICED, RECURRING_MISSING
 * @property {string} poNumber - PO number (if applicable)
 * @property {string} [poItem] - PO item
 * @property {string} vendorId - Vendor ID
 * @property {number} estimatedAmount - Estimated accrual amount
 * @property {string} description - Description
 * @property {number} confidence - Confidence level
 */

/**
 * Identify accrual candidates based on PO data and invoice history.
 * High confidence when invoice data is provided for comparison.
 * @param {Object} params - Accrual parameters
 * @param {Date|string} params.periodEndDate - Period end date
 * @param {Object[]} params.purchaseOrders - POs to check for accruals
 * @param {string} params.purchaseOrders[].poNumber - PO number
 * @param {string} [params.purchaseOrders[].poItem] - Specific item (optional)
 * @param {Object[]} [params.invoices] - Invoices already received (to exclude from accruals)
 * @param {string} params.invoices[].poNumber - PO number on invoice
 * @param {string} [params.invoices[].poItem] - PO item on invoice
 * @param {number} params.invoices[].amount - Invoice amount
 * @param {Object[]} [params.recurringExpenses] - Expected recurring expenses
 * @param {string} params.recurringExpenses[].vendorId - Vendor ID
 * @param {string} params.recurringExpenses[].description - Expense description (e.g., "Monthly Rent")
 * @param {number} params.recurringExpenses[].expectedAmount - Expected amount
 * @param {number} [params.materialityThreshold=100] - Minimum amount to consider
 * @returns {Promise<{accruals: AccrualCandidate[], summary: Object, confidence: number}>}
 */
async function identifyAccrualCandidates(params) {
  const { 
    periodEndDate, 
    purchaseOrders = [], 
    invoices = [],
    recurringExpenses = [],
    materialityThreshold = 100 
  } = params;
  
  const periodEnd = new Date(periodEndDate);
  const accruals = [];
  
  try {
    const ecc = await getEccService();
    
    // Build invoice lookup by PO
    const invoicedByPO = new Map();
    for (const inv of invoices) {
      if (inv.poNumber) {
        const key = `${normalizePONumberPadded(inv.poNumber)}_${inv.poItem || 'ALL'}`;
        const current = invoicedByPO.get(key) || 0;
        invoicedByPO.set(key, current + normalizeAmount(inv.amount));
      }
    }
    
    // Check each PO for uninvoiced amounts
    for (const po of purchaseOrders) {
      const paddedPO = normalizePONumberPadded(po.poNumber);
      
      const poDetail = await ecc.getPODetail1({
        PURCHASEORDER: paddedPO,
        ITEMS: 'X',
        HISTORY: 'X'
      });
      
      if (!poDetail || poDetail.RETURN?.some(r => r.TYPE === 'E')) {
        continue;
      }
      
      const items = poDetail.POITEM || [];
      const historyTotals = poDetail.POHISTORY_TOTALS || [];
      const header = poDetail.POHEADER || {};
      
      // Filter to specific item if provided
      const relevantItems = po.poItem
        ? items.filter(i => i.PO_ITEM === po.poItem.toString().padStart(5, '0'))
        : items;
      
      for (const item of relevantItems) {
        const itemNumber = item.PO_ITEM;
        const acctAssignCat = item.ACCTASSCAT || '';
        
        // Calculate PO value
        const qty = Number.parseFloat(item.QUANTITY) || Number.parseFloat(item.PO_QUANTITY) || 0;
        const price = Number.parseFloat(item.NET_PRICE) || 0;
        const priceUnit = Number.parseFloat(item.PRICE_UNIT) || 1;
        const poValue = (qty * price) / priceUnit;
        
        // Get goods received value from history
        const itemHistory = historyTotals.find(h => h.PO_ITEM === itemNumber);
        const grValue = itemHistory ? (Number.parseFloat(itemHistory.GR_VAL) || 0) : 0;
        const ivValue = itemHistory ? (Number.parseFloat(itemHistory.IV_VAL) || 0) : 0;
        
        // Add any new invoices from input
        const invKey = `${paddedPO}_${itemNumber}`;
        const invKeyAll = `${paddedPO}_ALL`;
        const newInvoiceAmount = (invoicedByPO.get(invKey) || 0) + (invoicedByPO.get(invKeyAll) || 0);
        const totalInvoiced = ivValue + newInvoiceAmount;
        
        // Determine accrual type based on item category and GR status
        const isService = ['K', 'D', 'P'].includes(acctAssignCat); // Service categories
        
        // GR received but not fully invoiced
        if (grValue > totalInvoiced + materialityThreshold) {
          const accrualAmount = grValue - totalInvoiced;
          accruals.push({
            type: isService ? 'SERVICE_RECEIVED_NOT_INVOICED' : 'GOODS_RECEIVED_NOT_INVOICED',
            poNumber: paddedPO,
            poItem: itemNumber,
            vendorId: header.VENDOR || '',
            estimatedAmount: Math.round(accrualAmount * 100) / 100,
            description: item.SHORT_TEXT || `${isService ? 'Service' : 'Goods'} received, invoice pending`,
            grValue: Math.round(grValue * 100) / 100,
            invoicedValue: Math.round(totalInvoiced * 100) / 100,
            currency: header.CURRENCY || '',
            confidence: 0.95 // High confidence - based on ECC history + invoice input
          });
        }
        
        // PO value committed but not received/invoiced (for services without GR)
        if (isService && grValue === 0 && totalInvoiced < poValue - materialityThreshold) {
          // Check if service should be accrued based on PO date
          const poDate = header.CREAT_DATE ? new Date(header.CREAT_DATE) : null;
          if (poDate && poDate < periodEnd) {
            // Service PO created before period end, may need accrual
            const accrualAmount = poValue - totalInvoiced;
            accruals.push({
              type: 'SERVICE_RECEIVED_NOT_INVOICED',
              poNumber: paddedPO,
              poItem: itemNumber,
              vendorId: header.VENDOR || '',
              estimatedAmount: Math.round(accrualAmount * 100) / 100,
              description: item.SHORT_TEXT || 'Service PO - invoice pending',
              poValue: Math.round(poValue * 100) / 100,
              invoicedValue: Math.round(totalInvoiced * 100) / 100,
              currency: header.CURRENCY || '',
              confidence: 0.70 // Lower confidence - service may not yet be received
            });
          }
        }
      }
    }
    
    // Check for missing recurring expenses
    for (const recurring of recurringExpenses) {
      const matchingInvoice = invoices.find(inv => 
        inv.vendorId === recurring.vendorId &&
        Math.abs(normalizeAmount(inv.amount) - recurring.expectedAmount) < recurring.expectedAmount * 0.1
      );
      
      if (!matchingInvoice) {
        accruals.push({
          type: 'RECURRING_MISSING',
          poNumber: '',
          vendorId: recurring.vendorId,
          estimatedAmount: recurring.expectedAmount,
          description: recurring.description || 'Expected recurring expense not received',
          currency: recurring.currency || 'USD',
          confidence: 0.80 // Good confidence based on pattern
        });
      }
    }
    
    // Calculate overall confidence
    const avgConfidence = accruals.length > 0
      ? accruals.reduce((sum, a) => sum + a.confidence, 0) / accruals.length
      : 1.0;
    
    return {
      accruals,
      summary: {
        periodEndDate: periodEnd.toISOString().split('T')[0],
        totalAccruals: accruals.length,
        totalEstimatedAmount: Math.round(accruals.reduce((sum, a) => sum + a.estimatedAmount, 0) * 100) / 100,
        byType: {
          goodsReceivedNotInvoiced: accruals.filter(a => a.type === 'GOODS_RECEIVED_NOT_INVOICED').length,
          serviceReceivedNotInvoiced: accruals.filter(a => a.type === 'SERVICE_RECEIVED_NOT_INVOICED').length,
          recurringMissing: accruals.filter(a => a.type === 'RECURRING_MISSING').length
        }
      },
      confidence: avgConfidence
    };
    
  } catch (error) {
    return {
      accruals: [],
      summary: { error: error.message },
      confidence: 0
    };
  }
}


// ============================================================================
// PAYMENT FORECASTING
// ============================================================================

/**
 * Payment forecast item.
 * @typedef {Object} PaymentForecastItem
 * @property {string} dueDate - Payment due date
 * @property {number} amount - Amount due
 * @property {string} invoiceNumber - Invoice number
 * @property {string} vendorId - Vendor ID
 * @property {Object} [discount] - Discount information
 */

/**
 * Forecast payment obligations based on invoice data.
 * High confidence using direct invoice input.
 * @param {Object} params - Forecast parameters
 * @param {Date|string} params.fromDate - Start date for forecast
 * @param {Date|string} params.toDate - End date for forecast
 * @param {Object[]} params.invoices - Open invoices
 * @param {string} params.invoices[].invoiceNumber - Invoice number
 * @param {string} params.invoices[].vendorId - Vendor ID
 * @param {number} params.invoices[].grossAmount - Gross amount
 * @param {string|Date} params.invoices[].dueDate - Payment due date
 * @param {string|Date} [params.invoices[].baselineDate] - Baseline date for discount
 * @param {number} [params.invoices[].discountPercent1] - First discount percentage
 * @param {number} [params.invoices[].discountDays1] - Days for first discount
 * @param {number} [params.invoices[].discountPercent2] - Second discount percentage
 * @param {number} [params.invoices[].discountDays2] - Days for second discount
 * @param {string} [params.invoices[].currency] - Currency
 * @param {boolean} [params.invoices[].isPaid] - Whether already paid
 * @returns {{forecast: Object, byDate: Object[], byVendor: Object[], discountAnalysis: Object, confidence: number}}
 */
function forecastPayments(params) {
  const { fromDate, toDate, invoices } = params;
  const from = new Date(fromDate);
  const to = new Date(toDate);
  const today = new Date();
  
  // Filter to unpaid invoices with due dates in range
  const openInvoices = invoices.filter(inv => !inv.isPaid);
  
  const paymentsByDate = new Map();
  const paymentsByVendor = new Map();
  
  let totalDue = 0;
  let totalDiscountAvailable = 0;
  let totalDiscountAtRisk = 0;
  const discountOpportunities = [];
  
  for (const invoice of openInvoices) {
    const dueDate = new Date(invoice.dueDate);
    const baselineDate = invoice.baselineDate ? new Date(invoice.baselineDate) : dueDate;
    const amount = normalizeAmount(invoice.grossAmount);
    const currency = invoice.currency || 'USD';
    
    // Check if due date is in forecast range
    if (dueDate >= from && dueDate <= to) {
      totalDue += amount;
      
      // Group by date
      const dateKey = dueDate.toISOString().split('T')[0];
      const dateEntry = paymentsByDate.get(dateKey) || { date: dateKey, amount: 0, count: 0, invoices: [] };
      dateEntry.amount += amount;
      dateEntry.count++;
      dateEntry.invoices.push({ invoiceNumber: invoice.invoiceNumber, vendorId: invoice.vendorId, amount });
      paymentsByDate.set(dateKey, dateEntry);
      
      // Group by vendor
      const vendorKey = invoice.vendorId;
      const vendorEntry = paymentsByVendor.get(vendorKey) || { vendorId: vendorKey, amount: 0, count: 0, invoices: [] };
      vendorEntry.amount += amount;
      vendorEntry.count++;
      vendorEntry.invoices.push({ invoiceNumber: invoice.invoiceNumber, dueDate: dateKey, amount });
      paymentsByVendor.set(vendorKey, vendorEntry);
    }
    
    // Analyze discounts
    if (invoice.discountPercent1 && invoice.discountDays1) {
      const discountDeadline = new Date(baselineDate);
      discountDeadline.setDate(discountDeadline.getDate() + invoice.discountDays1);
      const discountAmount = amount * (invoice.discountPercent1 / 100);
      
      if (discountDeadline >= today) {
        totalDiscountAvailable += discountAmount;
        discountOpportunities.push({
          invoiceNumber: invoice.invoiceNumber,
          vendorId: invoice.vendorId,
          invoiceAmount: amount,
          discountPercent: invoice.discountPercent1,
          discountAmount: Math.round(discountAmount * 100) / 100,
          discountDeadline: discountDeadline.toISOString().split('T')[0],
          daysRemaining: Math.ceil((discountDeadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
          currency
        });
        
        // At risk if deadline is within 7 days
        const daysToDeadline = Math.ceil((discountDeadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysToDeadline <= 7) {
          totalDiscountAtRisk += discountAmount;
        }
      }
    }
  }
  
  // Sort discount opportunities by deadline (soonest first)
  discountOpportunities.sort((a, b) => new Date(a.discountDeadline).getTime() - new Date(b.discountDeadline).getTime());
  
  // Convert maps to sorted arrays
  const byDate = Array.from(paymentsByDate.values())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(d => ({ ...d, amount: Math.round(d.amount * 100) / 100 }));
  
  const byVendor = Array.from(paymentsByVendor.values())
    .sort((a, b) => b.amount - a.amount)
    .map(v => ({ ...v, amount: Math.round(v.amount * 100) / 100 }));
  
  // Confidence is 100% when using direct invoice data
  const confidence = 1.0;
  
  return {
    forecast: {
      fromDate: from.toISOString().split('T')[0],
      toDate: to.toISOString().split('T')[0],
      totalInvoices: openInvoices.length,
      totalDue: Math.round(totalDue * 100) / 100,
      invoicesInRange: byDate.reduce((sum, d) => sum + d.count, 0)
    },
    byDate,
    byVendor,
    discountAnalysis: {
      totalDiscountAvailable: Math.round(totalDiscountAvailable * 100) / 100,
      totalDiscountAtRisk: Math.round(totalDiscountAtRisk * 100) / 100,
      opportunitiesCount: discountOpportunities.length,
      opportunities: discountOpportunities.slice(0, 20) // Top 20 opportunities
    },
    confidence
  };
}


// ============================================================================
// PERIOD-END READINESS VALIDATION
// ============================================================================

/**
 * Period-end readiness check result.
 * @typedef {Object} PeriodEndReadinessResult
 * @property {string} status - READY, ISSUES_FOUND, BLOCKED
 * @property {Object[]} checks - Individual check results
 * @property {Object[]} issues - Issues that need resolution
 * @property {Object[]} recommendations - Recommended actions
 */

/**
 * Validate readiness for period-end close.
 * Consolidates all reconciliation checks into a single report.
 * @param {Object} params - Validation parameters
 * @param {string} params.companyCode - Company code
 * @param {string} params.fiscalYear - Fiscal year
 * @param {string} params.fiscalPeriod - Fiscal period (01-12)
 * @param {Date|string} params.periodEndDate - Period end date
 * @param {Object[]} params.invoices - All invoices for the period
 * @param {Object[]} [params.purchaseOrders] - POs to reconcile
 * @param {Object[]} [params.recurringExpenses] - Expected recurring expenses
 * @param {Object} [params.thresholds] - Custom thresholds
 * @param {number} [params.thresholds.agingDaysWarning=60] - Days overdue to warn
 * @param {number} [params.thresholds.accrualMateriality=100] - Min accrual amount
 * @param {number} [params.thresholds.overbillingTolerance=0.01] - Overbilling tolerance %
 * @returns {Promise<PeriodEndReadinessResult>}
 */
async function validatePeriodEndReadiness(params) {
  const {
    companyCode,
    fiscalYear,
    fiscalPeriod,
    periodEndDate,
    invoices = [],
    purchaseOrders = [],
    recurringExpenses = [],
    thresholds = {}
  } = params;
  
  const {
    agingDaysWarning = 60,
    accrualMateriality = 100,
    overbillingTolerance = 0.01
  } = thresholds;
  
  const periodEnd = new Date(periodEndDate);
  const checks = [];
  const issues = [];
  const recommendations = [];
  
  // 1. Invoice Aging Check
  const agingResult = analyzeInvoiceAging({ periodEndDate, invoices });
  
  const agingCheck = {
    name: 'Invoice Aging',
    status: 'PASS',
    details: agingResult.summary
  };
  
  if (agingResult.summary.priorPeriodCount > 0) {
    agingCheck.status = 'WARNING';
    issues.push({
      severity: 'MEDIUM',
      category: 'AGING',
      description: `${agingResult.summary.priorPeriodCount} invoices dated in prior period`,
      amount: agingResult.aging.find(a => a.bucket === 'PRIOR_PERIOD')?.amount || 0
    });
    recommendations.push({
      action: 'Review prior-period invoices for proper accrual or posting date adjustment',
      priority: 'MEDIUM'
    });
  }
  
  if (agingResult.summary.futureDatedCount > 0) {
    agingCheck.status = 'WARNING';
    issues.push({
      severity: 'LOW',
      category: 'AGING',
      description: `${agingResult.summary.futureDatedCount} invoices dated in future`,
      amount: agingResult.aging.find(a => a.bucket === 'FUTURE_DATED')?.amount || 0
    });
    recommendations.push({
      action: 'Investigate future-dated invoices - may need to be held',
      priority: 'LOW'
    });
  }
  
  const overdueOver60 = (agingResult.aging.find(a => a.bucket === 'OVERDUE_61_90')?.count || 0) +
                        (agingResult.aging.find(a => a.bucket === 'OVERDUE_OVER_90')?.count || 0);
  if (overdueOver60 > 0) {
    agingCheck.status = 'FAIL';
    issues.push({
      severity: 'HIGH',
      category: 'AGING',
      description: `${overdueOver60} invoices overdue > 60 days`,
      amount: (agingResult.aging.find(a => a.bucket === 'OVERDUE_61_90')?.amount || 0) +
              (agingResult.aging.find(a => a.bucket === 'OVERDUE_OVER_90')?.amount || 0)
    });
    recommendations.push({
      action: 'Prioritize payment of significantly overdue invoices',
      priority: 'HIGH'
    });
  }
  
  checks.push(agingCheck);
  
  // 2. PO Reconciliation Check (if POs provided)
  if (purchaseOrders.length > 0) {
    let totalOverInvoiced = 0;
    let totalUnderInvoiced = 0;
    let overInvoicedCount = 0;
    let underInvoicedCount = 0;
    
    for (const po of purchaseOrders) {
      const poInvoices = invoices.filter(inv => 
        inv.poNumber && normalizePONumberPadded(inv.poNumber) === normalizePONumberPadded(po.poNumber)
      );
      
      const reconResult = await reconcilePOWithInvoices({
        poNumber: po.poNumber,
        invoices: poInvoices
      });
      
      for (const item of reconResult.reconciliation) {
        if (item.status === 'OVER_INVOICED') {
          overInvoicedCount++;
          totalOverInvoiced += item.variance;
        } else if (item.status === 'NOT_INVOICED' || item.status === 'PARTIALLY_INVOICED') {
          underInvoicedCount++;
          totalUnderInvoiced += item.remainingAmount;
        }
      }
    }
    
    const poCheck = {
      name: 'PO Reconciliation',
      status: 'PASS',
      details: {
        posChecked: purchaseOrders.length,
        overInvoicedCount,
        underInvoicedCount,
        totalOverInvoiced: Math.round(totalOverInvoiced * 100) / 100,
        totalUnderInvoiced: Math.round(totalUnderInvoiced * 100) / 100
      }
    };
    
    if (overInvoicedCount > 0) {
      poCheck.status = 'FAIL';
      issues.push({
        severity: 'HIGH',
        category: 'PO_RECONCILIATION',
        description: `${overInvoicedCount} PO items over-invoiced`,
        amount: Math.round(totalOverInvoiced * 100) / 100
      });
      recommendations.push({
        action: 'Review over-invoiced POs before close - may need credit memo or adjustment',
        priority: 'HIGH'
      });
    }
    
    if (totalUnderInvoiced > accrualMateriality) {
      poCheck.status = poCheck.status === 'FAIL' ? 'FAIL' : 'WARNING';
      issues.push({
        severity: 'MEDIUM',
        category: 'PO_RECONCILIATION',
        description: `${underInvoicedCount} PO items have uninvoiced amounts`,
        amount: Math.round(totalUnderInvoiced * 100) / 100
      });
      recommendations.push({
        action: 'Consider accruals for uninvoiced PO amounts',
        priority: 'MEDIUM'
      });
    }
    
    checks.push(poCheck);
  }
  
  // 3. Accrual Identification Check
  if (purchaseOrders.length > 0 || recurringExpenses.length > 0) {
    const accrualResult = await identifyAccrualCandidates({
      periodEndDate,
      purchaseOrders,
      invoices,
      recurringExpenses,
      materialityThreshold: accrualMateriality
    });
    
    const accrualCheck = {
      name: 'Accrual Identification',
      status: 'PASS',
      details: accrualResult.summary
    };
    
    if (accrualResult.accruals.length > 0) {
      accrualCheck.status = 'WARNING';
      issues.push({
        severity: 'MEDIUM',
        category: 'ACCRUALS',
        description: `${accrualResult.accruals.length} potential accruals identified`,
        amount: accrualResult.summary.totalEstimatedAmount
      });
      recommendations.push({
        action: 'Review and post accrual entries for identified items',
        priority: 'MEDIUM',
        details: accrualResult.accruals.slice(0, 10) // Top 10
      });
    }
    
    checks.push(accrualCheck);
  }
  
  // 4. Payment Forecast Check (7-day window after period end)
  const paymentForecastEnd = new Date(periodEnd);
  paymentForecastEnd.setDate(paymentForecastEnd.getDate() + 7);
  
  const paymentResult = forecastPayments({
    fromDate: periodEnd,
    toDate: paymentForecastEnd,
    invoices
  });
  
  const paymentCheck = {
    name: 'Payment Forecast',
    status: 'PASS',
    details: {
      totalDue: paymentResult.forecast.totalDue,
      discountsAtRisk: paymentResult.discountAnalysis.totalDiscountAtRisk
    }
  };
  
  if (paymentResult.discountAnalysis.totalDiscountAtRisk > 0) {
    paymentCheck.status = 'WARNING';
    issues.push({
      severity: 'LOW',
      category: 'PAYMENTS',
      description: `Discounts at risk of expiring within 7 days`,
      amount: paymentResult.discountAnalysis.totalDiscountAtRisk
    });
    recommendations.push({
      action: 'Process payments to capture at-risk discounts',
      priority: 'LOW',
      details: paymentResult.discountAnalysis.opportunities.filter(o => o.daysRemaining <= 7)
    });
  }
  
  checks.push(paymentCheck);
  
  // 5. Duplicate Check (invoices in this period)
  const duplicateCheck = {
    name: 'Duplicate Invoice Check',
    status: 'PASS',
    details: { duplicatesFound: 0 }
  };
  
  const invoiceKeys = new Map();
  const duplicates = [];
  
  for (const inv of invoices) {
    // Create key from vendor + invoice number + amount + date
    const key = `${inv.vendorId}_${inv.invoiceNumber}_${normalizeAmount(inv.grossAmount)}`;
    if (invoiceKeys.has(key)) {
      duplicates.push({
        invoiceNumber: inv.invoiceNumber,
        vendorId: inv.vendorId,
        amount: inv.grossAmount,
        duplicateOf: invoiceKeys.get(key)
      });
    } else {
      invoiceKeys.set(key, inv.invoiceNumber);
    }
  }
  
  if (duplicates.length > 0) {
    duplicateCheck.status = 'FAIL';
    duplicateCheck.details = { duplicatesFound: duplicates.length, duplicates: duplicates.slice(0, 10) };
    issues.push({
      severity: 'HIGH',
      category: 'DUPLICATES',
      description: `${duplicates.length} potential duplicate invoices found`,
      amount: duplicates.reduce((sum, d) => sum + normalizeAmount(d.amount), 0)
    });
    recommendations.push({
      action: 'Review and resolve duplicate invoices before close',
      priority: 'HIGH'
    });
  }
  
  checks.push(duplicateCheck);
  
  // Determine overall status
  const hasFailures = checks.some(c => c.status === 'FAIL');
  const hasWarnings = checks.some(c => c.status === 'WARNING');
  const overallStatus = hasFailures ? 'BLOCKED' : hasWarnings ? 'ISSUES_FOUND' : 'READY';
  
  // Sort issues by severity
  const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  
  // Sort recommendations by priority
  const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  
  return {
    status: overallStatus,
    periodInfo: {
      companyCode,
      fiscalYear,
      fiscalPeriod,
      periodEndDate: periodEnd.toISOString().split('T')[0]
    },
    summary: {
      checksPerformed: checks.length,
      checksPassed: checks.filter(c => c.status === 'PASS').length,
      checksWarning: checks.filter(c => c.status === 'WARNING').length,
      checksFailed: checks.filter(c => c.status === 'FAIL').length,
      totalIssues: issues.length,
      highSeverityIssues: issues.filter(i => i.severity === 'HIGH').length
    },
    checks,
    issues,
    recommendations,
    confidence: 0.95 // High confidence with invoice input data
  };
}


// ============================================================================
// MODULE EXPORTS
// ============================================================================

module.exports = {
  // PO Reconciliation
  reconcilePOWithInvoices,
  
  // Invoice Aging
  analyzeInvoiceAging,
  
  // Accrual Identification
  identifyAccrualCandidates,
  
  // Payment Forecasting
  forecastPayments,
  
  // Period-End Validation
  validatePeriodEndReadiness
};
