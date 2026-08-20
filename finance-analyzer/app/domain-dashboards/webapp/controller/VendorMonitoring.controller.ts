import BaseController from "./BaseController";
import JSONModel from "sap/ui/model/json/JSONModel";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import ODataListBinding from "sap/ui/model/odata/v4/ODataListBinding";
import Event from "sap/ui/base/Event";

/**
 * Vendor Monitoring Controller
 * Displays vendor master bank changes with risk indicators:
 * - Risk score color coding: red >= 80, orange >= 60, yellow >= 40
 * - Change details, justification, correlated payments
 * Requirement: 5.6
 */
export default class VendorMonitoringController extends BaseController {
  public onInit(): void {
    const oViewModel = new JSONModel({
      busy: false,
      riskThresholds: {
        critical: 80,
        high: 60,
        medium: 40
      }
    });
    this.setModel(oViewModel, "viewModel");
    this.getRouter().getRoute("vendorMonitoring")!.attachPatternMatched(this._onRouteMatched, this);
  }

  private _onRouteMatched(): void {
    // View data loaded via OData binding in XML
  }

  /**
   * Returns the custom data CSS class based on risk score thresholds.
   * Red >= 80, Orange >= 60, Yellow >= 40
   */
  public riskScoreIndicatorColor(vendorRiskScore: number): string {
    if (vendorRiskScore >= 80) return "Error";
    if (vendorRiskScore >= 60) return "Warning";
    if (vendorRiskScore >= 40) return "Information";
    return "Success";
  }

  /**
   * Handles search by vendor ID or changing user.
   */
  public onSearch(oEvent: Event): void {
    const sQuery = (oEvent.getParameter("query") as string) || "";
    const oTable = this.byId("vendorTable") as any;
    if (oTable) {
      const oBinding = oTable.getBinding("items") as ODataListBinding;
      if (oBinding) {
        const aFilters = sQuery
          ? [
              new Filter({
                filters: [
                  new Filter("vendorId", FilterOperator.Contains, sQuery),
                  new Filter("changingUser", FilterOperator.Contains, sQuery)
                ],
                and: false
              })
            ]
          : [];
        oBinding.filter(aFilters);
      }
    }
  }

  /**
   * Handles risk level filter.
   */
  public onRiskLevelFilter(oEvent: Event): void {
    const sKey = (oEvent.getParameter("selectedItem") as any)?.getKey() || "";
    const oTable = this.byId("vendorTable") as any;
    if (oTable) {
      const oBinding = oTable.getBinding("items") as ODataListBinding;
      if (oBinding) {
        const aFilters = sKey
          ? [new Filter("riskLevel", FilterOperator.EQ, sKey)]
          : [];
        oBinding.filter(aFilters);
      }
    }
  }

  /**
   * Refreshes vendor change data.
   */
  public onRefresh(): void {
    const oTable = this.byId("vendorTable") as any;
    if (oTable) {
      const oBinding = oTable.getBinding("items") as ODataListBinding;
      if (oBinding) {
        oBinding.refresh();
      }
    }
  }
}
