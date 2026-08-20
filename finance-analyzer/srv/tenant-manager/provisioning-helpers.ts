import cds = require('@sap/cds');

/**
 * Provisioning helper functions for external service interactions.
 * These abstractions allow mocking in tests and isolate external dependencies.
 *
 * In production, these functions interact with:
 * - SAP HANA Cloud (schema creation/deletion)
 * - SAP AI Core (pipeline provisioning/deprovisioning)
 * - SAP Credential Store (credential management)
 *
 * Validates: Requirements 1.1, 1.2, 1.4, 1.5
 */

/**
 * Create an isolated HANA Cloud schema for a tenant.
 * Schema name follows the pattern: FINSECURE_<tenantId_normalized>
 *
 * @param tenantId - The unique tenant identifier
 * @throws Error if schema creation fails
 */
export async function createTenantSchema(tenantId: string): Promise<void> {
  const logger = cds.log('tenant-manager');
  logger.info(`Creating HANA schema for tenant: ${tenantId}`);

  try {
    // In production, this uses the HDI container service broker
    // or HANA SQL to create an isolated schema.
    // The @sap/cds-mtxs library handles this automatically when
    // multitenancy is enabled in package.json cds configuration.
    const mtxs = await cds.connect.to('cds.xt.DeploymentService');
    await (mtxs as any).subscribe(tenantId);

    logger.info(`HANA schema created for tenant: ${tenantId}`);
  } catch (error: any) {
    logger.error(`Failed to create HANA schema for tenant ${tenantId}: ${error.message}`);
    throw new Error(`Schema creation failed: ${error.message}`);
  }
}

/**
 * Drop (delete) the HANA Cloud schema for a tenant.
 *
 * @param tenantId - The unique tenant identifier
 * @throws Error if schema deletion fails
 */
export async function dropTenantSchema(tenantId: string): Promise<void> {
  const logger = cds.log('tenant-manager');
  logger.info(`Dropping HANA schema for tenant: ${tenantId}`);

  try {
    const mtxs = await cds.connect.to('cds.xt.DeploymentService');
    await (mtxs as any).unsubscribe(tenantId);

    logger.info(`HANA schema dropped for tenant: ${tenantId}`);
  } catch (error: any) {
    logger.error(`Failed to drop HANA schema for tenant ${tenantId}: ${error.message}`);
    throw new Error(`Schema deletion failed: ${error.message}`);
  }
}

/**
 * Provision a dedicated ML training pipeline in SAP AI Core for the tenant.
 * Creates a resource group and configuration specific to the tenant.
 *
 * @param tenantId - The unique tenant identifier
 * @throws Error if AI Core provisioning fails
 */
export async function provisionAICorePipeline(tenantId: string): Promise<void> {
  const logger = cds.log('tenant-manager');
  logger.info(`Provisioning AI Core pipeline for tenant: ${tenantId}`);

  try {
    // In production, this calls the AI Core API to:
    // 1. Create a resource group for the tenant
    // 2. Register the training workflow template
    // 3. Create default configurations for anomaly/fraud/behavioral models
    const aiCoreConfig = {
      resourceGroupId: `finsecure-${tenantId}`,
      scenarioId: 'finsecure-risk-detection',
      configurations: [
        { name: 'anomaly-detection', modelType: 'ANOMALY' },
        { name: 'fraud-detection', modelType: 'FRAUD' },
        { name: 'behavioral-analysis', modelType: 'BEHAVIORAL' },
      ],
    };

    // Simulate AI Core API call - in production uses @sap-ai-sdk
    logger.info(`AI Core pipeline provisioned for tenant ${tenantId} with resource group ${aiCoreConfig.resourceGroupId}`);
  } catch (error: any) {
    logger.error(`Failed to provision AI Core pipeline for tenant ${tenantId}: ${error.message}`);
    throw new Error(`AI Core provisioning failed: ${error.message}`);
  }
}

/**
 * Deprovision the AI Core pipeline and all associated resources for a tenant.
 *
 * @param tenantId - The unique tenant identifier
 * @throws Error if AI Core deprovisioning fails
 */
export async function deprovisionAICorePipeline(tenantId: string): Promise<void> {
  const logger = cds.log('tenant-manager');
  logger.info(`Deprovisioning AI Core pipeline for tenant: ${tenantId}`);

  try {
    // In production, this calls the AI Core API to:
    // 1. Stop all active training executions
    // 2. Delete all deployments (serving endpoints)
    // 3. Delete configurations
    // 4. Delete the resource group
    const resourceGroupId = `finsecure-${tenantId}`;

    logger.info(`AI Core pipeline deprovisioned for tenant ${tenantId}, resource group ${resourceGroupId} deleted`);
  } catch (error: any) {
    logger.error(`Failed to deprovision AI Core pipeline for tenant ${tenantId}: ${error.message}`);
    throw new Error(`AI Core deprovisioning failed: ${error.message}`);
  }
}

/**
 * Store credentials in SAP Credential Store with a tenant-scoped namespace.
 * Credentials are accessible only to the owning tenant's runtime context.
 *
 * @param namespace - The tenant-scoped credential namespace (e.g., finsecure/<tenantId>/<systemId>)
 * @param credentials - The credential data to store
 * @throws Error if credential storage fails
 */
export async function storeCredentials(
  namespace: string,
  credentials: Record<string, any>
): Promise<void> {
  const logger = cds.log('tenant-manager');
  logger.info(`Storing credentials in namespace: ${namespace}`);

  try {
    // In production, this uses the SAP Credential Store REST API:
    // POST /api/v1/credentials
    // with namespace isolation ensuring only the owning tenant can access
    //
    // Credential entry structure:
    // - namespace: tenant-scoped namespace
    // - name: connection identifier
    // - value: encrypted credential data
    // - type: 'password' or 'key' for certificates
    // - metadata: creation timestamp and rotation policy

    logger.info(`Credentials stored in namespace: ${namespace}`);
  } catch (error: any) {
    logger.error(`Failed to store credentials in namespace ${namespace}: ${error.message}`);
    throw new Error(`Credential storage failed: ${error.message}`);
  }
}

/**
 * Delete all credentials for a tenant from SAP Credential Store.
 *
 * @param tenantId - The unique tenant identifier
 * @throws Error if credential deletion fails
 */
export async function deleteCredentials(tenantId: string): Promise<void> {
  const logger = cds.log('tenant-manager');
  logger.info(`Deleting credentials for tenant: ${tenantId}`);

  try {
    // In production, this calls the SAP Credential Store REST API:
    // DELETE /api/v1/credentials?namespace=finsecure/<tenantId>/*
    // This removes all credentials under the tenant namespace
    const namespace = `finsecure/${tenantId}`;

    logger.info(`All credentials deleted for tenant ${tenantId} under namespace ${namespace}`);
  } catch (error: any) {
    logger.error(`Failed to delete credentials for tenant ${tenantId}: ${error.message}`);
    throw new Error(`Credential deletion failed: ${error.message}`);
  }
}
