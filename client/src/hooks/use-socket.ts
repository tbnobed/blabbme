import { useEffect, useRef, useState } from 'react';

interface UseSocketOptions {
  sessionId?: string | null;
  onSessionRestore?: (data: any) => void;
}

export function useSocket(options: UseSocketOptions = {}) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 10;
  const { sessionId, onSessionRestore } = options;

  const connect = () => {
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        setSocket(ws);
        
        // Initialize session on connection
        if (sessionId) {
          ws.send(JSON.stringify({
            type: 'init-session',
            sessionId,
          }));
        }

        // Start heartbeat to keep connection alive
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 25000); // Send ping every 25 seconds
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle session restoration
          if (data.type === 'session-restored' && onSessionRestore) {
            onSessionRestore(data);
          }
          
          // Handle server heartbeat to keep connection alive
          if (data.type === 'server-heartbeat') {
            // Send back a response to confirm connection is alive
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'heartbeat-ack' }));
            }
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        setSocket(null);
        
        // Clear heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }
        
        // Auto-reconnect with exponential backoff
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(Math.pow(2, reconnectAttemptsRef.current) * 1000, 30000); // Max 30 seconds
          console.log(`Reconnecting in ${delay}ms... (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        } else {
          console.log('Max reconnection attempts reached');
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    
    if (socket) {
      socket.close();
    }
    
    setSocket(null);
    setIsConnected(false);
    reconnectAttemptsRef.current = maxReconnectAttempts; // Prevent auto-reconnect
  };

  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [sessionId]);

  return {
    socket,
    isConnected,
    connect,
    disconnect,
  };
}
