import { useState, useCallback, useRef } from "react";

export interface TerminalMessage {
  id: string;
  timestamp: Date;
  type: "info" | "success" | "warning" | "error" | "debug";
  content: string;
  source?: string;
}

export function useTerminalStream() {
  const [messages, setMessages] = useState<TerminalMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const addMessage = useCallback(
    (content: string, type: TerminalMessage["type"] = "info", source?: string) => {
      const message: TerminalMessage = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        type,
        content,
        source,
      };
      setMessages((prev) => [...prev, message]);
    },
    []
  );

  const addInfo = useCallback((content: string, source?: string) => {
    addMessage(content, "info", source);
  }, [addMessage]);

  const addSuccess = useCallback((content: string, source?: string) => {
    addMessage(content, "success", source);
  }, [addMessage]);

  const addWarning = useCallback((content: string, source?: string) => {
    addMessage(content, "warning", source);
  }, [addMessage]);

  const addError = useCallback((content: string, source?: string) => {
    addMessage(content, "error", source);
  }, [addMessage]);

  const addDebug = useCallback((content: string, source?: string) => {
    addMessage(content, "debug", source);
  }, [addMessage]);

  const clear = useCallback(() => {
    setMessages([]);
  }, []);

  const startStreaming = useCallback(() => {
    setIsStreaming(true);
  }, []);

  const stopStreaming = useCallback(() => {
    setIsStreaming(false);
  }, []);

  return {
    messages,
    isStreaming,
    addMessage,
    addInfo,
    addSuccess,
    addWarning,
    addError,
    addDebug,
    clear,
    startStreaming,
    stopStreaming,
    messagesEndRef,
  };
}
