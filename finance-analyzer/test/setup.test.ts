import * as fc from "fast-check";

describe("Project Setup Verification", () => {
  it("should have fast-check available for property-based testing", () => {
    const result = fc.check(
      fc.property(fc.integer({ min: 0, max: 100 }), (score) => {
        return score >= 0 && score <= 100;
      })
    );
    expect(result.failed).toBe(false);
  });

  it("should have TypeScript configured correctly", () => {
    const value: number = 42;
    expect(typeof value).toBe("number");
  });
});
