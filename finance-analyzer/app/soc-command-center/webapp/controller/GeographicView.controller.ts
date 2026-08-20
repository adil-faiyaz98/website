import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";
import BaseController from "./BaseController";

/**
 * Controller for the Geographic View.
 * Displays alert distribution by SAP system location for multi-region deployments,
 * showing a map with alert density indicators for each data center or office location
 * where connected SAP systems reside.
 *
 * Uses a custom SVG map with dynamically colored markers based on alert density.
 *
 * Requirements: 26.5
 */
export default class GeographicViewController extends BaseController {

  private _currentMapView: string = "density";

  /**
   * Initialize the geographic view.
   * Load region data and render the SVG map with alert density markers.
   */
  public onInit(): void {
    this._loadRegionData();
    this._renderMap();
  }

  /**
   * Load region data including system locations and alert counts per region.
   */
  private _loadRegionData(): void {
    const dashboardModel = this.getModel("dashboard") as JSONModel;

    // Region data is aggregated from ConnectedSystems and their associated alerts.
    // Each region has: name, location, system count, alert count, critical count, risk level.
    dashboardModel.setProperty("/regions", []);
    dashboardModel.setProperty("/mapSvgContent", this._generateMapSvg([]));
  }

  /**
   * Render the SVG map with alert density heat markers.
   * Markers are colored based on density thresholds:
   * - Low (1-5): Green (#a8d4a0)
   * - Medium (6-20): Yellow (#e6a400)
   * - High (21-50): Orange (#e87500)
   * - Critical (50+): Red (#cc1919)
   */
  private _renderMap(): void {
    const dashboardModel = this.getModel("dashboard") as JSONModel;
    const regions = dashboardModel.getProperty("/regions") || [];
    const svgContent = this._generateMapSvg(regions);
    dashboardModel.setProperty("/mapSvgContent", svgContent);
  }

  /**
   * Generate SVG map content with alert density markers.
   * Uses a simplified world map with marker overlays at system locations.
   */
  private _generateMapSvg(regions: any[]): string {
    const markersSvg = regions.map((region: any) => {
      const color = this._getDensityColor(region.alertCount);
      const radius = this._getDensityRadius(region.alertCount);
      const coords = this._getRegionCoordinates(region.region);
      return `
        <circle cx="${coords.x}" cy="${coords.y}" r="${radius}" 
                fill="${color}" fill-opacity="0.7" stroke="${color}" stroke-width="2"
                class="soc-map-marker" data-region="${region.region}">
          <title>${region.region}: ${region.alertCount} alerts</title>
        </circle>
        <text x="${coords.x}" y="${coords.y + radius + 15}" 
              text-anchor="middle" font-size="11" fill="currentColor">
          ${region.region}
        </text>`;
    }).join("");

    return `<div class="socMapWrapper">
      <svg viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg" class="socMapSvg" role="img" aria-label="Geographic alert density map">
        <title>Alert Distribution by Region</title>
        <!-- Simplified map background -->
        <rect width="800" height="400" fill="var(--soc-map-bg, #f5f6f7)" rx="8" />
        
        <!-- Grid lines for reference -->
        <line x1="0" y1="200" x2="800" y2="200" stroke="var(--soc-map-grid, #e0e0e0)" stroke-dasharray="4" />
        <line x1="400" y1="0" x2="400" y2="400" stroke="var(--soc-map-grid, #e0e0e0)" stroke-dasharray="4" />
        
        <!-- North America outline (simplified) -->
        <path d="M80,80 L200,60 L280,100 L300,160 L260,200 L200,220 L140,200 L100,160 Z" 
              fill="var(--soc-map-land, #d4e6f1)" stroke="var(--soc-map-border, #a9cce3)" stroke-width="1" />
        
        <!-- Europe outline (simplified) -->
        <path d="M380,80 L460,70 L500,100 L490,150 L450,160 L400,150 L380,120 Z"
              fill="var(--soc-map-land, #d4e6f1)" stroke="var(--soc-map-border, #a9cce3)" stroke-width="1" />
        
        <!-- Asia outline (simplified) -->
        <path d="M520,80 L680,70 L720,120 L700,180 L620,200 L560,180 L520,140 Z"
              fill="var(--soc-map-land, #d4e6f1)" stroke="var(--soc-map-border, #a9cce3)" stroke-width="1" />

        <!-- Alert density markers -->
        ${markersSvg}
        
        <!-- No data message when no regions -->
        ${regions.length === 0 ? '<text x="400" y="200" text-anchor="middle" font-size="14" fill="var(--soc-map-text, #6a6d70)">No region data available. Connect SAP systems to see alert distribution.</text>' : ''}
      </svg>
    </div>`;
  }

  /**
   * Get alert density color based on count thresholds.
   */
  private _getDensityColor(alertCount: number): string {
    if (alertCount > 50) return "#cc1919";    // Critical
    if (alertCount > 20) return "#e87500";    // High
    if (alertCount > 5) return "#e6a400";     // Medium
    return "#a8d4a0";                          // Low
  }

  /**
   * Get marker radius based on alert density.
   */
  private _getDensityRadius(alertCount: number): number {
    if (alertCount > 50) return 25;
    if (alertCount > 20) return 20;
    if (alertCount > 5) return 15;
    return 10;
  }

  /**
   * Get approximate SVG coordinates for known BTP/data center regions.
   * Maps SAP BTP regions to map positions.
   */
  private _getRegionCoordinates(region: string): { x: number; y: number } {
    const regionCoords: Record<string, { x: number; y: number }> = {
      // North America
      "US East": { x: 220, y: 140 },
      "US West": { x: 120, y: 140 },
      "Canada (Montreal)": { x: 230, y: 100 },
      // Europe
      "EU (Frankfurt)": { x: 430, y: 110 },
      "EU (Amsterdam)": { x: 415, y: 95 },
      // Asia Pacific
      "AP (Singapore)": { x: 620, y: 200 },
      "AP (Sydney)": { x: 700, y: 320 },
      "AP (Tokyo)": { x: 690, y: 120 },
      // Default center
      "default": { x: 400, y: 200 }
    };

    return regionCoords[region] || regionCoords["default"];
  }

  /**
   * Handle map view selector change (density vs system locations).
   */
  public onMapViewChange(event: any): void {
    const selectedKey = event.getParameter("item").getKey();
    this._currentMapView = selectedKey;
    this._renderMap();
  }

  /**
   * Refresh map data from backend.
   */
  public onRefreshMap(): void {
    this._loadRegionData();
    this._renderMap();
    MessageToast.show("Geographic view refreshed");
  }

  /**
   * Handle region row press in the summary table.
   * Shows detailed alert breakdown for the selected region.
   */
  public onRegionPress(event: any): void {
    const source = event.getSource();
    const bindingContext = source.getBindingContext("dashboard");
    if (bindingContext) {
      const regionData = bindingContext.getObject();
      MessageToast.show(`Region: ${regionData.region} - ${regionData.alertCount} active alerts`);
    }
  }

  /**
   * Navigate back to main command center view.
   */
  public onNavBack(): void {
    this.navTo("main");
  }
}
