using SecurityAnalystService as service from '../../srv/services';

// ============================================================================
// Annotations for Risk Intelligence Dashboard (Overview Page)
// Provides Fiori Elements metadata for cards, charts, and filter controls
// ============================================================================

// ---------- Alerts Entity Annotations ----------

annotate service.Alerts with @(
  UI: {
    // Selection Fields for filter bar
    SelectionFields: [
      priority,
      status,
      riskCategory,
      riskScore,
      createdAt
    ],

    // Line Item columns for list display
    LineItem: [
      { Value: priority, Label: 'Priority' },
      { Value: title, Label: 'Title' },
      { Value: riskCategory, Label: 'Risk Category' },
      { Value: riskScore, Label: 'Risk Score' },
      { Value: status, Label: 'Status' },
      { Value: financialExposure, Label: 'Financial Exposure' },
      { Value: createdAt, Label: 'Created' }
    ],

    // Header info for object page
    HeaderInfo: {
      TypeName: 'Alert',
      TypeNamePlural: 'Alerts',
      Title: { Value: title },
      Description: { Value: description }
    },

    // Data Point for KPI card - risk score
    DataPoint #RiskScore: {
      Value: riskScore,
      Title: 'Risk Score',
      CriticalityCalculation: {
        ImprovementDirection: #Minimize,
        DeviationRangeHighValue: 80,
        ToleranceRangeHighValue: 50
      }
    },

    // Chart for alert priority distribution
    Chart #AlertsByPriority: {
      ChartType: #Donut,
      Title: 'Alerts by Priority',
      Measures: [riskScore],
      MeasureAttributes: [{
        Measure: riskScore,
        Role: #Axis1
      }],
      Dimensions: [priority],
      DimensionAttributes: [{
        Dimension: priority,
        Role: #Category
      }]
    },

    // Chart for alerts trend over time
    Chart #AlertsTrend: {
      ChartType: #Line,
      Title: 'Alert Trends',
      Measures: [riskScore],
      MeasureAttributes: [{
        Measure: riskScore,
        Role: #Axis1
      }],
      Dimensions: [createdAt],
      DimensionAttributes: [{
        Dimension: createdAt,
        Role: #Category
      }]
    },

    // Presentation variant for default sorting
    PresentationVariant: {
      SortOrder: [{ Property: createdAt, Descending: true }],
      Visualizations: ['@UI.LineItem']
    }
  }
);

// Value helps for filter dropdowns
annotate service.Alerts with {
  priority @(
    Common.Label: 'Priority'
  );
  riskCategory @(
    Common.Label: 'Risk Category'
  );
  status @(
    Common.Label: 'Status'
  );
  riskScore @(
    Common.Label: 'Risk Score'
  );
};


// ---------- Transactions Entity Annotations ----------

annotate service.Transactions with @(
  UI: {
    SelectionFields: [
      documentType,
      userId,
      companyCode,
      postingDate,
      riskScore
    ],

    LineItem: [
      { Value: documentNumber, Label: 'Document #' },
      { Value: documentType, Label: 'Type' },
      { Value: amount, Label: 'Amount' },
      { Value: currency, Label: 'Currency' },
      { Value: userId, Label: 'User' },
      { Value: companyCode, Label: 'Company Code' },
      { Value: riskScore, Label: 'Risk Score' },
      { Value: postingDate, Label: 'Posting Date' }
    ],

    HeaderInfo: {
      TypeName: 'Transaction',
      TypeNamePlural: 'Transactions',
      Title: { Value: documentNumber },
      Description: { Value: documentType }
    },

    DataPoint #TransactionRiskScore: {
      Value: riskScore,
      Title: 'Risk Score',
      CriticalityCalculation: {
        ImprovementDirection: #Minimize,
        DeviationRangeHighValue: 80,
        ToleranceRangeHighValue: 50
      }
    },

    Chart #TransactionsByType: {
      ChartType: #Bar,
      Title: 'Transactions by Type',
      Measures: [amount],
      MeasureAttributes: [{
        Measure: amount,
        Role: #Axis1
      }],
      Dimensions: [documentType],
      DimensionAttributes: [{
        Dimension: documentType,
        Role: #Category
      }]
    },

    PresentationVariant: {
      SortOrder: [{ Property: createdAt, Descending: true }],
      MaxItems: 50,
      Visualizations: ['@UI.LineItem']
    }
  }
);

annotate service.Transactions with {
  documentNumber @(Common.Label: 'Document Number');
  documentType @(Common.Label: 'Document Type');
  amount @(Common.Label: 'Amount');
  userId @(Common.Label: 'User');
  companyCode @(Common.Label: 'Company Code');
  riskScore @(Common.Label: 'Risk Score');
  postingDate @(Common.Label: 'Posting Date');
};


// ---------- SoD Violations Entity Annotations ----------

annotate service.SoDViolations with @(
  UI: {
    SelectionFields: [
      userId,
      severity,
      status,
      createdAt
    ],

    LineItem: [
      { Value: userId, Label: 'User' },
      { Value: severity, Label: 'Severity' },
      { Value: activity1Obj, Label: 'Activity 1' },
      { Value: activity2Obj, Label: 'Activity 2' },
      { Value: activity1Time, Label: 'Activity 1 Time' },
      { Value: activity2Time, Label: 'Activity 2 Time' },
      { Value: status, Label: 'Status' },
      { Value: createdAt, Label: 'Detected' }
    ],

    HeaderInfo: {
      TypeName: 'SoD Violation',
      TypeNamePlural: 'SoD Violations',
      Title: { Value: userId },
      Description: { Value: severity }
    },

    DataPoint #SoDCount: {
      Value: severity,
      Title: 'Active SoD Violations'
    },

    Chart #SoDTrend: {
      ChartType: #Line,
      Title: 'SoD Violation Trends',
      Measures: [severity],
      MeasureAttributes: [{
        Measure: severity,
        Role: #Axis1
      }],
      Dimensions: [createdAt],
      DimensionAttributes: [{
        Dimension: createdAt,
        Role: #Category
      }]
    },

    PresentationVariant: {
      SortOrder: [{ Property: createdAt, Descending: true }],
      Visualizations: ['@UI.LineItem']
    }
  }
);

annotate service.SoDViolations with {
  userId @(Common.Label: 'User');
  severity @(Common.Label: 'Severity');
  status @(Common.Label: 'Status');
  activity1Obj @(Common.Label: 'Activity 1');
  activity2Obj @(Common.Label: 'Activity 2');
};


// ---------- Behavioral Profiles Entity Annotations ----------

annotate service.BehavioralProfiles with @(
  UI: {
    SelectionFields: [
      userId,
      status,
      lastUpdated
    ],

    LineItem: [
      { Value: userId, Label: 'User ID' },
      { Value: status, Label: 'Profile Status' },
      { Value: daysCovered, Label: 'Days Covered' },
      { Value: windowStartDate, Label: 'Window Start' },
      { Value: windowEndDate, Label: 'Window End' },
      { Value: lastUpdated, Label: 'Last Updated' }
    ],

    HeaderInfo: {
      TypeName: 'Behavioral Profile',
      TypeNamePlural: 'Behavioral Profiles',
      Title: { Value: userId },
      Description: { Value: status }
    }
  }
);

annotate service.BehavioralProfiles with {
  userId @(Common.Label: 'User ID');
  status @(Common.Label: 'Profile Status');
  daysCovered @(Common.Label: 'Days Covered');
};
