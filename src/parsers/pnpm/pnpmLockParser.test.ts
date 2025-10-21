import { describe, it, expect } from 'vitest';
import { PnpmLockParser } from './pnpmLockParser.js';

describe('PnpmLockParser', () => {
  let parser: PnpmLockParser;

  it('should create parser instance', () => {
    parser = new PnpmLockParser();
    expect(parser).toBeDefined();
  });

  it('should have required methods', () => {
    parser = new PnpmLockParser();
    expect(typeof parser.parseAndNormalize).toBe('function');
    expect(typeof parser.buildDependencyTree).toBe('function');
  });
});