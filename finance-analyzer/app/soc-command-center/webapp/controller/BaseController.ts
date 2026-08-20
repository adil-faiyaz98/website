import Controller from "sap/ui/core/mvc/Controller";
import UIComponent from "sap/ui/core/UIComponent";
import Router from "sap/m/routing/Router";
import Model from "sap/ui/model/Model";
import ResourceModel from "sap/ui/model/resource/ResourceModel";
import ResourceBundle from "sap/base/i18n/ResourceBundle";
import formatter from "../model/formatter";

/**
 * Base controller providing common helper methods for all SOC Command Center controllers.
 * Centralizes router access, model retrieval, and navigation utilities.
 */
export default abstract class BaseController extends Controller {
  public formatter = formatter;

  /**
   * Gets the application router instance.
   */
  public getRouter(): Router {
    return (this.getOwnerComponent() as UIComponent).getRouter() as unknown as Router;
  }

  /**
   * Gets a model by name from the view or component.
   */
  public getModel(sName?: string): Model {
    return this.getView()!.getModel(sName) ||
      (this.getOwnerComponent() as UIComponent).getModel(sName) as Model;
  }

  /**
   * Sets a model on the view.
   */
  public setModel(oModel: Model, sName?: string): void {
    this.getView()!.setModel(oModel, sName);
  }

  /**
   * Gets the resource bundle for i18n texts.
   */
  public getResourceBundle(): ResourceBundle {
    return (this.getModel("i18n") as ResourceModel).getResourceBundle() as ResourceBundle;
  }

  /**
   * Navigates to a route by name.
   */
  public navTo(sRouteName: string, oParameters?: object, bReplace?: boolean): void {
    this.getRouter().navTo(sRouteName, oParameters, undefined, bReplace);
  }

  /**
   * Navigates back to the main command center view.
   */
  public onNavBack(): void {
    this.getRouter().navTo("main", {}, undefined, true);
  }
}
