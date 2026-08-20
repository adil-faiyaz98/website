using { finsecure.ai as db } from '../../db/schema';

/**
 * Deployment Topology Service
 * Manages deployment configurations, system registration, region validation,
 * and parallel monitoring support for multi-tenant and single-tenant deployments.
 *
 * Validates: Requirements 24.1, 24.2, 24.3, 24.4, 24.5, 24.6, 24.7, 24.8, 24.9
 */
@(requires: 'TenantAdmin')
service DeploymentTopologyService @(path: '/deployment') {

  // Tenant configuration: read + update deployment topology
  @odata.draft.enabled
  entity Tenants as projection on db.Tenants;

  // Connected Systems: full CRUD with registration validation
  @odata.draft.enabled
  entity ConnectedSystems as projection on db.ConnectedSystems;

  // Actions for deployment topology management
  action validateDeploymentTopology(tenantId : String, deploymentModel : String, region : String) returns String;
  action registerSystem(tenantId : String, systemId : String, systemType : String, release : String,
                        connectionType : String, endpoint : String, authMethod : String,
                        modules : array of String, documentTypes : array of String,
                        iamMonitoring : Boolean, vulnerabilityScanning : Boolean) returns String;
  action validateRegion(region : String) returns Boolean;
  action configureCloudConnector(tenantId : String, systemId : String, locationId : String,
                                  virtualHost : String, virtualPort : Integer) returns String;
  action enableParallelMonitoring(tenantId : String, eccSystemId : String, s4SystemId : String) returns String;
  action getDeploymentStatus(tenantId : String) returns String;
}
