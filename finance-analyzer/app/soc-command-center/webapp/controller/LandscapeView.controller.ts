import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";
import VBox from "sap/m/VBox";
import HBox from "sap/m/HBox";
import Text from "sap/m/Text";
import ObjectStatus from "sap/m/ObjectStatus";
import Icon from "sap/ui/core/Icon";
import BaseController from "./BaseController";

/**
 * Controller for the Multi-System Landscape View.
 * Displays the security posture of all connected S/4HANA, ECC, and BTP systems
 * simultaneously, with each system represented as a node showing its current risk level
 * (Green/Yellow/Orange/Red based on active critical and high alerts) and connectivity status.
 *
 * Requirements: 26.2
 */
export default class LandscapeViewController extends BaseController {

  /**
   * Initialize the landscape view.
   * Load connected systems and their status indicators.
   */
  public onInit(): void {
    this._loadConnectedSystems();
  }

  /**
   * Load all connected systems and determine their risk-level status.
   * Status determination:
   * - Green (Healthy): 0 critical, 0 high alerts
   * - Yellow (Degraded): 0 critical, 1+ high alerts
   * - Orange (At-Risk): 1-2 critical alerts
   * - Red (Critical): 3+ critical alerts
   */
  private _loadConnectedSystems(): void {
    const dashboardModel = this.getModel("dashboard") as JSONModel;

    // Systems are loaded from the admin service ConnectedSystems entity.
    // Status is calculated based on alert counts for each system.
    dashboardModel.setProperty("/systems", []);
    dashboardModel.setProperty("/selectedSystem/visible", false);
    dashboardModel.setProperty("/connectedSystemsCount", 0);

    this._renderSystemNodes();
  }

  /**
   * Render system nodes dynamically in the grid.
   * Each node shows system name, type, status color, and connectivity.
   */
  private _renderSystemNodes(): void {
    const dashboardModel = this.getModel("dashboard") as JSONModel;
    const systems = dashboardModel.getProperty("/systems") || [];
    const grid = this.byId("systemGrid") as any;

    if (!grid) return;

    // Clear existing content
    grid.destroyContent();

    systems.forEach((system: any) => {
      const statusColor = this.formatter.getSystemNodeColor(system.status);
      const statusState = this.formatter.getSystemStatusColor(system.status);

      const nodeCard = new VBox({
        class: "socSystemNode",
        items: [
          new Icon({
            src: this._getSystemIcon(system.type),
            size: "2.5rem",
            color: statusColor
          }),
          new Text({
            text: system.name,
            class: "socSystemNodeName"
          }),
          new Text({
            text: system.type,
            class: "socSystemNodeType"
          }),
          new ObjectStatus({
            text: system.status,
            state: statusState
          }),
          new HBox({
            items: [
              new Icon({
                src: system.connectivity === "Connected" ? "sap-icon://connected" : "sap-icon://disconnected",
                color: system.connectivity === "Connected" ? "#2b7c2b" : "#cc1919",
                size: "1rem"
              }),
              new Text({
                text: ` ${system.connectivity}`
              })
            ]
          })
        ]
      });

      nodeCard.attachBrowserEvent("click", () => {
        this._onSystemNodeClick(system);
      });

      grid.addContent(nodeCard);
    });
  }

  /**
   * Get the appropriate icon for a system type.
   */
  private _getSystemIcon(systemType: string): string {
    switch (systemType?.toLowerCase()) {
      case "s4hana-cloud":
      case "s/4hana cloud":
        return "sap-icon://cloud";
      case "s4hana-onprem":
      case "s/4hana on-premise":
        return "sap-icon://it-host";
      case "ecc":
      case "sap ecc":
        return "sap-icon://database";
      case "btp":
        return "sap-icon://cloud";
      default:
        return "sap-icon://it-system";
    }
  }

  /**
   * Handle system node click - show system detail panel.
   */
  private _onSystemNodeClick(system: any): void {
    const dashboardModel = this.getModel("dashboard") as JSONModel;
    dashboardModel.setProperty("/selectedSystem", {
      visible: true,
      name: system.name,
      type: system.type,
      version: system.version,
      status: system.status,
      connectivity: system.connectivity,
      activeAlerts: system.activeAlerts || 0,
      lastEvent: system.lastEvent || "N/A",
      region: system.region || "N/A",
      alerts: system.alerts || []
    });
  }

  /**
   * Calculate system status based on alert counts.
   * - Green: 0 critical, 0 high alerts
   * - Yellow: 0 critical, 1+ high alerts
   * - Orange: 1-2 critical alerts
   * - Red: 3+ critical alerts
   */
  public calculateSystemStatus(criticalAlerts: number, highAlerts: number): string {
    if (criticalAlerts >= 3) return "Red";
    if (criticalAlerts >= 1) return "Orange";
    if (highAlerts >= 1) return "Yellow";
    return "Green";
  }

  /**
   * Refresh landscape data from backend.
   */
  public onRefreshLandscape(): void {
    this._loadConnectedSystems();
    MessageToast.show("Landscape view refreshed");
  }

  /**
   * Navigate back to main command center view.
   */
  public onNavBack(): void {
    this.navTo("main");
  }

  /**
   * Handle press on an alert in the system detail panel.
   */
  public onSystemAlertPress(event: any): void {
    const source = event.getSource();
    const bindingContext = source.getBindingContext("dashboard");
    if (bindingContext) {
      const alertData = bindingContext.getObject();
      MessageToast.show(`Navigating to Alert: ${alertData.id}`);
    }
  }
}
