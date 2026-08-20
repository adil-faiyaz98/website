import JSONModel from "sap/ui/model/json/JSONModel";
import ODataModel from "sap/ui/model/odata/v4/ODataModel";
import ODataListBinding from "sap/ui/model/odata/v4/ODataListBinding";
import MessageBox from "sap/m/MessageBox";
import MessageToast from "sap/m/MessageToast";
import Dialog from "sap/m/Dialog";
import Button from "sap/m/Button";
import TextArea from "sap/m/TextArea";
import Label from "sap/m/Label";
import VBox from "sap/m/VBox";
import Table from "sap/m/Table";
import BaseController from "./BaseController";

/**
 * Access Review Controller
 * Provides the reviewer interface for access review campaigns.
 *
 * Implements Requirement 30.3:
 * - Reviewer decisions: approve (with justification min 10 chars for high-risk), revoke, flag
 * - Campaign listing and task review interface
 * - Bulk decision support
 *
 * @namespace finsecure.ai.alertsinvestigations.controller
 */
export default class AccessReview extends BaseController {
  private _justificationDialog: Dialog | null = null;
  private _pendingDecision: { context: any; decision: string; isHighRisk: boolean } | null = null;

  public onInit(): void {
    // Access review state model
    const accessReviewModel = new JSONModel({
      tasksPanelVisible: false,
      bulkEnabled: false,
      selectedCampaignId: "",
      selectedTaskCount: 0
    });
    this.getView()!.setModel(accessReviewModel, "accessReview");

    // Register route matched handler
    this.getRouter()
      .getRoute("AccessReview")!
      .attachPatternMatched(this._onRouteMatched, this);
  }

  /**
   * Route pattern matched - refresh data
   */
  private _onRouteMatched(): void {
    // Refresh campaigns list on navigation
    const table = this.byId("campaignTable") as Table;
    if (table) {
      const binding = table.getBinding("items") as ODataListBinding;
      if (binding) {
        binding.refresh();
      }
    }
  }

  /**
   * Handles campaign selection - shows tasks panel
   */
  public onCampaignSelect(event: any): void {
    const item = event.getParameter("listItem");
    if (item) {
      const context = item.getBindingContext("iam");
      const campaignId = context.getProperty("ID");

      const accessReviewModel = this.getView()!.getModel("accessReview") as JSONModel;
      accessReviewModel.setProperty("/tasksPanelVisible", true);
      accessReviewModel.setProperty("/selectedCampaignId", campaignId);
    }
  }

  /**
   * Handles campaign press for navigation
   */
  public onCampaignPress(event: any): void {
    const item = event.getSource();
    const context = item.getBindingContext("iam");
    const campaignId = context.getProperty("ID");

    const accessReviewModel = this.getView()!.getModel("accessReview") as JSONModel;
    accessReviewModel.setProperty("/tasksPanelVisible", true);
    accessReviewModel.setProperty("/selectedCampaignId", campaignId);
  }

  /**
   * Handles task selection change for bulk actions
   */
  public onTaskSelectionChange(event: any): void {
    const table = event.getSource() as Table;
    const selectedItems = table.getSelectedItems();
    const accessReviewModel = this.getView()!.getModel("accessReview") as JSONModel;
    accessReviewModel.setProperty("/bulkEnabled", selectedItems.length > 0);
    accessReviewModel.setProperty("/selectedTaskCount", selectedItems.length);
  }

  /**
   * Approve task - requires justification for high-risk (min 10 chars per Req 30.3)
   */
  public onApproveTask(event: any): void {
    const item = event.getSource().getParent().getParent(); // HBox → cells → ColumnListItem
    const context = item.getBindingContext("iam");
    const isHighRisk = this._isHighRiskTask(context);

    if (isHighRisk) {
      // High-risk approval requires justification (min 10 chars)
      this._pendingDecision = { context, decision: "APPROVE", isHighRisk: true };
      this._openJustificationDialog(true);
    } else {
      // Low/medium risk can be approved with optional justification
      this._pendingDecision = { context, decision: "APPROVE", isHighRisk: false };
      this._openJustificationDialog(false);
    }
  }

  /**
   * Revoke task access
   */
  public onRevokeTask(event: any): void {
    const item = event.getSource().getParent().getParent();
    const context = item.getBindingContext("iam");

    this._pendingDecision = { context, decision: "REVOKE", isHighRisk: false };
    this._applyDecision("REVOKE", "Access revoked", context);
  }

  /**
   * Flag task for further review
   */
  public onFlagTask(event: any): void {
    const item = event.getSource().getParent().getParent();
    const context = item.getBindingContext("iam");

    this._pendingDecision = { context, decision: "FLAG_FOR_REVIEW", isHighRisk: false };
    this._applyDecision("FLAG_FOR_REVIEW", "Flagged for review", context);
  }

  /**
   * Handles bulk decision actions
   */
  public onBulkDecision(event: any): void {
    const source = event.getSource();
    const sourceId = source.getId();
    let decision: string;

    if (sourceId.includes("BulkApprove")) {
      decision = "APPROVE";
    } else if (sourceId.includes("BulkRevoke")) {
      decision = "REVOKE";
    } else {
      decision = "FLAG_FOR_REVIEW";
    }

    const table = this.byId("taskTable") as Table;
    const selectedItems = table.getSelectedItems();
    const count = selectedItems.length;

    if (count === 0) return;

    MessageBox.confirm(
      `Apply "${this.formatter.reviewDecisionLabel(decision)}" to ${count} selected items?`,
      {
        title: "Confirm Bulk Decision",
        onClose: (action: string) => {
          if (action === MessageBox.Action.OK) {
            if (decision === "APPROVE") {
              // For bulk approve, check if any are high-risk
              const hasHighRisk = selectedItems.some((item: any) => {
                const ctx = item.getBindingContext("iam");
                return this._isHighRiskTask(ctx);
              });

              if (hasHighRisk) {
                this._pendingDecision = { context: selectedItems, decision: "APPROVE", isHighRisk: true };
                this._openJustificationDialog(true);
              } else {
                this._applyBulkDecision(decision, "", selectedItems);
              }
            } else {
              this._applyBulkDecision(decision, "", selectedItems);
            }
          }
        }
      }
    );
  }

  /**
   * Determines if a task is high-risk based on roles or context
   */
  private _isHighRiskTask(context: any): boolean {
    if (!context) return false;
    const roles = context.getProperty("roles") || "";
    // High-risk if roles contain admin, privileged, or critical keywords
    const highRiskKeywords = ["admin", "privileged", "critical", "finance", "security", "root"];
    return highRiskKeywords.some(keyword => roles.toLowerCase().includes(keyword));
  }

  /**
   * Opens justification dialog for approve decisions.
   * For high-risk: min 10 characters required per Req 30.3.
   */
  private _openJustificationDialog(isHighRisk: boolean): void {
    if (!this._justificationDialog) {
      const justificationArea = new TextArea("justificationTextArea", {
        placeholder: "Enter justification...",
        rows: 4,
        width: "100%",
        maxLength: 500,
        valueLiveUpdate: true,
        liveChange: (event: any) => {
          const value = event.getParameter("value") || "";
          const label = sap.ui.getCore().byId("justificationCharCount") as Label;
          if (label) {
            label.setText(`Characters: ${value.length}/500`);
          }
        }
      });

      const charLabel = new Label("justificationCharCount", {
        text: "Characters: 0/500"
      });

      const infoLabel = new Label("justificationInfoLabel", {
        text: ""
      });

      this._justificationDialog = new Dialog("justificationDialog", {
        title: "Justification Required",
        type: "Message",
        contentWidth: "450px",
        content: [
          new VBox({
            items: [
              infoLabel,
              new Label({ text: "{i18n>taskJustification}", required: true }),
              justificationArea,
              charLabel
            ]
          }).addStyleClass("sapUiSmallMargin")
        ],
        beginButton: new Button({
          text: "{i18n>confirm}",
          type: "Emphasized",
          press: () => this._onConfirmJustification()
        }),
        endButton: new Button({
          text: "{i18n>cancel}",
          press: () => {
            this._justificationDialog!.close();
            this._pendingDecision = null;
          }
        })
      });

      this.getView()!.addDependent(this._justificationDialog);
    }

    // Update info label based on risk level
    const infoLabel = sap.ui.getCore().byId("justificationInfoLabel") as Label;
    if (infoLabel) {
      infoLabel.setText(
        isHighRisk
          ? "High-risk approval: justification required (minimum 10 characters)"
          : "Please provide justification for approval"
      );
    }

    // Reset
    const justArea = sap.ui.getCore().byId("justificationTextArea") as TextArea;
    if (justArea) justArea.setValue("");
    const charLabel = sap.ui.getCore().byId("justificationCharCount") as Label;
    if (charLabel) charLabel.setText("Characters: 0/500");

    this._justificationDialog.open();
  }

  /**
   * Confirms justification and applies the pending decision.
   * Validates min 10 chars for high-risk per Req 30.3.
   */
  private _onConfirmJustification(): void {
    const justification = (sap.ui.getCore().byId("justificationTextArea") as TextArea).getValue().trim();

    if (!this._pendingDecision) return;

    // Validate: high-risk requires min 10 chars
    if (this._pendingDecision.isHighRisk && justification.length < 10) {
      MessageBox.error("Justification must be at least 10 characters for high-risk approvals.");
      return;
    }

    this._justificationDialog!.close();

    if (Array.isArray(this._pendingDecision.context)) {
      // Bulk decision
      this._applyBulkDecision("APPROVE", justification, this._pendingDecision.context);
    } else {
      // Single task decision
      this._applyDecision("APPROVE", justification, this._pendingDecision.context);
    }

    this._pendingDecision = null;
  }

  /**
   * Applies a decision to a single task
   */
  private async _applyDecision(decision: string, justification: string, context: any): Promise<void> {
    try {
      context.setProperty("decision", decision);
      if (justification) {
        context.setProperty("justification", justification);
      }
      context.setProperty("completedAt", new Date().toISOString());

      const iamModel = this.getView()!.getModel("iam") as ODataModel;
      await iamModel.submitBatch(iamModel.getUpdateGroupId());

      MessageToast.show(`Decision applied: ${this.formatter.reviewDecisionLabel(decision)}`);
    } catch (err) {
      console.error("Failed to apply decision:", err);
      MessageBox.error("Failed to apply decision. Please try again.");
    }
  }

  /**
   * Applies a decision to multiple selected tasks
   */
  private async _applyBulkDecision(decision: string, justification: string, selectedItems: any[]): Promise<void> {
    try {
      selectedItems.forEach((item: any) => {
        const context = item.getBindingContext("iam");
        if (context) {
          context.setProperty("decision", decision);
          if (justification) {
            context.setProperty("justification", justification);
          }
          context.setProperty("completedAt", new Date().toISOString());
        }
      });

      const iamModel = this.getView()!.getModel("iam") as ODataModel;
      await iamModel.submitBatch(iamModel.getUpdateGroupId());

      MessageToast.show(`Bulk decision applied to ${selectedItems.length} items: ${this.formatter.reviewDecisionLabel(decision)}`);

      // Clear selection
      const table = this.byId("taskTable") as Table;
      if (table) {
        table.removeSelections(true);
      }
      const accessReviewModel = this.getView()!.getModel("accessReview") as JSONModel;
      accessReviewModel.setProperty("/bulkEnabled", false);
      accessReviewModel.setProperty("/selectedTaskCount", 0);
    } catch (err) {
      console.error("Failed to apply bulk decision:", err);
      MessageBox.error("Failed to apply bulk decision. Please try again.");
    }
  }

  /**
   * Refreshes the campaigns list
   */
  public onRefresh(): void {
    const table = this.byId("campaignTable") as Table;
    if (table) {
      const binding = table.getBinding("items") as ODataListBinding;
      if (binding) {
        binding.refresh();
      }
    }
  }
}
