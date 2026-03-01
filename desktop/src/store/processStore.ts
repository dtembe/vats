/**
 * Process Store - Zustand state management for file processing
 *
 * This store manages the state of file processing operations including:
 * - Processing status (idle/processing)
 * - Current file being processed
 * - Progress tracking
 * - Terminal output lines
 *
 * The store is designed to handle streaming output from long-running
 * transcription/summarization operations.
 */

import { create } from 'zustand';
import type { TerminalLine, QueueItem } from '@/services/types';

/**
 * State shape for the process store
 */
interface ProcessState {
  /** Whether a processing operation is currently active */
  isProcessing: boolean;
  /** Path to the file currently being processed, or null */
  currentFile: string | null;
  /** Overall progress percentage (0-100) for the current operation */
  progress: number;
  /** Accumulated terminal output lines */
  terminalLines: TerminalLine[];
  /** Queue of files being processed (for bulk operations) */
  queue: QueueItem[];
  /** Total number of files in queue */
  queueTotal: number;
  /** Number of completed files in queue */
  queueCompleted: number;
  /** Number of failed files in queue */
  queueFailed: number;

  /**
   * Add a terminal line to the output
   *
   * Appends a new line to the terminal output array.
   *
   * @param line - The terminal line to add
   */
  addLine: (line: TerminalLine) => void;

  /**
   * Clear all terminal output
   *
   * Resets the terminal lines array to empty.
   */
  clearLines: () => void;

  /**
   * Set the processing state
   *
   * Updates whether processing is active and optionally sets the current file.
   *
   * @param isProcessing - Whether processing is active
   * @param file - Optional file path being processed
   */
  setProcessing: (isProcessing: boolean, file?: string) => void;

  /**
   * Update the progress percentage
   *
   * @param progress - Progress value from 0 to 100
   */
  setProgress: (progress: number) => void;

  /**
   * Initialize the processing queue
   *
   * Sets up the queue with the given list of files.
   *
   * @param files - Array of file paths to process
   */
  initQueue: (files: string[]) => void;

  /**
   * Update status of a queue item
   *
   * Updates the status and progress of a specific file in the queue.
   *
   * @param file - File path to update
   * @param status - New status
   * @param progress - New progress value
   * @param error - Optional error message if failed
   */
  updateQueueItem: (
    file: string,
    status: QueueItem['status'],
    progress?: number,
    error?: string
  ) => void;

  /**
   * Clear the processing queue
   *
   * Resets the queue to empty.
   */
  clearQueue: () => void;

  /**
   * Reset the entire process state
   *
   * Clears all state including terminal lines, queue, and progress.
   */
  reset: () => void;
}

/**
 * Process store
 *
 * @example
 * ```tsx
 * function Terminal() {
 *   const { terminalLines, isProcessing } = useProcessStore();
 *
 *   return (
 *     <div className="terminal">
 *       {terminalLines.map((line, i) => (
 *         <div key={i} className={line.type}>{line.line}</div>
 *       ))}
 *       {isProcessing && <Spinner />}
 *     </div>
 *   );
 * }
 * ```
 */
export const useProcessStore = create<ProcessState>((set) => ({
  isProcessing: false,
  currentFile: null,
  progress: 0,
  terminalLines: [],
  queue: [],
  queueTotal: 0,
  queueCompleted: 0,
  queueFailed: 0,

  addLine: (line) =>
    set((state) => ({
      terminalLines: [...state.terminalLines, line],
    })),

  clearLines: () =>
    set({ terminalLines: [] }),

  setProcessing: (isProcessing, file) =>
    set({
      isProcessing,
      currentFile: file || null,
      progress: isProcessing ? 0 : 100,
    }),

  setProgress: (progress) =>
    set({ progress: Math.max(0, Math.min(100, progress)) }),

  initQueue: (files) =>
    set({
      queue: files.map((file) => ({
        file,
        status: 'pending' as const,
        progress: 0,
      })),
      queueTotal: files.length,
      queueCompleted: 0,
      queueFailed: 0,
    }),

  updateQueueItem: (file, status, progress = 0, error) =>
    set((state) => {
      const queue = state.queue.map((item) =>
        item.file === file
          ? { ...item, status, progress, error }
          : item
      );

      // Update counters
      const queueCompleted = queue.filter(
        (item) => item.status === 'completed'
      ).length;
      const queueFailed = queue.filter(
        (item) => item.status === 'failed'
      ).length;

      // Update current file if processing started
      const currentFile = status === 'processing' ? file : state.currentFile;

      return {
        queue,
        queueCompleted,
        queueFailed,
        currentFile,
        // Auto-update overall progress based on queue
        progress:
          state.queueTotal > 0
            ? Math.round(((queueCompleted + queueFailed) / state.queueTotal) * 100)
            : state.progress,
      };
    }),

  clearQueue: () =>
    set({
      queue: [],
      queueTotal: 0,
      queueCompleted: 0,
      queueFailed: 0,
    }),

  reset: () =>
    set({
      isProcessing: false,
      currentFile: null,
      progress: 0,
      terminalLines: [],
      queue: [],
      queueTotal: 0,
      queueCompleted: 0,
      queueFailed: 0,
    }),
}));

/**
 * Selector hooks for commonly used process state
 *
 * These hooks allow components to subscribe to specific values
 * without causing unnecessary re-renders.
 */
export const useIsProcessing = () => useProcessStore((state) => state.isProcessing);
export const useCurrentFile = () => useProcessStore((state) => state.currentFile);
export const useProgress = () => useProcessStore((state) => state.progress);
export const useTerminalLines = () => useProcessStore((state) => state.terminalLines);
export const useQueue = () => useProcessStore((state) => state.queue);
export const useQueueStats = () =>
  useProcessStore((state) => ({
    total: state.queueTotal,
    completed: state.queueCompleted,
    failed: state.queueFailed,
    remaining: state.queueTotal - state.queueCompleted - state.queueFailed,
  }));

/**
 * Action hooks for common process operations
 */
export const useAddLine = () => useProcessStore((state) => state.addLine);
export const useClearLines = () => useProcessStore((state) => state.clearLines);
export const useSetProcessing = () => useProcessStore((state) => state.setProcessing);
export const useSetProgress = () => useProcessStore((state) => state.setProgress);
export const useInitQueue = () => useProcessStore((state) => state.initQueue);
export const useUpdateQueueItem = () => useProcessStore((state) => state.updateQueueItem);
export const useClearQueue = () => useProcessStore((state) => state.clearQueue);
export const useResetProcess = () => useProcessStore((state) => state.reset);
