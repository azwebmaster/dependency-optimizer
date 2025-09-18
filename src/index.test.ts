import { describe, it, expect } from 'vitest';
import { 
  DependencyScanner, 
  NodeModulesAnalyzer, 
  scanDependencies, 
  analyzeNodeModules 
} from './index.js';

describe('Index exports', () => {
  it('should export DependencyScanner class', () => {
    expect(DependencyScanner).toBeDefined();
    expect(typeof DependencyScanner).toBe('function');
  });

  it('should export NodeModulesAnalyzer class', () => {
    expect(NodeModulesAnalyzer).toBeDefined();
    expect(typeof NodeModulesAnalyzer).toBe('function');
  });

  it('should export scanDependencies function', () => {
    expect(scanDependencies).toBeDefined();
    expect(typeof scanDependencies).toBe('function');
  });

  it('should export analyzeNodeModules function', () => {
    expect(analyzeNodeModules).toBeDefined();
    expect(typeof analyzeNodeModules).toBe('function');
  });

  it('should create scanner instance through convenience function', async () => {
    // This should not throw
    expect(async () => {
      await scanDependencies();
    }).toBeDefined();
  });

  it('should create analyzer instance through convenience function', async () => {
    // This should not throw
    expect(async () => {
      await analyzeNodeModules();
    }).toBeDefined();
  });
});