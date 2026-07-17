import { Bell, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useNotifications } from '@/hooks/useNotifications';

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, clearAll } = useNotifications();

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      urgent: 'text-red-600 bg-red-50',
      high: 'text-orange-600 bg-orange-50',
      medium: 'text-blue-600 bg-blue-50',
      low: 'text-gray-600 bg-gray-100',
    };
    return colors[priority] || 'text-gray-600 bg-gray-100';
  };

  const formatTime = (value: Date | string) => {
    const date = new Date(value);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative h-10 w-10 rounded-full border border-gray-200 bg-white shadow-sm transition hover:bg-gray-50 hover:shadow-md"
        >
          <Bell size={18} className="text-gray-700" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 p-0 text-[10px] font-semibold text-white">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] rounded-2xl border border-gray-200 bg-white p-0 shadow-xl" align="end">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-blue-50 p-2 text-blue-600">
              <Bell size={16} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
              <p className="text-xs text-gray-500">{unreadCount > 0 ? `${unreadCount} non lue(s)` : 'À jour'}</p>
            </div>
          </div>
          {notifications.length > 0 && (
            <Button variant="ghost" size="sm" className="text-xs text-gray-600 hover:text-gray-900" onClick={clearAll}>
              Tout effacer
            </Button>
          )}
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
              <div className="rounded-full bg-gray-100 p-3 text-gray-500">
                <Sparkles size={18} />
              </div>
              <p className="text-sm font-medium text-gray-700">Aucune notification</p>
              <p className="text-xs text-gray-500">Vous serez informé ici dès qu’un nouvel événement arrive.</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`cursor-pointer border-b border-gray-100 px-4 py-3 transition hover:bg-gray-50 ${
                  !notif.read ? 'bg-blue-50/60' : 'bg-white'
                }`}
                onClick={() => markAsRead(notif.id)}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 rounded-full p-2 ${getPriorityColor(notif.priority)}`}>
                    <Bell size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900">{notif.title}</p>
                      {!notif.read && <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" />}
                    </div>
                    <p className="mt-1 text-sm leading-5 text-gray-600">{notif.message}</p>
                    <p className="mt-2 text-xs text-gray-400">{formatTime(notif.timestamp)}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
