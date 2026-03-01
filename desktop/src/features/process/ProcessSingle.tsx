import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/card";
import { Button } from "@/components/button";
import { Select } from "@/components/select";
import { Badge } from "@/components/badge";
import { Progress } from "@/components/progress";
import { Terminal, useTerminalStream } from "@/features/terminal";
import {
  Upload,
  FileAudio,
  Settings,
  Play,
  Square,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

interface ProcessOption {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

const processOptions: ProcessOption[] = [
  { id: "full", label: "Full Process", icon: Play, description: "Transcribe and summarize" },
  { id: "transcribe", label: "Transcribe Only", icon: FileText, description: "Generate transcript without summary" },
];

const whisperModels = [
  { value: "tiny", label: "Tiny (fastest, lowest accuracy)" },
  { value: "base", label: "Base" },
  { value: "small", label: "Small (recommended)" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large (slowest, highest accuracy)" },
];

const languages = [
  { value: "auto", label: "Auto-detect" },
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
  { value: "pt", label: "Portuguese" },
  { value: "nl", label: "Dutch" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "zh", label: "Chinese" },
];

export const ProcessSingle = () => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [processMode, setProcessMode] = useState<string>("full");
  const [whisperModel, setWhisperModel] = useState<string>("small");
  const [language, setLanguage] = useState<string>("auto");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const terminal = useTerminalStream();

  const handleFileSelect = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "Media Files",
            extensions: ["mp4", "mp3", "wav", "m4a", "avi", "mov", "mkv", "webm", "flac", "ogg"],
          },
        ],
      });

      if (selected && typeof selected === "string") {
        setSelectedFile(selected);
        terminal.addInfo(`Selected file: ${selected.split("/").pop()}`);
      }
    } catch (error) {
      terminal.addError(`Failed to select file: ${error}`);
    }
  }, [terminal]);

  const handleStart = useCallback(async () => {
    if (!selectedFile) {
      terminal.addWarning("Please select a file first");
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    terminal.startStreaming();
    terminal.addInfo("Starting processing...");

    try {
      // Simulate progress updates (replace with actual backend updates)
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) {
            clearInterval(interval);
            return 95;
          }
          return prev + 5;
        });
      }, 500);

      const result = await invoke("process_recording", {
        filePath: selectedFile,
        options: {
          model: whisperModel,
          language: language === "auto" ? null : language,
          summarize: processMode === "full",
        },
      });

      clearInterval(interval);
      setProgress(100);
      terminal.addSuccess("Processing completed successfully!");
      terminal.addInfo(`Output saved to: ${result}`);
    } catch (error) {
      terminal.addError(`Processing failed: ${error}`);
    } finally {
      setIsProcessing(false);
      terminal.stopStreaming();
    }
  }, [selectedFile, processMode, whisperModel, language, terminal]);

  const handleStop = useCallback(() => {
    setIsProcessing(false);
    terminal.addWarning("Processing stopped by user");
  }, [terminal]);

  const selectedFileName = selectedFile ? selectedFile.split(/[\\/]/).pop() : null;

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Process Single File</h1>
        <p className="text-muted-foreground">
          Transcribe and optionally summarize a single audio or video file
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - File Selection & Options */}
        <div className="lg:col-span-1 space-y-4">
          {/* File Selection Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Input File</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!selectedFile ? (
                <Button
                  variant="outline"
                  className="w-full h-24 flex-col gap-2 border-dashed"
                  onClick={handleFileSelect}
                  disabled={isProcessing}
                >
                  <Upload className="w-6 h-6" />
                  <span>Select media file</span>
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                    <FileAudio className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm truncate flex-1">{selectedFileName}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleFileSelect}
                    disabled={isProcessing}
                  >
                    Change file
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Process Mode Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Options
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Process Mode */}
              <div className="space-y-2">
                <label className="text-xs font-medium">Process Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  {processOptions.map((option) => {
                    const Icon = option.icon;
                    const isSelected = processMode === option.id;
                    return (
                      <button
                        key={option.id}
                        onClick={() => !isProcessing && setProcessMode(option.id)}
                        disabled={isProcessing}
                        className={`
                          flex flex-col items-center gap-1 p-2 rounded border text-center transition-all
                          ${isSelected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:bg-accent"
                          }
                          ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}
                        `}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-xs">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Whisper Model */}
              <div className="space-y-2">
                <label className="text-xs font-medium">Whisper Model</label>
                <Select
                  value={whisperModel}
                  onChange={(e) => setWhisperModel(e.target.value)}
                  options={whisperModels}
                  disabled={isProcessing}
                />
              </div>

              {/* Language */}
              <div className="space-y-2">
                <label className="text-xs font-medium">Language</label>
                <Select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  options={languages}
                  disabled={isProcessing}
                />
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
                  disabled={!selectedFile}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Processing
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
          {/* Progress Card */}
          {isProcessing && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Processing Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Progress value={progress} />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Processing...</span>
                  <Badge variant="secondary">{progress}%</Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Terminal Output */}
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
