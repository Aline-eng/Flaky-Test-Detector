/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testMatch: ['**/*.test.ts'],
  setupFiles: ['<rootDir>/test-setup.ts'],
  clearMocks: true,
  coverageDirectory: '<rootDir>/../coverage',
  collectCoverageFrom: ['**/*.ts', '!**/*.test.ts', '!**/__tests__/**', '!**/__fixtures__/**'],
};
