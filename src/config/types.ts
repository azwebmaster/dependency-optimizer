export interface DepOptimizerConfig {
  // Global settings
  verbose?: boolean;
  json?: boolean;
  prod?: boolean;
  parallel?: boolean;
  
  // Command-specific configurations
  unused?: Record<string, any>;
  size?: Record<string, any>;
  duplicates?: Record<string, any>;
  tree?: Record<string, any>;
  devcheck?: Record<string, any>;
}

export interface ConfigLoaderOptions {
  configPath?: string;
  packageJsonPath?: string;
  searchUp?: boolean;
}
