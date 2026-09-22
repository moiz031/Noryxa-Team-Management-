// jest.config.js
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  setupFiles: ["<rootDir>/tests/setup-env.ts"],
  setupFilesAfterEnv: ["<rootDir>/tests/jest.setup.ts"],
  testTimeout: 30000,
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          target: "ES2020",
          module: "commonjs",
          moduleResolution: "node",
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          jsx: "react-jsx",
          strict: false,
          skipLibCheck: true,
        },
      },
    ],
  },
};
