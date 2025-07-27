import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Bell, X, Check, AlertTriangle, Info } from 'lucide-react';
import { Button } from './button';
import { Badge } from './badge';
import { Card, CardContent } from './card';
import { useWebSocket } from '../../hooks/useWebSocket';

interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
}

export function RealTimeNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const handleWebSocketError = useCallback((error: Event) => {
    console.error('WebSocket error in notifications:', error);
  }, []);

  const webSocketOptions = useMemo(() => ({
    onError: handleWebSocketError
  }), [handleWebSocketError]);

  const { isConnected, lastMessage } = useWebSocket(webSocketOptions);

  // Mock notifications for demo
  useEffect(() => {
    const mockNotifications: Notification[] = [
      {
        id: '1',
        title: 'Hồ sơ mới cần xử lý',
        message: 'Có 3 hồ sơ bồi thường mới cần được xem xét',
        type: 'info',
        timestamp: new Date(Date.now() - 5 * 60 * 1000),
        read: false,
        actionUrl: '/admin'
      },
      {
        id: '2',
        title: 'Hồ sơ đã được duyệt',
        message: 'Hồ sơ HS001234 đã được duyệt thành công',
        type: 'success',
        timestamp: new Date(Date.now() - 15 * 60 * 1000),
        read: false
      },
      {
        id: '3',
        title: 'Cảnh báo hệ thống',
        message: 'Tải hệ thống đang cao (85%)',
        type: 'warning',
        timestamp: new Date(Date.now() - 30 * 60 * 1000),
        read: true
      }
    ];
    setNotifications(mockNotifications);
  }, []);

  // Handle new WebSocket messages
  useEffect(() => {
    if (lastMessage && typeof lastMessage === 'object' && lastMessage.type) {
      try {
        // lastMessage is already a parsed WebSocketMessage object
        const data = lastMessage as WebSocketMessage;

        // Validate message structure
        if (!data.type || !data.data) {
          console.warn('Invalid WebSocket message structure:', data);
          return;
        }

        // Convert WebSocket messages to notifications
        let notificationData: any = null;

        switch (data.type) {
          case 'notification':
            notificationData = data.data;
            break;
          case 'claim_update':
            notificationData = {
              title: 'Cập nhật hồ sơ',
              message: data.data.message || `Hồ sơ ${data.data.claimId} đã được cập nhật`,
              notificationType: 'info'
            };
            break;
          case 'document_verified':
            notificationData = {
              title: 'Tài liệu đã xác minh',
              message: data.data.message || `${data.data.documentName} đã được xác minh thành công`,
              notificationType: 'success'
            };
            break;
          case 'payment_processed':
            notificationData = {
              title: 'Thanh toán hoàn tất',
              message: data.data.message || `Đã chuyển khoản ${data.data.amount?.toLocaleString()} VND`,
              notificationType: 'success'
            };
            break;
        }

        if (notificationData) {
          const newNotification: Notification = {
            id: Date.now().toString(),
            title: notificationData.title || 'Thông báo mới',
            message: notificationData.message || 'Có cập nhật mới',
            type: notificationData.notificationType || 'info',
            timestamp: new Date(),
            read: false,
            actionUrl: notificationData.actionUrl
          };

          setNotifications(prev => [newNotification, ...prev]);

          // Show browser notification if permission granted
          if (Notification.permission === 'granted') {
            new Notification(newNotification.title, {
              body: newNotification.message,
              icon: '/icon-192x192.png'
            });
          }
        }
      } catch (error) {
        console.error('Failed to process WebSocket message:', error);
      }
    }
  }, [lastMessage]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(n => ({ ...n, read: true }))
    );
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <X className="h-4 w-4 text-red-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const formatTime = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days} ngày trước`;
    if (hours > 0) return `${hours} giờ trước`;
    if (minutes > 0) return `${minutes} phút trước`;
    return 'Vừa xong';
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2"
        aria-label="Thông báo"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs p-0"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
        {/* Connection status indicator */}
        <div 
          className={`absolute bottom-0 right-0 w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-red-500'
          }`}
          title={isConnected ? 'Đã kết nối' : 'Mất kết nối'}
        />
      </Button>

      {showDropdown && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowDropdown(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-80 sm:w-96 max-w-[calc(100vw-2rem)] z-50">
            <Card>
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="font-semibold">Thông báo</h3>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={markAllAsRead}
                      className="text-xs"
                    >
                      Đánh dấu đã đọc
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDropdown(false)}
                    className="p-1"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="max-h-72 sm:max-h-80 overflow-y-auto">
                {notifications.length > 0 ? (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 border-b last:border-b-0 hover:bg-muted cursor-pointer ${
                        !notification.read ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => {
                        markAsRead(notification.id);
                        if (notification.actionUrl) {
                          window.location.href = notification.actionUrl;
                        }
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-1">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <h4 className={`text-sm font-medium vietnamese-text break-words ${
                              !notification.read ? 'text-gray-900' : 'text-gray-600'
                            }`}>
                              {notification.title}
                            </h4>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeNotification(notification.id);
                              }}
                              className="p-1 ml-2"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-2">
                            {formatTime(notification.timestamp)}
                          </p>
                        </div>
                        {!notification.read && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-gray-500">
                    <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Không có thông báo mới</p>
                  </div>
                )}
              </div>
              
              {notifications.length > 0 && (
                <div className="p-3 border-t bg-gray-50">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-center"
                    onClick={() => {
                      setShowDropdown(false);
                      // Navigate to notifications page
                    }}
                  >
                    Xem tất cả thông báo
                  </Button>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
