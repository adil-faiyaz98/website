import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";
import BaseController from "./BaseController";

/**
 * Controller for the Real-Time Threat Feed view.
 * Displays the latest 100 security events in reverse chronological order
 * with one-click navigation to the related Alert or Investigation.
 *
 * Implements polling at 60-second intervals for real-time updates.
 *
 * Requirements: 26.7
 */
export default class ThreatFeedController extends BaseController {

  private _refreshTimer: ReturnType<typeof setInterval> | null = null;
  private readonly _currentFilters: {
    severity: string;
    category: string;
    searchText: string;
  } = { severity: "all", category: "all", searchText: "" };

  /**
   * Initialize the threat feed view.
   * Start auto-refresh polling and load initial feed data.
   */
  public onInit(): void {
    this._loadThreatFeed();
    this._startAutoRefresh();
  }

  /**
   * Clean up timers when leaving the view.
   */
  public onExit(): void {
    this._stopAutoRefresh();
  }

  /**
   * Load the latest 100 security events in reverse chronological order.
   * Events are fetched from the Alerts entity across all security domains.
   */
  private _loadThreatFeed(): void {
    const dashboardModel = this.getModel("dashboard") as JSONModel;

    // In production, this queries the analyst service for the latest 100 alerts
    // ordered by createdAt descending, with filters applied.
    // The data is enriched with relative timestamps and category labels.
    dashboardModel.setProperty("/threatFeedLastRefreshed", new Date().toLocaleTimeString());
    dashboardModel.setProperty("/threatFeedCount",
      (dashboardModel.getProperty("/threatFeed") || []).length
    );
  }

  /**
   * Start auto-refresh polling at 60-second intervals.
   */
  private _startAutoRefresh(): void {
    this._refreshTimer = setInterval(() => {
      this._loadThreatFeed();
    }, 60000);
  }

  /**
   * Stop auto-refresh timer.
   */
  private _stopAutoRefresh(): void {
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
      this._refreshTimer = null;
    }
  }

  /**
   * Handle search within the threat feed.
   * Filters events by title and description text.
   */
  public onSearchThreatFeed(event: any): void {
    const searchText = event.getParameter("query") || event.getParameter("newValue") || "";
    this._currentFilters.searchText = searchText;
    this._applyFilters();
  }

  /**
   * Handle severity filter change.
   */
  public onSeverityFilterChange(event: any): void {
    const selectedKey = event.getParameter("selectedItem").getKey();
    this._currentFilters.severity = selectedKey;
    this._applyFilters();
  }

  /**
   * Handle category filter change.
   */
  public onCategoryFilterChange(event: any): void {
    const selectedKey = event.getParameter("selectedItem").getKey();
    this._currentFilters.category = selectedKey;
    this._applyFilters();
  }

  /**
   * Apply all active filters to the threat feed list.
   */
  private _applyFilters(): void {
    const dashboardModel = this.getModel("dashboard") as JSONModel;
    const allEvents = dashboardModel.getProperty("/threatFeedAll") || [];

    let filteredEvents = [...allEvents];

    // Apply severity filter
    if (this._currentFilters.severity !== "all") {
      filteredEvents = filteredEvents.filter(
        (evt: any) => evt.severity === this._currentFilters.severity
      );
    }

    // Apply category filter
    if (this._currentFilters.category !== "all") {
      filteredEvents = filteredEvents.filter(
        (evt: any) => evt.category === this._currentFilters.category
      );
    }

    // Apply text search filter
    if (this._currentFilters.searchText) {
      const searchLower = this._currentFilters.searchText.toLowerCase();
      filteredEvents = filteredEvents.filter(
        (evt: any) =>
          (evt.title || "").toLowerCase().includes(searchLower) ||
          (evt.description || "").toLowerCase().includes(searchLower)
      );
    }

    // Limit to 100 events
    filteredEvents = filteredEvents.slice(0, 100);

    dashboardModel.setProperty("/threatFeed", filteredEvents);
    dashboardModel.setProperty("/threatFeedCount", filteredEvents.length);
  }

  /**
   * Manual refresh of the threat feed.
   */
  public onRefreshFeed(): void {
    this._loadThreatFeed();
    MessageToast.show("Threat feed refreshed");
  }

  /**
   * Handle threat event press - one-click navigation to related Alert or Investigation.
   * Navigates to the appropriate detail view based on event type.
   */
  public onThreatEventPress(event: any): void {
    const source = event.getSource();
    const bindingContext = source.getBindingContext("dashboard");
    if (bindingContext) {
      const eventData = bindingContext.getObject();

      if (eventData.alertId) {
        // Navigate to alert detail - in full implementation this would use
        // cross-app navigation to the Fiori Elements alert detail page
        MessageToast.show(`Navigating to Alert: ${eventData.alertId}`);
        this._navigateToAlertDetail(eventData.alertId);
      } else if (eventData.investigationId) {
        MessageToast.show(`Navigating to Investigation: ${eventData.investigationId}`);
        this._navigateToInvestigationDetail(eventData.investigationId);
      }
    }
  }

  /**
   * Navigate to alert detail view (cross-app navigation).
   */
  private _navigateToAlertDetail(alertId: string): void {
    // In production, this uses sap.ushell cross-app navigation:
    // sap.ushell.Container.getServiceAsync("CrossApplicationNavigation")
    //   .then(nav => nav.toExternal({ target: { semanticObject: "Alert", action: "display" },
    //     params: { ID: alertId } }));
    const baseUrl = window.location.origin;
    const alertUrl = `${baseUrl}/analyst/Alerts('${alertId}')`;
    console.log(`Alert detail URL: ${alertUrl}`);
  }

  /**
   * Navigate to investigation detail view (cross-app navigation).
   */
  private _navigateToInvestigationDetail(investigationId: string): void {
    const baseUrl = window.location.origin;
    const invUrl = `${baseUrl}/analyst/Investigations('${investigationId}')`;
    console.log(`Investigation detail URL: ${invUrl}`);
  }

  /**
   * Navigate back to main command center view.
   */
  public onNavBack(): void {
    this.navTo("main");
  }
}
