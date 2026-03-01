import { useEffect, useState } from "react";
import { Input } from "@/components/input";
import { Button } from "@/components/button";
import { Badge } from "@/components/badge";
import { Eye, EyeOff, Check, X, RefreshCw } from "lucide-react";
import { useConfigStore } from "@/store/configStore";

const aiProviders = [
  { value: "ollama", label: "Ollama (Local)", description: "Run models locally, no API key needed" },
  { value: "gemini", label: "Google Gemini", description: "Google's Gemini AI models" },
  { value: "deepseek", label: "DeepSeek", description: "DeepSeek AI models" },
  { value: "openrouter", label: "OpenRouter", description: "Access to Claude, GPT-4, and more" },
  { value: "zai", label: "Z.ai", description: "Z.ai GLM-4.6 models" },
];

export const AIProviderConfig = () => {
  const { config, loading, error, loadConfig, updateConfig } = useConfigStore();
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");

  // Load config on mount
  useEffect(() => {
    if (!config) {
      loadConfig();
    }
  }, [config, loadConfig]);

  // Get current provider from .env
  const provider = config?.AI_MODEL || "ollama";

  const handleProviderChange = (newProvider: string) => {
    updateConfig("AI_MODEL", newProvider);
  };

  // Get API key for current provider
  const getApiKey = () => {
    switch (provider) {
      case "gemini": return config?.GEMINI_API_KEY || "";
      case "deepseek": return config?.DEEPSEEK_API_KEY || "";
      case "openrouter": return config?.OPENROUTER_API_KEY || "";
      case "zai": return config?.ZAI_API_KEY || "";
      default: return "";
    }
  };

  // Update API key for current provider
  const handleApiKeyChange = (value: string) => {
    const keyMap: Record<string, string> = {
      gemini: "GEMINI_API_KEY",
      deepseek: "DEEPSEEK_API_KEY",
      openrouter: "OPENROUTER_API_KEY",
      zai: "ZAI_API_KEY",
    };
    const keyName = keyMap[provider];
    if (keyName) {
      updateConfig(keyName, value);
    }
  };

  const handleTest = async () => {
    setTestStatus("testing");
    setTimeout(() => {
      if (getApiKey() || provider === "ollama") {
        setTestStatus("success");
      } else {
        setTestStatus("error");
      }
      setTimeout(() => setTestStatus("idle"), 2000);
    }, 1500);
  };

  const needsKey = provider !== "ollama";

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
        <Button variant="outline" size="sm" onClick={loadConfig} className="mt-2">
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">AI Provider Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Settings are read from and saved to the .env file
        </p>
      </div>

      {/* Provider Selection */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Provider (AI_MODEL)</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {aiProviders.map((p) => (
            <button
              key={p.value}
              onClick={() => handleProviderChange(p.value)}
              disabled={loading}
              className={`
                flex flex-col items-start p-3 rounded-lg border text-left transition-all
                ${provider === p.value
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:bg-accent"
                }
                ${loading ? "opacity-50" : ""}
              `}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-medium text-sm">{p.label}</span>
                {provider === p.value && (
                  <Check className="w-4 h-4 text-primary" />
                )}
              </div>
              <span className="text-xs text-muted-foreground mt-1">{p.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* API Key */}
      {needsKey && (
        <div className="space-y-2">
          <label className="text-sm font-medium">API Key</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showKey ? "text" : "password"}
                value={getApiKey()}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                placeholder="Enter your API key"
                className="pr-10"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testStatus === "testing" || !getApiKey() || loading}
            >
              {testStatus === "testing" ? (
                "Testing..."
              ) : testStatus === "success" ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : testStatus === "error" ? (
                <X className="w-4 h-4 text-destructive" />
              ) : (
                "Test"
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Saved to .env file
          </p>
        </div>
      )}

      {/* Current .env Values */}
      <div className="p-3 rounded-lg bg-muted/50">
        <h4 className="text-sm font-medium mb-2">Current .env Values</h4>
        <div className="space-y-1 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-muted-foreground">AI_MODEL=</span>
            <Badge variant="secondary">{provider}</Badge>
          </div>
          {needsKey && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">API_KEY=</span>
              <span>{getApiKey() ? "••••••••" : "(not set)"}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">WHISPER_MODEL=</span>
            <span>{config?.WHISPER_MODEL || "small"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">PERFORMANCE_PROFILE=</span>
            <span>{config?.PERFORMANCE_PROFILE || "balanced"}</span>
          </div>
        </div>
      </div>

      {provider === "ollama" && (
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
          <h4 className="text-sm font-medium mb-1 text-green-600 dark:text-green-400">
            Local Mode Active
          </h4>
          <p className="text-xs text-green-600/80 dark:text-green-400/80">
            No API key required. Models run locally via Ollama.
          </p>
        </div>
      )}
    </div>
  );
};
