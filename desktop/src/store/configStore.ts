/**
 * Configuration Store - Zustand state management for VATS configuration
 *
 * This store manages the application configuration including AI provider settings,
 * Whisper model selection, and API keys. It provides a reactive interface for
 * components to access and update configuration.
 *
 * The store handles:
 * - Loading config from the backend
 * - Updating individual config values
 * - Resetting to defaults
 * - Loading and error states
 */

import { create } from 'zustand';
import { vatsService } from '@/services/vats';
import type { VatsConfig, AIProvider, PerformanceProfile, WhisperModel } from '@/services/types';

/**
 * State shape for the configuration store
 */
interface ConfigState {
  /** Current configuration values, or null if not loaded */
  config: VatsConfig | null;
  /** True while loading configuration from backend */
  loading: boolean;
  /** Error message from the last failed operation, or null */
  error: string | null;

  /**
   * Load configuration from the backend
   *
   * Fetches the current .env configuration and parses it into a VatsConfig object.
   * Sets loading state during the operation and handles errors.
   */
  loadConfig: () => Promise<void>;

  /**
   * Update a single configuration value
   *
   * Sends the update to the backend and refreshes the local config.
   * Automatically converts string values to appropriate types.
   *
   * @param key - Configuration key (e.g., 'AI_MODEL', 'WHISPER_MODEL')
   * @param value - New value as a string (backend expects strings)
   */
  updateConfig: (key: string, value: string) => Promise<void>;

  /**
   * Reset configuration to defaults
   *
   * Resets the backend configuration to default values and reloads the config.
   */
  resetConfig: () => Promise<void>;

  /**
   * Clear any error state
   *
   * Useful for dismissing error messages in the UI.
   */
  clearError: () => void;
}

/**
 * Helper to parse config values from strings
 *
 * The backend returns all config values as strings, but we want proper types
 * in our VatsConfig interface.
 */
function parseConfig(rawConfig: Record<string, string>): VatsConfig {
  // Helper to parse boolean strings
  const parseBool = (val: string | undefined): boolean => {
    if (!val) return false;
    return val.toLowerCase() === 'true' || val === '1';
  };

  // Helper to parse number strings
  const parseNum = (val: string | undefined, defaultValue: number): number => {
    if (!val) return defaultValue;
    const parsed = parseFloat(val);
    return isNaN(parsed) ? defaultValue : parsed;
  };

  // Helper to parse enum with validation
  const parseEnum = <T extends string>(
    val: string | undefined,
    validValues: readonly T[],
    defaultValue: T
  ): T => {
    if (!val) return defaultValue;
    return validValues.includes(val as T) ? (val as T) : defaultValue;
  };

  const aiProviders = ['ollama', 'gemini', 'deepseek', 'openrouter', 'zai'] as const;
  const performanceProfiles = ['speed', 'balanced', 'quality'] as const;
  const whisperModels = ['tiny', 'base', 'small', 'medium', 'large'] as const;

  return {
    AI_MODEL: parseEnum(rawConfig.AI_MODEL, aiProviders, 'ollama'),
    WHISPER_MODEL: parseEnum(rawConfig.WHISPER_MODEL, whisperModels, 'small'),
    WHISPER_LANGUAGE: rawConfig.WHISPER_LANGUAGE || 'auto',
    PERFORMANCE_PROFILE: parseEnum(rawConfig.PERFORMANCE_PROFILE, performanceProfiles, 'balanced'),
    GPU_MEMORY_FRACTION: parseNum(rawConfig.GPU_MEMORY_FRACTION, 0.9),
    GPU_DEVICE: rawConfig.GPU_DEVICE || 'auto',
    ENABLE_MULTI_GPU: parseBool(rawConfig.ENABLE_MULTI_GPU),
    USE_WHISPER_CPP: parseBool(rawConfig.USE_WHISPER_CPP),
    WHISPER_CPP_PATH: rawConfig.WHISPER_CPP_PATH,
    ENABLE_DIARIZATION: parseBool(rawConfig.ENABLE_DIARIZATION),
    ENABLE_SUMMARIZATION: parseBool(rawConfig.ENABLE_SUMMARIZATION),
    MAX_CONCURRENT_FILES: parseNum(rawConfig.MAX_CONCURRENT_FILES, 3),
    GEMINI_API_KEY: rawConfig.GEMINI_API_KEY,
    DEEPSEEK_API_KEY: rawConfig.DEEPSEEK_API_KEY,
    OPENROUTER_API_KEY: rawConfig.OPENROUTER_API_KEY,
    ZAI_API_KEY: rawConfig.ZAI_API_KEY,
  };
}

/**
 * Configuration store
 *
 * @example
 * ```tsx
 * function ConfigPanel() {
 *   const { config, loading, updateConfig } = useConfigStore();
 *
 *   if (loading) return <Spinner />;
 *   if (!config) return null;
 *
 *   return (
 *     <select
 *       value={config.AI_MODEL}
 *       onChange={(e) => updateConfig('AI_MODEL', e.target.value)}
 *     >
 *       <option value="ollama">Ollama</option>
 *       <option value="gemini">Gemini</option>
 *     </select>
 *   );
 * }
 * ```
 */
export const useConfigStore = create<ConfigState>((set, get) => ({
  config: null,
  loading: false,
  error: null,

  loadConfig: async () => {
    set({ loading: true, error: null });
    try {
      const rawConfig = await vatsService.getConfig();
      set({ config: parseConfig(rawConfig), loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load configuration';
      set({ error: message, loading: false });
    }
  },

  updateConfig: async (key: string, value: string) => {
    set({ loading: true, error: null });
    try {
      await vatsService.updateConfig(key, value);
      // Reload config to get the updated state
      const rawConfig = await vatsService.getConfig();
      set({ config: parseConfig(rawConfig), loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update configuration';
      set({ error: message, loading: false });
    }
  },

  resetConfig: async () => {
    set({ loading: true, error: null });
    try {
      await vatsService.resetConfig();
      // Reload config to get the default values
      const rawConfig = await vatsService.getConfig();
      set({ config: parseConfig(rawConfig), loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset configuration';
      set({ error: message, loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));

/**
 * Selector hooks for commonly used config values
 *
 * These hooks allow components to subscribe to specific config values
 * without causing unnecessary re-renders when other values change.
 *
 * @example
 * ```tsx
 * function AISelector() {
 *   const aiModel = useAIModel();
 *   const setAIModel = useUpdateAIModel();
 *   // ...
 * }
 * ```
 */
export const useAIModel = () => useConfigStore((state) => state.config?.AI_MODEL ?? 'ollama');
export const useWhisperModel = () => useConfigStore((state) => state.config?.WHISPER_MODEL ?? 'small');
export const usePerformanceProfile = () => useConfigStore((state) => state.config?.PERFORMANCE_PROFILE ?? 'balanced');
export const useDiarizationEnabled = () => useConfigStore((state) => state.config?.ENABLE_DIARIZATION ?? false);
export const useSummarizationEnabled = () => useConfigStore((state) => state.config?.ENABLE_SUMMARIZATION ?? true);

/**
 * Action hooks for common config operations
 */
export const useLoadConfig = () => useConfigStore((state) => state.loadConfig);
export const useUpdateConfig = () => useConfigStore((state) => state.updateConfig);
export const useResetConfig = () => useConfigStore((state) => state.resetConfig);
