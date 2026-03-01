import { useEffect } from "react";
import { Card, CardContent } from "@/components/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/tabs";
import { AIProviderConfig } from "./AIProvider";
import { WhisperConfig } from "./WhisperConfig";
import { PerformanceConfig } from "./PerformanceConfig";
import { GPUConfig } from "./GPUConfig";
import { Button } from "@/components/button";
import { Badge } from "@/components/badge";
import { RotateCcw, RefreshCw, Check, FileText } from "lucide-react";
import { useConfigStore } from "@/store/configStore";

export const ConfigPanel = () => {
  const { config, loading, error, loadConfig, resetConfig } = useConfigStore();

  // Load config on mount
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleReset = async () => {
    if (confirm("Reset all settings to defaults? This will modify your .env file.")) {
      await resetConfig();
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
              <FileText className="w-6 h-6" />
              Configuration
            </h1>
            <p className="text-muted-foreground">
              Settings are read from and auto-saved to the .env file
            </p>
          </div>
          <div className="flex items-center gap-2">
            {loading && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Saving...
              </Badge>
            )}
            {!loading && config && (
              <Badge variant="outline" className="flex items-center gap-1 text-green-600">
                <Check className="w-3 h-3" />
                Auto-saved
              </Badge>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive">
          <p className="font-medium">Error loading .env</p>
          <p className="text-sm">{error}</p>
          <Button variant="outline" size="sm" onClick={loadConfig} className="mt-2">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="ai" className="w-full">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="ai">AI Provider</TabsTrigger>
              <TabsTrigger value="whisper">Whisper</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="gpu">GPU</TabsTrigger>
            </TabsList>

            <TabsContent value="ai" className="mt-6">
              <AIProviderConfig />
            </TabsContent>

            <TabsContent value="whisper" className="mt-6">
              <WhisperConfig />
            </TabsContent>

            <TabsContent value="performance" className="mt-6">
              <PerformanceConfig />
            </TabsContent>

            <TabsContent value="gpu" className="mt-6">
              <GPUConfig />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-between items-center mt-6">
        <p className="text-xs text-muted-foreground">
          Changes are automatically saved to: <code className="bg-muted px-1 rounded">C:\tools\vats\.env</code>
        </p>
        <Button variant="outline" onClick={handleReset} disabled={loading}>
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
};
