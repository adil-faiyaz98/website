# Deployment Best Practices

Guidelines for deploying CAP applications to SAP BTP.

## MTA Configuration

```yaml
# mta.yaml
_schema-version: "3.2"
ID: my-cap-app
version: 1.0.0

modules:
  - name: my-cap-app-srv
    type: nodejs
    path: gen/srv
    provides:
      - name: srv-api
        properties:
          srv-url: ${default-url}
    requires:
      - name: my-cap-app-db
      - name: my-cap-app-auth

  - name: my-cap-app-db-deployer
    type: hdb
    path: gen/db
    requires:
      - name: my-cap-app-db

resources:
  - name: my-cap-app-db
    type: com.sap.xs.hdi-container
    
  - name: my-cap-app-auth
    type: org.cloudfoundry.managed-service
    parameters:
      service: xsuaa
      service-plan: application
      path: ./xs-security.json
```

## Build and Deploy

```bash
# Build MTA archive
mbt build

# Deploy to Cloud Foundry
cf deploy mta_archives/my-cap-app_1.0.0.mtar
```

## Environment Configuration

```json
// .cdsrc.json for production
{
  "requires": {
    "db": {
      "kind": "hana"
    },
    "auth": {
      "kind": "xsuaa"
    }
  }
}
```

## Best Practices Summary

1. **Use MTA** - Multi-target applications for complex deployments
2. **Environment configs** - Separate dev/prod configurations
3. **CI/CD** - Automate build and deployment pipelines
4. **Health checks** - Implement readiness and liveness probes
5. **Logging** - Use structured logging for production
