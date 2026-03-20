/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  testMatch: ['**/tests/unit/**/*.test.js'],
  rootDir: '..',
  moduleDirectories: ['node_modules', 'backend/node_modules'],
};

module.exports = config;
