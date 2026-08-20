import JSONModel from "sap/ui/model/json/JSONModel";
import ODataModel from "sap/ui/model/odata/v4/ODataModel";
import ODataListBinding from "sap/ui/model/odata/v4/ODataListBinding";
import MessageBox from "sap/m/MessageBox";
import MessageToast from "sap/m/MessageToast";
import Dialog from "sap/m/Dialog";
import Button from "sap/m/Button";
import TextArea from "sap/m/TextArea";
import Select from "sap/m/Select";
import Label from "sap/m/Label";
import VBox from "sap/m/VBox";
import Input from "sap/m/Input";
import BaseController from "./BaseController";

/**
 * Investigation Workflow Controller
 * Manages investigation state transitions, notes, evidence, and resolution workflow.
 *
 * Valid transitions per Requirement 9.4:
 * - OPEN → IN_PROGRESS, ESCALATED
 * - IN_PROGRESS → ESCALATED, RESOLVED_TRUE_POSITIVE, RESOLVED_FALSE_POSITIVE
 * - ESCALATED → IN_PROGRESS, RESOLVED_TRUE_POSITIVE, RESOLVED_FALSE_POSITIVE
 *
 * Resolution requires mandatory notes (1-5000 chars).
 *
 * @namespace finsecure.ai.alertsinvestigations.controller
 */
export default class InvestigationWorkflow extends BaseController {
  private _investigationId: string = "";
  private _addNoteDialog: Dialog | null = null;
  private _addEvidenceDialog: Dialog | null = null;
  private _resolutionDialog: Dialog | null = null;

  /**
   * Valid state transitions map per Requirement 9.4
   */
  private static readonly VALID_TRANSITIONS: Record<string, string[]> = {
    "OPEN": ["IN_PROGRESS", "ESCALATED"],
    "IN_PROGRESS": ["ESCALATED", "RESOLVED_TRUE_POSITIVE", "RESOLVED_FALSE_POSITIVE"],
    "ESCALATED": ["IN_PROGRESS", "RESOLVED_TRUE_POSITIVE", "RESOLVED_FALSE_POSITIVE"]
  };

  public onInit(): void {
    // Workflow state model for process flow visualization
    const workflowStateModel = new JSONModel({
      openState: "Neutral",
      inProgressState: "Neutral",
      escalatedState: "Neutral",
      resolvedState: "Neutral"
    });
    this.getView()!.setModel(workflowStateModel, "workflowState");

    // Register route matched handler
    this.getRouter()
      .getRoute("InvestigationWorkflow")!
      .attachPatternMatched(this._onInvestigationMatched, this);
  }

  /**
   * Route pattern matched handler - loads investigation data
   */
  private async _onInvestigationMatched(event: any): Promise<void> {
    this._investigationId = event.getParameter("arguments").investigationId;

    // Bind the view to the specific investigation
    const path = `/Investigations('${this._investigationId}')`;
    this.getView()!.bindElement({
      path,
      parameters: {
        $expand: "notes,evidence"
      }
    });

    // Update process flow visualization
    await this._updateWorkflowState();
  }

  /**
   * Updates the process flow node states based on current investigation status
   */
  private async _updateWorkflowState(): Promise<void> {
    const model = this.getView()!.getModel() as ODataModel;
    const workflowModel = this.getView()!.getModel("workflowState") as JSONModel;

    try {
      const binding = model.bindContext(`/Investigations('${this._investigationId}')`);
      const data = await binding.requestObject();
      const status = data?.status || "OPEN";

      // ProcessFlowNodeState values: Positive, Negative, Neutral, Planned, Critical
      const states: Record<string, string> = {
        openState: "Neutral",
        inProgressState: "Neutral",
        escalatedState: "Neutral",
        resolvedState: "Neutral"
      };

      switch (status) {
        case "OPEN":
          states.openState = "Positive";
          states.inProgressState = "Planned";
          states.escalatedState = "Planned";
          states.resolvedState = "Planned";
          break;
        case "IN_PROGRESS":
          states.openState = "Positive";
          states.inProgressState = "Positive";
          states.escalatedState = "Planned";
          states.resolvedState = "Planned";
          break;
        case "ESCALATED":
          states.openState = "Positive";
          states.inProgressState = "Positive";
          states.escalatedState = "Critical";
          states.resolvedState = "Planned";
          break;
        case "RESOLVED_TRUE_POSITIVE":
        case "RESOLVED_FALSE_POSITIVE":
          states.openState = "Positive";
          states.inProgressState = "Positive";
          states.resolvedState = "Positive";
          break;
      }

      workflowModel.setData(states);
    } catch (err) {
      console.error("Failed to update workflow state:", err);
    }
  }

  /**
   * Validates whether a state transition is permitted per Requirement 9.4
   */
  private _isValidTransition(currentState: string, targetState: string): boolean {
    const validTargets = InvestigationWorkflow.VALID_TRANSITIONS[currentState];
    return validTargets ? validTargets.includes(targetState) : false;
  }

  /**
   * Performs a state transition on the investigation
   */
  private async _performTransition(targetState: string): Promise<void> {
    const model = this.getView()!.getModel() as ODataModel;

    try {
      const binding = model.bindContext(`/Investigations('${this._investigationId}')`);
      const data = await binding.requestObject();
      const currentState = data?.status;

      // Validate transition per Requirement 9.4
      if (!this._isValidTransition(currentState, targetState)) {
        const validTargets = InvestigationWorkflow.VALID_TRANSITIONS[currentState] || [];
        MessageBox.error(
          `Invalid state transition from "${this.formatter.statusLabel(currentState)}" to "${this.formatter.statusLabel(targetState)}". ` +
          `Permitted transitions: ${validTargets.map((s: string) => this.formatter.statusLabel(s)).join(", ")}.`
        );
        return;
      }

      // Update the investigation status
      const context = this.getView()!.getBindingContext();
      if (context) {
        (context as any).setProperty("status", targetState);

        // If transitioning to IN_PROGRESS, set startedAt if not already set
        if (targetState === "IN_PROGRESS" && !data.startedAt) {
          (context as any).setProperty("startedAt", new Date().toISOString());
        }

        await model.submitBatch(model.getUpdateGroupId());
        MessageToast.show(`Investigation transitioned to ${this.formatter.statusLabel(targetState)}`);
        await this._updateWorkflowState();
      }
    } catch (err) {
      console.error("Failed to perform transition:", err);
      MessageBox.error("Failed to update investigation status. Please try again.");
    }
  }

  /**
   * Transition to IN_PROGRESS state
   */
  public onTransitionToInProgress(): void {
    this._performTransition("IN_PROGRESS");
  }

  /**
   * Transition to ESCALATED state
   */
  public onTransitionToEscalated(): void {
    MessageBox.confirm(
      "Are you sure you want to escalate this investigation? This will notify the escalation contact.",
      {
        title: "Confirm Escalation",
        onClose: (action: string) => {
          if (action === MessageBox.Action.OK) {
            this._performTransition("ESCALATED");
          }
        }
      }
    );
  }

  /**
   * Opens the resolution dialog for resolving an investigation.
   * Resolution requires type (true positive / false positive) and mandatory notes (1-5000 chars).
   */
  public onOpenResolutionDialog(): void {
    if (!this._resolutionDialog) {
      const resolutionSelect = new Select("resolutionTypeSelect", {
        width: "100%",
        items: [
          new sap.ui.core.Item({ key: "RESOLVED_TRUE_POSITIVE", text: "True Positive - Confirmed Threat" }),
          new sap.ui.core.Item({ key: "RESOLVED_FALSE_POSITIVE", text: "False Positive - Not a Threat" })
        ]
      });

      const resolutionNotes = new TextArea("resolutionNotesArea", {
        placeholder: "Enter resolution notes (required, 1-5000 characters)...",
        rows: 6,
        width: "100%",
        maxLength: 5000,
        valueLiveUpdate: true,
        liveChange: (event: any) => {
          const value = event.getParameter("value") || "";
          const charCount = value.length;
          const label = sap.ui.getCore().byId("resolutionCharCount") as Label;
          if (label) {
            label.setText(`Characters: ${charCount}/5000`);
          }
        }
      });

      const charCountLabel = new Label("resolutionCharCount", {
        text: "Characters: 0/5000"
      });

      this._resolutionDialog = new Dialog("resolutionDialog", {
        title: "{i18n>resolutionDialog}",
        type: "Message",
        contentWidth: "500px",
        content: [
          new VBox({
            items: [
              new Label({ text: "{i18n>resolutionType}", required: true }),
              resolutionSelect,
              new Label({ text: "{i18n>resolutionNotes}", required: true, labelFor: "resolutionNotesArea" }),
              resolutionNotes,
              charCountLabel
            ]
          }).addStyleClass("sapUiSmallMargin")
        ],
        beginButton: new Button({
          text: "{i18n>confirm}",
          type: "Emphasized",
          press: () => this._onConfirmResolution()
        }),
        endButton: new Button({
          text: "{i18n>cancel}",
          press: () => this._resolutionDialog!.close()
        })
      });

      this.getView()!.addDependent(this._resolutionDialog);
    }

    // Reset fields
    const notesArea = sap.ui.getCore().byId("resolutionNotesArea") as TextArea;
    if (notesArea) {
      notesArea.setValue("");
    }
    const charLabel = sap.ui.getCore().byId("resolutionCharCount") as Label;
    if (charLabel) {
      charLabel.setText("Characters: 0/5000");
    }

    this._resolutionDialog.open();
  }

  /**
   * Confirms the resolution - validates notes length (1-5000 chars mandatory)
   */
  private async _onConfirmResolution(): Promise<void> {
    const resolutionType = (sap.ui.getCore().byId("resolutionTypeSelect") as Select).getSelectedKey();
    const notes = (sap.ui.getCore().byId("resolutionNotesArea") as TextArea).getValue().trim();

    // Validate mandatory notes (1-5000 characters)
    if (!notes || notes.length < 1 || notes.length > 5000) {
      MessageBox.error("Resolution notes are required and must be between 1 and 5000 characters.");
      return;
    }

    this._resolutionDialog!.close();

    try {
      await this._performTransition(resolutionType);

      // Add resolution note as an investigation note
      const model = this.getView()!.getModel() as ODataModel;
      const notesBinding = model.bindList(`/Investigations('${this._investigationId}')/notes`) as ODataListBinding;
      notesBinding.create({
        content: `[RESOLUTION - ${resolutionType === "RESOLVED_TRUE_POSITIVE" ? "True Positive" : "False Positive"}] ${notes}`,
        author: "Current User",
        noteType: "RESOLUTION"
      });
      await model.submitBatch(model.getUpdateGroupId());

      MessageToast.show("Investigation resolved successfully.");
    } catch (err) {
      console.error("Failed to resolve investigation:", err);
      MessageBox.error("Failed to resolve investigation. Please try again.");
    }
  }

  /**
   * Opens the Add Note dialog
   */
  public onOpenAddNoteDialog(): void {
    if (!this._addNoteDialog) {
      const noteTextArea = new TextArea("noteContentArea", {
        placeholder: "Enter investigation note...",
        rows: 5,
        width: "100%",
        maxLength: 5000,
        valueLiveUpdate: true,
        liveChange: (event: any) => {
          const value = event.getParameter("value") || "";
          const label = sap.ui.getCore().byId("noteCharCount") as Label;
          if (label) {
            label.setText(`Characters: ${value.length}/5000`);
          }
        }
      });

      const charLabel = new Label("noteCharCount", {
        text: "Characters: 0/5000"
      });

      this._addNoteDialog = new Dialog("addNoteDialog", {
        title: "{i18n>addNote}",
        type: "Message",
        contentWidth: "450px",
        content: [
          new VBox({
            items: [
              new Label({ text: "{i18n>noteContent}", required: true }),
              noteTextArea,
              charLabel
            ]
          }).addStyleClass("sapUiSmallMargin")
        ],
        beginButton: new Button({
          text: "{i18n>save}",
          type: "Emphasized",
          press: () => this._onSaveNote()
        }),
        endButton: new Button({
          text: "{i18n>cancel}",
          press: () => this._addNoteDialog!.close()
        })
      });

      this.getView()!.addDependent(this._addNoteDialog);
    }

    // Reset
    const noteArea = sap.ui.getCore().byId("noteContentArea") as TextArea;
    if (noteArea) {
      noteArea.setValue("");
    }
    const charLabel = sap.ui.getCore().byId("noteCharCount") as Label;
    if (charLabel) {
      charLabel.setText("Characters: 0/5000");
    }

    this._addNoteDialog.open();
  }

  /**
   * Saves a new investigation note (1-5000 chars)
   */
  private async _onSaveNote(): Promise<void> {
    const noteContent = (sap.ui.getCore().byId("noteContentArea") as TextArea).getValue().trim();

    if (!noteContent || noteContent.length < 1) {
      MessageBox.error("Note content is required (minimum 1 character).");
      return;
    }

    if (noteContent.length > 5000) {
      MessageBox.error("Note content must not exceed 5000 characters.");
      return;
    }

    this._addNoteDialog!.close();

    try {
      const model = this.getView()!.getModel() as ODataModel;
      const notesBinding = model.bindList(`/Investigations('${this._investigationId}')/notes`) as ODataListBinding;
      notesBinding.create({
        content: noteContent,
        author: "Current User",
        noteType: "INVESTIGATION"
      });
      await model.submitBatch(model.getUpdateGroupId());

      MessageToast.show("Note added successfully.");
    } catch (err) {
      console.error("Failed to add note:", err);
      MessageBox.error("Failed to add note. Please try again.");
    }
  }

  /**
   * Opens the Add Evidence dialog
   */
  public onOpenAddEvidenceDialog(): void {
    if (!this._addEvidenceDialog) {
      const evidenceTypeSelect = new Select("evidenceTypeSelect", {
        width: "100%",
        items: [
          new sap.ui.core.Item({ key: "SCREENSHOT", text: "Screenshot" }),
          new sap.ui.core.Item({ key: "LOG_EXCERPT", text: "Log Excerpt" }),
          new sap.ui.core.Item({ key: "TRANSACTION_RECORD", text: "Transaction Record" }),
          new sap.ui.core.Item({ key: "EMAIL", text: "Email Correspondence" }),
          new sap.ui.core.Item({ key: "SYSTEM_CONFIG", text: "System Configuration" }),
          new sap.ui.core.Item({ key: "OTHER", text: "Other" })
        ]
      });

      const referenceInput = new Input("evidenceReferenceInput", {
        placeholder: "Reference ID or URL...",
        width: "100%"
      });

      const contentArea = new TextArea("evidenceContentArea", {
        placeholder: "Evidence description or content...",
        rows: 4,
        width: "100%",
        maxLength: 5000
      });

      this._addEvidenceDialog = new Dialog("addEvidenceDialog", {
        title: "{i18n>addEvidence}",
        type: "Message",
        contentWidth: "500px",
        content: [
          new VBox({
            items: [
              new Label({ text: "{i18n>evidenceType}", required: true }),
              evidenceTypeSelect,
              new Label({ text: "{i18n>evidenceReference}" }),
              referenceInput,
              new Label({ text: "{i18n>evidenceContent}", required: true }),
              contentArea
            ]
          }).addStyleClass("sapUiSmallMargin")
        ],
        beginButton: new Button({
          text: "{i18n>save}",
          type: "Emphasized",
          press: () => this._onSaveEvidence()
        }),
        endButton: new Button({
          text: "{i18n>cancel}",
          press: () => this._addEvidenceDialog!.close()
        })
      });

      this.getView()!.addDependent(this._addEvidenceDialog);
    }

    // Reset fields
    const refInput = sap.ui.getCore().byId("evidenceReferenceInput") as Input;
    if (refInput) refInput.setValue("");
    const contentArea = sap.ui.getCore().byId("evidenceContentArea") as TextArea;
    if (contentArea) contentArea.setValue("");

    this._addEvidenceDialog.open();
  }

  /**
   * Saves a new evidence item
   */
  private async _onSaveEvidence(): Promise<void> {
    const evidenceType = (sap.ui.getCore().byId("evidenceTypeSelect") as Select).getSelectedKey();
    const reference = (sap.ui.getCore().byId("evidenceReferenceInput") as Input).getValue().trim();
    const content = (sap.ui.getCore().byId("evidenceContentArea") as TextArea).getValue().trim();

    if (!content) {
      MessageBox.error("Evidence content is required.");
      return;
    }

    this._addEvidenceDialog!.close();

    try {
      const model = this.getView()!.getModel() as ODataModel;
      const evidenceBinding = model.bindList(`/Investigations('${this._investigationId}')/evidence`) as ODataListBinding;
      evidenceBinding.create({
        evidenceType: evidenceType,
        reference: reference,
        content: content
      });
      await model.submitBatch(model.getUpdateGroupId());

      MessageToast.show("Evidence added successfully.");
    } catch (err) {
      console.error("Failed to add evidence:", err);
      MessageBox.error("Failed to add evidence. Please try again.");
    }
  }

  /**
   * Handles evidence reference link press - opens in new window if URL
   */
  public onEvidenceReferencePress(event: any): void {
    const source = event.getSource();
    const reference = source.getText();
    if (reference && (reference.startsWith("http://") || reference.startsWith("https://"))) {
      window.open(reference, "_blank");
    }
  }

  /**
   * Formats elapsed time from milliseconds to human-readable string
   */
  public formatElapsedTime(elapsedMs: number): string {
    if (!elapsedMs || elapsedMs <= 0) {
      return "Not started";
    }

    const hours = Math.floor(elapsedMs / (1000 * 60 * 60));
    const minutes = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h ${minutes}m`;
    }
    return `${hours}h ${minutes}m`;
  }
}
