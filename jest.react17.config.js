const base = require('./jest.config');

module.exports = {
  ...base,
  displayName: 'react-17',
  testPathIgnorePatterns: [
    ...base.testPathIgnorePatterns,
    'package-entry.test.js',
  ],
  moduleNameMapper: {
    ...base.moduleNameMapper,
    '^react$': '<rootDir>/test/react17/node_modules/react',
    '^react/(.*)$': '<rootDir>/test/react17/node_modules/react/$1',
    '^react-dom$': '<rootDir>/test/react17/node_modules/react-dom',
    '^react-dom/(.*)$': '<rootDir>/test/react17/node_modules/react-dom/$1',
    '^@testing-library/react$': '<rootDir>/test/react17/node_modules/@testing-library/react',
  },
};
