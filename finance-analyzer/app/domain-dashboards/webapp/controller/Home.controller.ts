import BaseController from "./BaseController";

/**
 * Home controller - navigation hub for all domain dashboard views.
 */
export default class HomeController extends BaseController {
  public onNavToSoDViolations(): void {
    this.getRouter().navTo("sodViolations");
  }

  public onNavToVendorMonitoring(): void {
    this.getRouter().navTo("vendorMonitoring");
  }

  public onNavToBehavioralProfiles(): void {
    this.getRouter().navTo("behavioralProfiles");
  }

  public onNavToIAMHeatmap(): void {
    this.getRouter().navTo("iamHeatmap");
  }

  public onNavToCompliance(): void {
    this.getRouter().navTo("complianceDashboard");
  }

  public onNavToP2PCompliance(): void {
    this.getRouter().navTo("p2pCompliance");
  }

  public onNavToInsiderThreat(): void {
    this.getRouter().navTo("insiderThreat");
  }

  public onNavToVulnerability(): void {
    this.getRouter().navTo("vulnerabilityManagement");
  }

  public onNavToEventHealth(): void {
    this.getRouter().navTo("eventProcessingHealth");
  }

  public onNavToPrivacy(): void {
    this.getRouter().navTo("privacyImpact");
  }
}
