import JSONModel from "sap/ui/model/json/JSONModel";
import ODataModel from "sap/ui/model/odata/v4/ODataModel";
import ODataListBinding from "sap/ui/model/odata/v4/ODataListBinding";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import Table from "sap/m/Table";
import BaseController from "./BaseController";

/**
 * Alert Dashboard Controller
 * Displays open alerts with priority/age/category/analyst filters and SLA tracking.
 *
 * SLA thresholds per Requirement 9.6:
 * - Critical: 4h
 * - High: 24h
 * - Medium: 72h
 * - Low: 168h
 *
 * @namespace finsecure.ai.alertsinvestigations.controller
 */
export default class AlertDashboard extends BaseController {
  private _currentPriorityFilter: string = "ALL";
  private _currentStatusFilter: string = "OPEN";
  private _currentCategoryFilter: string = "";
  private _currentAnalystFilter: string = "";
  private _currentSearchQuery: string = "";

  public onInit(): void {
    // Dashboard summary model
    const dashboardModel = new JSONModel({
      totalAlerts: 0,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      slaOnTrack: 0,
      slaWarning: 0,
      slaCritical: 0
    });
    this.getView()!.setModel(dashboardModel, "dashboard");

    // Load summary counts
    this._loadDashboardCounts();
  }

  /**
   * Loads alert count summaries for the dashboard header.
   * SLA classification per Req 9.6: 4h critical, 24h high, 72h medium, 168h low.
   */
  private async _loadDashboardCounts(): Promise<void> {
    const model = this.getView()!.getModel() as ODataModel;
    const dashboardModel = this.getView()!.getModel("dashboard") as JSONModel;

    try {
      const listBinding = model.bindList("/Alerts", undefined, undefined, [
        new Filter("status", FilterOperator.NE, "RESOLVED_TRUE_POSITIVE"),
        new Filter("status", FilterOperator.NE, "RESOLVED_FALSE_POSITIVE")
      ]) as ODataListBinding;

      const contexts = await listBinding.requestContexts(0, 10000);
      const alerts = contexts.map((ctx: any) => ctx.getObject());

      const now = Date.now();
      let slaOnTrack = 0;
      let slaWarning = 0;
      let slaCritical = 0;

      alerts.forEach((alert: any) => {
        if (alert.slaDeadline) {
          const hoursRemaining = (new Date(alert.slaDeadline).getTime() - now) / (1000 * 60 * 60);
          if (hoursRemaining < 0) {
            slaCritical++; // Overdue
          } else if (hoursRemaining < 4) {
            slaCritical++; // Critical threshold
          } else if (hoursRemaining < 24) {
            slaWarning++;
          } else {
            slaOnTrack++;
          }
        }
      });

      dashboardModel.setProperty("/totalAlerts", alerts.length);
      dashboardModel.setProperty("/criticalCount", alerts.filter((a: any) => a.priority === "CRITICAL").length);
      dashboardModel.setProperty("/highCount", alerts.filter((a: any) => a.priority === "HIGH").length);
      dashboardModel.setProperty("/mediumCount", alerts.filter((a: any) => a.priority === "MEDIUM").length);
      dashboardModel.setProperty("/lowCount", alerts.filter((a: any) => a.priority === "LOW").length);
      dashboardModel.setProperty("/slaOnTrack", slaOnTrack);
      dashboardModel.setProperty("/slaWarning", slaWarning);
      dashboardModel.setProperty("/slaCritical", slaCritical);
    } catch (err) {
      console.error("Failed to load dashboard counts:", err);
    }
  }

  /**
   * Handles priority tab selection
   */
  public onPriorityTabSelect(event: any): void {
    const key = event.getParameter("key");
    this._currentPriorityFilter = key;
    this._applyFilters();
  }

  /**
   * Handles filter dropdown changes (status, category, analyst)
   */
  public onFilterChange(event: any): void {
    const source = event.getSource();
    const selectedKey = source.getSelectedKey();
    const sourceId = source.getId();

    if (sourceId.includes("filterStatus")) {
      this._currentStatusFilter = selectedKey;
    } else if (sourceId.includes("filterCategory")) {
      this._currentCategoryFilter = selectedKey;
    } else if (sourceId.includes("filterAnalyst")) {
      this._currentAnalystFilter = selectedKey;
    }

    this._applyFilters();
  }

  /**
   * Handles search field
   */
  public onSearch(event: any): void {
    this._currentSearchQuery = event.getParameter("query") || "";
    this._applyFilters();
  }

  /**
   * Applies all active filters to the alert table
   */
  private _applyFilters(): void {
    const table = this.byId("alertTable") as Table;
    const binding = table.getBinding("items") as ODataListBinding;

    if (!binding) return;

    const filters: Filter[] = [];

    // Priority filter
    if (this._currentPriorityFilter && this._currentPriorityFilter !== "ALL") {
      filters.push(new Filter("priority", FilterOperator.EQ, this._currentPriorityFilter));
    }

    // Status filter
    if (this._currentStatusFilter) {
      filters.push(new Filter("status", FilterOperator.EQ, this._currentStatusFilter));
    }

    // Category filter
    if (this._currentCategoryFilter) {
      filters.push(new Filter("riskCategory", FilterOperator.EQ, this._currentCategoryFilter));
    }

    // Analyst filter
    if (this._currentAnalystFilter) {
      filters.push(new Filter("assignedAnalyst", FilterOperator.EQ, this._currentAnalystFilter));
    }

    // Search filter
    if (this._currentSearchQuery) {
      filters.push(new Filter({
        filters: [
          new Filter("title", FilterOperator.Contains, this._currentSearchQuery),
          new Filter("description", FilterOperator.Contains, this._currentSearchQuery)
        ],
        and: false
      }));
    }

    binding.filter(filters.length > 0 ? new Filter({ filters, and: true }) : []);
  }

  /**
   * Navigates to alert detail when an alert is pressed
   */
  public onAlertPress(event: any): void {
    const item = event.getSource();
    const bindingContext = item.getBindingContext();
    const alertId = bindingContext.getProperty("ID");

    this.getRouter().navTo("AlertDetail", {
      alertId: alertId
    });
  }

  /**
   * Handles alert selection in SingleSelectMaster mode
   */
  public onAlertSelect(event: any): void {
    const item = event.getParameter("listItem");
    if (item) {
      const bindingContext = item.getBindingContext();
      const alertId = bindingContext.getProperty("ID");
      this.getRouter().navTo("AlertDetail", {
        alertId: alertId
      });
    }
  }

  /**
   * Navigates to Access Review page
   */
  public onNavigateToAccessReview(): void {
    this.getRouter().navTo("AccessReview");
  }

  /**
   * Refreshes the alert list and dashboard counts
   */
  public onRefresh(): void {
    const table = this.byId("alertTable") as Table;
    const binding = table.getBinding("items") as ODataListBinding;
    if (binding) {
      binding.refresh();
    }
    this._loadDashboardCounts();
  }
}
