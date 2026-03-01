import { useEffect } from "react";
import { Badge } from "@/components/badge";
import { Switch } from "@/components/switch";
import { Zap, Activity, Gauge, RefreshCw } from "lucide-react";
import { useConfigStore } from "@/store/configStore";

const performanceProfiles = [
  {
    value: "speed",
    label: "Speed Priority",
    description: "Fastest processing with lower accuracy",
    icon: Zap,
    color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    settings: { model: "tiny", segmentLength: 120, transWorkers: 6, splitWorkers: 8, gpuMemory: 95 },
  },
  {
    value: "balanced",
    label: "Balanced",
    description: "Good balance of speed and accuracy (recommended)",
    icon: Activity,
    color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    settings: { model: "small", segmentLength: 180, transWorkers: 3, splitWorkers: 6, gpuMemory: 90 },
  },
  {
    value: "quality",
    label: "Quality Priority",
    description: "Highest accuracy, slower processing",
    icon: Gauge,
    color: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    settings: { model: "medium", segmentLength: 300, transWorkers: 1, splitWorkers: 4, gpuMemory: 80 },
  },
];

export const PerformanceConfig = () => {
  const { config, loading, error, loadConfig, updateConfig } = useConfigStore();

  // Load config on mount
  useEffect(() => {
    if (!config) {
      loadConfig();
    }
  }, [config, loadConfig]);

  // Get current profile from .env
  const profile = config?.PERFORMANCE_PROFILE || "balanced";
  const maxConcurrent = config?.MAX_CONCURRENT_FILES || 3;

  const handleProfileChange = (newProfile: string) => {
    updateConfig("PERFORMANCE_PROFILE", newProfile);
  };

  const handleMaxConcurrentChange = (value: number) => {
    updateConfig("MAX_CONCURRENT_FILES", value.toString());
  };

  const selectedProfile = performanceProfiles.find((p) => p.value === profile);

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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Performance Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Settings are read from and saved to the .env file
        </p>
      </div>

      {/* Profile Selection */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Performance Profile (PERFORMANCE_PROFILE)</label>
        <div className="grid grid-cols-1 gap-3">
          {performanceProfiles.map((p) => {
            const Icon = p.icon;
            const isSelected = profile === p.value;

            return (
              <button
                key={p.value}
                onClick={() => handleProfileChange(p.value)}
                disabled={loading}
                className={`
                  flex items-start gap-4 p-4 rounded-lg border text-left transition-all
                  ${isSelected
                    ? `${p.color} ring-1 ring-current`
                    : "border-border hover:bg-accent"
                  }
                  ${loading ? "opacity-50" : ""}
                `}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  isSelected ? p.color.split(" ")[0] + " " + p.color.split(" ")[1] : "bg-muted"
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{p.label}</span>
                    <Badge variant="secondary" className="text-xs">{p.settings.model}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{p.description}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>Workers: {p.settings.transWorkers} trans / {p.settings.splitWorkers} split</span>
                    <span>Segment: {p.settings.segmentLength}s</span>
                    <span>GPU: {p.settings.gpuMemory}%</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Concurrent Files */}
      <div className="space-y-3 p-4 rounded-lg border">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium">Max Concurrent Files (MAX_CONCURRENT_FILES)</label>
            <p className="text-xs text-muted-foreground">
              Number of files to process simultaneously in bulk mode
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleMaxConcurrentChange(Math.max(1, maxConcurrent - 1))}
              disabled={loading || maxConcurrent <= 1}
              className="w-8 h-8 rounded border flex items-center justify-center hover:bg-accent disabled:opacity-50"
            >
              -
            </button>
            <span className="w-8 text-center font-medium">{maxConcurrent}</span>
            <button
              onClick={() => handleMaxConcurrentChange(Math.min(8, maxConcurrent + 1))}
              disabled={loading || maxConcurrent >= 8}
              className="w-8 h-8 rounded border flex items-center justify-center hover:bg-accent disabled:opacity-50"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Current .env Values */}
      <div className="p-3 rounded-lg bg-muted/50">
        <h4 className="text-sm font-medium mb-2">Current .env Values</h4>
        <div className="space-y-1 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-muted-foreground">PERFORMANCE_PROFILE=</span>
            <Badge variant="secondary">{profile}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">MAX_CONCURRENT_FILES=</span>
            <span>{maxConcurrent}</span>
          </div>
          {selectedProfile && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">GPU_MEMORY_FRACTION=</span>
                <span>{(selectedProfile.settings.gpuMemory / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">WHISPER_MODEL=</span>
                <span>{selectedProfile.settings.model}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
        <h4 className="text-sm font-medium mb-1 text-blue-600 dark:text-blue-400">
          Profile Auto-Tuning
        </h4>
        <p className="text-xs text-blue-600/80 dark:text-blue-400/80">
          Changing the profile will automatically adjust WHISPER_MODEL, GPU_MEMORY_FRACTION,
          and worker counts according to the profile settings.
        </p>
      </div>
    </div>
  );
};
