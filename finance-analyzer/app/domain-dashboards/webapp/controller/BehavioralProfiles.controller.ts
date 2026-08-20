import BaseController from "./BaseController";
import JSONModel from "sap/ui/model/json/JSONModel";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import ODataListBinding from "sap/ui/model/odata/v4/ODataListBinding";
import Event from "sap/ui/base/Event";

/**
 * Behavioral Profiles Controller
 * Displays user behavioral profile summaries with:
 * - Profile status, days covered, last updated
 * - Sparkline charts for deviation frequency over time
 * - Dimension breakdown (posting frequency, amounts, access patterns)
 * Requirement: 4.6
 */
export default class BehavioralProfilesController extends BaseController {
  public onInit(): void {
    const oViewModel = new JSONModel({
      busy: false,
      selectedProfile: null,
      deviationHistory: [] as Array<{ date: string; deviations: number }>
    });
    this.setModel(oViewModel, "viewModel");
    this.getRouter().getRoute("behavioralProfiles")!.attachPatternMatched(this._onRouteMatched, this);
  }

  private _onRouteMatched(): void {
    // Data loaded via OData binding
  }

  /**
   * Handles profile selection to show deviation details.
   */
  public onProfileSelect(oEvent: Event): void {
    const oItem = oEvent.getParameter("listItem") as any;
    if (oItem) {
      const oContext = oItem.getBindingContext("analyst");
      if (oContext) {
        const oProfile = oContext.getObject();
        const oViewModel = this.getModel("viewModel") as JSONModel;
        oViewModel.setProperty("/selectedProfile", oProfile);
        this._loadDeviationHistory(oProfile.userId);
      }
    }
  }

  /**
   * Loads deviation history trend data for sparkline visualization.
   */
  private _loadDeviationHistory(userId: string): void {
    // Deviation history computed from alert frequency for this user
    // In production, this would query alerts by userId grouped by date
    const oViewModel = this.getModel("viewModel") as JSONModel;
    oViewModel.setProperty("/deviationHistory", []);
  }

  /**
   * Searches profiles by user ID.
   */
  public onSearch(oEvent: Event): void {
    const sQuery = (oEvent.getParameter("query") as string) || "";
    const oTable = this.byId("profilesTable") as any;
    if (oTable) {
      const oBinding = oTable.getBinding("items") as ODataListBinding;
      if (oBinding) {
        const aFilters = sQuery
          ? [new Filter("userId", FilterOperator.Contains, sQuery)]
          : [];
        oBinding.filter(aFilters);
      }
    }
  }

  /**
   * Filters by profile status.
   */
  public onStatusFilter(oEvent: Event): void {
    const sKey = (oEvent.getParameter("selectedItem") as any)?.getKey() || "";
    const oTable = this.byId("profilesTable") as any;
    if (oTable) {
      const oBinding = oTable.getBinding("items") as ODataListBinding;
      if (oBinding) {
        const aFilters = sKey
          ? [new Filter("status", FilterOperator.EQ, sKey)]
          : [];
        oBinding.filter(aFilters);
      }
    }
  }

  public onRefresh(): void {
    const oTable = this.byId("profilesTable") as any;
    if (oTable) {
      const oBinding = oTable.getBinding("items") as ODataListBinding;
      if (oBinding) {
        oBinding.refresh();
      }
    }
  }
}
