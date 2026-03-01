/**
 * VATS Service - Frontend service layer for VATS backend operations
 *
 * This service handles all communication with the Tauri backend, including:
 * - File processing with streaming terminal output
 * - Bulk processing operations
 * - System status queries
 * - Cache management
 * - Configuration operations
 *
 * The service uses Tauri's event system for real-time output streaming
 * from long-running Python processes.
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import type {
  TerminalLine,
  ProcessOptions,
  BulkOptions,
  SystemStatus,
  CacheStats,
  VatsConfig,
  ProcessOutputEvent,
  ProcessCompleteEvent,
} from './types';

/**
 * VATS Service class
 *
 * Provides methods to interact with the VATS Python backend via Tauri commands.
 * All async operations that produce output use event listeners for streaming.
 */
class VATSService {
  /**
   * Process a single file with streaming terminal output
   *
   * Sets up an event listener for 'process-output' events, invokes the
   * backend command, and cleans up the listener when processing completes.
   *
   * @param file - Absolute path to the audio/video file
   * @param options - Processing options (noSummary, profile)
   * @param onLine - Callback for each line of terminal output
   * @returns Promise that resolves when processing is complete
   */
  async processFileStream(
    file: string,
    options: ProcessOptions = {},
    onLine: (line: TerminalLine) => void
  ): Promise<void> {
    let unlisten: UnlistenFn | null = null;

    try {
      // Set up event listener for streaming output
      unlisten = await listen<ProcessOutputEvent>('process-output', (event) => {
        onLine({
          type: event.payload.type,
          line: event.payload.line,
          timestamp: Date.now(),
        });
      });

      // Also listen for completion event
      await listen<ProcessCompleteEvent>('process-complete', (event) => {
        if (!event.payload.success) {
          onLine({
            type: 'system',
            line: `Processing failed: ${event.payload.error || 'Unknown error'}`,
            timestamp: Date.now(),
          });
        }
      });

      // Invoke the backend command
      await invoke('process_file_stream', {
        path: file,
        options: {
          no_summary: options.noSummary ?? false,
          profile: options.profile ?? 'balanced',
        },
      });
    } finally {
      // Clean up event listener
      if (unlisten) {
        unlisten();
      }
    }
  }

  /**
   * Process multiple files in bulk with streaming output
   *
   * @param files - Array of absolute paths to process
   * @param options - Bulk processing options
   * @param onLine - Callback for each line of terminal output
   * @returns Promise that resolves when all files are processed
   */
  async bulkProcess(
    files: string[],
    options: BulkOptions = {},
    onLine: (line: TerminalLine) => void
  ): Promise<void> {
    let unlisten: UnlistenFn | null = null;

    try {
      unlisten = await listen<ProcessOutputEvent>('bulk-process-output', (event) => {
        onLine({
          type: event.payload.type,
          line: event.payload.line,
          timestamp: Date.now(),
        });
      });

      await invoke('bulk_process_stream', {
        files,
        options: {
          max_concurrent: options.maxConcurrent ?? 3,
          no_summary: options.noSummary ?? false,
        },
      });
    } finally {
      if (unlisten) {
        unlisten();
      }
    }
  }

  /**
   * High-speed queue processing for all media files in a directory
   *
   * Scans the directory for supported media files and processes them
   * using optimized concurrent processing.
   *
   * @param directory - Absolute path to directory containing media files
   * @param onLine - Callback for each line of terminal output
   * @returns Promise that resolves when directory processing is complete
   */
  async speedQueue(
    directory: string,
    onLine: (line: TerminalLine) => void
  ): Promise<void> {
    let unlisten: UnlistenFn | null = null;

    try {
      unlisten = await listen<ProcessOutputEvent>('speed-queue-output', (event) => {
        onLine({
          type: event.payload.type,
          line: event.payload.line,
          timestamp: Date.now(),
        });
      });

      await invoke('speed_queue', {
        directory,
      });
    } finally {
      if (unlisten) {
        unlisten();
      }
    }
  }

  /**
   * Summarize a document (PDF, DOCX, TXT, MD)
   *
   * Extracts text from the document and generates an AI-powered summary.
   *
   * @param file - Absolute path to the document file
   * @param onLine - Callback for each line of terminal output
   * @returns Promise that resolves when summarization is complete
   */
  async summarizeDocument(
    file: string,
    onLine: (line: TerminalLine) => void
  ): Promise<void> {
    let unlisten: UnlistenFn | null = null;

    try {
      unlisten = await listen<ProcessOutputEvent>('docsummarize-output', (event) => {
        onLine({
          type: event.payload.type,
          line: event.payload.line,
          timestamp: Date.now(),
        });
      });

      await invoke('summarize_document', {
        path: file,
      });
    } finally {
      if (unlisten) {
        unlisten();
      }
    }
  }

  /**
   * Get system status including GPU information
   *
   * Queries the backend for available GPUs, memory info, and current
   * configuration settings.
   *
   * @returns Promise resolving to system status information
   */
  async getSystemStatus(): Promise<SystemStatus> {
    return await invoke<SystemStatus>('get_system_status');
  }

  /**
   * Get cache statistics
   *
   * Returns information about the model and result caches including
   * sizes and entry counts.
   *
   * @returns Promise resolving to cache statistics
   */
  async getCacheStats(): Promise<CacheStats> {
    return await invoke<CacheStats>('get_cache_stats');
  }

  /**
   * Clean up cache files
   *
   * Removes cached models and/or results based on the force parameter.
   *
   * @param force - If true, clears all caches; otherwise only expired entries
   * @returns Promise resolving to a status message
   */
  async cacheCleanup(force: boolean = false): Promise<string> {
    return await invoke<string>('cache_cleanup', { force });
  }

  /**
   * Get current VATS configuration
   *
   * Returns all configuration values from the .env file. API keys are
   * masked for security.
   *
   * @returns Promise resolving to configuration key-value pairs
   */
  async getConfig(): Promise<Record<string, string>> {
    return await invoke<Record<string, string>>('get_config');
  }

  /**
   * Update a single configuration value
   *
   * Updates the .env file with the new value and validates it.
   *
   * @param key - Configuration key name
   * @param value - New value to set
   * @returns Promise that resolves when the config is updated
   */
  async updateConfig(key: string, value: string): Promise<void> {
    await invoke('update_config', { key, value });
  }

  /**
   * Reset configuration to defaults
   *
   * Restores the .env file to default values while preserving
   * API keys if they exist.
   *
   * @returns Promise that resolves when config is reset
   */
  async resetConfig(): Promise<void> {
    await invoke('reset_config');
  }

  /**
   * Select a file using the native file dialog
   *
   * Opens the system file picker and returns the selected file path.
   *
   * @returns Promise resolving to the selected file path, or null if cancelled
   */
  async selectFile(): Promise<string | null> {
    return await invoke<string | null>('select_file');
  }

  /**
   * Select multiple files using the native file dialog
   *
   * Opens the system file picker allowing multiple selection.
   *
   * @returns Promise resolving to array of selected file paths
   */
  async selectFiles(): Promise<string[]> {
    return await invoke<string[]>('select_files');
  }

  /**
   * Select a directory using the native folder dialog
   *
   * Opens the system folder picker for directory selection.
   *
   * @returns Promise resolving to the selected directory path, or null if cancelled
   */
  async selectDirectory(): Promise<string | null> {
    return await invoke<string | null>('select_directory');
  }

  /**
   * Open a file or folder in the system file manager
   *
   * @param path - Absolute path to open
   * @returns Promise that resolves when the file manager is opened
   */
  async openInExplorer(path: string): Promise<void> {
    await invoke('open_in_explorer', { path });
  }

  /**
   * Cancel the currently running operation
   *
   * Signals the backend to stop the current processing operation.
   *
   * @returns Promise that resolves when cancellation is requested
   */
  async cancelOperation(): Promise<void> {
    await invoke('cancel_operation');
  }
}

/**
 * Singleton instance of the VATS service
 *
 * Import this instance throughout the app to access VATS backend operations.
 *
 * @example
 * ```tsx
 * import { vatsService } from '@/services/vats';
 *
 * await vatsService.processFileStream('/path/to/file.mp4', {}, (line) => {
 *   console.log(line);
 * });
 * ```
 */
export const vatsService = new VATSService();
