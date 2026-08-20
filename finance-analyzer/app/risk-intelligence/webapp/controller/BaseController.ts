import Controller from "sap/ui/core/mvc/Controller";
import UIComponent from "sap/ui/core/UIComponent";
import Router from "sap/m/routing/Router";
import Model from "sap/ui/model/Model";
import ResourceModel from "sap/ui/model/resource/ResourceModel";
import ResourceBundle from "sap/base/i18n/ResourceBundle";

/**
 * Base controller providing common helper methods for all controllers.
 */
export default abstract class BaseController extends Controller {
  /**
   * Gets the application router.
   */
  public getRouter(): Router {
    return (this.getOwnerComponent() as UIComponent).getRouter() as unknown as Router;
  }

  /**
   * Gets a model by name from the view or component.
   */
  public getModel(name?: string): Model {
    return this.getView()!.getModel(name)!;
  }

  /**
   * Sets a model on the view.
   */
  public setModel(model: Model, name?: string): void {
    this.getView()!.setModel(model, name);
  }

  /**
   * Gets the resource bundle for i18n texts.
   */
  public getResourceBundle(): ResourceBundle {
    return (this.getModel("i18n") as ResourceModel).getResourceBundle() as ResourceBundle;
  }

  /**
   * Convenience wrapper for `this.getView().byId()`.
   */
  public byId(id: string): any {
    return this.getView()!.byId(id);
  }

  /**
   * Navigates to a route.
   */
  public navTo(routeName: string, params?: object, replace?: boolean): void {
    this.getRouter().navTo(routeName, params, undefined, replace);
  }
}
