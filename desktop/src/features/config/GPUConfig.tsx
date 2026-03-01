import { useEffect } from "react";
import { Badge } from "@/components/badge";
import { Switch } from "@/components/switch";
import { Select } from "@/components/select";
import { Cpu, HardDrive, RefreshCw } from "lucide-react";
import { useConfigStore } from "@/store/configStore";

const gpuSelections = [
  { value: "auto", label: "Auto-detect" },
  { value: "0", label: "GPU 0" },
  { value: "1", label: "GPU 1" },
  { value: "2", label: "GPU 2" },
  { value: "3", label: "GPU 3" },
];

export const GPUConfig = () => {
  const { config, loading, error, loadConfig, updateConfig } = useConfigStore();

  // Load config on mount
  useEffect(() => {
    if (!config) {
      loadConfig();
    }
  }, [config, loadConfig]);

  // Get current values from .env
  const memoryFraction = config?.GPU_MEMORY_FRACTION || 0.9;
  const enableMultiGPU = config?.ENABLE_MULTI_GPU || false;
  const selectedGPU = config?.GPU_DEVICE || "auto";

  const handleMemoryFractionChange = (value: number) => {
    updateConfig("GPU_MEMORY_FRACTION", value.toFixed(2));
  };

  const handleMultiGPUChange = (enabled: boolean) => {
    updateConfig("ENABLE_MULTI_GPU", enabled.toString());
  };

  const handleGPUDeviceChange = (device: string) => {
    updateConfig("GPU_DEVICE", device);
  };

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
        <h3 className="text-lg font-semibold mb-1">GPU Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Settings are read from and saved to the .env file
        </p>
      </div>

      {/* GPU Status */}
      <div className="flex items-center justify-between p-4 rounded-lg border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-500/10">
            <HardDrive className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <p className="text-sm font-medium">GPU Acceleration</p>
            <p className="text-xs text-muted-foreground">
              Automatically enabled when CUDA is available
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="text-green-600">Enabled</Badge>
      </div>

      {/* GPU Device Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium">GPU Device (GPU_DEVICE)</label>
        <Select
          value={selectedGPU}
          onChange={(e) => handleGPUDeviceChange(e.target.value)}
          options={gpuSelections}
          disabled={loading}
        />
        <p className="text-xs text-muted-foreground">
          {selectedGPU === "auto"
            ? "Automatically select the best available GPU"
            : `Use GPU device ${selectedGPU}`}
        </p>
      </div>

      {/* Memory Fraction */}
      <div className="space-y-3 p-4 rounded-lg border">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium">GPU Memory Fraction (GPU_MEMORY_FRACTION)</label>
            <p className="text-xs text-muted-foreground">
              Percentage of GPU memory to use for models
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleMemoryFractionChange(Math.max(0.5, memoryFraction - 0.05))}
              disabled={loading || memoryFraction <= 0.5}
              className="w-8 h-8 rounded border flex items-center justify-center hover:bg-accent disabled:opacity-50"
            >
              -
            </button>
            <span className="w-12 text-center font-medium">{(memoryFraction * 100).toFixed(0)}%</span>
            <button
              onClick={() => handleMemoryFractionChange(Math.min(1.0, memoryFraction + 0.05))}
              disabled={loading || memoryFraction >= 1.0}
              className="w-8 h-8 rounded border flex items-center justify-center hover:bg-accent disabled:opacity-50"
            >
              +
            </button>
          </div>
        </div>

        {/* Memory Bar */}
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${memoryFraction * 100}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Leave room for system stability. Recommended: 0.85-0.95
        </p>
      </div>

      {/* Multi-GPU */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
        <div>
          <p className="text-sm font-medium">Multi-GPU Processing (ENABLE_MULTI_GPU)</p>
          <p className="text-xs text-muted-foreground">
            Distribute workload across multiple GPUs
          </p>
        </div>
        <Switch
          checked={enableMultiGPU}
          onCheckedChange={handleMultiGPUChange}
          disabled={loading}
        />
      </div>

      {/* Current .env Values */}
      <div className="p-3 rounded-lg bg-muted/50">
        <h4 className="text-sm font-medium mb-2">Current .env Values</h4>
        <div className="space-y-1 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-muted-foreground">GPU_MEMORY_FRACTION=</span>
            <span>{memoryFraction.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">GPU_DEVICE=</span>
            <span>{selectedGPU}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">ENABLE_MULTI_GPU=</span>
            <span>{enableMultiGPU.toString()}</span>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
        <h4 className="text-sm font-medium mb-1 text-blue-600 dark:text-blue-400">
          Performance Tip
        </h4>
        <p className="text-xs text-blue-600/80 dark:text-blue-400/80">
          GPU acceleration is automatically used when PyTorch detects CUDA.
          The memory fraction controls how much VRAM is allocated for Whisper models.
        </p>
      </div>
    </div>
  );
};
