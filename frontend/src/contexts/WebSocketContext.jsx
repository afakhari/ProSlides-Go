import React, { createContext, useEffect, useRef, useState } from "react";

export const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children, role = "manager" }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [type8Message, setType8Message] = useState(null); // مخصوص type:8 که گم نشه
  const [connectionError, setConnectionError] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const [sessionId, setSessionId] = useState(null);

  // Connect to WebSocket
  const connect = (sessionIdInput) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log("Already connected");
      return;
    }

    try {
      // const wsUrl = `ws://localhost:8080/ws/${sessionIdInput}/${role}`;
      const wsUrl = `wss://present.proslides.ir/ws/${sessionIdInput}/${role}`;
      console.log(`🔌 Connecting to: ${wsUrl}`);

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("✅ WebSocket Connected as", role);
        setIsConnected(true);
        setConnectionError(null);
        setSessionId(sessionIdInput);
      };

      ws.onclose = () => {
        console.log("❌ WebSocket Disconnected");
        setIsConnected(false);

        // Auto-reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          if (sessionId) {
            console.log("🔄 Attempting to reconnect...");
            connect(sessionId);
          }
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error("⚠️ WebSocket Error:", error);
        setConnectionError("Connection error occurred");
      };

      ws.onmessage = (event) => {
        console.log("📩 Received:", event.data);

        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
          // ذخیره جداگانه type:8 تا با پیام‌های دیگه گم نشه
          if (data.type === 8) {
            console.log("📩 Type 8 stored separately");
            setType8Message({ ...data, _timestamp: Date.now() });
          }
        } catch {
          // Handle non-JSON messages (like "OK count: X")
          console.log("📩 Text message:", event.data);
          // Ignore "OK count" messages to prevent overwriting important JSON messages
          if (!event.data.startsWith("OK")) {
            setLastMessage({ type: "text", content: event.data });
          }
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      setConnectionError(error.message);
    }
  };

  // Disconnect WebSocket
  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setSessionId(null);
  };

  // Send message
  const sendMessage = (message) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const messageStr =
        typeof message === "string" ? message : JSON.stringify(message);
      wsRef.current.send(messageStr);
      console.log("📤 Sent:", messageStr);
      return true;
    } else {
      console.error("⚠️ WebSocket is not connected");
      return false;
    }
  };

  // Send navigation command (for manager)
  const sendNavigation = (action) => {
    const msg = {
      type: 9,
      action: action, // "next" or "previous"
    };
    return sendMessage(msg);
  };

  // Send end command (for manager)
  const sendEnd = () => {
    const msg = {
      type: 9,
      action: "end",
    };
    return sendMessage(msg);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const value = {
    isConnected,
    lastMessage,
    type8Message, // پیام type:8 جداگانه
    connectionError,
    sessionId,
    connect,
    disconnect,
    sendMessage,
    sendNavigation,
    sendEnd,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};
