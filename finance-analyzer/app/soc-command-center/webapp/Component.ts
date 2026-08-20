import UIComponent from "sap/ui/core/UIComponent";
import JSONModel from "sap/ui/model/json/JSONModel";
import Device from "sap/ui/Device";

/**
 * SOC Command Center Component
 * Custom Fiori extension for unified security operations view.
 * Provides multi-system landscape monitoring, SOC KPIs, role-specific views,
 * geographic alert density mapping, dark mode, and real-time threat feed.
 */
export default class Component extends UIComponent {

  public static readonly metadata = {
    manifest: "json",
    interfaces: ["sap.ui.core.IAsyncContentCreation"]
  };

  public init(): void {
    // Call the base component's init function
    super.init();

    // Initialize device model for responsive behavior
    const deviceModel = new JSONModel(Device);
    deviceModel.setDefaultBindingMode("OneWay");
    this.setModel(deviceModel, "device");

    // Initialize dashboard state model
    const dashboardModel = new JSONModel({
      darkMode: this._loadDarkModePreference(),
      currentRole: "",
      notificationsEnabled: false,
      shareableUrl: "",
      kpis: {
        mttd: 0,
        mttr: 0,
        alertVolume7d: 0,
        alertVolume30d: 0,
        falsePositiveRate: 0,
        complianceCoverage: 0
      },
      systems: [],
      threatFeed: [],
      savedConfigurations: []
    });
    this.setModel(dashboardModel, "dashboard");

    // Initialize the router
    this.getRouter().initialize();
  }

  /**
   * Load dark mode preference from localStorage
   */
  private _loadDarkModePreference(): boolean {
    try {
      return localStorage.getItem("soc-command-center-dark-mode") === "true";
    } catch {
      return false;
    }
  }

  public destroy(): void {
    super.destroy();
  }
}
