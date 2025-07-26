import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void;
  onClose?: () => void;
  reconnectAttempts?: number;
  reconnectInterval?: number;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { user, token } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = options.reconnectAttempts || 5;
  const reconnectInterval = options.reconnectInterval || 3000;

  const connect = useCallback(() => {
    if (!user || !token) return;

    try {
      setConnectionStatus('connecting');

      // In a real implementation, this would be wss://your-domain.com/ws
      // For demo purposes, we'll simulate WebSocket behavior
      const mockWebSocket = createMockWebSocket();
      wsRef.current = mockWebSocket;

      mockWebSocket.onopen = () => {
        setIsConnected(true);
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0;
        options.onOpen?.();

        // Send authentication
        mockWebSocket.send(JSON.stringify({
          type: 'auth',
          token: token,
          userId: user.id
        }));
      };

      mockWebSocket.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);
          options.onMessage?.(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      mockWebSocket.onerror = (error) => {
        setConnectionStatus('error');
        options.onError?.(error);
      };

      mockWebSocket.onclose = () => {
        setIsConnected(false);
        setConnectionStatus('disconnected');
        wsRef.current = null;
        options.onClose?.();

        // Attempt reconnection
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval * reconnectAttemptsRef.current);
        }
      };

    } catch (error) {
      console.error('WebSocket connection error:', error);
      setConnectionStatus('error');
    }
  }, [user, token, maxReconnectAttempts, reconnectInterval]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setConnectionStatus('disconnected');
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current && isConnected) {
      wsRef.current.send(JSON.stringify({
        ...message,
        timestamp: new Date().toISOString()
      }));
    }
  }, [isConnected]);

  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  return {
    isConnected,
    connectionStatus,
    lastMessage,
    sendMessage,
    connect,
    disconnect
  };
}

// Mock WebSocket for demonstration
function createMockWebSocket(): WebSocket {
  const mockWS = {
    readyState: WebSocket.CONNECTING,
    onopen: null as ((event: Event) => void) | null,
    onmessage: null as ((event: MessageEvent) => void) | null,
    onerror: null as ((event: Event) => void) | null,
    onclose: null as ((event: CloseEvent) => void) | null,
    
    send: (data: string) => {
      console.log('WebSocket send:', data);
    },
    
    close: () => {
      mockWS.readyState = WebSocket.CLOSED;
      setTimeout(() => {
        mockWS.onclose?.({} as CloseEvent);
      }, 100);
    }
  } as WebSocket;

  // Simulate connection
  setTimeout(() => {
    mockWS.readyState = WebSocket.OPEN;
    mockWS.onopen?.({} as Event);
    
    // Simulate periodic messages
    const messageInterval = setInterval(() => {
      if (mockWS.readyState === WebSocket.OPEN) {
        const mockMessages = [
          {
            type: 'claim_update',
            data: {
              claimId: 'HC240115001',
              status: 'Đang xem xét',
              message: 'Hồ sơ của bạn đang được thẩm định bởi chuyên viên'
            },
            timestamp: new Date().toISOString()
          },
          {
            type: 'document_verified',
            data: {
              claimId: 'HC240115001',
              documentName: 'Hóa đơn viện phí',
              message: 'Tài liệu đã được xác minh thành công'
            },
            timestamp: new Date().toISOString()
          },
          {
            type: 'payment_processed',
            data: {
              claimId: 'HC240115001',
              amount: 2500000,
              message: 'Tiền bồi thường đã được chuyển khoản'
            },
            timestamp: new Date().toISOString()
          }
        ];
        
        const randomMessage = mockMessages[Math.floor(Math.random() * mockMessages.length)];
        mockWS.onmessage?.({
          data: JSON.stringify(randomMessage)
        } as MessageEvent);
      }
    }, 10000); // Send message every 10 seconds

    // Clean up interval when connection closes
    const originalClose = mockWS.close;
    mockWS.close = () => {
      clearInterval(messageInterval);
      originalClose.call(mockWS);
    };
    
  }, 1000);

  return mockWS;
}

// Notification hook
export function useNotifications() {
  const [notifications, setNotifications] = useState<WebSocketMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const { lastMessage } = useWebSocket({
    onMessage: (message) => {
      // Add notification to list
      setNotifications(prev => [message, ...prev.slice(0, 49)]); // Keep last 50
      setUnreadCount(prev => prev + 1);
      
      // Show browser notification if permission granted
      if (Notification.permission === 'granted') {
        new Notification('ClaimFlow - Cập nhật mới', {
          body: getNotificationBody(message),
          icon: '/favicon.ico',
          tag: message.type
        });
      }
    }
  });

  const markAsRead = useCallback((messageId?: string) => {
    if (messageId) {
      setNotifications(prev => 
        prev.map(notif => 
          notif.timestamp === messageId 
            ? { ...notif, read: true } 
            : notif
        )
      );
    } else {
      setUnreadCount(0);
    }
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  const requestPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return Notification.permission === 'granted';
  }, []);

  return {
    notifications,
    unreadCount,
    markAsRead,
    clearNotifications,
    requestPermission
  };
}

function getNotificationBody(message: WebSocketMessage): string {
  switch (message.type) {
    case 'claim_update':
      return `Hồ sơ ${message.data.claimId}: ${message.data.message}`;
    case 'document_verified':
      return `${message.data.documentName} đã được xác minh`;
    case 'payment_processed':
      return `Đã chuyển khoản ${message.data.amount.toLocaleString()} VND`;
    default:
      return message.data.message || 'Có cập nhật mới';
  }
}
