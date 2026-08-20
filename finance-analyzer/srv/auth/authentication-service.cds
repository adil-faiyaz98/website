using { finsecure.ai as db } from '../../db/schema';

/**
 * Authentication Service
 * Manages IAS proxy authentication, principal propagation via OAuth2SAMLBearer,
 * IdP group-to-role mapping, MFA enforcement, session management, and IdP revocation.
 *
 * Validates: Requirements 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8
 */
service AuthenticationService @(requires: 'system-user') {

  /**
   * Validate and establish a user session after IAS authentication.
   * Maps IdP groups to BTP role collections and enforces session limits.
   */
  action validateSession(
    userId    : String(100),
    tenantId  : String(36),
    idpToken  : LargeString,
    clientIP  : String(45),
    userAgent : String(500),
    idpOrigin : String(100)
  ) returns LargeString;

  /**
   * Enforce MFA step-up authentication for high-risk operations.
   * Returns whether the MFA challenge was satisfied.
   */
  action enforceMFA(
    userId     : String(100),
    tenantId   : String(36),
    operation  : String(100),
    mfaToken   : LargeString
  ) returns LargeString;

  /**
   * Perform principal propagation via OAuth2SAMLBearer assertion flow.
   * Exchanges IAS token for backend SAP system access token via XSUAA.
   */
  action propagatePrincipal(
    userId         : String(100),
    tenantId       : String(36),
    targetSystem   : String(100),
    sessionId      : String(36)
  ) returns LargeString;

  /**
   * Check and terminate sessions for revoked IdP users.
   * Runs on polling interval (< 5 minutes).
   */
  action checkIdPRevocations(
    tenantId : String(36)
  ) returns LargeString;

  /**
   * Terminate a specific user session.
   */
  action terminateSession(
    sessionId : String(36),
    reason    : String(200)
  ) returns LargeString;

  /**
   * Get active sessions for a user (for concurrent session enforcement).
   */
  action getActiveSessions(
    userId   : String(100),
    tenantId : String(36)
  ) returns LargeString;

  /**
   * Map IdP group memberships to BTP role collections.
   * Configurable attribute mapping per tenant.
   */
  action mapIdPGroups(
    userId     : String(100),
    tenantId   : String(36),
    idpGroups  : LargeString
  ) returns LargeString;

  /**
   * Handle session timeout (idle or absolute).
   * Terminates session and logs event.
   */
  action handleSessionTimeout(
    sessionId   : String(36),
    timeoutType : String(20)
  ) returns LargeString;
}
