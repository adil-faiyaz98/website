/**
 * Unit tests for Authentication Service
 * Tests IAS proxy authentication, principal propagation, MFA enforcement,
 * session management, IdP group mapping, and revocation handling.
 *
 * Validates: Requirements 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8
 */

// Mock cds module before importing the service
jest.mock('@sap/cds', () => {
  const mockAuditService = {
    send: jest.fn().mockResolvedValue(undefined),
  };

  return {
    log: () => ({
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
    }),
    connect: {
      to: jest.fn().mockResolvedValue(mockAuditService),
    },
    ApplicationService: class {
      on(_event: string, _handler: any) {}
      async init() {}
    },
  };
});

import AuthenticationService from '@srv/auth/authentication-service';

// Helper to create a valid JWT-like token for testing
function createTestToken(payload: Record<string, any>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = Buffer.from('test-signature').toString('base64url');
  return `${header}.${body}.${signature}`;
}

describe('AuthenticationService', () => {
  let service: AuthenticationService;

  beforeEach(() => {
    service = new AuthenticationService();
  });

  // ==========================================================================
  // Session Management Tests (Requirement 17.5)
  // ==========================================================================

  describe('Session Management', () => {
    it('should return default session config when no tenant config is set', () => {
      const config = service.getSessionConfig('tenant-1');

      expect(config.idleTimeoutMinutes).toBe(30);
      expect(config.absoluteDurationHours).toBe(8);
      expect(config.maxConcurrentSessions).toBe(3);
    });

    it('should allow configuring session parameters per tenant', () => {
      const updated = service.setSessionConfig('tenant-1', {
        idleTimeoutMinutes: 60,
        absoluteDurationHours: 12,
        maxConcurrentSessions: 5,
      });

      expect(updated.idleTimeoutMinutes).toBe(60);
      expect(updated.absoluteDurationHours).toBe(12);
      expect(updated.maxConcurrentSessions).toBe(5);
    });

    it('should clamp idle timeout to minimum of 5 minutes', () => {
      const updated = service.setSessionConfig('tenant-1', {
        idleTimeoutMinutes: 2,
      });

      expect(updated.idleTimeoutMinutes).toBe(5);
    });

    it('should clamp idle timeout to maximum of 480 minutes', () => {
      const updated = service.setSessionConfig('tenant-1', {
        idleTimeoutMinutes: 600,
      });

      expect(updated.idleTimeoutMinutes).toBe(480);
    });

    it('should enforce minimum 1 concurrent session', () => {
      const updated = service.setSessionConfig('tenant-1', {
        maxConcurrentSessions: 0,
      });

      expect(updated.maxConcurrentSessions).toBe(1);
    });

    it('should track sessions and update last activity on touch', () => {
      const session = {
        sessionId: 'session-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        idpOrigin: 'entra-id',
        clientIP: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        createdAt: Date.now() - 60000,
        lastActivity: Date.now() - 60000,
        absoluteExpiry: Date.now() + 28800000,
        roles: ['FinSecure_SecurityAnalyst'],
        mfaVerified: false,
        mfaVerifiedAt: null,
      };

      service.addSession(session);

      const before = service.getSession('session-1')!.lastActivity;
      service.touchSession('session-1');
      const after = service.getSession('session-1')!.lastActivity;

      expect(after).toBeGreaterThanOrEqual(before);
    });

    it('should return false when touching a non-existent session', () => {
      expect(service.touchSession('non-existent')).toBe(false);
    });

    it('should track active session count', () => {
      expect(service.getActiveSessionCount()).toBe(0);

      service.addSession({
        sessionId: 'session-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        idpOrigin: 'entra-id',
        clientIP: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        createdAt: Date.now(),
        lastActivity: Date.now(),
        absoluteExpiry: Date.now() + 28800000,
        roles: [],
        mfaVerified: false,
        mfaVerifiedAt: null,
      });

      expect(service.getActiveSessionCount()).toBe(1);
    });
  });

  // ==========================================================================
  // IdP Group-to-Role Mapping Tests (Requirement 17.3)
  // ==========================================================================

  describe('IdP Group-to-Role Mapping', () => {
    it('should map default IdP groups to BTP role collections', () => {
      const roles = service.mapGroupsToRoles('tenant-1', [
        'FinSecure-SecurityAnalysts',
        'FinSecure-Auditors',
      ]);

      expect(roles).toContain('FinSecure_SecurityAnalyst');
      expect(roles).toContain('FinSecure_Auditor');
      expect(roles).toHaveLength(2);
    });

    it('should return empty roles for unrecognized groups', () => {
      const roles = service.mapGroupsToRoles('tenant-1', [
        'Unknown-Group',
        'Another-Unknown',
      ]);

      expect(roles).toHaveLength(0);
    });

    it('should deduplicate roles when multiple groups map to same role', () => {
      service.setRoleMappings('tenant-custom', {
        idpGroupAttribute: 'groups',
        mappings: {
          'Group-A': 'FinSecure_SecurityAnalyst',
          'Group-B': 'FinSecure_SecurityAnalyst',
          'Group-C': 'FinSecure_Auditor',
        },
      });

      const roles = service.mapGroupsToRoles('tenant-custom', [
        'Group-A',
        'Group-B',
        'Group-C',
      ]);

      expect(roles).toContain('FinSecure_SecurityAnalyst');
      expect(roles).toContain('FinSecure_Auditor');
      expect(roles).toHaveLength(2);
    });

    it('should use tenant-specific mappings when configured', () => {
      service.setRoleMappings('tenant-custom', {
        idpGroupAttribute: 'groups',
        mappings: {
          'CORP-Security': 'FinSecure_SecurityAdmin',
          'CORP-Audit': 'FinSecure_Auditor',
        },
      });

      const roles = service.mapGroupsToRoles('tenant-custom', ['CORP-Security']);
      expect(roles).toEqual(['FinSecure_SecurityAdmin']);
    });

    it('should map all six dashboard roles', () => {
      const allGroups = [
        'FinSecure-SecurityAnalysts',
        'FinSecure-SecurityAdmins',
        'FinSecure-Auditors',
        'FinSecure-Executives',
        'FinSecure-IAMAdmins',
        'FinSecure-SOCOperators',
      ];

      const roles = service.mapGroupsToRoles('tenant-1', allGroups);

      expect(roles).toContain('FinSecure_SecurityAnalyst');
      expect(roles).toContain('FinSecure_SecurityAdmin');
      expect(roles).toContain('FinSecure_Auditor');
      expect(roles).toContain('FinSecure_Executive');
      expect(roles).toContain('FinSecure_IAMAdmin');
      expect(roles).toContain('FinSecure_SOCOperator');
      expect(roles).toHaveLength(6);
    });
  });

  // ==========================================================================
  // MFA Enforcement Tests (Requirement 17.4)
  // ==========================================================================

  describe('MFA Enforcement', () => {
    it('should identify high-risk operations requiring MFA', () => {
      expect(service.isHighRiskOperation('ACKNOWLEDGE_CRITICAL_ALERT')).toBe(true);
      expect(service.isHighRiskOperation('APPROVE_PLAYBOOK_CONTAINMENT')).toBe(true);
      expect(service.isHighRiskOperation('MODIFY_SOD_RULES')).toBe(true);
      expect(service.isHighRiskOperation('CHANGE_THRESHOLDS')).toBe(true);
      expect(service.isHighRiskOperation('ACCESS_AUDIT_TRAIL_EXPORT')).toBe(true);
    });

    it('should not require MFA for non-high-risk operations', () => {
      expect(service.isHighRiskOperation('VIEW_DASHBOARD')).toBe(false);
      expect(service.isHighRiskOperation('READ_ALERTS')).toBe(false);
      expect(service.isHighRiskOperation('SEARCH_TRANSACTIONS')).toBe(false);
    });
  });

  // ==========================================================================
  // Principal Propagation Failure Handling Tests (Requirement 17.8)
  // ==========================================================================

  describe('Error Sanitization for Logging', () => {
    it('should redact Bearer tokens from error messages', () => {
      const error = 'Failed with Bearer eyJhbGciOiJSUzI1NiJ9.test.signature in request';
      // Access private method via bracket notation for testing
      const sanitized = (service as any).sanitizeErrorForLogging(error);

      expect(sanitized).not.toContain('eyJhbGciOiJSUzI1NiJ9');
      expect(sanitized).toContain('[REDACTED]');
    });

    it('should redact Basic auth credentials from error messages', () => {
      const error = 'Auth failed: Basic dXNlcjpwYXNz in header';
      const sanitized = (service as any).sanitizeErrorForLogging(error);

      expect(sanitized).not.toContain('dXNlcjpwYXNz');
      expect(sanitized).toContain('[REDACTED]');
    });

    it('should redact client_secret values', () => {
      const error = 'Token request failed: client_secret=my-super-secret&grant_type=token';
      const sanitized = (service as any).sanitizeErrorForLogging(error);

      expect(sanitized).not.toContain('my-super-secret');
      expect(sanitized).toContain('[REDACTED]');
    });

    it('should redact password values', () => {
      const error = 'Connection error: password=TopSecret123 in config';
      const sanitized = (service as any).sanitizeErrorForLogging(error);

      expect(sanitized).not.toContain('TopSecret123');
      expect(sanitized).toContain('[REDACTED]');
    });

    it('should redact JWT tokens from error messages', () => {
      const jwt = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyMSJ9.abc123signature';
      const error = `Token validation failed: ${jwt}`;
      const sanitized = (service as any).sanitizeErrorForLogging(error);

      expect(sanitized).not.toContain('eyJhbGciOiJSUzI1NiJ9');
      expect(sanitized).toContain('[JWT_REDACTED]');
    });

    it('should preserve non-credential error messages', () => {
      const error = 'Connection timed out after 30000ms';
      const sanitized = (service as any).sanitizeErrorForLogging(error);

      expect(sanitized).toBe('Connection timed out after 30000ms');
    });
  });

  // ==========================================================================
  // Token Validation Tests (Requirement 17.1)
  // ==========================================================================

  describe('IAS Token Validation', () => {
    it('should reject null/empty tokens', async () => {
      const result = await (service as any).validateIASToken('', 'entra-id');
      expect(result).toBeNull();
    });

    it('should reject tokens with invalid structure', async () => {
      const result = await (service as any).validateIASToken('not-a-jwt', 'entra-id');
      expect(result).toBeNull();
    });

    it('should reject tokens missing required claims', async () => {
      const token = createTestToken({ foo: 'bar' }); // missing sub and email
      const result = await (service as any).validateIASToken(token, 'entra-id');
      expect(result).toBeNull();
    });

    it('should accept valid tokens with required claims', async () => {
      const token = createTestToken({
        sub: 'user-123',
        email: 'user@corp.com',
        groups: ['FinSecure-SecurityAnalysts'],
      });
      const result = await (service as any).validateIASToken(token, 'entra-id');

      expect(result).not.toBeNull();
      expect(result!.sub).toBe('user-123');
      expect(result!.email).toBe('user@corp.com');
      expect(result!.groups).toContain('FinSecure-SecurityAnalysts');
    });

    it('should extract groups from xs.system.attributes when groups claim is absent', async () => {
      const token = createTestToken({
        sub: 'user-456',
        email: 'admin@corp.com',
        'xs.system.attributes': {
          groups: ['FinSecure-SecurityAdmins'],
        },
      });
      const result = await (service as any).validateIASToken(token, 'okta');

      expect(result).not.toBeNull();
      expect(result!.groups).toContain('FinSecure-SecurityAdmins');
    });
  });

  // ==========================================================================
  // MFA Token Validation Tests (Requirement 17.4)
  // ==========================================================================

  describe('MFA Token Validation', () => {
    it('should reject empty MFA tokens', async () => {
      const result = await (service as any).validateMFAToken('user-1', '');
      expect(result).toBe(false);
    });

    it('should reject null MFA tokens', async () => {
      const result = await (service as any).validateMFAToken('user-1', null);
      expect(result).toBe(false);
    });

    it('should accept valid MFA tokens (6+ characters)', async () => {
      const result = await (service as any).validateMFAToken('user-1', '123456');
      expect(result).toBe(true);
    });

    it('should reject MFA tokens shorter than 6 characters', async () => {
      const result = await (service as any).validateMFAToken('user-1', '12345');
      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // Audit Event Outcome Mapping Tests (Requirement 17.7)
  // ==========================================================================

  describe('Auth Event Outcome Mapping', () => {
    it('should map LOGON_SUCCESS to SUCCESS outcome', () => {
      const outcome = (service as any).mapEventTypeToOutcome('LOGON_SUCCESS');
      expect(outcome).toBe('SUCCESS');
    });

    it('should map LOGON_FAILURE to FAILURE outcome', () => {
      const outcome = (service as any).mapEventTypeToOutcome('LOGON_FAILURE');
      expect(outcome).toBe('FAILURE');
    });

    it('should map MFA_FAILURE to FAILURE outcome', () => {
      const outcome = (service as any).mapEventTypeToOutcome('MFA_FAILURE');
      expect(outcome).toBe('FAILURE');
    });

    it('should map SESSION_TIMEOUT to DENIED outcome', () => {
      const outcome = (service as any).mapEventTypeToOutcome('SESSION_TIMEOUT');
      expect(outcome).toBe('DENIED');
    });

    it('should map IDP_REVOCATION to DENIED outcome', () => {
      const outcome = (service as any).mapEventTypeToOutcome('IDP_REVOCATION');
      expect(outcome).toBe('DENIED');
    });

    it('should map PRINCIPAL_PROPAGATION_FAILURE to FAILURE outcome', () => {
      const outcome = (service as any).mapEventTypeToOutcome('PRINCIPAL_PROPAGATION_FAILURE');
      expect(outcome).toBe('FAILURE');
    });
  });
});
