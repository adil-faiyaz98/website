import BaseController from "./BaseController";
import JSONModel from "sap/ui/model/json/JSONModel";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import ODataListBinding from "sap/ui/model/odata/v4/ODataListBinding";
import Event from "sap/ui/base/Event";

/**
 * Insider Threat Controller
 * Displays insider threat risk score per user:
 * - User list sorted by composite threat score (0-100)
 * - Dimension breakdown showing contributing risk factors
 * - Color-coded severity indicators
 * Requirement: 21.6
 */
export default class InsiderThreatController extends BaseController {
  public onInit(): void {
    const oViewModel = new JSONModel({
      busy: false,
      users: [] as Array<{
        userId: string;
        compositeScore: number;
        dimensions: {
          accessAnomaly: number;
          behavioralDeviation: number;
          dataExfiltration: number;
          privilegeAbuse: number;
          policyViolation: number;
        };
        lastActivity: string;
        status: string;
      }>,
      selectedUser: null
    });
    this.setModel(oViewModel, "viewModel");
    this.getRouter().getRoute("insiderThreat")!.attachPatternMatched(this._onRouteMatched, this);
  }

  private _onRouteMatched(): void {
    this._loadInsiderThreatScores();
  }

  /**
   * Loads composite insider threat scores per user.
   * Score is computed from multiple dimensions:
   * - Access anomaly patterns
   * - Behavioral deviations from baseline
   * - Data exfiltration indicators
   * - Privilege abuse patterns
   * - Policy violation history
   */
  private async _loadInsiderThreatScores(): Promise<void> {
    const oViewModel = this.getModel("viewModel") as JSONModel;
    oViewModel.setProperty("/busy", true);

    try {
      // In production, this aggregates from BehavioralProfiles and Alerts
      // The composite score combines multiple risk dimensions
      oViewModel.setProperty("/users", []);
    } finally {
      oViewModel.setProperty("/busy", false);
    }
  }

  /**
   * Handles user selection to show dimension breakdown.
   */
  public onUserSelect(oEvent: Event): void {
    const oItem = oEvent.getParameter("listItem") as any;
    if (oItem) {
      const oContext = oItem.getBindingContext("viewModel");
      if (oContext) {
        const oUser = oContext.getObject();
        const oViewModel = this.getModel("viewModel") as JSONModel;
        oViewModel.setProperty("/selectedUser", oUser);
      }
    }
  }

  /**
   * Search by user ID.
   */
  public onSearch(oEvent: Event): void {
    const sQuery = (oEvent.getParameter("query") as string) || "";
    const oTable = this.byId("threatTable") as any;
    if (oTable) {
      const oBinding = oTable.getBinding("items");
      if (oBinding) {
        const aFilters = sQuery
          ? [new Filter("userId", FilterOperator.Contains, sQuery)]
          : [];
        (oBinding as any).filter(aFilters);
      }
    }
  }

  /**
   * Sorts the user list by threat score descending.
   */
  public onSortByScore(): void {
    const oViewModel = this.getModel("viewModel") as JSONModel;
    const aUsers = oViewModel.getProperty("/users") as any[];
    aUsers.sort((a: any, b: any) => b.compositeScore - a.compositeScore);
    oViewModel.setProperty("/users", [...aUsers]);
  }

  public onRefresh(): void {
    this._loadInsiderThreatScores();
  }
}
