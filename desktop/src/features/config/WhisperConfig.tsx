import { useEffect } from "react";
import { Input } from "@/components/input";
import { Select } from "@/components/select";
import { Badge } from "@/components/badge";
import { Switch } from "@/components/switch";
import { RefreshCw } from "lucide-react";
import { useConfigStore } from "@/store/configStore";

const whisperModels = [
  { value: "tiny", label: "Tiny", ram: "1GB", speed: "Fastest", accuracy: "Low" },
  { value: "base", label: "Base", ram: "1GB", speed: "Fast", accuracy: "Medium" },
  { value: "small", label: "Small", ram: "2GB", speed: "Moderate", accuracy: "Good" },
  { value: "medium", label: "Medium", ram: "5GB", speed: "Slow", accuracy: "High" },
  { value: "large", label: "Large", ram: "10GB", speed: "Slowest", accuracy: "Highest" },
];

const languages = [
  { value: "auto", label: "Auto-detect" },
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
  { value: "pt", label: "Portuguese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "zh", label: "Chinese" },
  { value: "ru", label: "Russian" },
  { value: "ar", label: "Arabic" },
  { value: "hi", label: "Hindi" },
];

export const WhisperConfig = () => {
  const { config, loading, error, loadConfig, updateConfig } = useConfigStore();

  // Load config on mount
  useEffect(() => {
    if (!config) {
      loadConfig();
    }
  }, [config, loadConfig]);

  // Get current values from .env
  const model = config?.WHISPER_MODEL || "small";
  const language = config?.WHISPER_LANGUAGE || "auto";
  const useCpp = config?.USE_WHISPER_CPP || false;
  const cppPath = config?.WHISPER_CPP_PATH || "";
  const enableDiarization = config?.ENABLE_DIARIZATION ?? true;
  const enableSummarization = config?.ENABLE_SUMMARIZATION ?? true;

  const selectedModelInfo = whisperModels.find((m) => m.value === model);

  if (loading && !config) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading .env configuration...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-destructive/10 text-destructive">
        <p className="font-medium">Error loading configuration</p>
        <p className="text-sm">{error}</p>
        <button onClick={loadConfig} className="mt-2 text-sm underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Whisper Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Settings are read from and saved to the .env file
        </p>
      </div>

      {/* Model Selection */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Model Size (WHISPER_MODEL)</label>
        <Select
          value={model}
          onChange={(e) => updateConfig("WHISPER_MODEL", e.target.value)}
          options={whisperModels.map((m) => ({ value: m.value, label: `${m.label} (${m.ram})` }))}
          disabled={loading}
        />

        {/* Model Info Card */}
        {selectedModelInfo && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-lg bg-muted/50">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">RAM</p>
              <p className="text-sm font-medium">{selectedModelInfo.ram}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Speed</p>
              <p className="text-sm font-medium">{selectedModelInfo.speed}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Accuracy</p>
              <p className="text-sm font-medium">{selectedModelInfo.accuracy}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge variant="secondary" className="text-xs">
                {["tiny", "base", "small"].includes(model) ? "Cached" : "Download on use"}
              </Badge>
            </div>
          </div>
        )}
      </div>

      {/* Language Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Language (WHISPER_LANGUAGE)</label>
        <Select
          value={language}
          onChange={(e) => updateConfig("WHISPER_LANGUAGE", e.target.value)}
          options={languages}
          disabled={loading}
        />
        <p className="text-xs text-muted-foreground">
          {language === "auto"
            ? "Automatically detect the language from the audio content"
            : `Force transcription to use ${languages.find((l) => l.value === language)?.label}`}
        </p>
      </div>

      {/* Whisper.cpp Options */}
      <div className="space-y-3 p-4 rounded-lg border">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium">Use whisper.cpp (USE_WHISPER_CPP)</label>
            <p className="text-xs text-muted-foreground">
              Faster CPU-based transcription
            </p>
          </div>
          <Switch
            checked={useCpp}
            onCheckedChange={(checked) => updateConfig("USE_WHISPER_CPP", checked.toString())}
            disabled={loading}
          />
        </div>

        {useCpp && (
          <div className="space-y-2 pt-2 border-t">
            <label className="text-sm font-medium">whisper.cpp Path (WHISPER_CPP_PATH)</label>
            <Input
              value={cppPath}
              onChange={(e) => updateConfig("WHISPER_CPP_PATH", e.target.value)}
              placeholder="C:\\whisper.cpp\\main.exe"
              disabled={loading}
            />
          </div>
        )}
      </div>

      {/* Feature Toggles */}
      <div className="space-y-3 pt-4 border-t">
        <h4 className="text-sm font-medium">Features</h4>

        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
          <div>
            <p className="text-sm font-medium">Speaker Diarization (ENABLE_DIARIZATION)</p>
            <p className="text-xs text-muted-foreground">
              Identify different speakers in audio
            </p>
          </div>
          <Switch
            checked={enableDiarization}
            onCheckedChange={(checked) => updateConfig("ENABLE_DIARIZATION", checked.toString())}
            disabled={loading}
          />
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
          <div>
            <p className="text-sm font-medium">Summarization (ENABLE_SUMMARIZATION)</p>
            <p className="text-xs text-muted-foreground">
              Generate AI summary after transcription
            </p>
          </div>
          <Switch
            checked={enableSummarization}
            onCheckedChange={(checked) => updateConfig("ENABLE_SUMMARIZATION", checked.toString())}
            disabled={loading}
          />
        </div>
      </div>

      {/* Current .env Values */}
      <div className="p-3 rounded-lg bg-muted/50">
        <h4 className="text-sm font-medium mb-2">Current .env Values</h4>
        <div className="space-y-1 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-muted-foreground">WHISPER_MODEL=</span>
            <span>{model}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">WHISPER_LANGUAGE=</span>
            <span>{language}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">USE_WHISPER_CPP=</span>
            <span>{useCpp.toString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">ENABLE_DIARIZATION=</span>
            <span>{enableDiarization.toString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
