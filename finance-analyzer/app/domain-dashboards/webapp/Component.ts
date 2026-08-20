import UIComponent from "sap/ui/core/UIComponent";
import { support } from "sap/ui/core/library";
import models from "./model/models";

/**
 * Domain Dashboards UI Component
 * Entry point for the FinSecure AI domain-specific dashboard views application.
 */
export default class Component extends UIComponent {
  public static metadata = {
    manifest: "json",
    interfaces: ["sap.ui.core.IAsyncContentCreation"]
  };

  public init(): void {
    // Call the base component's init function
    super.init();

    // Create the views based on the URL/hash
    this.getRouter().initialize();
  }
}
