import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Bell, FileText, Pill, Package, CheckCheck } from 'lucide-react';
import { AppNotification } from '../types';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '../utils/supabase';
import { useLanguage } from '../context/LanguageContext';

const ICONS: Record<AppNotification['type'], React.ComponentType<{ className?: string }>> = {
  prescription: Pill,
  report: FileText,
  order: Package,
  system: Bell,
};

/** Human-friendly "3h ago" / "2d ago" style relative time — small enough
 *  not to warrant pulling in a date library for. */
function relativeTime(iso: string, tr: (en: string, hi: string) => string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return tr('Just now', 'अभी');
  if (mins < 60) return tr(`${mins}m ago`, `${mins} मिनट पहले`);
  const hours = Math.floor(mins / 60);
  if (hours < 24) return tr(`${hours}h ago`, `${hours} घंटे पहले`);
  const days = Math.floor(hours / 24);
  if (days < 7) return tr(`${days}d ago`, `${days} दिन पहले`);
  return new Date(iso).toLocaleDateString();
}

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called whenever the unread count may have changed (opened, marked
   *  read, marked all read) so the bell's badge upstream can refresh. */
  onUnreadCountChange: (count: number) => void;
}

/** The bell's real destination — a real `notifications` row for every item,
 *  never invented. Tapping one marks it read; there's no per-type deep link
 *  yet (the source screens for an order/prescription aren't all reachable
 *  from Home today), so this intentionally stays a read/acknowledge list
 *  rather than guessing a navigation target. */
export const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ isOpen, onClose, onUnreadCountChange }) => {
  const { language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(() => {
    setIsLoading(true);
    getNotifications()
      .then((list) => {
        setItems(list);
        onUnreadCountChange(list.filter((n) => !n.read).length);
      })
      .finally(() => setIsLoading(false));
  }, [onUnreadCountChange]);

  useEffect(() => {
    if (isOpen) refresh();
  }, [isOpen, refresh]);

  const handleItemClick = (item: AppNotification) => {
    if (item.read) return;
    setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
    onUnreadCountChange(items.filter((n) => !n.read && n.id !== item.id).length);
    markNotificationRead(item.id).catch(() => {});
  };

  const handleMarkAllRead = () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    onUnreadCountChange(0);
    markAllNotificationsRead().catch(() => {});
  };

  const unreadCount = items.filter((n) => !n.read).length;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              className="relative w-full max-w-sm max-h-[80vh] rounded-3xl bg-white shadow-2xl flex flex-col text-left overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-zinc-100 shrink-0">
                <h2 className="text-lg font-black text-zinc-950">{tr('Notifications', 'सूचनाएं')}</h2>
                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      title={tr('Mark all as read', 'सभी को पढ़ा हुआ चिह्नित करें')}
                      className="p-1.5 rounded-full hover:bg-zinc-100 text-zinc-500 hover:text-emerald-600 cursor-pointer"
                    >
                      <CheckCheck className="w-4 h-4" />
                    </button>
                  )}
                  <button type="button" onClick={onClose} className="p-1.5 rounded-full hover:bg-zinc-100 cursor-pointer">
                    <X className="w-4 h-4 text-zinc-500" />
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto flex-1 px-3 py-2">
                {isLoading ? (
                  <div className="space-y-2 py-2">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-16 rounded-2xl bg-zinc-50 animate-pulse" />
                    ))}
                  </div>
                ) : items.length === 0 ? (
                  <div className="py-10 text-center">
                    <Bell className="w-8 h-8 text-zinc-300 mx-auto mb-2" strokeWidth={1.5} />
                    <p className="text-sm font-bold text-zinc-400">{tr('No notifications yet', 'अभी तक कोई सूचना नहीं')}</p>
                    <p className="text-xs text-zinc-400 mt-1">{tr("We'll let you know when something real happens.", 'जब कुछ वास्तविक होगा, हम आपको बताएंगे।')}</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 py-1">
                    {items.map((item) => {
                      const Icon = ICONS[item.type] || Bell;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleItemClick(item)}
                          className={`w-full flex items-start gap-3 p-3 rounded-2xl text-left transition-colors cursor-pointer ${
                            item.read ? 'bg-white hover:bg-zinc-50' : 'bg-emerald-50/70 hover:bg-emerald-50'
                          }`}
                        >
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${item.read ? 'bg-zinc-50 text-zinc-400' : 'bg-white text-emerald-600 shadow-sm'}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className={`text-sm truncate ${item.read ? 'font-semibold text-zinc-700' : 'font-black text-zinc-950'}`}>
                                {item.title}
                              </div>
                              {!item.read && <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-1.5" />}
                            </div>
                            {item.body && <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{item.body}</p>}
                            <p className="text-[10px] text-zinc-400 font-semibold mt-1">{relativeTime(item.createdAt, tr)}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};
