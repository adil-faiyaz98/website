import UIComponent from "sap/ui/core/UIComponent";
import models from "./model/models";

/**
 * Risk Intelligence Dashboard Component
 * Entry point for the Fiori Elements-based Overview Page application
 * binding to the SecurityAnalystService at /analyst path.
 */
export default class Component extends UIComponent {
  public static metadata = {
    manifest: "json",
    interfaces: ["sap.ui.core.IAsyncContentCreation"]
  };

  public init(): void {
    // Call the base component's init function
    super.init();

    // Set the device model
    this.setModel(models.createDeviceModel(), "device");

    // Create the views based on the URL/hash
    this.getRouter().initialize();
  }

  public destroy(): void {
    super.destroy();
  }
}
