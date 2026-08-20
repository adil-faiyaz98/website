import Controller from "sap/ui/core/mvc/Controller";
import UIComponent from "sap/ui/core/UIComponent";
import Router from "sap/m/routing/Router";
import Model from "sap/ui/model/Model";
import ResourceModel from "sap/ui/model/resource/ResourceModel";
import ResourceBundle from "sap/base/i18n/ResourceBundle";
import formatter from "../model/formatter";

/**
 * Base controller providing common navigation and model access utilities.
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
   * Gets a model by name from the component.
   */
  public getModel(sName?: string): Model {
    return this.getView()!.getModel(sName)!;
  }

  /**
   * Sets a model on the view.
   */
  public setModel(oModel: Model, sName?: string): void {
    this.getView()!.setModel(oModel, sName);
  }

  /**
   * Gets the resource bundle for i18n.
   */
  public getResourceBundle(): ResourceBundle {
    return (this.getModel("i18n") as ResourceModel).getResourceBundle() as ResourceBundle;
  }

  /**
   * Navigates back to the home view.
   */
  public onNavBack(): void {
    this.getRouter().navTo("home");
  }
}
