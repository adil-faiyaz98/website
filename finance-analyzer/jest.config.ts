import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/test"],
  testMatch: ["**/*.test.ts"],
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  moduleNameMapper: {
    "^@srv/(.*)$": "<rootDir>/srv/$1",
    "^@db/(.*)$": "<rootDir>/db/$1",
    "^@test/(.*)$": "<rootDir>/test/$1",
  },
  collectCoverageFrom: [
    "srv/**/*.ts",
    "!srv/**/*.d.ts",
    "!srv/**/index.ts",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov"],
  verbose: true,
};

export default config;
