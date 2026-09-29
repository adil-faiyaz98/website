/**
 * Tax Determination Engine V2 - Comprehensive Test Suite
 *
 * Tests for deterministic, fail-closed tax determination (4 configured layers,
 * no company-default fallback, no local tax estimation).
 * Covers PO-based, Non-PO, US, Canadian, and cross-border scenarios against a
 * seeded configuration cache (@sap/cds is mocked).
 *
 * @module test/tax-engine-v2.test
 */

'use strict';

jest.mock('@sap/cds', () => ({
    connect: { to: jest.fn() },
    entities: jest.fn(() => ({}))
}));

const cds = require('@sap/cds');
const { TaxDeterminationEngineV2 } = require('../srv/lib/tax-engine-v2');

// Test data for various scenarios
const TEST_SCENARIOS = {
    // =========================================================================
    // PO-BASED INVOICE SCENARIOS
    // =========================================================================
    
    PO_BASED: {
        // Layer 1: PO Line Item Tax Code
        PO_LINE_ITEM_WITH_TAX: {
            description: 'PO-based invoice with tax code on PO line item',
            context: {
                companyCode: '1000',
                invoiceType: 'PO_BASED',
                poNumber: '4500001234',
                poLineItem: 10,
                poData: {
                    taxCode: 'V1',
                    taxRate: 0.0725,
                    jurisdictionCode: 'CA000000'
                },
                grossAmount: 1000.00,
                currency: 'USD'
            },
            expected: {
                taxCode: 'V1',
                determinationLayer: 'PO_LINE_ITEM',
                confidenceScore: 100
            }
        },

        // PO without tax code - falls to geographic
        PO_NO_TAX_CODE_CA_DELIVERY: {
            description: 'PO-based invoice without tax code, delivery to California',
            context: {
                companyCode: '1000',
                invoiceType: 'PO_BASED',
                poNumber: '4500001235',
                poLineItem: 10,
                shipToCountry: 'US',
                shipToRegion: 'CA',
                shipToZipCode: '90210',
                grossAmount: 5000.00,
                currency: 'USD'
            },
            expected: {
                determinationLayer: 'GEOGRAPHIC_DEFAULTS',
                taxCodeNotNull: true
            }
        },

        // PO with delivery to no-tax state
        PO_OREGON_NO_TAX: {
            description: 'PO-based invoice with delivery to Oregon (no sales tax)',
            context: {
                companyCode: '1000',
                invoiceType: 'PO_BASED',
                poNumber: '4500001236',
                shipToCountry: 'US',
                shipToRegion: 'OR',
                grossAmount: 2500.00,
                currency: 'USD'
            },
            expected: {
                taxCode: 'V0',
                taxRate: 0,
                determinationLayer: 'GEOGRAPHIC_DEFAULTS'
            }
        }
    },

    // =========================================================================
    // NON-PO INVOICE SCENARIOS
    // =========================================================================

    NON_PO: {
        // Non-PO with expense category
        TRAVEL_EXPENSE_US: {
            description: 'Non-PO travel expense in US',
            context: {
                companyCode: '1000',
                invoiceType: 'NON_PO',
                vendorId: '0000100001',
                expenseCategory: 'TRAVEL',
                shipToCountry: 'US',
                shipToRegion: 'NY',
                grossAmount: 1500.00,
                currency: 'USD'
            },
            expected: {
                determinationLayer: 'ADMIN_RULES',
                taxCodeNotNull: true
            }
        },

        // Non-PO with G/L account
        GL_ACCOUNT_SERVICES: {
            description: 'Non-PO professional services with G/L account',
            context: {
                companyCode: '1000',
                invoiceType: 'NON_PO',
                vendorId: '0000100002',
                glAccount: '6400100',
                shipToCountry: 'US',
                shipToRegion: 'TX',
                grossAmount: 10000.00,
                currency: 'USD'
            },
            expected: {
                taxCodeNotNull: true
            }
        },

        // Non-PO with exempt vendor
        EXEMPT_VENDOR: {
            description: 'Non-PO invoice from tax-exempt vendor',
            context: {
                companyCode: '1000',
                invoiceType: 'NON_PO',
                vendorId: 'EXEMPT001',
                grossAmount: 5000.00,
                currency: 'USD'
            },
            expected: {
                taxCode: 'V0',
                taxRate: 0
            }
        },

        // Non-PO insurance (typically exempt)
        INSURANCE_EXEMPT: {
            description: 'Non-PO insurance premium (exempt)',
            context: {
                companyCode: '1000',
                invoiceType: 'NON_PO',
                expenseCategory: 'INSURANCE',
                glAccount: '6700100',
                shipToCountry: 'US',
                grossAmount: 25000.00,
                currency: 'USD'
            },
            expected: {
                taxCode: 'V0'
            }
        }
    },

    // =========================================================================
    // US STATE-SPECIFIC SCENARIOS
    // =========================================================================

    US_STATES: {
        // California with high local tax
        CALIFORNIA_LA: {
            description: 'Delivery to Los Angeles, CA (high combined rate)',
            context: {
                companyCode: '1000',
                shipToCountry: 'US',
                shipToRegion: 'CA',
                shipToZipCode: '90001',
                grossAmount: 1000.00,
                currency: 'USD'
            },
            expected: {
                stateCode: 'CA',
                taxRateMin: 0.0725
            }
        },

        // New York City
        NEW_YORK_CITY: {
            description: 'Delivery to New York City',
            context: {
                companyCode: '1000',
                shipToCountry: 'US',
                shipToRegion: 'NY',
                shipToZipCode: '10001',
                grossAmount: 1000.00,
                currency: 'USD'
            },
            expected: {
                stateCode: 'NY',
                taxRateMin: 0.04
            }
        },

        // Delaware (no sales tax)
        DELAWARE_NO_TAX: {
            description: 'Delivery to Delaware (no sales tax)',
            context: {
                companyCode: '1000',
                shipToCountry: 'US',
                shipToRegion: 'DE',
                grossAmount: 1000.00,
                currency: 'USD'
            },
            expected: {
                taxCode: 'V0',
                taxRate: 0
            }
        },

        // Montana (no sales tax)
        MONTANA_NO_TAX: {
            description: 'Delivery to Montana (no sales tax)',
            context: {
                companyCode: '1000',
                shipToCountry: 'US',
                shipToRegion: 'MT',
                grossAmount: 1000.00,
                currency: 'USD'
            },
            expected: {
                taxCode: 'V0',
                taxRate: 0
            }
        },

        // New Hampshire (no sales tax)
        NEW_HAMPSHIRE_NO_TAX: {
            description: 'Delivery to New Hampshire (no sales tax)',
            context: {
                companyCode: '1000',
                shipToCountry: 'US',
                shipToRegion: 'NH',
                grossAmount: 1000.00,
                currency: 'USD'
            },
            expected: {
                taxCode: 'V0',
                taxRate: 0
            }
        },

        // Texas with local tax
        TEXAS_HOUSTON: {
            description: 'Delivery to Houston, TX',
            context: {
                companyCode: '1000',
                shipToCountry: 'US',
                shipToRegion: 'TX',
                shipToZipCode: '77001',
                grossAmount: 1000.00,
                currency: 'USD'
            },
            expected: {
                stateCode: 'TX',
                taxRateMin: 0.0625
            }
        },

        // Washington State (high tax)
        WASHINGTON_SEATTLE: {
            description: 'Delivery to Seattle, WA (high combined rate)',
            context: {
                companyCode: '1000',
                shipToCountry: 'US',
                shipToRegion: 'WA',
                shipToZipCode: '98101',
                grossAmount: 1000.00,
                currency: 'USD'
            },
            expected: {
                stateCode: 'WA',
                taxRateMin: 0.065
            }
        }
    },

    // =========================================================================
    // CANADIAN PROVINCIAL SCENARIOS
    // =========================================================================

    CANADA: {
        // Ontario HST
        ONTARIO_HST: {
            description: 'Delivery to Ontario (HST 13%)',
            context: {
                companyCode: '2000',
                shipToCountry: 'CA',
                shipToRegion: 'ON',
                grossAmount: 1000.00,
                currency: 'CAD'
            },
            expected: {
                taxCode: 'H1',
                taxRate: 0.13,
                taxSystem: 'HST'
            }
        },

        // British Columbia GST+PST
        BC_GST_PST: {
            description: 'Delivery to British Columbia (GST 5% + PST 7%)',
            context: {
                companyCode: '2000',
                shipToCountry: 'CA',
                shipToRegion: 'BC',
                grossAmount: 1000.00,
                currency: 'CAD'
            },
            expected: {
                taxCode: 'C2',
                taxRate: 0.12,
                taxSystem: 'GST_PST'
            }
        },

        // Quebec GST+QST
        QUEBEC_GST_QST: {
            description: 'Delivery to Quebec (GST 5% + QST 9.975%)',
            context: {
                companyCode: '2000',
                shipToCountry: 'CA',
                shipToRegion: 'QC',
                grossAmount: 1000.00,
                currency: 'CAD'
            },
            expected: {
                taxCode: 'C3',
                taxRateMin: 0.14,
                taxSystem: 'GST_QST'
            }
        },

        // Alberta GST only
        ALBERTA_GST_ONLY: {
            description: 'Delivery to Alberta (GST only 5%)',
            context: {
                companyCode: '2000',
                shipToCountry: 'CA',
                shipToRegion: 'AB',
                grossAmount: 1000.00,
                currency: 'CAD'
            },
            expected: {
                taxCode: 'G1',
                taxRate: 0.05,
                taxSystem: 'GST_ONLY'
            }
        },

        // Nova Scotia HST 15%
        NOVA_SCOTIA_HST: {
            description: 'Delivery to Nova Scotia (HST 15%)',
            context: {
                companyCode: '2000',
                shipToCountry: 'CA',
                shipToRegion: 'NS',
                grossAmount: 1000.00,
                currency: 'CAD'
            },
            expected: {
                taxCode: 'H2',
                taxRate: 0.15,
                taxSystem: 'HST'
            }
        },

        // Yukon Territory (GST only)
        YUKON_GST: {
            description: 'Delivery to Yukon (GST only 5%)',
            context: {
                companyCode: '2000',
                shipToCountry: 'CA',
                shipToRegion: 'YT',
                grossAmount: 1000.00,
                currency: 'CAD'
            },
            expected: {
                taxCode: 'G1',
                taxRate: 0.05
            }
        }
    },

    // =========================================================================
    // CROSS-BORDER SCENARIOS
    // =========================================================================

    CROSS_BORDER: {
        // US to Canada
        US_TO_CANADA: {
            description: 'Cross-border US to Canada',
            context: {
                companyCode: '1000',
                shipFromCountry: 'US',
                shipFromRegion: 'CA',
                shipToCountry: 'CA',
                shipToRegion: 'ON',
                grossAmount: 5000.00,
                currency: 'USD'
            },
            expected: {
                determinationLayer: 'GEOGRAPHIC_DEFAULTS',
                taxCodeNotNull: true
            }
        },

        // Canada to US
        CANADA_TO_US: {
            description: 'Cross-border Canada to US',
            context: {
                companyCode: '2000',
                shipFromCountry: 'CA',
                shipFromRegion: 'ON',
                shipToCountry: 'US',
                shipToRegion: 'NY',
                grossAmount: 5000.00,
                currency: 'CAD'
            },
            expected: {
                taxCodeNotNull: true
            }
        },

        // US to EU (reverse charge)
        US_TO_EU_REVERSE_CHARGE: {
            description: 'Cross-border US to EU (reverse charge)',
            context: {
                companyCode: '1000',
                shipFromCountry: 'US',
                shipToCountry: 'DE',
                grossAmount: 10000.00,
                currency: 'USD'
            },
            expected: {
                taxCodeNotNull: true
            }
        },

        // Intra-US (domestic)
        US_DOMESTIC: {
            description: 'Domestic US transaction',
            context: {
                companyCode: '1000',
                shipFromCountry: 'US',
                shipFromRegion: 'CA',
                shipToCountry: 'US',
                shipToRegion: 'NY',
                grossAmount: 2500.00,
                currency: 'USD'
            },
            expected: {
                taxCodeNotNull: true
            }
        }
    },

    // =========================================================================
    // FALLBACK SCENARIOS
    // =========================================================================

    FALLBACK: {
        // No geographic info - exception (no company default)
        NO_LOCATION_INFO: {
            description: 'Invoice with no location information - exception',
            context: {
                companyCode: '1000',
                invoiceType: 'NON_PO',
                grossAmount: 500.00,
                currency: 'USD'
            },
            expected: {
                successFalse: true,
                errorCode: 'NO_TAX_DETERMINATION'
            }
        },

        // Plant default when plant is provided
        PLANT_DEFAULT: {
            description: 'Invoice with plant code - plant default',
            context: {
                companyCode: '1000',
                invoiceType: 'NON_PO',
                plantCode: '1001',
                grossAmount: 1000.00,
                currency: 'USD'
            },
            expected: {
                successTrue: true,
                taxCodeNotNull: true,
                determinationLayer: 'PLANT_DEFAULT'
            }
        },

        // Company default tax code is never used
        NO_COMPANY_DEFAULT: {
            description: 'Configured company default tax code is not used as fallback',
            context: {
                companyCode: '1000',
                grossAmount: 100.00,
                currency: 'USD'
            },
            expected: {
                successFalse: true,
                errorCode: 'NO_TAX_DETERMINATION'
            }
        }
    },

    // =========================================================================
    // SPECIAL CASES
    // =========================================================================

    SPECIAL: {
        // Zero amount invoice
        ZERO_AMOUNT: {
            description: 'Zero amount invoice',
            context: {
                companyCode: '1000',
                shipToCountry: 'US',
                shipToRegion: 'CA',
                grossAmount: 0,
                currency: 'USD'
            },
            expected: {
                taxCodeNotNull: true,
                taxAmount: 0
            }
        },

        // High value invoice (review required)
        HIGH_VALUE_REVIEW: {
            description: 'High value invoice requiring review',
            context: {
                companyCode: '1000',
                shipToCountry: 'US',
                shipToRegion: 'CA',
                grossAmount: 150000.00,
                currency: 'USD'
            },
            expected: {
                requiresReview: true,
                taxCodeNotNull: true
            }
        },

        // Small invoice (de minimis)
        SMALL_INVOICE: {
            description: 'Small invoice below threshold',
            context: {
                companyCode: '1000',
                invoiceType: 'NON_PO',
                shipToCountry: 'US',
                shipToRegion: 'NY',
                grossAmount: 10.00,
                currency: 'USD'
            },
            expected: {
                taxCodeNotNull: true
            }
        },

        // Multiple currencies
        EUR_CURRENCY: {
            description: 'Invoice in EUR currency',
            context: {
                companyCode: '3000',
                shipToCountry: 'DE',
                grossAmount: 5000.00,
                currency: 'EUR'
            },
            expected: {
                taxCodeNotNull: true
            }
        }
    },

    // =========================================================================
    // ZIP CODE RESOLUTION SCENARIOS
    // =========================================================================

    ZIP_CODES: {
        // Major metro area
        NYC_ZIP: {
            zipCode: '10001',
            expected: {
                success: true,
                stateCode: 'NY',
                city: 'New York City'
            }
        },

        // Los Angeles
        LA_ZIP: {
            zipCode: '90210',
            expected: {
                success: true,
                stateCode: 'CA',
                city: 'Beverly Hills'
            }
        },

        // No sales tax state
        PORTLAND_OR_ZIP: {
            zipCode: '97201',
            expected: {
                success: true,
                stateCode: 'OR',
                combinedTaxRate: 0
            }
        },

        // Invalid ZIP
        INVALID_ZIP: {
            zipCode: '00000',
            expected: {
                success: false
            }
        },

        // ZIP+4 format
        ZIP_PLUS_4: {
            zipCode: '10001-1234',
            expected: {
                success: true,
                stateCode: 'NY'
            }
        }
    }
};

// ============================================================================
// TEST SUITE
// ============================================================================

// Configuration seeded into the engine cache (mirrors vim.tax master data)
const SEED = {
    companyConfigs: [
        { companyCode: '1000', countryKey: 'US', defaultInputTaxCode: 'I0', defaultExemptCode: 'V0' },
        { companyCode: '2000', countryKey: 'CA', defaultInputTaxCode: 'C0', defaultExemptCode: 'C0' },
        { companyCode: '3000', countryKey: 'DE', defaultInputTaxCode: 'VN' },
        { companyCode: '4000', countryKey: 'US', defaultInputTaxCode: 'I0' }
    ],
    plantConfigs: [
        { companyCode_companyCode: '1000', plantCode: '1001', defaultInputTaxCode: 'P1', defaultJurisdiction: 'NY0000000' }
    ],
    usStates: [
        { stateCode: 'CA', stateName: 'California', hasSalesTax: true, defaultInputTaxCode: 'I1', stateTaxRate: 0.0725, avgCombinedRate: 0.0885, defaultJurisdiction: 'CA0000000' },
        { stateCode: 'NY', stateName: 'New York', hasSalesTax: true, defaultInputTaxCode: 'I1', stateTaxRate: 0.04, avgCombinedRate: 0.0852, defaultJurisdiction: 'NY0000000' },
        { stateCode: 'TX', stateName: 'Texas', hasSalesTax: true, defaultInputTaxCode: 'I1', stateTaxRate: 0.0625, avgCombinedRate: 0.082, defaultJurisdiction: 'TX0000000' },
        { stateCode: 'WA', stateName: 'Washington', hasSalesTax: true, defaultInputTaxCode: 'I1', stateTaxRate: 0.065, avgCombinedRate: 0.0929, defaultJurisdiction: 'WA0000000' },
        { stateCode: 'DE', stateName: 'Delaware', hasSalesTax: false, defaultInputTaxCode: 'V0', defaultJurisdiction: 'DE0000000' },
        { stateCode: 'MT', stateName: 'Montana', hasSalesTax: false, defaultInputTaxCode: 'V0', defaultJurisdiction: 'MT0000000' },
        { stateCode: 'NH', stateName: 'New Hampshire', hasSalesTax: false, defaultInputTaxCode: 'V0', defaultJurisdiction: 'NH0000000' },
        { stateCode: 'OR', stateName: 'Oregon', hasSalesTax: false, defaultInputTaxCode: 'V0', defaultJurisdiction: 'OR0000000' }
    ],
    caProvinces: [
        { provinceCode: 'ON', provinceName: 'Ontario', taxSystem: 'HST', defaultInputTaxCode: 'H1', combinedRate: 0.13, hstRate: 0.13 },
        { provinceCode: 'BC', provinceName: 'British Columbia', taxSystem: 'GST_PST', defaultInputTaxCode: 'C2', combinedRate: 0.12, gstRate: 0.05, pstRate: 0.07 },
        { provinceCode: 'QC', provinceName: 'Quebec', taxSystem: 'GST_QST', defaultInputTaxCode: 'C3', combinedRate: 0.14975, gstRate: 0.05, qstRate: 0.09975 },
        { provinceCode: 'AB', provinceName: 'Alberta', taxSystem: 'GST_ONLY', defaultInputTaxCode: 'G1', combinedRate: 0.05, gstRate: 0.05 },
        { provinceCode: 'NS', provinceName: 'Nova Scotia', taxSystem: 'HST', defaultInputTaxCode: 'H2', combinedRate: 0.15, hstRate: 0.15 },
        { provinceCode: 'YT', provinceName: 'Yukon', taxSystem: 'GST_ONLY', defaultInputTaxCode: 'G1', combinedRate: 0.05, gstRate: 0.05 }
    ],
    crossBorderRules: [
        { originCountry: 'US', destinationCountry: 'CA', determinedTaxCode: 'I3', determinedRate: 0 },
        { originCountry: 'US', destinationCountry: 'DE', determinedTaxCode: 'RC', determinedRate: 0 }
    ],
    vendorProfiles: [
        { vendorId: 'EXEMPT001', taxStatus: 'EXEMPT', exemptionCertificate: 'CERT-001', exemptionExpiry: '2099-12-31' },
        { vendorId: 'EXEMPT002', taxStatus: 'EXEMPT', exemptionCertificate: null, exemptionExpiry: '2099-12-31' }
    ],
    adminRules: [
        { ID: 'R-TRAVEL', ruleName: 'Travel expenses', priority: 10, expenseType: 'TRAVEL', determinedTaxCode: 'I1' },
        { ID: 'R-INSURANCE', ruleName: 'Insurance exempt', priority: 10, expenseType: 'INSURANCE', determinedTaxCode: 'V0', determinedTaxRate: 0 },
        { ID: 'R-DE', ruleName: 'Germany domestic', priority: 20, companyCode: '3000', shipToCountry: 'DE', determinedTaxCode: 'VN', determinedTaxRate: 0.19 }
    ]
};

function createSeededEngine(adminRules = SEED.adminRules) {
    const engine = new TaxDeterminationEngineV2();
    const c = engine.cache;
    SEED.companyConfigs.forEach(x => c.companyConfigs.set(x.companyCode, x));
    SEED.plantConfigs.forEach(x => c.plantConfigs.set(`${x.companyCode_companyCode}-${x.plantCode}`, x));
    SEED.usStates.forEach(x => c.usStates.set(x.stateCode, x));
    SEED.caProvinces.forEach(x => c.caProvinces.set(x.provinceCode, x));
    SEED.crossBorderRules.forEach(x => c.crossBorderRules.set(`${x.originCountry}-${x.destinationCountry}`, x));
    SEED.vendorProfiles.forEach(x => c.vendorProfiles.set(x.vendorId, x));
    c.adminRules = adminRules;
    engine.initialized = true;
    engine.cacheTimestamp = Date.now();
    return engine;
}

function expectDetermined(result) {
    expect(result.success).toBe(true);
    expect(result.status).toBe('DETERMINED');
    expect(result.errorCode).toBeNull();
    expect(result.taxCode).toBeTruthy();
}

function expectException(result, errorCode) {
    expect(result.success).toBe(false);
    expect(result.status).toBe('EXCEPTION');
    expect(result.errorCode).toBe(errorCode);
    expect(result.taxCode).toBeNull();
    expect(result.taxRate).toBeNull();
    expect(result.taxAmount).toBeNull();
}

function assertExpected(result, expected) {
    if (expected.taxCode) {
        expect(result.taxCode).toBe(expected.taxCode);
    }
    if (expected.determinationLayer) {
        expect(result.determinationLayer).toBe(expected.determinationLayer);
    }
    if (expected.taxCodeNotNull) {
        expect(result.taxCode).not.toBeNull();
    }
    if (expected.confidenceScore) {
        expect(result.confidenceScore).toBe(expected.confidenceScore);
    }
    if (expected.taxRate !== undefined) {
        expect(result.taxRate).toBe(expected.taxRate);
    }
    if (expected.taxRateMin !== undefined) {
        expect(result.taxRate).toBeGreaterThanOrEqual(expected.taxRateMin);
    }
    if (expected.requiresReview) {
        expect(result.requiresReview).toBe(true);
    }
    if (expected.taxAmount !== undefined) {
        expect(result.taxAmount).toBe(expected.taxAmount);
    }
}

describe('Tax Determination Engine V2 - Deterministic, Fail-Closed', () => {
    let engine;

    beforeAll(() => {
        global.SELECT = {
            one: { from: jest.fn(() => ({ where: jest.fn().mockResolvedValue(null) })) }
        };
    });

    afterAll(() => {
        delete global.SELECT;
    });

    beforeEach(() => {
        engine = createSeededEngine();
    });

    // =========================================================================
    // CORE GUARANTEE TEST
    // =========================================================================

    describe('Core Guarantee: Configured Tax Code Or Explicit Exception', () => {
        it('should return an exception instead of a default tax code when nothing matches', async () => {
            const contexts = [
                { companyCode: '1000' },
                { companyCode: '1000', invoiceType: 'PO_BASED' },
                { companyCode: '1000', invoiceType: 'NON_PO' },
                { companyCode: '1000', vendorId: 'UNKNOWN' },
                { companyCode: '1000', shipToCountry: 'XX' }
            ];

            for (const context of contexts) {
                const result = await engine.determineTax(context);
                expectException(result, 'NO_TAX_DETERMINATION');
                expect(result.determinationLayer).toBeNull();
            }
        });

        it('should fail with COMPANY_CODE_REQUIRED for missing company code', async () => {
            expectException(await engine.determineTax({}), 'COMPANY_CODE_REQUIRED');
            expectException(await engine.determineTax(null), 'COMPANY_CODE_REQUIRED');
            expectException(await engine.determineNonPOTax({}), 'COMPANY_CODE_REQUIRED');
        });

        it('should fail with COMPANY_NOT_CONFIGURED for unknown company code', async () => {
            const result = await engine.determineTax({ companyCode: '9999', shipToCountry: 'US', shipToRegion: 'CA' });
            expectException(result, 'COMPANY_NOT_CONFIGURED');
        });

        it('should fail with EXCEPTION when configuration cannot be loaded', async () => {
            cds.connect.to.mockRejectedValue(new Error('db unavailable'));
            const unseeded = new TaxDeterminationEngineV2();

            const result = await unseeded.determineTax({ companyCode: '1000', shipToCountry: 'US', shipToRegion: 'CA' });
            expectException(result, 'EXCEPTION');
            expect(result.error).toBe('db unavailable');

            const nonPo = await unseeded.determineNonPOTax({ companyCode: '1000', shipToCountry: 'US', shipToRegion: 'CA' });
            expectException(nonPo, 'EXCEPTION');
            cds.connect.to.mockReset();
        });
    });

    // =========================================================================
    // PO-BASED INVOICE TESTS
    // =========================================================================

    describe('PO-Based Invoice Tax Determination', () => {
        Object.entries(TEST_SCENARIOS.PO_BASED).forEach(([name, scenario]) => {
            it(`should handle ${scenario.description}`, async () => {
                const result = await engine.determineTax(scenario.context);
                expectDetermined(result);
                assertExpected(result, scenario.expected);
            });
        });
    });

    // =========================================================================
    // NON-PO INVOICE TESTS
    // =========================================================================

    describe('Non-PO Invoice Tax Determination', () => {
        Object.entries(TEST_SCENARIOS.NON_PO).forEach(([name, scenario]) => {
            it(`should handle ${scenario.description}`, async () => {
                const result = await engine.determineNonPOTax(scenario.context);
                expectDetermined(result);
                assertExpected(result, scenario.expected);
            });
        });

        it('should fail with EXEMPTION_CERTIFICATE_MISSING for exempt vendor without certificate', async () => {
            const result = await engine.determineNonPOTax({ companyCode: '1000', vendorId: 'EXEMPT002', grossAmount: 100 });
            expectException(result, 'EXEMPTION_CERTIFICATE_MISSING');
        });

        it('should fail with EXEMPT_TAX_CODE_NOT_CONFIGURED when company has no exempt tax code', async () => {
            const result = await engine.determineNonPOTax({ companyCode: '4000', vendorId: 'EXEMPT001', grossAmount: 100 });
            expectException(result, 'EXEMPT_TAX_CODE_NOT_CONFIGURED');
        });
    });

    // =========================================================================
    // US STATE TESTS
    // =========================================================================

    describe('US State Tax Determination', () => {
        Object.entries(TEST_SCENARIOS.US_STATES).forEach(([name, scenario]) => {
            it(`should handle ${scenario.description}`, async () => {
                const result = await engine.determineTax(scenario.context);
                expectDetermined(result);
                expect(result.determinationLayer).toBe('GEOGRAPHIC_DEFAULTS');
                assertExpected(result, scenario.expected);
            });
        });

        it('should fail closed for an unconfigured state', async () => {
            const result = await engine.determineTax({
                companyCode: '1000', shipToCountry: 'US', shipToRegion: 'FL', grossAmount: 1000.00
            });
            expectException(result, 'NO_TAX_DETERMINATION');
        });
    });

    // =========================================================================
    // CANADIAN PROVINCE TESTS
    // =========================================================================

    describe('Canadian Provincial Tax Determination', () => {
        Object.entries(TEST_SCENARIOS.CANADA).forEach(([name, scenario]) => {
            it(`should handle ${scenario.description}`, async () => {
                const result = await engine.determineTax(scenario.context);
                expectDetermined(result);
                assertExpected(result, scenario.expected);
            });
        });

        it('should fail closed for an unconfigured province', async () => {
            const result = await engine.determineTax({
                companyCode: '2000', shipToCountry: 'CA', shipToRegion: 'NU', grossAmount: 1000.00
            });
            expectException(result, 'NO_TAX_DETERMINATION');
        });
    });

    // =========================================================================
    // CROSS-BORDER TESTS
    // =========================================================================

    describe('Cross-Border Tax Determination', () => {
        Object.entries(TEST_SCENARIOS.CROSS_BORDER).forEach(([name, scenario]) => {
            it(`should handle ${scenario.description}`, async () => {
                const result = await engine.determineTax(scenario.context);
                expectDetermined(result);
                assertExpected(result, scenario.expected);
            });
        });
    });

    // =========================================================================
    // DETERMINATION LAYER TESTS
    // =========================================================================

    describe('Layered Determination Without Company Default', () => {
        Object.entries(TEST_SCENARIOS.FALLBACK).forEach(([name, scenario]) => {
            it(`should handle ${scenario.description}`, async () => {
                const result = await engine.determineTax(scenario.context);

                if (scenario.expected.successTrue) {
                    expectDetermined(result);
                }
                if (scenario.expected.successFalse) {
                    expectException(result, scenario.expected.errorCode);
                }
                if (scenario.expected.taxCodeNotNull) {
                    expect(result.taxCode).not.toBeNull();
                }
                if (scenario.expected.determinationLayer) {
                    expect(result.determinationLayer).toBe(scenario.expected.determinationLayer);
                }
            });
        });

        it('should track determination path', async () => {
            const result = await engine.determineTax({
                companyCode: '1000',
                shipToCountry: 'US',
                shipToRegion: 'CA',
                grossAmount: 1000.00
            });

            expect(Array.isArray(result.determinationPath)).toBe(true);
            expect(result.determinationPath.length).toBeGreaterThan(0);
        });

        it('should fail with AMBIGUOUS_TAX_RULE for equal-priority rules with different outcomes', async () => {
            engine = createSeededEngine([
                { ID: 'R-A', ruleName: 'Rule A', priority: 5, glAccount: '6400100', determinedTaxCode: 'A1' },
                { ID: 'R-B', ruleName: 'Rule B', priority: 5, glAccount: '6400100', determinedTaxCode: 'A2' }
            ]);

            const result = await engine.determineTax({
                companyCode: '1000', glAccount: '6400100', shipToCountry: 'US', shipToRegion: 'CA'
            });

            expectException(result, 'AMBIGUOUS_TAX_RULE');
            expect(result.candidates.map(c => c.taxCode)).toEqual(['A1', 'A2']);
        });

        it('should use the rule when equal-priority rules agree', async () => {
            engine = createSeededEngine([
                { ID: 'R-A', ruleName: 'Rule A', priority: 5, glAccount: '6400100', determinedTaxCode: 'A1' },
                { ID: 'R-B', ruleName: 'Rule B', priority: 5, glAccount: '6400100', determinedTaxCode: 'A1' }
            ]);

            const result = await engine.determineTax({ companyCode: '1000', glAccount: '6400100' });

            expectDetermined(result);
            expect(result.taxCode).toBe('A1');
            expect(result.ruleId).toBe('R-A');
        });

        it('should ignore a matching rule without a tax code', async () => {
            engine = createSeededEngine([
                { ID: 'R-EMPTY', ruleName: 'Empty rule', priority: 1, costCenter: 'CC1', determinedTaxCode: null }
            ]);

            const result = await engine.determineTax({
                companyCode: '1000', costCenter: 'CC1', shipToCountry: 'US', shipToRegion: 'NY'
            });

            expectDetermined(result);
            expect(result.determinationLayer).toBe('GEOGRAPHIC_DEFAULTS');
        });
    });

    // =========================================================================
    // SPECIAL CASES TESTS
    // =========================================================================

    describe('Special Cases', () => {
        Object.entries(TEST_SCENARIOS.SPECIAL).forEach(([name, scenario]) => {
            it(`should handle ${scenario.description}`, async () => {
                const result = await engine.determineTax(scenario.context);
                expectDetermined(result);
                assertExpected(result, scenario.expected);
            });
        });

        it('should never estimate a tax amount locally', async () => {
            const result = await engine.determineTax({
                companyCode: '1000', shipToCountry: 'US', shipToRegion: 'CA', grossAmount: 1000.00
            });

            expectDetermined(result);
            expect(result.taxAmount).toBeNull();
        });

        it('should flag test determinations', async () => {
            const result = await engine.testDetermination({ companyCode: '1000' });
            expect(result.isTest).toBe(true);
            expectException(result, 'NO_TAX_DETERMINATION');
        });
    });

    // =========================================================================
    // EXPLANATION TESTS
    // =========================================================================

    describe('Tax Determination Explanation', () => {
        it('should provide detailed explanation', async () => {
            const explanation = await engine.explainDetermination({
                companyCode: '1000',
                shipToCountry: 'US',
                shipToRegion: 'CA',
                shipToZipCode: '90210',
                grossAmount: 1000.00,
                currency: 'USD'
            });

            expect(explanation.input).toBeDefined();
            expect(explanation.result.taxCode).toBe('I1');
            expect(explanation.determinationLayer).toBe('GEOGRAPHIC_DEFAULTS');
            expect(typeof explanation.layerExplanation).toBe('string');
            expect(Array.isArray(explanation.determinationPath)).toBe(true);
        });

        it('should provide recommendations when no determination is possible', async () => {
            const explanation = await engine.explainDetermination({
                companyCode: '1000'
            });

            expect(explanation.determinationLayer).toBeNull();
            expect(explanation.result.taxCode).toBeNull();
            expect(explanation.recommendations).toContain(
                'Provide ship-to state/province for more accurate geographic tax determination'
            );
        });
    });

    // =========================================================================
    // PERFORMANCE TESTS
    // =========================================================================

    describe('Performance', () => {
        it('should handle batch processing', async () => {
            const promises = [];

            for (let i = 0; i < 100; i++) {
                promises.push(engine.determineTax({
                    companyCode: '1000',
                    shipToCountry: 'US',
                    shipToRegion: ['CA', 'NY', 'TX'][i % 3],
                    grossAmount: (i + 1) * 100
                }));
            }

            const results = await Promise.all(promises);
            results.forEach(r => expectDetermined(r));
        });
    });
});

// Export test scenarios for reuse
module.exports = { TEST_SCENARIOS };
