// Re-exports the test-only reset hook so test files can import from a
// clearly test-scoped module rather than directly from the production file.
export { __resetMissingI18nKeyReporterForTests } from './missing-key-reporter';
