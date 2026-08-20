import BaseController from "./BaseController";
import JSONModel from "sap/ui/model/json/JSONModel";
import ODataModel from "sap/ui/model/odata/v4/ODataModel";
import ODataListBinding from "sap/ui/model/odata/v4/ODataListBinding";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import MessageToast from "sap/m/MessageToast";
import formatter from "../model/formatter";

interface DashboardFilters {
  dateRangeDays: string;
  riskCategories: string[];
  userId: string;
  businessUnit: string;
  severities: string[];
}

interface DashboardModel {
  autoRefreshEnabled: boolean;
  refreshIntervalSeconds: number;
  lastUpdatedText: string;
  filters: DashboardFilters;
  riskPosture: {
    score: number;
    subtitle: string;
    trend: string;
  };
  alerts: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  sod: {
    activeCount: number;
    previousCount: number;
    maxValue: number;
  };
  fraud: {
    activeCount: number;
    patternsCount: number;
  };
  compliance: {
    passRate: string;
    totalControls: number;
    passingControls: number;
    failingControls: number;
    state: string;
  };
  trends: {
    granularityLabel: string;
  };
  componentErrors: Record<string, string | null>;
}

/**
 * Risk Intelligence Dashboard Controller
 *
 * Implements:
 * - Auto-refresh at configurable intervals (max 60 seconds)
 * - Filter controls with date range, risk category, user, business unit, severity
 * - Time-series trend charts with daily/weekly granularity based on date range
 * - Drill-down from summary metrics to individual transactions
 * - Independent error handling per dashboard component
 */
export default class RiskDashboardController extends BaseController {
  public formatter = formatter;

  private _refreshTimer: ReturnType<typeof setInterval> | null = null;
  private _filterDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  private static readonly MAX_REFRESH_INTERVAL_SECONDS = 60;
  private static readonly DEFAULT_REFRESH_INTERVAL_SECONDS = 30;
  private static readonly DEFAULT_DATE_RANGE_DAYS = "30";
  private static readonly FILTER_DEBOUNCE_MS = 300;
  private static readonly DAILY_GRANULARITY_THRESHOLD_DAYS = 90;

  public onInit(): void {
    const dashboardModel = new JSONModel(this._getInitialDashboardState());
    this.setModel(dashboardModel, "dashboard");

    const trendsModel = new JSONModel({ data: [] });
    this.setModel(trendsModel, "trends");

    // Initial data load
    this._loadAllComponents();

    // Start auto-refresh
    this._startAutoRefresh();
  }

  public onExit(): void {
    this._stopAutoRefresh();
    if (this._filterDebounceTimer) {
      clearTimeout(this._filterDebounceTimer);
    }
  }

  // ========== AUTO-REFRESH HANDLERS ==========

  /**
   * Toggles auto-refresh on/off.
   */
  public onAutoRefreshToggle(): void {
    const model = this.getModel("dashboard") as JSONModel;
    const enabled = model.getProperty("/autoRefreshEnabled") as boolean;

    if (enabled) {
      this._startAutoRefresh();
      MessageToast.show(
        this.getResourceBundle().getText("autoRefreshEnabled", [
          model.getProperty("/refreshIntervalSeconds")
        ])
      );
    } else {
      this._stopAutoRefresh();
      MessageToast.show(this.getResourceBundle().getText("autoRefreshDisabled"));
    }
  }

  /**
   * Handles changes to the refresh interval (capped at 60 seconds).
   */
  public onRefreshIntervalChange(): void {
    const model = this.getModel("dashboard") as JSONModel;
    let interval = model.getProperty("/refreshIntervalSeconds") as number;

    // Enforce max 60-second interval
    if (interval > RiskDashboardController.MAX_REFRESH_INTERVAL_SECONDS) {
      interval = RiskDashboardController.MAX_REFRESH_INTERVAL_SECONDS;
      model.setProperty("/refreshIntervalSeconds", interval);
    }
    if (interval < 10) {
      interval = 10;
      model.setProperty("/refreshIntervalSeconds", interval);
    }

    // Restart timer with new interval
    if (model.getProperty("/autoRefreshEnabled")) {
      this._stopAutoRefresh();
      this._startAutoRefresh();
    }
  }

  /**
   * Manual refresh button handler.
   */
  public onManualRefresh(): void {
    this._loadAllComponents();
    MessageToast.show(this.getResourceBundle().getText("statusLoading"));
  }

  // ========== FILTER HANDLERS ==========

  /**
   * Handles filter change events with debouncing.
   * Filter updates reflect across all components within 3 seconds.
   */
  public onFilterChange(): void {
    if (this._filterDebounceTimer) {
      clearTimeout(this._filterDebounceTimer);
    }

    this._filterDebounceTimer = setTimeout(() => {
      this._applyFilters();
    }, RiskDashboardController.FILTER_DEBOUNCE_MS);
  }

  /**
   * Applies all current filters to dashboard components.
   */
  public onFilterApply(): void {
    this._applyFilters();
  }

  /**
   * Resets all filters to defaults.
   */
  public onFilterReset(): void {
    const model = this.getModel("dashboard") as JSONModel;
    model.setProperty("/filters", this._getDefaultFilters());

    // Reset multi-combo boxes
    const riskCategorySelect = this.byId("riskCategorySelect") as any;
    if (riskCategorySelect) {
      riskCategorySelect.setSelectedKeys([]);
    }
    const severitySelect = this.byId("severitySelect") as any;
    if (severitySelect) {
      severitySelect.setSelectedKeys([]);
    }

    this._applyFilters();
  }

  // ========== DRILL-DOWN HANDLERS ==========

  /**
   * Drill-down from risk posture score to filtered transaction list.
   */
  public onRiskPostureDrillDown(): void {
    this.navTo("transactionDetail", { transactionId: "all" });
  }

  /**
   * Drill-down from alerts card to alerts filtered by priority.
   */
  public onAlertsDrillDown(): void {
    this.navTo("transactionDetail", { transactionId: "alerts" });
  }

  /**
   * Drill-down from SoD violations card.
   */
  public onSoDDrillDown(): void {
    this.navTo("transactionDetail", { transactionId: "sod" });
  }

  /**
   * Drill-down from fraud detections card.
   */
  public onFraudDrillDown(): void {
    this.navTo("transactionDetail", { transactionId: "fraud" });
  }

  /**
   * Drill-down from compliance status card.
   */
  public onComplianceDrillDown(): void {
    this.navTo("transactionDetail", { transactionId: "compliance" });
  }

  /**
   * Drill-down from trend charts to transaction details.
   */
  public onTrendsDrillDown(): void {
    this.navTo("transactionDetail", { transactionId: "trends" });
  }

  // ========== RETRY HANDLERS ==========

  /**
   * Retries loading the risk posture component after a failure.
   */
  public onRetryRiskPosture(): void {
    this._loadRiskPosture();
  }

  /**
   * Retries loading the alerts component after a failure.
   */
  public onRetryAlerts(): void {
    this._loadAlerts();
  }

  /**
   * Retries loading the SoD violations component after a failure.
   */
  public onRetrySoD(): void {
    this._loadSoDViolations();
  }

  /**
   * Retries loading the fraud detections component after a failure.
   */
  public onRetryFraud(): void {
    this._loadFraudDetections();
  }

  /**
   * Retries loading the compliance status component after a failure.
   */
  public onRetryCompliance(): void {
    this._loadComplianceStatus();
  }

  /**
   * Retries loading the trends component after a failure.
   */
  public onRetryTrends(): void {
    this._loadTrendData();
  }

  // ========== PRIVATE METHODS ==========

  /**
   * Returns the initial state of the dashboard model.
   */
  private _getInitialDashboardState(): DashboardModel {
    return {
      autoRefreshEnabled: true,
      refreshIntervalSeconds: RiskDashboardController.DEFAULT_REFRESH_INTERVAL_SECONDS,
      lastUpdatedText: "",
      filters: this._getDefaultFilters(),
      riskPosture: {
        score: 0,
        subtitle: "Calculating...",
        trend: ""
      },
      alerts: {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      },
      sod: {
        activeCount: 0,
        previousCount: 0,
        maxValue: 100
      },
      fraud: {
        activeCount: 0,
        patternsCount: 0
      },
      compliance: {
        passRate: "N/A",
        totalControls: 0,
        passingControls: 0,
        failingControls: 0,
        state: "None"
      },
      trends: {
        granularityLabel: "Daily"
      },
      componentErrors: {}
    };
  }

  /**
   * Returns default filter configuration (30-day range).
   */
  private _getDefaultFilters(): DashboardFilters {
    return {
      dateRangeDays: RiskDashboardController.DEFAULT_DATE_RANGE_DAYS,
      riskCategories: [],
      userId: "",
      businessUnit: "",
      severities: []
    };
  }

  /**
   * Starts the auto-refresh timer.
   */
  private _startAutoRefresh(): void {
    this._stopAutoRefresh();

    const model = this.getModel("dashboard") as JSONModel;
    const intervalMs = (model.getProperty("/refreshIntervalSeconds") as number) * 1000;

    this._refreshTimer = setInterval(() => {
      this._loadAllComponents();
    }, intervalMs);
  }

  /**
   * Stops the auto-refresh timer.
   */
  private _stopAutoRefresh(): void {
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
      this._refreshTimer = null;
    }
  }

  /**
   * Loads all dashboard components independently.
   * Each component handles its own errors without affecting others.
   */
  private _loadAllComponents(): void {
    // Load each component independently - failures are isolated
    this._loadRiskPosture();
    this._loadAlerts();
    this._loadSoDViolations();
    this._loadFraudDetections();
    this._loadComplianceStatus();
    this._loadTrendData();

    // Update last refreshed timestamp
    this._updateLastRefreshed();
  }

  /**
   * Applies current filter state to all dashboard components.
   */
  private _applyFilters(): void {
    this._syncFilterState();
    this._loadAllComponents();
  }

  /**
   * Synchronizes UI filter controls with the dashboard model.
   */
  private _syncFilterState(): void {
    const model = this.getModel("dashboard") as JSONModel;

    // Sync multi-combo box selections
    const riskCategorySelect = this.byId("riskCategorySelect") as any;
    if (riskCategorySelect) {
      model.setProperty("/filters/riskCategories", riskCategorySelect.getSelectedKeys());
    }

    const severitySelect = this.byId("severitySelect") as any;
    if (severitySelect) {
      model.setProperty("/filters/severities", severitySelect.getSelectedKeys());
    }
  }

  /**
   * Builds OData filters from the current filter state.
   */
  private _buildODataFilters(): Filter[] {
    const model = this.getModel("dashboard") as JSONModel;
    const filters: Filter[] = [];

    const dateRangeDays = Number.parseInt(model.getProperty("/filters/dateRangeDays") as string, 10);
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - dateRangeDays);
    filters.push(new Filter("createdAt", FilterOperator.GE, fromDate.toISOString()));

    const riskCategories = model.getProperty("/filters/riskCategories") as string[];
    if (riskCategories && riskCategories.length > 0) {
      const categoryFilters = riskCategories.map(
        (cat: string) => new Filter("riskCategory", FilterOperator.EQ, cat)
      );
      filters.push(new Filter({ filters: categoryFilters, and: false }));
    }

    const userId = model.getProperty("/filters/userId") as string;
    if (userId) {
      filters.push(new Filter("assignedAnalyst", FilterOperator.Contains, userId));
    }

    const severities = model.getProperty("/filters/severities") as string[];
    if (severities && severities.length > 0) {
      const severityFilters = severities.map(
        (sev: string) => new Filter("priority", FilterOperator.EQ, sev)
      );
      filters.push(new Filter({ filters: severityFilters, and: false }));
    }

    return filters;
  }

  /**
   * Builds OData filters specifically for Transactions.
   */
  private _buildTransactionFilters(): Filter[] {
    const model = this.getModel("dashboard") as JSONModel;
    const filters: Filter[] = [];

    const dateRangeDays = Number.parseInt(model.getProperty("/filters/dateRangeDays") as string, 10);
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - dateRangeDays);
    filters.push(new Filter("createdAt", FilterOperator.GE, fromDate.toISOString()));

    const userId = model.getProperty("/filters/userId") as string;
    if (userId) {
      filters.push(new Filter("userId", FilterOperator.Contains, userId));
    }

    const businessUnit = model.getProperty("/filters/businessUnit") as string;
    if (businessUnit) {
      filters.push(new Filter("companyCode", FilterOperator.EQ, businessUnit));
    }

    return filters;
  }

  /**
   * Loads risk posture score.
   * Calculates from alert severity distribution and recent risk scores.
   * Handles errors independently.
   */
  private async _loadRiskPosture(): Promise<void> {
    try {
      this._clearComponentError("riskPosture");
      const oDataModel = this.getModel() as ODataModel;
      const filters = this._buildODataFilters();

      const binding = oDataModel.bindList("/Alerts", undefined, undefined, filters, {
        $count: true
      }) as ODataListBinding;

      const contexts = await binding.requestContexts(0, 200);
      const alerts = contexts.map((ctx: any) => ctx.getObject());

      // Calculate risk posture score (0-100): higher = more risk
      let score = 0;
      if (alerts.length > 0) {
        const criticalCount = alerts.filter((a: any) => a.priority === "CRITICAL").length;
        const highCount = alerts.filter((a: any) => a.priority === "HIGH").length;
        const mediumCount = alerts.filter((a: any) => a.priority === "MEDIUM").length;

        // Weighted score calculation
        const weightedSum = criticalCount * 10 + highCount * 5 + mediumCount * 2;
        score = Math.min(100, Math.round(weightedSum));
      }

      const model = this.getModel("dashboard") as JSONModel;
      model.setProperty("/riskPosture/score", score);
      model.setProperty("/riskPosture/subtitle", `Based on ${alerts.length} active alerts`);
      model.setProperty("/riskPosture/trend", score > 50 ? "↑ Elevated" : "↓ Normal");

      binding.destroy();
    } catch (error: any) {
      this._handleComponentError("riskPosture", error);
    }
  }

  /**
   * Loads active alerts by priority.
   * Handles errors independently.
   */
  private async _loadAlerts(): Promise<void> {
    try {
      this._clearComponentError("alerts");
      const oDataModel = this.getModel() as ODataModel;
      const filters = this._buildODataFilters();

      // Add status filter: only OPEN or IN_PROGRESS
      filters.push(new Filter({
        filters: [
          new Filter("status", FilterOperator.EQ, "OPEN"),
          new Filter("status", FilterOperator.EQ, "IN_PROGRESS"),
          new Filter("status", FilterOperator.EQ, "ESCALATED")
        ],
        and: false
      }));

      const binding = oDataModel.bindList("/Alerts", undefined, undefined, filters, {
        $count: true
      }) as ODataListBinding;

      const contexts = await binding.requestContexts(0, 500);
      const alerts = contexts.map((ctx: any) => ctx.getObject());

      const model = this.getModel("dashboard") as JSONModel;
      model.setProperty("/alerts/total", alerts.length);
      model.setProperty("/alerts/critical", alerts.filter((a: any) => a.priority === "CRITICAL").length);
      model.setProperty("/alerts/high", alerts.filter((a: any) => a.priority === "HIGH").length);
      model.setProperty("/alerts/medium", alerts.filter((a: any) => a.priority === "MEDIUM").length);
      model.setProperty("/alerts/low", alerts.filter((a: any) => a.priority === "LOW").length);

      binding.destroy();
    } catch (error: any) {
      this._handleComponentError("alerts", error);
    }
  }

  /**
   * Loads SoD violation counts.
   * Handles errors independently.
   */
  private async _loadSoDViolations(): Promise<void> {
    try {
      this._clearComponentError("sod");
      const oDataModel = this.getModel() as ODataModel;
      const model = this.getModel("dashboard") as JSONModel;

      const dateRangeDays = Number.parseInt(model.getProperty("/filters/dateRangeDays") as string, 10);
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - dateRangeDays);

      const filters: Filter[] = [
        new Filter("createdAt", FilterOperator.GE, fromDate.toISOString())
      ];

      const binding = oDataModel.bindList("/SoDViolations", undefined, undefined, filters, {
        $count: true
      }) as ODataListBinding;

      const contexts = await binding.requestContexts(0, 200);
      const violations = contexts.map((ctx: any) => ctx.getObject());

      const activeCount = violations.filter((v: any) => v.status === "ACTIVE").length;
      const acknowledgedCount = violations.filter((v: any) => v.status === "ACKNOWLEDGED").length;

      model.setProperty("/sod/activeCount", activeCount);
      model.setProperty("/sod/previousCount", acknowledgedCount);
      model.setProperty("/sod/maxValue", Math.max(activeCount + acknowledgedCount, 50));

      binding.destroy();
    } catch (error: any) {
      this._handleComponentError("sod", error);
    }
  }

  /**
   * Loads fraud detection counts.
   * Handles errors independently.
   */
  private async _loadFraudDetections(): Promise<void> {
    try {
      this._clearComponentError("fraud");
      const oDataModel = this.getModel() as ODataModel;
      const model = this.getModel("dashboard") as JSONModel;

      const dateRangeDays = Number.parseInt(model.getProperty("/filters/dateRangeDays") as string, 10);
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - dateRangeDays);

      const filters: Filter[] = [
        new Filter("createdAt", FilterOperator.GE, fromDate.toISOString()),
        new Filter("riskCategory", FilterOperator.EQ, "FRAUD_PATTERN")
      ];

      const binding = oDataModel.bindList("/Alerts", undefined, undefined, filters, {
        $count: true
      }) as ODataListBinding;

      const contexts = await binding.requestContexts(0, 200);
      const fraudAlerts = contexts.map((ctx: any) => ctx.getObject());

      const activeCount = fraudAlerts.filter(
        (a: any) => a.status === "OPEN" || a.status === "IN_PROGRESS"
      ).length;

      // Count unique pattern types from risk indicators
      const patternTypes = new Set<string>();
      fraudAlerts.forEach((a: any) => {
        try {
          const indicators = JSON.parse(a.riskIndicators || "[]");
          indicators.forEach((ind: any) => patternTypes.add(ind.type || "unknown"));
        } catch {
          patternTypes.add("unknown");
        }
      });

      model.setProperty("/fraud/activeCount", activeCount);
      model.setProperty("/fraud/patternsCount", patternTypes.size);

      binding.destroy();
    } catch (error: any) {
      this._handleComponentError("fraud", error);
    }
  }

  /**
   * Loads compliance status.
   * Note: Compliance data is accessed through AuditorService but we aggregate
   * from alerts with COMPLIANCE_BREACH category for the analyst view.
   * Handles errors independently.
   */
  private async _loadComplianceStatus(): Promise<void> {
    try {
      this._clearComponentError("compliance");
      const oDataModel = this.getModel() as ODataModel;
      const model = this.getModel("dashboard") as JSONModel;

      const dateRangeDays = Number.parseInt(model.getProperty("/filters/dateRangeDays") as string, 10);
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - dateRangeDays);

      // Get compliance breach alerts as a proxy for compliance status
      const filters: Filter[] = [
        new Filter("createdAt", FilterOperator.GE, fromDate.toISOString()),
        new Filter("riskCategory", FilterOperator.EQ, "COMPLIANCE_BREACH")
      ];

      const binding = oDataModel.bindList("/Alerts", undefined, undefined, filters, {
        $count: true
      }) as ODataListBinding;

      const contexts = await binding.requestContexts(0, 200);
      const complianceAlerts = contexts.map((ctx: any) => ctx.getObject());

      // Estimate compliance status from alert data
      const failingControls = complianceAlerts.filter(
        (a: any) => a.status === "OPEN" || a.status === "IN_PROGRESS"
      ).length;

      // Assume a baseline of controls (this would come from a dedicated endpoint in production)
      const totalControls = Math.max(50, failingControls + 40);
      const passingControls = totalControls - failingControls;
      const passRate = formatter.complianceStatusText(passingControls, totalControls);
      const state = formatter.complianceState(passingControls, totalControls);

      model.setProperty("/compliance/passRate", passRate);
      model.setProperty("/compliance/totalControls", totalControls);
      model.setProperty("/compliance/passingControls", passingControls);
      model.setProperty("/compliance/failingControls", failingControls);
      model.setProperty("/compliance/state", state);

      binding.destroy();
    } catch (error: any) {
      this._handleComponentError("compliance", error);
    }
  }

  /**
   * Loads time-series trend data.
   * Uses daily granularity for periods <= 90 days, weekly for > 90 days.
   * Handles errors independently.
   */
  private async _loadTrendData(): Promise<void> {
    try {
      this._clearComponentError("trends");
      const oDataModel = this.getModel() as ODataModel;
      const model = this.getModel("dashboard") as JSONModel;
      const trendsModel = this.getModel("trends") as JSONModel;

      const dateRangeDays = Number.parseInt(model.getProperty("/filters/dateRangeDays") as string, 10);
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - dateRangeDays);

      // Determine granularity
      const isDaily = dateRangeDays <= RiskDashboardController.DAILY_GRANULARITY_THRESHOLD_DAYS;
      const granularityLabel = isDaily ? "Daily" : "Weekly";
      model.setProperty("/trends/granularityLabel", granularityLabel);

      const filters: Filter[] = [
        new Filter("createdAt", FilterOperator.GE, fromDate.toISOString())
      ];

      // Apply risk category filters if set
      const riskCategories = model.getProperty("/filters/riskCategories") as string[];
      if (riskCategories && riskCategories.length > 0) {
        const categoryFilters = riskCategories.map(
          (cat: string) => new Filter("riskCategory", FilterOperator.EQ, cat)
        );
        filters.push(new Filter({ filters: categoryFilters, and: false }));
      }

      const binding = oDataModel.bindList("/Alerts", undefined, undefined, filters) as ODataListBinding;
      const contexts = await binding.requestContexts(0, 1000);
      const alerts = contexts.map((ctx: any) => ctx.getObject());

      // Aggregate data by time period
      const trendData = this._aggregateTrendData(alerts, fromDate, dateRangeDays, isDaily);
      trendsModel.setProperty("/data", trendData);

      // Update VizFrame
      this._updateTrendChart();

      binding.destroy();
    } catch (error: any) {
      this._handleComponentError("trends", error);
    }
  }

  /**
   * Aggregates alert data into time-series buckets.
   * Daily granularity for <= 90 days, weekly for > 90 days.
   */
  private _aggregateTrendData(
    alerts: any[],
    fromDate: Date,
    _dateRangeDays: number,
    isDaily: boolean
  ): any[] {
    const buckets: Map<string, { anomalyCount: number; alertCount: number; fraudCount: number }> = new Map();

    // Create empty buckets
    const now = new Date();
    const intervalDays = isDaily ? 1 : 7;
    const currentDate = new Date(fromDate);

    while (currentDate <= now) {
      const key = this._getBucketKey(currentDate, isDaily);
      buckets.set(key, { anomalyCount: 0, alertCount: 0, fraudCount: 0 });
      currentDate.setDate(currentDate.getDate() + intervalDays);
    }

    // Populate buckets from alerts
    alerts.forEach((alert: any) => {
      const alertDate = new Date(alert.createdAt);
      const key = this._getBucketKey(alertDate, isDaily);

      if (buckets.has(key)) {
        const bucket = buckets.get(key)!;
        bucket.alertCount++;

        if (alert.riskCategory === "ANOMALY") {
          bucket.anomalyCount++;
        } else if (alert.riskCategory === "FRAUD_PATTERN") {
          bucket.fraudCount++;
        }
      }
    });

    // Convert to array
    return Array.from(buckets.entries()).map(([date, counts]) => ({
      date,
      ...counts
    }));
  }

  /**
   * Gets the bucket key for a date based on granularity.
   */
  private _getBucketKey(date: Date, isDaily: boolean): string {
    if (isDaily) {
      return date.toISOString().split("T")[0];
    }
    // Weekly: use the Monday of the week
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d.toISOString().split("T")[0];
  }

  /**
   * Updates the VizFrame chart configuration.
   */
  private _updateTrendChart(): void {
    const vizFrame = this.byId("trendVizFrame") as any;
    if (!vizFrame) return;

    vizFrame.setVizProperties({
      plotArea: {
        dataLabel: { visible: false },
        window: { start: null, end: null }
      },
      valueAxis: {
        title: { visible: true, text: "Count" }
      },
      timeAxis: {
        title: { visible: true, text: "Date" },
        levels: ["day", "month"],
        levelConfig: {
          day: { formatString: "MMM dd" },
          month: { formatString: "MMM yyyy" }
        }
      },
      title: { visible: false },
      legend: { visible: true }
    });
  }

  /**
   * Updates the last refreshed timestamp.
   */
  private _updateLastRefreshed(): void {
    const model = this.getModel("dashboard") as JSONModel;
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    model.setProperty("/lastUpdatedText", `Last updated: ${timeStr}`);
  }

  /**
   * Handles component-level errors independently.
   * Shows error in the affected component without impacting others.
   */
  private _handleComponentError(componentName: string, error: any): void {
    const model = this.getModel("dashboard") as JSONModel;
    const errorMessage = error?.message || "Unknown error";

    model.setProperty(`/componentErrors/${componentName}`, errorMessage);

    // Log error for debugging but don't disrupt other components
    console.error(`[RiskDashboard] Error loading ${componentName}:`, errorMessage);
  }

  /**
   * Clears a component error state.
   */
  private _clearComponentError(componentName: string): void {
    const model = this.getModel("dashboard") as JSONModel;
    model.setProperty(`/componentErrors/${componentName}`, null);
  }
}
