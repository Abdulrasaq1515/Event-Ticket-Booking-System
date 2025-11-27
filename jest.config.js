module.exports = {
  testEnvironment: 'node',

  testMatch: [
    '<rootDir>/test/unit_test/**/*.test.js',
    '<rootDir>/test/integration_test/**/*.test.js',
    '<rootDir>/test/unit_test/**/*.spec.js',
    '<rootDir>/test/integration_test/**/*.spec.js',
  ],

  collectCoverage: true,
  collectCoverageFrom: [
    'test/unit_test/**/*.(test|spec).js',
    'test/integration_test/**/*.(test|spec).js',
  ],

  coverageDirectory: 'coverage',
};