import BaseController from "./BaseController";
import JSONModel from "sap/ui/model/json/JSONModel";

/**
 * App controller - root controller for the domain dashboards application.
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
