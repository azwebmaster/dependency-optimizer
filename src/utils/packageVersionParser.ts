/**
 * Utility functions for parsing package@version format
 */

export interface PackageVersionSpec {
  name: string;
  version?: string;
}

/**
 * Parse a package specification that may include a version
 * Supports formats:
 * - "package-name" (name only)
 * - "package-name@1.2.3" (name with exact version)
 * - "package-name@^1.2.3" (name with semver range)
 * - "@scope/package-name@1.2.3" (scoped package with version)
 */
export function parsePackageVersionSpec(spec: string): PackageVersionSpec {
  if (!spec || typeof spec !== 'string') {
    throw new Error('Package specification must be a non-empty string');
  }

  // Handle scoped packages like @scope/package@version
  const scopedMatch = spec.match(/^(@[^/]+\/[^@]+)@(.+)$/);
  if (scopedMatch) {
    return {
      name: scopedMatch[1],
      version: scopedMatch[2]
    };
  }

  // Handle regular packages like package@version
  const regularMatch = spec.match(/^([^@]+)@(.+)$/);
  if (regularMatch) {
    return {
      name: regularMatch[1],
      version: regularMatch[2]
    };
  }

  // No version specified, just return the name
  return {
    name: spec
  };
}

/**
 * Check if a package node matches the given package version specification
 */
export function matchesPackageVersionSpec(
  node: { name: string; version: string },
  spec: PackageVersionSpec
): boolean {
  // First check if the name matches
  if (node.name !== spec.name) {
    return false;
  }

  // If no version specified in the spec, any version matches
  if (!spec.version) {
    return true;
  }

  // For exact version matching, we'll do a simple string comparison
  // In the future, this could be enhanced to support semver ranges
  return node.version === spec.version;
}

/**
 * Check if a package name matches the given package specification (ignoring version)
 * This is useful for partial matching when version is not specified
 */
export function matchesPackageName(
  packageName: string,
  spec: PackageVersionSpec
): boolean {
  return packageName === spec.name || packageName.includes(spec.name);
}
