export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/packages/**/*.test.js',
  ],
  collectCoverageFrom: [
    'packages/**/*.js',
    '!packages/**/node_modules/**',
    '!packages/**/dist/**',
    '!packages/**/*.test.js',
    '!packages/**/__tests__/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  verbose: true,
};

