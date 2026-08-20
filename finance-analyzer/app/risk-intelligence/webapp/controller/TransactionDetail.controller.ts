import BaseController from "./BaseController";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import formatter from "../model/formatter";

/**
 * Transaction Detail Controller
 * Provides drill-down view from dashboard summary metrics to individual transactions.
 */
export default class TransactionDetailController extends BaseController {
  public formatter = formatter;

  public onInit(): void {
    this.getRouter().getRoute("transactionDetail")?.attachPatternMatched(
      this._onRouteMatched,
      this
    );
  }

  /**
   * Handles route pattern matching to apply appropriate filters
   * based on which dashboard card triggered the drill-down.
   */
  private _onRouteMatched(event: any): void {
    const transactionId = event.getParameter("arguments").transactionId;
    this._applyDrillDownFilter(transactionId);
  }

  /**
   * Navigates back to the dashboard.
   */
  public onNavBack(): void {
    this.navTo("dashboard", {}, true);
  }

  /**
   * Handles search in the transaction table.
   */
  public onTransactionSearch(event: any): void {
    const query = event.getParameter("query");
    const table = this.byId("transactionsTable") as any;
    const binding = table?.getBinding("items");

    if (!binding) return;

    const filters: Filter[] = [];
    if (query) {
      filters.push(new Filter({
        filters: [
          new Filter("documentNumber", FilterOperator.Contains, query),
          new Filter("userId", FilterOperator.Contains, query)
        ],
        and: false
      }));
    }

    binding.filter(filters);
  }

  /**
   * Handles press on a transaction row.
   */
  public onTransactionPress(event: any): void {
    const context = event.getSource().getBindingContext();
    if (context) {
      const transactionId = context.getProperty("ID");
      // In a full implementation, this would navigate to a detailed transaction view
      // For now, we show the data in the current drill-down
      console.log("Transaction selected:", transactionId);
    }
  }

  /**
   * Applies filters based on the drill-down source (alerts, sod, fraud, etc.).
   */
  private _applyDrillDownFilter(source: string): void {
    const table = this.byId("transactionsTable") as any;
    const binding = table?.getBinding("items");

    if (!binding) return;

    const filters: Filter[] = [];
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Always filter by date range
    filters.push(new Filter("createdAt", FilterOperator.GE, thirtyDaysAgo.toISOString()));

    switch (source) {
      case "alerts":
        // Show transactions with high risk scores (related to alerts)
        filters.push(new Filter("riskScore", FilterOperator.GE, 70));
        break;
      case "sod":
        // Show transactions from users with SoD violations
        filters.push(new Filter("scored", FilterOperator.EQ, true));
        break;
      case "fraud":
        // Show transactions flagged for fraud patterns
        filters.push(new Filter("riskScore", FilterOperator.GE, 80));
        break;
      case "compliance":
        // Show all scored transactions
        filters.push(new Filter("scored", FilterOperator.EQ, true));
        break;
      case "trends":
        // Show all transactions in the period
        break;
      default:
        // "all" - no additional filters
        break;
    }

    binding.filter(filters);
  }
}
