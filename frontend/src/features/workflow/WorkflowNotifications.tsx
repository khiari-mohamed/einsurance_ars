import { useState, useEffect } from 'react';
import { Bell, CheckCircle, Clock, AlertTriangle, X, Eye } from 'lucide-react';
import { toast } from 'sonner';

interface Notification {
  id: string;
  type: 'task' | 'alert' | 'info' | 'approval';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  message: string;
  affaireId?: string;
  sinistreId?: string;
  actionUrl?: string;
  createdAt: string;
  read: boolean;
  completed: boolean;
}

export default function WorkflowNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'tasks'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
    // Setup WebSocket for real-time notifications
    const ws = new WebSocket('ws://localhost:3000/notifications');
    ws.onmessage = (event) => {
      const newNotif = JSON.parse(event.data);
      setNotifications((prev) => [newNotif, ...prev]);
      toast.info(newNotif.title);
    };
    return () => ws.close();
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/workflow/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/workflow/notifications/${id}/read`, { method: 'PUT' });
      setNotifications(notifications.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const markAsCompleted = async (id: string) => {
    try {
      await fetch(`/api/workflow/notifications/${id}/complete`, { method: 'PUT' });
      setNotifications(notifications.map((n) => (n.id === id ? { ...n, completed: true } : n)));
      toast.success('Tâche marquée comme terminée');
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await fetch(`/api/workflow/notifications/${id}`, { method: 'DELETE' });
      setNotifications(notifications.filter((n) => n.id !== id));
      toast.success('Notification supprimée');
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'task':
        return <Clock className="text-blue-600" size={20} />;
      case 'alert':
        return <AlertTriangle className="text-orange-600" size={20} />;
      case 'approval':
        return <CheckCircle className="text-green-600" size={20} />;
      default:
        return <Bell className="text-gray-600" size={20} />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'border-l-4 border-red-500 bg-red-50';
      case 'high':
        return 'border-l-4 border-orange-500 bg-orange-50';
      case 'medium':
        return 'border-l-4 border-yellow-500 bg-yellow-50';
      default:
        return 'border-l-4 border-gray-300 bg-white';
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.read;
    if (filter === 'tasks') return n.type === 'task' && !n.completed;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;
  const taskCount = notifications.filter((n) => n.type === 'task' && !n.completed).length;

  if (loading) {
    return <div className="p-6 text-center">Chargement...</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="text-blue-600" size={32} />
              <div>
                <h1 className="text-2xl font-bold">Notifications & Tâches</h1>
                <p className="text-sm text-gray-600">
                  {unreadCount} non lue(s) • {taskCount} tâche(s) en attente
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 border-b bg-gray-50">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg ${
                filter === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              Toutes ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-4 py-2 rounded-lg ${
                filter === 'unread' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              Non lues ({unreadCount})
            </button>
            <button
              onClick={() => setFilter('tasks')}
              className={`px-4 py-2 rounded-lg ${
                filter === 'tasks' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              Tâches ({taskCount})
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="divide-y max-h-[600px] overflow-y-auto">
          {filteredNotifications.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Bell size={48} className="mx-auto mb-4 text-gray-300" />
              <p>Aucune notification</p>
            </div>
          ) : (
            filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-4 hover:bg-gray-50 transition-colors ${getPriorityColor(notif.priority)} ${
                  !notif.read ? 'font-semibold' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">{getIcon(notif.type)}</div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{notif.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">{notif.message}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          {new Date(notif.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {notif.type === 'task' && !notif.completed && (
                          <button
                            onClick={() => markAsCompleted(notif.id)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                            title="Marquer comme terminé"
                          >
                            <CheckCircle size={18} />
                          </button>
                        )}
                        {!notif.read && (
                          <button
                            onClick={() => markAsRead(notif.id)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            title="Marquer comme lu"
                          >
                            <Eye size={18} />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(notif.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Supprimer"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                    {notif.actionUrl && (
                      <a
                        href={notif.actionUrl}
                        className="inline-block mt-2 text-sm text-blue-600 hover:underline"
                      >
                        Voir le détail →
                      </a>
                    )}
                    {notif.completed && (
                      <span className="inline-block mt-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                        ✓ Terminé
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Common Notification Types Info */}
      <div className="mt-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
        <h4 className="font-semibold mb-2">Types de Notifications</h4>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>• <strong>Validation Sinistre:</strong> Directeur Technique doit approuver</li>
          <li>• <strong>Handoff DAF:</strong> Chargé de dossier → DAF pour paiement traité</li>
          <li>• <strong>SWIFT Manquant:</strong> Confirmation de paiement à attacher</li>
          <li>• <strong>Seuil Sinistre:</strong> Sinistre dépasse le seuil du traité</li>
          <li>• <strong>Document Manquant:</strong> Checklist incomplète</li>
          <li>• <strong>Échéance PMD:</strong> Rappel de paiement à venir</li>
        </ul>
      </div>
    </div>
  );
}
