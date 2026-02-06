/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests', '<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Module path aliases (match tsconfig paths)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@stablenet/core$': '<rootDir>/../../packages/sdk-ts/core/src/index.ts',
    '^@stablenet/sdk-types$': '<rootDir>/../../packages/sdk-ts/types/src/index.ts',
    '^@stablenet/config$': '<rootDir>/../../packages/config/src/index.ts',
    '^@stablenet/plugin-stealth$': '<rootDir>/../../packages/sdk-ts/plugins/stealth/src/index.ts',
    '^@stablenet/wallet-sdk$': '<rootDir>/../../packages/wallet-sdk/src/index.ts',
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  // Transform configuration
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.test.json',
      useESM: true,
    }],
  },

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/types/**/*',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },

  // Ignore patterns
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  transformIgnorePatterns: [
    'node_modules/(?!(viem|@noble|@stablenet)/)',
  ],

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
}

module.exports = config
