import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/card";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import {
  Cpu,
  HardDrive,
  Zap,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Activity,
  Database,
} from "lucide-react";

interface GPUInfo {
  available: boolean;
  name?: string;
  memory?: {
    total: number;
    used: number;
    free: number;
  };
  computeCapability?: string;
}

interface SystemStatus {
  python: boolean;
  pythonVersion?: string;
  torch: boolean;
  torchVersion?: string;
  whisper: boolean;
  whisperModel?: string;
  diarization: boolean;
  backend: "whisper" | "faster-whisper" | "whisper.cpp";
  cache: {
    models: number;
    results: number;
    totalSize: number;
  };
}

const mockGPUInfo: GPUInfo = {
  available: true,
  name: "NVIDIA GeForce RTX 3080",
  memory: {
    total: 10737418240, // 10GB
    used: 2147483648, // 2GB
    free: 8589934592, // 8GB
  },
  computeCapability: "8.6",
};

const mockSystemStatus: SystemStatus = {
  python: true,
  pythonVersion: "3.11.7",
  torch: true,
  torchVersion: "2.1.2+cu121",
  whisper: true,
  whisperModel: "small",
  diarization: true,
  backend: "faster-whisper",
  cache: {
    models: 3,
    results: 12,
    totalSize: 1536 * 1024 * 1024, // ~1.5GB
  },
};

export const SystemStatus = () => {
  const [gpuInfo, setGpuInfo] = useState<GPUInfo | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadStatus = async () => {
    setIsLoading(true);
    try {
      // In a real app, these would be Tauri commands
      // const gpuInfo = await invoke<GPUInfo>("get_gpu_info");
      // const systemStatus = await invoke<SystemStatus>("get_system_status");

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 800));

      setGpuInfo(mockGPUInfo);
      setSystemStatus(mockSystemStatus);
    } catch (error) {
      console.error("Failed to load system status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const formatBytes = (bytes: number): string => {
    const gb = bytes / (1024 * 1024 * 1024);
    return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  };

  const StatusIcon = ({ status }: { status: "success" | "error" | "warning" }) => {
    const icons = {
      success: CheckCircle2,
      error: XCircle,
      warning: AlertCircle,
    };
    const colors = {
      success: "text-green-500",
      error: "text-destructive",
      warning: "text-yellow-500",
    };
    const Icon = icons[status];
    return <Icon className={`w-4 h-4 ${colors[status]}`} />;
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
            <Activity className="w-6 h-6" />
            System Status
          </h1>
          <p className="text-muted-foreground">
            View GPU availability, model info, and system health
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadStatus}
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* GPU Status */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <HardDrive className="w-4 h-4" />
                GPU Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {gpuInfo?.available ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">GPU Name</span>
                    <span className="text-sm font-medium">{gpuInfo.name}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Memory Usage</span>
                      <span className="font-medium">
                        {gpuInfo.memory
                          ? `${formatBytes(gpuInfo.memory.used)} / ${formatBytes(gpuInfo.memory.total)}`
                          : "N/A"}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{
                          width: gpuInfo.memory
                            ? `${(gpuInfo.memory.used / gpuInfo.memory.total) * 100}%`
                            : "0%",
                        }}
                      />
                    </div>
                  </div>
                  {gpuInfo.computeCapability && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Compute Capability</span>
                      <Badge variant="secondary">{gpuInfo.computeCapability}</Badge>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-destructive">
                  <XCircle className="w-4 h-4" />
                  <span className="text-sm">No GPU detected. CPU will be used for processing.</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Python Environment */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Cpu className="w-4 h-4" />
                Python Environment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Python</span>
                <div className="flex items-center gap-2">
                  <StatusIcon status={systemStatus?.python ? "success" : "error"} />
                  <span className="text-sm">
                    {systemStatus?.pythonVersion || "Not installed"}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">PyTorch</span>
                <div className="flex items-center gap-2">
                  <StatusIcon status={systemStatus?.torch ? "success" : "error"} />
                  <span className="text-sm">
                    {systemStatus?.torchVersion || "Not installed"}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">CUDA Support</span>
                <div className="flex items-center gap-2">
                  <StatusIcon
                    status={
                      systemStatus?.torchVersion?.includes("cu")
                        ? "success"
                        : "warning"
                    }
                  />
                  <span className="text-sm">
                    {systemStatus?.torchVersion?.includes("cu")
                      ? "Yes"
                      : "CPU only"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transcription Backend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Transcription
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Backend</span>
                <Badge variant="secondary">{systemStatus?.backend}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Whisper</span>
                <div className="flex items-center gap-2">
                  <StatusIcon status={systemStatus?.whisper ? "success" : "error"} />
                  <span className="text-sm">
                    {systemStatus?.whisper ? "Installed" : "Not installed"}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Speaker Diarization
                </span>
                <div className="flex items-center gap-2">
                  <StatusIcon
                    status={systemStatus?.diarization ? "success" : "warning"}
                  />
                  <span className="text-sm">
                    {systemStatus?.diarization
                      ? "Available"
                      : "Not configured"}
                  </span>
                </div>
              </div>
              {systemStatus?.whisperModel && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Default Model
                  </span>
                  <Badge variant="outline">{systemStatus.whisperModel}</Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cache Status */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <HardDrive className="w-4 h-4" />
                Cache Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Database className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Cached Models</p>
                    <p className="text-lg font-semibold">
                      {systemStatus?.cache.models || 0}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                    <HardDrive className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Cached Results</p>
                    <p className="text-lg font-semibold">
                      {systemStatus?.cache.results || 0}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Size</p>
                    <p className="text-lg font-semibold">
                      {systemStatus?.cache.totalSize
                        ? formatBytes(systemStatus.cache.totalSize)
                        : "0 B"}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
