import JSONModel from "sap/ui/model/json/JSONModel";
import Device from "sap/ui/Device";

/**
 * Model factory for the Risk Intelligence Dashboard.
 */
const models = {
  /**
   * Creates a device model with responsive design information.
   */
  createDeviceModel(): JSONModel {
    return new JSONModel(Device, true);
  }
};

export default models;
