/**
 * Type definitions for VATS Desktop application
 *
 * This file contains all shared TypeScript interfaces and types used across
 * the service layer, stores, and components.
 */

/** Supported AI providers for summarization */
export type AIProvider = 'ollama' | 'gemini' | 'deepseek' | 'openrouter' | 'zai';

/** Performance profiles that auto-tune Whisper and processing parameters */
export type PerformanceProfile = 'speed' | 'balanced' | 'quality';

/** Whisper model sizes - trade off between speed and accuracy */
export type WhisperModel = 'tiny' | 'base' | 'small' | 'medium' | 'large';

/** Options for single file processing */
export interface ProcessOptions {
  /** Skip summarization step (transcription only) */
  noSummary?: boolean;
  /** Performance profile to use for processing */
  profile?: PerformanceProfile;
}

/** Options for bulk processing multiple files */
export interface BulkOptions {
  /** Maximum number of files to process concurrently */
  maxConcurrent?: number;
  /** Skip summarization step for all files */
  noSummary?: boolean;
}

/** A single line of terminal output with metadata */
export interface TerminalLine {
  /** Output stream type */
  type: 'stdout' | 'stderr' | 'system';
  /** The actual line content */
  line: string;
  /** Unix timestamp when the line was received */
  timestamp: number;
}

/** System status information including GPU availability and current configuration */
export interface SystemStatus {
  /** Whether any GPU is available for acceleration */
  gpu_available: boolean;
  /** List of detected GPU device names */
  gpu_devices: string[];
  /** GPU memory info keyed by device name */
  gpu_memory: Record<string, {
    /** Total memory in gigabytes */
    total_gb: number;
    /** Current utilization percentage (0-100) */
    utilization_percent: number;
  }>;
  /** Current VATS configuration */
  configuration: {
    performance_profile: PerformanceProfile;
    whisper_model: WhisperModel;
    ai_model: AIProvider;
  };
}

/** Cache statistics from VATS caching system */
export interface CacheStats {
  /** Human-readable size of model cache */
  model_cache_size: string;
  /** Human-readable size of result cache */
  result_cache_size: string;
  /** Total number of cached entries */
  total_entries: number;
  /** Date of oldest cache entry or null if empty */
  oldest_entry: string | null;
}

/** Complete VATS configuration with masked API keys */
export interface VatsConfig {
  /** Selected AI provider for summarization */
  AI_MODEL: AIProvider;
  /** Whisper model size for transcription */
  WHISPER_MODEL: WhisperModel;
  /** Language code for Whisper (e.g., 'en', 'auto') */
  WHISPER_LANGUAGE: string;
  /** Current performance profile */
  PERFORMANCE_PROFILE: PerformanceProfile;
  /** Fraction of GPU memory to use (0.0-1.0) */
  GPU_MEMORY_FRACTION: number;
  /** GPU device selection (auto, 0, 1, 2, 3) */
  GPU_DEVICE?: string;
  /** Enable multi-GPU processing */
  ENABLE_MULTI_GPU?: boolean;
  /** Use whisper.cpp backend */
  USE_WHISPER_CPP?: boolean;
  /** Path to whisper.cpp executable */
  WHISPER_CPP_PATH?: string;
  /** Enable speaker diarization */
  ENABLE_DIARIZATION: boolean;
  /** Enable AI summarization */
  ENABLE_SUMMARIZATION: boolean;
  /** Maximum concurrent files in bulk processing */
  MAX_CONCURRENT_FILES: number;
  /** API keys (masked in UI) */
  GEMINI_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  ZAI_API_KEY?: string;
}

/** Result of a file processing operation */
export interface ProcessResult {
  /** Path to the processed file */
  file: string;
  /** Whether processing succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Path to generated transcript if available */
  transcriptPath?: string;
  /** Path to generated summary if available */
  summaryPath?: string;
  /** Processing duration in seconds */
  duration?: number;
}

/** Status of a file in the processing queue */
export interface QueueItem {
  /** File path */
  file: string;
  /** Current status */
  status: 'pending' | 'processing' | 'completed' | 'failed';
  /** Progress percentage (0-100) */
  progress: number;
  /** Error message if failed */
  error?: string;
}

/** Event payload for process-output events from Tauri backend */
export interface ProcessOutputEvent {
  /** Type of output stream */
  type: 'stdout' | 'stderr' | 'system';
  /** The output line content */
  line: string;
}

/** Event payload for process-complete events from Tauri backend */
export interface ProcessCompleteEvent {
  /** Whether processing succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Path to transcript output */
  transcriptPath?: string;
  /** Path to summary output */
  summaryPath?: string;
}
