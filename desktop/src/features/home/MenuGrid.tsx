import React from "react";
import { cn } from "@/lib/utils";
import {
  FileAudio,
  FileText,
  Layers,
  Zap,
  FileDigit,
  Cpu,
  Database,
  Settings,
  HelpCircle,
} from "lucide-react";

export interface MenuItem {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  category: "process" | "manage" | "system";
  badge?: "new" | "beta" | "pro";
}

export const menuItems: MenuItem[] = [
  {
    id: "process-single",
    title: "Process Single File",
    description: "Transcribe and summarize a single audio/video file",
    icon: FileAudio,
    category: "process",
  },
  {
    id: "transcribe-only",
    title: "Transcribe Only",
    description: "Generate transcript without AI summarization",
    icon: FileText,
    category: "process",
  },
  {
    id: "bulk-process",
    title: "Bulk Processing",
    description: "Process multiple files with configurable concurrency",
    icon: Layers,
    category: "process",
  },
  {
    id: "high-speed-queue",
    title: "High-Speed Queue",
    description: "Fast batch processing with whisper.cpp backend",
    icon: Zap,
    category: "process",
    badge: "pro",
  },
  {
    id: "summarize-doc",
    title: "Summarize Document",
    description: "AI-powered document summarization (PDF, DOCX, TXT)",
    icon: FileDigit,
    category: "manage",
  },
  {
    id: "system-status",
    title: "System Status",
    description: "View GPU availability, model info, and system health",
    icon: Cpu,
    category: "system",
  },
  {
    id: "cache-manager",
    title: "Cache Management",
    description: "View and clear model and result caches",
    icon: Database,
    category: "system",
  },
  {
    id: "configuration",
    title: "Configuration",
    description: "Configure AI providers, models, and performance settings",
    icon: Settings,
    category: "system",
  },
  {
    id: "help",
    title: "Help",
    description: "Documentation, shortcuts, and troubleshooting",
    icon: HelpCircle,
    category: "system",
  },
];

interface MenuGridProps {
  onSelect: (itemId: string) => void;
  className?: string;
}

export const MenuGrid = ({ onSelect, className }: MenuGridProps) => {
  const categories = [
    { id: "process", label: "Processing", color: "bg-blue-500/10 text-blue-500" },
    { id: "manage", label: "Management", color: "bg-purple-500/10 text-purple-500" },
    { id: "system", label: "System", color: "bg-emerald-500/10 text-emerald-500" },
  ] as const;

  return (
    <div className={cn("space-y-8", className)}>
      {categories.map((category) => {
        const items = menuItems.filter((item) => item.category === category.id);
        if (items.length === 0) return null;

        return (
          <div key={category.id}>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className={cn("px-2 py-0.5 rounded text-sm", category.color)}>
                {category.label}
              </span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelect(item.id)}
                    className="group relative flex flex-col items-start p-4 rounded-lg border bg-card hover:bg-accent hover:border-accent transition-all duration-200 text-left"
                  >
                    {item.badge && (
                      <span
                        className={cn(
                          "absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded font-medium",
                          item.badge === "new" && "bg-green-500 text-white",
                          item.badge === "beta" && "bg-blue-500 text-white",
                          item.badge === "pro" && "bg-purple-500 text-white"
                        )}
                      >
                        {item.badge.toUpperCase()}
                      </span>
                    )}
                    <div
                      className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center mb-3",
                        category.color
                      )}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="font-semibold text-sm mb-1 group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {item.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
