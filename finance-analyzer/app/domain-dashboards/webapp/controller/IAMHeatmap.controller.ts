import BaseController from "./BaseController";
import JSONModel from "sap/ui/model/json/JSONModel";

/**
 * IAM Heatmap Controller
 * Displays a grid/matrix showing users vs privilege categories with risk score color intensity.
 * - Users on one axis, privilege categories on the other
 * - Color intensity based on risk score (red >= 80, orange >= 60, yellow >= 40)
 * Requirement: 14.3
 */
export default class IAMHeatmapController extends BaseController {
  public onInit(): void {
    const oViewModel = new JSONModel({
      busy: false,
      heatmapData: [] as Array<{
        userId: string;
        category: string;
        riskScore: number;
      }>
    });
    this.setModel(oViewModel, "viewModel");
    this.getRouter().getRoute("iamHeatmap")!.attachPatternMatched(this._onRouteMatched, this);
  }

  private _onRouteMatched(): void {
    this._loadHeatmapData();
  }

  /**
   * Loads heatmap data by computing privilege risk scores per user per category.
   * Combines data from BehavioralProfiles and Alert patterns.
   */
  private async _loadHeatmapData(): Promise<void> {
    const oViewModel = this.getModel("viewModel") as JSONModel;
    oViewModel.setProperty("/busy", true);

    try {
      // Privilege categories for IAM risk assessment
      const categories = [
        "Transaction Execution",
        "Master Data Maintenance",
        "Configuration Access",
        "Debug/Replace Access",
        "Firefighter Usage",
        "Cross-System Access",
        "Sensitive Data Read",
        "User Administration"
      ];

      // In production, this data comes from IAM service aggregation.
      // The heatmap is populated from BehavioralProfiles + AccessReviewTasks
      // The OData model will provide this data via a custom view/function import
      oViewModel.setProperty("/heatmapData", []);
    } finally {
      oViewModel.setProperty("/busy", false);
    }
  }

  /**
   * Refreshes the heatmap data.
   */
  public onRefresh(): void {
    this._loadHeatmapData();
  }
}
