import JSONModel from "sap/ui/model/json/JSONModel";
import ODataModel from "sap/ui/model/odata/v4/ODataModel";
import ODataListBinding from "sap/ui/model/odata/v4/ODataListBinding";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import BaseController from "./BaseController";

/**
 * Alert Detail Controller
 * Shows triggering transaction, risk score rationale, up to 50 related historical alerts (12 months),
 * and recommended investigation steps.
 *
 * Implements Requirement 9.3:
 * - Triggering transaction details
 * - Risk_Score rationale (indicators breakdown)
 * - Up to 50 related historical alerts (same user/entity, last 12 months)
 * - Recommended investigation steps
 *
 * @namespace finsecure.ai.alertsinvestigations.controller
 */
export default class AlertDetail extends BaseController {
  private _alertId: string = "";

  public onInit(): void {
    // Models for sub-sections
    this.getView()!.setModel(new JSONModel({}), "triggeringTransaction");
    this.getView()!.setModel(new JSONModel({ indicators: [] }), "riskIndicatorsModel");
    this.getView()!.setModel(new JSONModel({ alerts: [] }), "historicalAlerts");
    this.getView()!.setModel(new JSONModel({ steps: [] }), "recommendedActions");

    // Register route matched handler
    this.getRouter()
      .getRoute("AlertDetail")!
      .attachPatternMatched(this._onAlertMatched, this);
  }

  /**
   * Route pattern matched handler - loads alert data
   */
  private async _onAlertMatched(event: any): Promise<void> {
    this._alertId = event.getParameter("arguments").alertId;

    // Bind the view to the specific alert
    const path = `/Alerts('${this._alertId}')`;
    this.getView()!.bindElement({ path });

    // Load supplementary data
    await Promise.all([
      this._loadTriggeringTransaction(),
      this._loadRiskIndicators(),
      this._loadHistoricalAlerts(),
      this._loadRecommendedActions()
    ]);
  }

  /**
   * Loads the triggering transaction details (Req 9.3)
   */
  private async _loadTriggeringTransaction(): Promise<void> {
    const model = this.getView()!.getModel() as ODataModel;
    const txModel = this.getView()!.getModel("triggeringTransaction") as JSONModel;

    try {
      // Get the alert's triggering transaction ID
      const alertBinding = model.bindContext(`/Alerts('${this._alertId}')`);
      const alertContext = await alertBinding.requestObject();
      const triggeringTxId = alertContext?.triggeringTxId;

      if (triggeringTxId) {
        const txBinding = model.bindContext(`/Transactions('${triggeringTxId}')`);
        const txData = await txBinding.requestObject();
        txModel.setData(txData || {});
      } else {
        txModel.setData({});
      }
    } catch (err) {
      console.error("Failed to load triggering transaction:", err);
      txModel.setData({});
    }
  }

  /**
   * Loads and parses risk indicators from the alert's riskIndicators JSON field (Req 9.3)
   */
  private async _loadRiskIndicators(): Promise<void> {
    const model = this.getView()!.getModel() as ODataModel;
    const indicatorsModel = this.getView()!.getModel("riskIndicatorsModel") as JSONModel;

    try {
      const alertBinding = model.bindContext(`/Alerts('${this._alertId}')`);
      const alertData = await alertBinding.requestObject();

      let indicators: any[] = [];
      if (alertData?.riskIndicators) {
        try {
          const parsed = JSON.parse(alertData.riskIndicators);
          indicators = Array.isArray(parsed) ? parsed : [];
        } catch {
          indicators = [];
        }
      }
      indicatorsModel.setProperty("/indicators", indicators);
    } catch (err) {
      console.error("Failed to load risk indicators:", err);
      indicatorsModel.setProperty("/indicators", []);
    }
  }

  /**
   * Loads up to 50 related historical alerts from the last 12 months (Req 9.3).
   * Related = same user or same affected entity.
   */
  private async _loadHistoricalAlerts(): Promise<void> {
    const model = this.getView()!.getModel() as ODataModel;
    const historicalModel = this.getView()!.getModel("historicalAlerts") as JSONModel;

    try {
      const alertBinding = model.bindContext(`/Alerts('${this._alertId}')`);
      const alertData = await alertBinding.requestObject();

      if (!alertData) {
        historicalModel.setProperty("/alerts", []);
        return;
      }

      // Calculate 12 months ago
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

      // Build filters: same entity/user, within 12 months, not this alert, max 50
      const filters: Filter[] = [
        new Filter("ID", FilterOperator.NE, this._alertId),
        new Filter("createdAt", FilterOperator.GE, twelveMonthsAgo.toISOString())
      ];

      // If we know the affected entities, filter by those
      if (alertData.affectedEntities) {
        try {
          const entities = JSON.parse(alertData.affectedEntities);
          if (entities.userId) {
            filters.push(new Filter("affectedEntities", FilterOperator.Contains, entities.userId));
          }
        } catch {
          // If can't parse, just use time filter
        }
      }

      const listBinding = model.bindList("/Alerts", undefined, undefined, filters) as ODataListBinding;
      const contexts = await listBinding.requestContexts(0, 50);
      const alerts = contexts.map((ctx: any) => ctx.getObject());

      historicalModel.setProperty("/alerts", alerts);
    } catch (err) {
      console.error("Failed to load historical alerts:", err);
      historicalModel.setProperty("/alerts", []);
    }
  }

  /**
   * Loads recommended investigation steps from the alert's recommendedActions JSON field (Req 9.3)
   */
  private async _loadRecommendedActions(): Promise<void> {
    const model = this.getView()!.getModel() as ODataModel;
    const actionsModel = this.getView()!.getModel("recommendedActions") as JSONModel;

    try {
      const alertBinding = model.bindContext(`/Alerts('${this._alertId}')`);
      const alertData = await alertBinding.requestObject();

      let steps: any[] = [];
      if (alertData?.recommendedActions) {
        try {
          const parsed = JSON.parse(alertData.recommendedActions);
          steps = Array.isArray(parsed) ? parsed : [];
        } catch {
          steps = [];
        }
      }

      // If no stored recommendations, provide default rule-based steps
      if (steps.length === 0) {
        steps = this._getDefaultInvestigationSteps(alertData?.riskCategory);
      }

      actionsModel.setProperty("/steps", steps);
    } catch (err) {
      console.error("Failed to load recommended actions:", err);
      actionsModel.setProperty("/steps", []);
    }
  }

  /**
   * Provides default investigation steps based on risk category
   */
  private _getDefaultInvestigationSteps(category: string): any[] {
    const baseSteps = [
      {
        title: "Review Triggering Transaction",
        description: "Examine the transaction details, amounts, and timing for anomalies",
        icon: "sap-icon://detail-view",
        priority: "HIGH"
      },
      {
        title: "Check User Activity History",
        description: "Review the user's recent activity and behavioral profile for deviations",
        icon: "sap-icon://employee",
        priority: "HIGH"
      },
      {
        title: "Verify Business Justification",
        description: "Contact the user or manager to verify the business need for the activity",
        icon: "sap-icon://message-popup",
        priority: "MEDIUM"
      }
    ];

    // Add category-specific steps
    switch (category) {
      case "SOD_VIOLATION":
        baseSteps.push({
          title: "Review Segregation of Duties Conflict",
          description: "Check which conflicting roles/activities were performed and whether compensating controls exist",
          icon: "sap-icon://locked",
          priority: "CRITICAL"
        });
        break;
      case "FRAUD_PATTERN":
        baseSteps.push({
          title: "Analyze Payment Trail",
          description: "Trace the payment flow and verify recipient bank details against known patterns",
          icon: "sap-icon://money-bills",
          priority: "CRITICAL"
        });
        break;
      case "PRIVILEGE_ESCALATION":
        baseSteps.push({
          title: "Audit Role Assignments",
          description: "Review recent role changes and verify authorization through proper channels",
          icon: "sap-icon://role",
          priority: "CRITICAL"
        });
        break;
      case "INSIDER_THREAT":
        baseSteps.push({
          title: "Cross-reference HR Data",
          description: "Check employment status, recent performance reviews, and access patterns",
          icon: "sap-icon://hr-approval",
          priority: "CRITICAL"
        });
        break;
      case "VENDOR_TAMPERING":
        baseSteps.push({
          title: "Verify Vendor Master Changes",
          description: "Compare vendor bank details with original onboarding records and recent change history",
          icon: "sap-icon://supplier",
          priority: "CRITICAL"
        });
        break;
      default:
        baseSteps.push({
          title: "Correlate with Related Events",
          description: "Search for related alerts and events in the same timeframe for broader impact assessment",
          icon: "sap-icon://connected",
          priority: "MEDIUM"
        });
    }

    baseSteps.push({
      title: "Document Findings",
      description: "Record investigation findings, evidence collected, and recommended resolution",
      icon: "sap-icon://document-text",
      priority: "LOW"
    });

    return baseSteps;
  }

  /**
   * Navigates to a historical alert's detail
   */
  public onHistoricalAlertPress(event: any): void {
    const item = event.getSource();
    const bindingContext = item.getBindingContext("historicalAlerts");
    const alertId = bindingContext.getProperty("ID");

    this.getRouter().navTo("AlertDetail", {
      alertId: alertId
    });
  }

  /**
   * Starts a new investigation for this alert
   */
  public onStartInvestigation(): void {
    const context = this.getView()!.getBindingContext();
    const investigationId = context?.getProperty("investigation_ID");

    if (investigationId) {
      this.getRouter().navTo("InvestigationWorkflow", {
        investigationId: investigationId
      });
    }
  }

  /**
   * Views existing investigation
   */
  public onViewInvestigation(): void {
    const context = this.getView()!.getBindingContext();
    const investigationId = context?.getProperty("investigation_ID");

    if (investigationId) {
      this.getRouter().navTo("InvestigationWorkflow", {
        investigationId: investigationId
      });
    }
  }
}
