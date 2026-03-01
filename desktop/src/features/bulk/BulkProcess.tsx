import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/card";
import { Button } from "@/components/button";
import { Select } from "@/components/select";
import { Badge } from "@/components/badge";
import { Progress } from "@/components/progress";
import { Terminal, useTerminalStream } from "@/features/terminal";
import {
  Upload,
  X,
  FileAudio,
  Play,
  Square,
  Trash2,
  Plus,
  Clock,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";

interface FileTask {
  id: string;
  name: string;
  path: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  result?: string;
  error?: string;
}

const MAX_CONCURRENT_OPTIONS = [
  { value: "1", label: "1 file (sequential)" },
  { value: "2", label: "2 files" },
  { value: "3", label: "3 files (recommended)" },
  { value: "4", label: "4 files" },
  { value: "6", label: "6 files (high performance)" },
];

export const BulkProcess = () => {
  const [files, setFiles] = useState<FileTask[]>([]);
  const [maxConcurrent, setMaxConcurrent] = useState<string>("3");
  const [whisperModel, setWhisperModel] = useState<string>("small");
  const [isProcessing, setIsProcessing] = useState(false);
  const [globalProgress, setGlobalProgress] = useState(0);

  const terminal = useTerminalStream();

  const handleFileSelect = useCallback(async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: "Media Files",
            extensions: ["mp4", "mp3", "wav", "m4a", "avi", "mov", "mkv", "webm", "flac", "ogg"],
          },
        ],
      });

      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        const newFiles: FileTask[] = paths.map((path) => ({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: path.split(/[\\/]/).pop() || path,
          path,
          status: "pending",
          progress: 0,
        }));

        setFiles((prev) => [...prev, ...newFiles]);
        terminal.addInfo(`Added ${newFiles.length} file(s) to queue`);
      }
    } catch (error) {
      terminal.addError(`Failed to select files: ${error}`);
    }
  }, [terminal]);

  const handleRemoveFile = useCallback((id: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file && (file.status === "processing" || file.status === "completed")) {
        terminal.addWarning("Cannot remove processing or completed files");
        return prev;
      }
      return prev.filter((f) => f.id !== id);
    });
  }, [terminal]);

  const handleClearCompleted = useCallback(() => {
    setFiles((prev) => prev.filter((f) => f.status !== "completed"));
    terminal.addInfo("Cleared completed files");
  }, [terminal]);

  const handleClearAll = useCallback(() => {
    if (isProcessing) {
      terminal.addWarning("Cannot clear files while processing");
      return;
    }
    setFiles([]);
    terminal.addInfo("Cleared all files");
  }, [isProcessing, terminal]);

  const handleStart = useCallback(async () => {
    const pendingFiles = files.filter((f) => f.status === "pending");
    if (pendingFiles.length === 0) {
      terminal.addWarning("No pending files to process");
      return;
    }

    setIsProcessing(true);
    setGlobalProgress(0);
    terminal.startStreaming();
    terminal.addInfo(`Starting bulk processing of ${pendingFiles.length} file(s)...`);

    // Simulate processing (replace with actual backend)
    let completed = 0;
    const total = pendingFiles.length;

    for (const file of pendingFiles) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === file.id ? { ...f, status: "processing" as const, progress: 0 } : f
        )
      );

      // Simulate file processing
      for (let i = 0; i <= 100; i += 10) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id ? { ...f, progress: i } : f
          )
        );
      }

      setFiles((prev) =>
        prev.map((f) =>
          f.id === file.id
            ? { ...f, status: "completed" as const, progress: 100, result: `/output/${f.name}.txt` }
            : f
        )
      );

      completed++;
      setGlobalProgress((completed / total) * 100);
      terminal.addSuccess(`Completed: ${file.name}`);
    }

    terminal.addSuccess("Bulk processing completed!");
    setIsProcessing(false);
    terminal.stopStreaming();
  }, [files, terminal]);

  const handleStop = useCallback(() => {
    setIsProcessing(false);
    terminal.addWarning("Processing stopped by user");
    setFiles((prev) =>
      prev.map((f) =>
        f.status === "processing" ? { ...f, status: "pending" as const, progress: 0 } : f
      )
    );
  }, [terminal]);

  const statusIcon = {
    pending: Clock,
    processing: Loader2,
    completed: CheckCircle2,
    failed: AlertCircle,
  };

  const statusColor = {
    pending: "text-muted-foreground",
    processing: "text-primary animate-spin",
    completed: "text-green-500",
    failed: "text-destructive",
  };

  const statusBadge = {
    pending: "secondary",
    processing: "default",
    completed: "success",
    failed: "destructive",
  } as const;

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Bulk Processing</h1>
        <p className="text-muted-foreground">
          Process multiple files concurrently with configurable options
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Queue & Options */}
        <div className="lg:col-span-1 space-y-4">
          {/* File Queue Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">File Queue</CardTitle>
                <Badge variant="secondary">{files.length} files</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Add Files Button */}
              <Button
                variant="outline"
                className="w-full"
                onClick={handleFileSelect}
                disabled={isProcessing}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Files
              </Button>

              {/* File List */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-thin">
                {files.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <FileAudio className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No files in queue</p>
                  </div>
                ) : (
                  files.map((file) => {
                    const StatusIcon = statusIcon[file.status];
                    return (
                      <div
                        key={file.id}
                        className="flex items-center gap-2 p-2 rounded bg-muted/30 group"
                      >
                        <StatusIcon className={`w-4 h-4 flex-shrink-0 ${statusColor[file.status]}`} />
                        <span className="text-sm truncate flex-1">{file.name}</span>
                        <Badge
                          variant={statusBadge[file.status]}
                          className="text-xs"
                        >
                          {file.progress}%
                        </Badge>
                        {file.status === "pending" && !isProcessing && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                            onClick={() => handleRemoveFile(file.id)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Clear Buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handleClearCompleted}
                  disabled={isProcessing || !files.some((f) => f.status === "completed")}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Clear Done
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handleClearAll}
                  disabled={isProcessing}
                >
                  Clear All
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Options Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium">Max Concurrent</label>
                <Select
                  value={maxConcurrent}
                  onChange={(e) => setMaxConcurrent(e.target.value)}
                  options={MAX_CONCURRENT_OPTIONS}
                  disabled={isProcessing}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium">Whisper Model</label>
                <Select
                  value={whisperModel}
                  onChange={(e) => setWhisperModel(e.target.value)}
                  options={[
                    { value: "tiny", label: "Tiny" },
                    { value: "base", label: "Base" },
                    { value: "small", label: "Small" },
                    { value: "medium", label: "Medium" },
                  ]}
                  disabled={isProcessing}
                />
              </div>

              <div className="pt-2 border-t">
                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="flex justify-between">
                    <span>Pending:</span>
                    <span>{files.filter((f) => f.status === "pending").length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Processing:</span>
                    <span>{files.filter((f) => f.status === "processing").length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Completed:</span>
                    <span>{files.filter((f) => f.status === "completed").length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Failed:</span>
                    <span>{files.filter((f) => f.status === "failed").length}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <Card>
            <CardContent className="pt-4">
              {!isProcessing ? (
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleStart}
                  disabled={!files.some((f) => f.status === "pending")}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Bulk Processing
                </Button>
              ) : (
                <Button
                  className="w-full"
                  size="lg"
                  variant="destructive"
                  onClick={handleStop}
                >
                  <Square className="w-4 h-4 mr-2" />
                  Stop Processing
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Progress & Terminal */}
        <div className="lg:col-span-2 space-y-4">
          {/* Overall Progress */}
          {isProcessing && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Overall Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Progress value={globalProgress} />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Processing {files.filter((f) => f.status === "processing").length} / {maxConcurrent} files
                  </span>
                  <Badge variant="secondary">{Math.round(globalProgress)}%</Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Individual Progress Cards */}
          {files.some((f) => f.status === "processing" || f.status === "completed") && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">File Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {files
                  .filter((f) => f.status === "processing" || f.status === "completed")
                  .map((file) => (
                    <div key={file.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="truncate flex-1 mr-2">{file.name}</span>
                        <Badge variant={statusBadge[file.status]} className="text-xs">
                          {file.status}
                        </Badge>
                      </div>
                      <Progress value={file.progress} variant={file.status === "completed" ? "success" : "default"} />
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}

          {/* Terminal */}
          <Terminal
            messages={terminal.messages}
            isStreaming={terminal.isStreaming}
            onClear={terminal.clear}
          />
        </div>
      </div>
    </div>
  );
};
