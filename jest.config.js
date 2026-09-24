// The pure, portable logic (Schengen calculator + shopping-list
// consolidation) is unit-tested in isolation with ts-jest so `npm test`
// runs without a native/Expo toolchain. These two modules are contract
// code (DESIGN.md §4.3 / §6.3) and must stay green.
/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts"],
  // The `@/` alias from tsconfig.json. Only pure modules may be pulled in this
  // way — anything importing react-native will not survive this environment.
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    // Bundled image assets (the trip-cover registry) resolve to a stub id here,
    // so a pure module that require()s a photo still loads under node.
    "\\.(jpg|jpeg|png|webp)$": "<rootDir>/src/test/assetStub.js",
  },
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.jest.json",
      },
    ],
  },
};
