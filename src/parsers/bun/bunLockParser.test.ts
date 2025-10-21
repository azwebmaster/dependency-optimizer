import { describe, it, expect } from 'vitest';
import { BunLockParser } from './bunLockParser.js';

describe('BunLockParser', () => {
  let parser: BunLockParser;

  it('should create parser instance', () => {
    parser = new BunLockParser();
    expect(parser).toBeDefined();
  });

  it('should have required methods', () => {
    parser = new BunLockParser();
    expect(typeof parser.parseAndNormalize).toBe('function');
    expect(typeof parser.buildDependencyTree).toBe('function');
  });
});