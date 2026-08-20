import JSONModel from "sap/ui/model/json/JSONModel";
import Device from "sap/ui/Device";

/**
 * Creates a device model with browser and device information.
 */
export function createDeviceModel(): JSONModel {
  const oModel = new JSONModel(Device);
  oModel.setDefaultBindingMode("OneWay");
  return oModel;
}

export default { createDeviceModel };
