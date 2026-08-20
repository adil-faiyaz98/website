using SecurityAnalystService as analyst from '../../srv/services';
using IAMAdminService as iam from '../../srv/services';

// ============================================================================
// Alert List Report Annotations
// ============================================================================

annotate analyst.Alerts with @(
  UI: {
    SelectionFields: [
      priority,
      status,
      riskCategory,
      assignedAnalyst
    ],
    LineItem: [
      { Value: priority, Label: 'Priority', Criticality: priorityCriticality },
      { Value: title, Label: 'Alert Title' },
      { Value: riskScore, Label: 'Risk Score' },
      { Value: riskCategory, Label: 'Category' },
      { Value: status, Label: 'Status' },
      { Value: assignedAnalyst, Label: 'Analyst' },
      { Value: slaDeadline, Label: 'SLA Deadline' },
      { Value: financialExposure, Label: 'Financial Exposure' },
      { Value: createdAt, Label: 'Created' }
    ],
    HeaderInfo: {
      TypeName: 'Alert',
      TypeNamePlural: 'Alerts',
      Title: { Value: title },
      Description: { Value: riskCategory }
    },
    Facets: [
      {
        $Type: 'UI.ReferenceFacet',
        ID: 'TriggeringTransaction',
        Label: 'Triggering Transaction',
        Target: '@UI.FieldGroup#TriggeringTransaction'
      },
      {
        $Type: 'UI.ReferenceFacet',
        ID: 'RiskScoreRationale',
        Label: 'Risk Score Rationale',
        Target: '@UI.FieldGroup#RiskScoreRationale'
      },
      {
        $Type: 'UI.ReferenceFacet',
        ID: 'AlertDetails',
        Label: 'Alert Details',
        Target: '@UI.FieldGroup#AlertDetails'
      },
      {
        $Type: 'UI.ReferenceFacet',
        ID: 'Resolution',
        Label: 'Resolution',
        Target: '@UI.FieldGroup#Resolution'
      }
    ],
    FieldGroup#TriggeringTransaction: {
      Label: 'Triggering Transaction',
      Data: [
        { Value: triggeringTxId, Label: 'Transaction ID' }
      ]
    },
    FieldGroup#RiskScoreRationale: {
      Label: 'Risk Score Rationale',
      Data: [
        { Value: riskScore, Label: 'Overall Risk Score' },
        { Value: riskCategory, Label: 'Risk Category' },
        { Value: aiConfidenceScore, Label: 'AI Confidence' },
        { Value: aiTriageRec, Label: 'AI Triage Recommendation' }
      ]
    },
    FieldGroup#AlertDetails: {
      Label: 'Alert Details',
      Data: [
        { Value: priority, Label: 'Priority' },
        { Value: status, Label: 'Status' },
        { Value: financialExposure, Label: 'Financial Exposure' },
        { Value: assignedAnalyst, Label: 'Assigned Analyst' },
        { Value: slaDeadline, Label: 'SLA Deadline' },
        { Value: escalatedAt, Label: 'Escalated At' }
      ]
    },
    FieldGroup#Resolution: {
      Label: 'Resolution',
      Data: [
        { Value: resolutionType, Label: 'Resolution Type' },
        { Value: resolutionNotes, Label: 'Resolution Notes' },
        { Value: resolvedAt, Label: 'Resolved At' }
      ]
    }
  }
) {
  priorityCriticality: Integer @UI.Hidden;
};

// ============================================================================
// Investigation Annotations
// ============================================================================

annotate analyst.Investigations with @(
  UI: {
    HeaderInfo: {
      TypeName: 'Investigation',
      TypeNamePlural: 'Investigations',
      Title: { Value: ID },
      Description: { Value: status }
    },
    LineItem: [
      { Value: ID, Label: 'Investigation ID' },
      { Value: status, Label: 'Status' },
      { Value: assignedAnalyst, Label: 'Analyst' },
      { Value: startedAt, Label: 'Started' },
      { Value: resolvedAt, Label: 'Resolved' }
    ],
    Facets: [
      {
        $Type: 'UI.ReferenceFacet',
        ID: 'InvestigationDetails',
        Label: 'Details',
        Target: '@UI.FieldGroup#InvestigationDetails'
      },
      {
        $Type: 'UI.ReferenceFacet',
        ID: 'Notes',
        Label: 'Notes',
        Target: 'notes/@UI.LineItem'
      },
      {
        $Type: 'UI.ReferenceFacet',
        ID: 'Evidence',
        Label: 'Evidence',
        Target: 'evidence/@UI.LineItem'
      }
    ],
    FieldGroup#InvestigationDetails: {
      Data: [
        { Value: status, Label: 'Status' },
        { Value: assignedAnalyst, Label: 'Analyst' },
        { Value: resolutionType, Label: 'Resolution Type' },
        { Value: resolutionNotes, Label: 'Resolution Notes' },
        { Value: startedAt, Label: 'Started' },
        { Value: resolvedAt, Label: 'Resolved' }
      ]
    }
  }
);

annotate analyst.InvestigationNotes with @(
  UI.LineItem: [
    { Value: author, Label: 'Author' },
    { Value: content, Label: 'Note' },
    { Value: createdAt, Label: 'Created' }
  ]
);

annotate analyst.EvidenceItems with @(
  UI.LineItem: [
    { Value: evidenceType, Label: 'Type' },
    { Value: reference, Label: 'Reference' },
    { Value: content, Label: 'Content' },
    { Value: createdAt, Label: 'Created' }
  ]
);

// ============================================================================
// Access Review Campaign Annotations
// ============================================================================

annotate iam.AccessReviewCampaigns with @(
  UI: {
    HeaderInfo: {
      TypeName: 'Access Review Campaign',
      TypeNamePlural: 'Access Review Campaigns',
      Title: { Value: ID },
      Description: { Value: status }
    },
    LineItem: [
      { Value: ID, Label: 'Campaign ID' },
      { Value: triggerType, Label: 'Trigger' },
      { Value: status, Label: 'Status' },
      { Value: completionRate, Label: 'Completion %' },
      { Value: deadline, Label: 'Deadline' }
    ],
    Facets: [
      {
        $Type: 'UI.ReferenceFacet',
        ID: 'CampaignDetails',
        Label: 'Campaign Details',
        Target: '@UI.FieldGroup#CampaignDetails'
      },
      {
        $Type: 'UI.ReferenceFacet',
        ID: 'Tasks',
        Label: 'Review Tasks',
        Target: 'tasks/@UI.LineItem'
      }
    ],
    FieldGroup#CampaignDetails: {
      Data: [
        { Value: triggerType, Label: 'Trigger Type' },
        { Value: status, Label: 'Status' },
        { Value: completionRate, Label: 'Completion Rate' },
        { Value: deadline, Label: 'Deadline' }
      ]
    }
  }
);

annotate iam.AccessReviewTasks with @(
  UI.LineItem: [
    { Value: reviewerId, Label: 'Reviewer' },
    { Value: userId, Label: 'User Under Review' },
    { Value: decision, Label: 'Decision' },
    { Value: justification, Label: 'Justification' },
    { Value: completedAt, Label: 'Completed' }
  ]
);
