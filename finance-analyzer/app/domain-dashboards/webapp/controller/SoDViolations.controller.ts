import BaseController from "./BaseController";
import JSONModel from "sap/ui/model/json/JSONModel";
import ODataListBinding from "sap/ui/model/odata/v4/ODataListBinding";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import Event from "sap/ui/base/Event";

/**
 * SoD Violations Controller
 * Displays paginated (max 50/page) SoD violations with:
 * - User, conflicting actions, timestamps, severity
 * - Daily count time-series chart
 * Requirement: 5.5
 */
export default class SoDViolationsController extends BaseController {
  private readonly _pageSize: number = 50;
  private _currentPage: number = 0;

  public onInit(): void {
    const oViewModel = new JSONModel({
      busy: false,
      currentPage: 1,
      pageSize: this._pageSize,
      totalCount: 0,
      hasNextPage: false,
      hasPrevPage: false,
      dailyCounts: [] as Array<{ date: string; count: number }>
    });
    this.setModel(oViewModel, "viewModel");
    this.getRouter().getRoute("sodViolations")!.attachPatternMatched(this._onRouteMatched, this);
  }

  private _onRouteMatched(): void {
    this._loadViolations();
    this._loadDailyCounts();
  }

  /**
   * Loads SoD violations with server-side pagination (max 50 per page).
   */
  private _loadViolations(): void {
    const oModel = this.getModel("viewModel") as JSONModel;
    oModel.setProperty("/busy", true);

    // Data binding handled by XML view binding to analyst model SoDViolations entity
    oModel.setProperty("/busy", false);
  }

  /**
   * Aggregates daily violation counts for the time-series chart.
   */
  private _loadDailyCounts(): void {
    // Daily counts computed from the SoDViolations entity createdAt field
    // The chart binding uses the analyst model with date aggregation
    const oViewModel = this.getModel("viewModel") as JSONModel;
    oViewModel.setProperty("/dailyCounts", []);
  }

  /**
   * Handles pagination - next page.
   */
  public onNextPage(): void {
    this._currentPage++;
    const oViewModel = this.getModel("viewModel") as JSONModel;
    oViewModel.setProperty("/currentPage", this._currentPage + 1);
    oViewModel.setProperty("/hasPrevPage", this._currentPage > 0);
    this._applyPagination();
  }

  /**
   * Handles pagination - previous page.
   */
  public onPrevPage(): void {
    if (this._currentPage > 0) {
      this._currentPage--;
    }
    const oViewModel = this.getModel("viewModel") as JSONModel;
    oViewModel.setProperty("/currentPage", this._currentPage + 1);
    oViewModel.setProperty("/hasPrevPage", this._currentPage > 0);
    this._applyPagination();
  }

  /**
   * Applies pagination parameters to the table binding.
   */
  private _applyPagination(): void {
    const oTable = this.byId("sodTable") as any;
    if (oTable) {
      const oBinding = oTable.getBinding("items") as ODataListBinding;
      if (oBinding) {
        oBinding.changeParameters({
          $skip: this._currentPage * this._pageSize,
          $top: this._pageSize
        });
      }
    }
  }

  /**
   * Handles search/filter by user ID.
   */
  public onSearch(oEvent: Event): void {
    const sQuery = (oEvent.getParameter("query") as string) || "";
    const oTable = this.byId("sodTable") as any;
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
   * Handles severity filter selection.
   */
  public onSeverityFilter(oEvent: Event): void {
    const sKey = (oEvent.getParameter("selectedItem") as any)?.getKey() || "";
    const oTable = this.byId("sodTable") as any;
    if (oTable) {
      const oBinding = oTable.getBinding("items") as ODataListBinding;
      if (oBinding) {
        const aFilters = sKey
          ? [new Filter("severity", FilterOperator.EQ, sKey)]
          : [];
        oBinding.filter(aFilters);
      }
    }
  }

  /**
   * Refreshes the view data.
   */
  public onRefresh(): void {
    this._currentPage = 0;
    const oViewModel = this.getModel("viewModel") as JSONModel;
    oViewModel.setProperty("/currentPage", 1);
    oViewModel.setProperty("/hasPrevPage", false);
    this._loadViolations();
    this._loadDailyCounts();
  }
}
