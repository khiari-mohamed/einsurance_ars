import { Bell, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useNotifications } from '@/hooks/useNotifications';

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, clearAll } = useNotifications();

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      urgent: 'text-[#d1503a] bg-[#d1503a]/15',
      high: 'text-[#e0a838] bg-[#e0a838]/15',
      medium: 'text-[#7fa8c2] bg-[#7fa8c2]/15',
      low: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-[#16201a]',
    };
    return colors[priority] || 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-[#16201a]';
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
          className="relative h-10 w-10 rounded-full border border-gray-200 dark:border-[#242e28] bg-white dark:bg-[#0e1712] shadow-sm transition hover:bg-gray-50 dark:hover:bg-[#16201a] hover:shadow-md"
        >
          <Bell size={18} className="text-gray-700 dark:text-gray-400" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#d1503a] p-0 text-[10px] font-semibold text-white">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] rounded-[14px] border border-gray-200 dark:border-[#242e28] bg-white dark:bg-[#0e1712] p-0 shadow-xl" align="end">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#16201a] px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-[#c5a15d]/15 border border-[#c5a15d]/25 p-2 text-[#c5a15d]">
              <Bell size={16} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{unreadCount > 0 ? `${unreadCount} non lue(s)` : 'À jour'}</p>
            </div>
          </div>
          {notifications.length > 0 && (
            <Button variant="ghost" size="sm" className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white" onClick={clearAll}>
              Tout effacer
            </Button>
          )}
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
              <div className="rounded-full bg-gray-100 dark:bg-[#16201a] p-3 text-gray-500 dark:text-gray-400">
                <Sparkles size={18} />
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Aucune notification</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Vous serez informé ici dès qu’un nouvel événement arrive.</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`cursor-pointer border-b border-gray-100 dark:border-[#16201a] px-4 py-3 transition hover:bg-gray-50 dark:hover:bg-[#16201a] ${
                  !notif.read ? 'bg-[#c5a15d]/[0.06] dark:bg-[#c5a15d]/[0.08]' : 'bg-white dark:bg-[#0e1712]'
                }`}
                onClick={() => markAsRead(notif.id)}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 rounded-full p-2 ${getPriorityColor(notif.priority)}`}>
                    <Bell size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{notif.title}</p>
                      {!notif.read && <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#c5a15d]" />}
                    </div>
                    <p className="mt-1 text-sm leading-5 text-gray-600 dark:text-gray-300">{notif.message}</p>
                    <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">{formatTime(notif.timestamp)}</p>
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