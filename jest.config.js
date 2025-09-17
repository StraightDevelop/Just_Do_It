/** @type {import('jest').Config} */
module.exports = {
  rootDir: __dirname,
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@mr-leo/shared/(.*)$': '<rootDir>/packages/shared/src/$1'
  },
  testMatch: ['**/?(*.)+(spec|test).ts']
};
