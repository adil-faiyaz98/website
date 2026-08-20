import BaseController from "./BaseController";
import JSONModel from "sap/ui/model/json/JSONModel";

/**
 * App-level controller managing the shell and navigation container.
 */
export default class AppController extends BaseController {
  public onInit(): void {
    const oViewModel = new JSONModel({
      busy: false,
      delay: 0
    });
    this.getView()!.setModel(oViewModel, "appView");
  }
}
