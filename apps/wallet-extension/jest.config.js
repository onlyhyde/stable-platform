/** @type {import('jest').Config} */
module.exports = {
  projects: [
    // Project 1: Unit security tests - use REAL @stablenet/core (built dist)
    {
      displayName: 'unit-security',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/tests/unit/security'],
      testMatch: ['**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/tests/setupEnv.ts'],
      moduleNameMapper: {
        '^@stablenet/core$': '<rootDir>/../../packages/sdk-ts/core/src/index.ts',
        '^@stablenet/sdk-types$': '<rootDir>/../../packages/sdk-ts/types/src/index.ts',
        '^@stablenet/types$': '<rootDir>/../../packages/types/src/index.ts',
        '^@stablenet/contracts$': '<rootDir>/../../packages/contracts/src/index.ts',
      },
    },
    // Project 2: Tests needing jsdom (inpage, setup.test, UI components/hooks)
    {
      displayName: 'jsdom',
      preset: 'ts-jest',
      testEnvironment: 'jsdom',
      roots: ['<rootDir>/tests/unit'],
      testMatch: [
        '**/inpage/**/*.test.ts',
        '**/setup.test.ts',
        '**/ui/**/*.test.ts',
        '**/ui/**/*.test.tsx',
      ],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
      moduleNameMapper: {
        '^@stablenet/core$': '<rootDir>/tests/utils/__mocks__/stablenetCore.js',
        '^@stablenet/plugin-stealth$': '<rootDir>/tests/utils/__mocks__/stablenetPluginStealth.js',
        '^@stablenet/contracts$': '<rootDir>/tests/utils/__mocks__/stablenetContracts.js',
      },
    },
    // Project 3: All other tests - node env with mocked @stablenet/core
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/tests'],
      testMatch: ['**/*.test.ts'],
      testPathIgnorePatterns: [
        'tests/unit/security/',
        'tests/unit/inpage/',
        'tests/unit/ui/',
        'setup\\.test\\.ts$',
      ],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
      moduleNameMapper: {
        '^@stablenet/core$': '<rootDir>/tests/utils/__mocks__/stablenetCore.js',
        '^@stablenet/plugin-stealth$': '<rootDir>/tests/utils/__mocks__/stablenetPluginStealth.js',
        '^@stablenet/contracts$': '<rootDir>/tests/utils/__mocks__/stablenetContracts.js',
      },
    },
  ],
}
