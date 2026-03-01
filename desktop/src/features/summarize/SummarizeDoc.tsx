import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/card";
import { Button } from "@/components/button";
import { Select } from "@/components/select";
import { Badge } from "@/components/badge";
import { Progress } from "@/components/progress";
import { Terminal, useTerminalStream } from "@/features/terminal";
import {
  Upload,
  FileText,
  File,
  Play,
  Square,
  Sparkles,
  Download,
  Eye,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";

interface DocumentType {
  id: string;
  label: string;
  extensions: string[];
  icon: React.ElementType;
}

const documentTypes: DocumentType[] = [
  { id: "pdf", label: "PDF Document", extensions: ["pdf"], icon: FileText },
  { id: "docx", label: "Word Document", extensions: ["docx", "doc"], icon: FileText },
  { id: "txt", label: "Text File", extensions: ["txt", "md"], icon: File },
  { id: "md", label: "Markdown", extensions: ["md"], icon: File },
];

const summaryStyles = [
  { value: "concise", label: "Conise (brief summary)" },
  { value: "standard", label: "Standard (balanced)" },
  { value: "detailed", label: "Detailed (comprehensive)" },
];

const summaryLengths = [
  { value: "short", label: "Short (~100 words)" },
  { value: "medium", label: "Medium (~300 words)" },
  { value: "long", label: "Long (~500 words)" },
];

export const SummarizeDoc = () => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [docType, setDocType] = useState<string>("auto");
  const [summaryStyle, setSummaryStyle] = useState<string>("standard");
  const [summaryLength, setSummaryLength] = useState<string>("medium");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<string | null>(null);

  const terminal = useTerminalStream();

  const handleFileSelect = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "Documents",
            extensions: ["pdf", "docx", "doc", "txt", "md"],
          },
        ],
      });

      if (selected && typeof selected === "string") {
        setSelectedFile(selected);
        terminal.addInfo(`Selected document: ${selected.split(/[\\/]/).pop()}`);

        // Auto-detect document type
        const ext = selected.split(".").pop()?.toLowerCase();
        if (ext) {
          const matchedType = documentTypes.find((dt) =>
            dt.extensions.includes(ext)
          );
          if (matchedType) {
            setDocType(matchedType.id);
          }
        }
      }
    } catch (error) {
      terminal.addError(`Failed to select file: ${error}`);
    }
  }, [terminal]);

  const handleStart = useCallback(async () => {
    if (!selectedFile) {
      terminal.addWarning("Please select a document first");
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setSummary(null);
    terminal.startStreaming();
    terminal.addInfo("Starting document summarization...");

    try {
      // Simulate processing
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) {
            clearInterval(interval);
            return 95;
          }
          return prev + 10;
        });
      }, 300);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 3000));

      clearInterval(interval);
      setProgress(100);

      // Mock summary result
      const mockSummary = `# Document Summary

This document provides a comprehensive overview of the topic discussed. Key points include:

1. **Main Theme**: The central focus revolves around understanding core concepts and their practical applications.

2. **Key Findings**: Several important insights were discovered during the analysis, particularly regarding the implementation strategies and their effectiveness.

3. **Recommendations**: Based on the findings, the document suggests several approaches for moving forward, with emphasis on practical solutions.

4. **Conclusion**: The document concludes by summarizing the main arguments and proposing areas for further research.

*Generated using ${summaryStyle} style with ${summaryLength} length.*`;

      setSummary(mockSummary);
      terminal.addSuccess("Document summarized successfully!");
    } catch (error) {
      terminal.addError(`Summarization failed: ${error}`);
    } finally {
      setIsProcessing(false);
      terminal.stopStreaming();
    }
  }, [selectedFile, summaryStyle, summaryLength, terminal]);

  const handleStop = useCallback(() => {
    setIsProcessing(false);
    terminal.addWarning("Processing stopped by user");
  }, [terminal]);

  const handleExport = useCallback(() => {
    if (!summary) return;
    // Trigger download
    const blob = new Blob([summary], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `summary_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    terminal.addInfo("Summary exported");
  }, [summary, terminal]);

  const selectedFileName = selectedFile ? selectedFile.split(/[\\/]/).pop() : null;
  const DocIcon = documentTypes.find((dt) => dt.id === docType)?.icon || File;

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          Summarize Document
        </h1>
        <p className="text-muted-foreground">
          AI-powered document summarization for PDF, DOCX, TXT, and Markdown files
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - File & Options */}
        <div className="lg:col-span-1 space-y-4">
          {/* File Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Input Document</CardTitle>
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
                  <span>Select document</span>
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                    <DocIcon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm truncate flex-1">{selectedFileName}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleFileSelect}
                    disabled={isProcessing}
                  >
                    Change document
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Options */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Summary Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium">Document Type</label>
                <Select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  options={[
                    { value: "auto", label: "Auto-detect" },
                    ...documentTypes.map((dt) => ({ value: dt.id, label: dt.label })),
                  ]}
                  disabled={isProcessing}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium">Summary Style</label>
                <Select
                  value={summaryStyle}
                  onChange={(e) => setSummaryStyle(e.target.value)}
                  options={summaryStyles}
                  disabled={isProcessing}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium">Summary Length</label>
                <Select
                  value={summaryLength}
                  onChange={(e) => setSummaryLength(e.target.value)}
                  options={summaryLengths}
                  disabled={isProcessing}
                />
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <Card>
            <CardContent className="pt-4 space-y-2">
              {!isProcessing ? (
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleStart}
                  disabled={!selectedFile}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Generate Summary
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

              {summary && (
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={handleExport}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Summary
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Progress & Results */}
        <div className="lg:col-span-2 space-y-4">
          {/* Progress */}
          {isProcessing && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Processing Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Progress value={progress} />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Analyzing document...</span>
                  <Badge variant="secondary">{progress}%</Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary Result */}
          {summary && !isProcessing && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    Generated Summary
                  </CardTitle>
                  <Badge variant="success">Ready</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none bg-muted/30 rounded-lg p-4 max-h-[400px] overflow-y-auto scrollbar-thin">
                  <pre className="whitespace-pre-wrap font-sans text-sm">{summary}</pre>
                </div>
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
