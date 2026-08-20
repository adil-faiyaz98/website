import UIComponent from "sap/ui/core/UIComponent";

/**
 * @namespace finsecure.ai.alertsinvestigations
 */
export default class Component extends UIComponent {
  public static readonly metadata = {
    manifest: "json",
    interfaces: ["sap.ui.core.IAsyncContentCreation"]
  };

  public init(): void {
    // Call the base component's init function
    super.init();

    // Create the views based on the URL/hash
    this.getRouter().initialize();
  }

  public destroy(): void {
    // Call the base component's destroy function
    super.destroy();
  }
}
