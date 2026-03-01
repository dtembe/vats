import { useState } from "react";
import { Home } from "./features/home";
import { ProcessSingle } from "./features/process";
import { BulkProcess } from "./features/bulk";
import { SummarizeDoc } from "./features/summarize";
import { SystemStatus } from "./features/status";
import { CacheManager } from "./features/cache";
import { ConfigPanel } from "./features/config";
import { Button } from "./components/button";
import { ArrowLeft, HelpCircle, ExternalLink } from "lucide-react";

type PageId =
  | "home"
  | "process-single"
  | "transcribe-only"
  | "bulk-process"
  | "high-speed-queue"
  | "summarize-doc"
  | "system-status"
  | "cache-manager"
  | "configuration"
  | "help";

const pageTitle: Record<PageId, string> = {
  home: "VATS Desktop",
  "process-single": "Process Single File",
  "transcribe-only": "Transcribe Only",
  "bulk-process": "Bulk Processing",
  "high-speed-queue": "High-Speed Queue",
  "summarize-doc": "Summarize Document",
  "system-status": "System Status",
  "cache-manager": "Cache Management",
  configuration: "Configuration",
  help: "Help",
};

// Helper to open external links in system browser
// In Tauri, this opens in the user's default browser
const openExternalLink = (url: string) => {
  window.open(url, "_blank", "noopener,noreferrer");
};

function App() {
  const [currentPage, setCurrentPage] = useState<PageId>("home");
  const [pageHistory, setPageHistory] = useState<PageId[]>([]);

  const handleNavigate = (pageId: string) => {
    setPageHistory((prev) => [...prev, currentPage]);
    setCurrentPage(pageId as PageId);
  };

  const handleBack = () => {
    if (pageHistory.length > 0) {
      const previousPage = pageHistory[pageHistory.length - 1];
      setPageHistory((prev) => prev.slice(0, -1));
      setCurrentPage(previousPage);
    } else {
      setCurrentPage("home");
    }
  };

  const renderPage = () => {
    switch (currentPage) {
      case "home":
        return <Home onNavigate={handleNavigate} />;

      case "process-single":
      case "transcribe-only":
        return <ProcessSingle />;

      case "bulk-process":
      case "high-speed-queue":
        return <BulkProcess />;

      case "summarize-doc":
        return <SummarizeDoc />;

      case "system-status":
        return <SystemStatus />;

      case "cache-manager":
        return <CacheManager />;

      case "configuration":
        return <ConfigPanel />;

      case "help":
        return <HelpPage onNavigate={handleNavigate} />;

      default:
        return <Home onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      {currentPage !== "home" && (
        <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 h-14 flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <h1 className="text-lg font-semibold">{pageTitle[currentPage]}</h1>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main>{renderPage()}</main>

      {/* Footer */}
      <footer className="border-t py-4 mt-auto">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          VATS Desktop v1.0.0 — Local-first AI-powered transcription
        </div>
      </footer>
    </div>
  );
}

// Simple Help page component
function HelpPage({ onNavigate }: { onNavigate: (pageId: string) => void }) {
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <HelpCircle className="w-6 h-6" />
          Help & Documentation
        </h1>
        <p className="text-muted-foreground">
          Learn how to use VATS Desktop for audio/video transcription
        </p>
      </div>

      <div className="grid gap-6">
        <div className="p-6 rounded-lg border bg-card">
          <h2 className="text-lg font-semibold mb-3">Quick Start</h2>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            <li>Select a processing option from the home screen</li>
            <li>Choose your audio or video file</li>
            <li>Configure options (model, language, etc.)</li>
            <li>Click "Start Processing" to begin</li>
            <li>View results in the output terminal</li>
          </ol>
        </div>

        <div className="p-6 rounded-lg border bg-card">
          <h2 className="text-lg font-semibold mb-3">Keyboard Shortcuts</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Open file</span>
              <kbd className="px-2 py-1 rounded bg-muted text-xs">Ctrl+O</kbd>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Start processing</span>
              <kbd className="px-2 py-1 rounded bg-muted text-xs">Ctrl+Enter</kbd>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Go home</span>
              <kbd className="px-2 py-1 rounded bg-muted text-xs">Ctrl+H</kbd>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Settings</span>
              <kbd className="px-2 py-1 rounded bg-muted text-xs">Ctrl+,</kbd>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-lg border bg-card">
          <h2 className="text-lg font-semibold mb-3">Common Issues</h2>
          <div className="space-y-3 text-sm">
            <div>
              <h3 className="font-medium">GPU not detected</h3>
              <p className="text-muted-foreground">
                Ensure CUDA is installed and check GPU availability in System Status.
              </p>
            </div>
            <div>
              <h3 className="font-medium">Slow transcription</h3>
              <p className="text-muted-foreground">
                Try using a smaller Whisper model (tiny/base) or enable whisper.cpp in settings.
              </p>
            </div>
            <div>
              <h3 className="font-medium">Summarization fails</h3>
              <p className="text-muted-foreground">
                Check your AI provider configuration and API keys in the Configuration panel.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-lg border bg-card">
          <h2 className="text-lg font-semibold mb-3">Learn More</h2>
          <div className="space-y-2 text-sm">
            <button
              onClick={() => openExternalLink("https://github.com/dtemb/vats")}
              className="flex items-center gap-2 text-primary hover:underline"
            >
              <ExternalLink className="w-4 h-4" />
              View on GitHub
            </button>
            <button
              onClick={() => onNavigate("system-status")}
              className="block text-primary hover:underline text-left"
            >
              Check System Status
            </button>
            <button
              onClick={() => onNavigate("configuration")}
              className="block text-primary hover:underline text-left"
            >
              Open Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
