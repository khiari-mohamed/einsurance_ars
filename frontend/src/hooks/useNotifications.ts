import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';

interface Notification {
  id: string;
  type: string;
  priority: string;
  title: string;
  message: string;
  data?: any;
  timestamp: Date;
  read: boolean;
}

export function useNotifications() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user) return;

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const newSocket = io(`${API_URL}/notifications`, {
      query: { userId: user.id },
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected');
    });

    newSocket.on('notification', (notification: Notification) => {
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);

      // Show toast for high priority notifications
      if (notification.priority === 'high' || notification.priority === 'urgent') {
        toast(notification.title, {
          description: notification.message,
          duration: 5000,
        });
      }

      // Play sound for urgent notifications
      if (notification.priority === 'urgent') {
        const audio = new Audio('/sounds/notification.mp3');
        audio.play().catch(() => {});
      }
    });

    newSocket.on('pending_notifications', (pending: Notification[]) => {
      setNotifications(pending);
      setUnreadCount(pending.filter(n => !n.read).length);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [user]);

  const markAsRead = (notificationId: string) => {
    if (socket) {
      socket.emit('mark_read', notificationId);
      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const clearAll = () => {
    if (socket) {
      socket.emit('clear_all');
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  return {
    notifications,
    unreadCount,
    markAsRead,
    clearAll,
  };
}
