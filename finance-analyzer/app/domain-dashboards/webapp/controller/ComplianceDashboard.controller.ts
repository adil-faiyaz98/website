import BaseController from "./BaseController";
import JSONModel from "sap/ui/model/json/JSONModel";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import ODataListBinding from "sap/ui/model/odata/v4/ODataListBinding";
import Event from "sap/ui/base/Event";

/**
 * Compliance Dashboard Controller
 * Displays per-framework compliance percentage with drill-down to individual controls.
 * - Percentage = pass / (pass + fail + warning) * 100
 * - Framework cards with color-coded pass rates
 * - Drill-down to individual ComplianceControls and ControlEvidence
 * Requirement: 16.8
 */
export default class ComplianceDashboardController extends BaseController {
  public onInit(): void {
    const oViewModel = new JSONModel({
      busy: false,
      frameworks: {
        SOX_DORA_PCI: { percentage: 0, pass: 0, fail: 0, warning: 0, valueColor: "Neutral", indicator: "None" },
        NERC_CIP: { percentage: 0, pass: 0, fail: 0, warning: 0, valueColor: "Neutral", indicator: "None" },
        CMMC_ITAR: { percentage: 0, pass: 0, fail: 0, warning: 0, valueColor: "Neutral", indicator: "None" },
        FEDRAMP_NIST: { percentage: 0, pass: 0, fail: 0, warning: 0, valueColor: "Neutral", indicator: "None" },
        PIPEDA_OSFI: { percentage: 0, pass: 0, fail: 0, warning: 0, valueColor: "Neutral", indicator: "None" }
      },
      selectedFramework: ""
    });
    this.setModel(oViewModel, "viewModel");
    this.getRouter().getRoute("complianceDashboard")!.attachPatternMatched(this._onRouteMatched, this);
  }

  private _onRouteMatched(): void {
    this._loadFrameworkPercentages();
  }

  /**
   * Loads compliance percentages per framework.
   * Formula: pass / (pass + fail + warning) * 100
   */
  private async _loadFrameworkPercentages(): Promise<void> {
    const oViewModel = this.getModel("viewModel") as JSONModel;
    oViewModel.setProperty("/busy", true);

    try {
      // In production, this aggregates ControlEvidence results per framework.
      // Each framework's percentage = PASS count / (PASS + FAIL + WARNING) * 100
      const frameworks = ["SOX_DORA_PCI", "NERC_CIP", "CMMC_ITAR", "FEDRAMP_NIST", "PIPEDA_OSFI"];
      for (const fw of frameworks) {
        // Data will come from OData aggregation on ControlEvidence
        // Placeholder structure - actual values populated from service response
        oViewModel.setProperty(`/frameworks/${fw}/percentage`, 0);
        oViewModel.setProperty(`/frameworks/${fw}/valueColor`, "Neutral");
      }
    } finally {
      oViewModel.setProperty("/busy", false);
    }
  }

  /**
   * Computes the value color based on compliance percentage.
   */
  private _getValueColor(percentage: number): string {
    if (percentage >= 90) return "Good";
    if (percentage >= 70) return "Critical";
    return "Error";
  }

  /**
   * Handles drill-down into a specific framework's controls.
   */
  public onFrameworkDrillDown(oEvent: Event): void {
    const oTile = oEvent.getSource() as any;
    const sHeader = oTile.getHeader() as string;

    // Map header text back to framework key
    const frameworkMap: Record<string, string> = {
      "SOX / DORA / PCI": "SOX_DORA_PCI",
      "NERC CIP": "NERC_CIP",
      "CMMC / ITAR": "CMMC_ITAR",
      "FedRAMP / NIST": "FEDRAMP_NIST",
      "PIPEDA / OSFI": "PIPEDA_OSFI"
    };

    const sFrameworkKey = frameworkMap[sHeader] || "";
    this._filterControlsByFramework(sFrameworkKey);

    // Switch to controls tab
    const oTabBar = this.byId("complianceTabBar") as any;
    if (oTabBar) {
      oTabBar.setSelectedKey("controls");
    }
  }

  /**
   * Handles framework selection change in controls view.
   */
  public onFrameworkChange(oEvent: Event): void {
    const sKey = (oEvent.getParameter("selectedItem") as any)?.getKey() || "";
    this._filterControlsByFramework(sKey);
  }

  /**
   * Filters the controls table by compliance pack.
   */
  private _filterControlsByFramework(sFrameworkKey: string): void {
    const oTable = this.byId("controlsTable") as any;
    if (oTable) {
      const oBinding = oTable.getBinding("items") as ODataListBinding;
      if (oBinding) {
        const aFilters = sFrameworkKey
          ? [new Filter("compliancePack", FilterOperator.EQ, sFrameworkKey)]
          : [];
        oBinding.filter(aFilters);
      }
    }
  }

  /**
   * Handles control search.
   */
  public onControlSearch(oEvent: Event): void {
    const sQuery = (oEvent.getParameter("query") as string) || "";
    const oTable = this.byId("controlsTable") as any;
    if (oTable) {
      const oBinding = oTable.getBinding("items") as ODataListBinding;
      if (oBinding) {
        const aFilters = sQuery
          ? [new Filter({
              filters: [
                new Filter("controlId", FilterOperator.Contains, sQuery),
                new Filter("name", FilterOperator.Contains, sQuery)
              ],
              and: false
            })]
          : [];
        oBinding.filter(aFilters);
      }
    }
  }

  /**
   * Handles navigation to control detail (evidence).
   */
  public onControlPress(oEvent: Event): void {
    // Navigate to control evidence detail or show in dialog
    const oItem = oEvent.getSource() as any;
    const oContext = oItem.getBindingContext("auditor");
    if (oContext) {
      // Could open a dialog showing ControlEvidence for this control
    }
  }

  public onRefresh(): void {
    this._loadFrameworkPercentages();
    const oTable = this.byId("controlsTable") as any;
    if (oTable) {
      const oBinding = oTable.getBinding("items") as ODataListBinding;
      if (oBinding) {
        oBinding.refresh();
      }
    }
  }
}
