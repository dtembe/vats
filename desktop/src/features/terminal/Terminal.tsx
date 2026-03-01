import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { TerminalMessage } from "./useTerminalStream";
import {
  Info,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Bug,
  Clock,
  Trash2,
  Download,
} from "lucide-react";
import { Button } from "@/components/button";

interface TerminalProps {
  messages: TerminalMessage[];
  isStreaming?: boolean;
  onClear?: () => void;
  onExport?: () => void;
  className?: string;
}

const typeConfig = {
  info: { icon: Info, color: "text-blue-500", bgColor: "bg-blue-500/10" },
  success: { icon: CheckCircle, color: "text-green-500", bgColor: "bg-green-500/10" },
  warning: { icon: AlertTriangle, color: "text-yellow-500", bgColor: "bg-yellow-500/10" },
  error: { icon: XCircle, color: "text-red-500", bgColor: "bg-red-500/10" },
  debug: { icon: Bug, color: "text-purple-500", bgColor: "bg-purple-500/10" },
};

export const Terminal = ({
  messages,
  isStreaming = false,
  onClear,
  onExport,
  className,
}: TerminalProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }) + "." + date.getMilliseconds().toString().padStart(3, "0");
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden",
        className
      )}
    >
      {/* Terminal Header */}
      <div className="flex items-center justify-between border-b px-4 py-2 bg-muted/50">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <span className="text-sm font-medium text-muted-foreground ml-2">
            Terminal Output
          </span>
          {isStreaming && (
            <span className="flex items-center gap-1.5 text-xs text-primary">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Streaming
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {messages.length} messages
          </span>
          {onExport && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onExport}
              className="h-7 px-2"
            >
              <Download className="w-3.5 h-3.5" />
            </Button>
          )}
          {onClear && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="h-7 px-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Terminal Body */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 font-mono text-sm bg-background max-h-[400px] min-h-[200px]">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Waiting for output...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {messages.map((msg) => {
              const config = typeConfig[msg.type];
              const Icon = config.icon;

              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex items-start gap-2 py-1 px-2 rounded",
                    config.bgColor
                  )}
                >
                  <Icon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", config.color)} />
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {formatTime(msg.timestamp)}
                  </span>
                  {msg.source && (
                    <span className="text-xs text-muted-foreground/70 flex-shrink-0">
                      [{msg.source}]
                    </span>
                  )}
                  <span className="flex-1 break-words">{msg.content}</span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
    </div>
  );
};
