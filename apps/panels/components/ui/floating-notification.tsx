'use client';

import { useEffect, useState, useCallback } from 'react';
import { CircleCheck, Info, OctagonX, TriangleAlert, X } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  description?: string;
  duration: number; // ms
  createdAt: number;
  exiting?: boolean;
}

interface NotifyOptions {
  description?: string;
  duration?: number; // ms, default 3000
}

// ─── Global Store (module-level, no React context needed) ────────────────────

let notifications: Notification[] = [];
let listeners: Array<() => void> = [];
let idCounter = 0;

function emitChange() {
  listeners.forEach((fn) => fn());
}

function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot(): Notification[] {
  return notifications;
}

function addNotification(type: NotificationType, message: string, opts?: NotifyOptions) {
  const id = `notif-${++idCounter}-${Date.now()}`;
  const duration = opts?.duration ?? 3000;
  notifications = [
    ...notifications,
    { id, type, message, description: opts?.description, duration, createdAt: Date.now() },
  ];
  // Limit stack to 5
  if (notifications.length > 5) {
    notifications = notifications.slice(-5);
  }
  emitChange();

  // Auto-dismiss: mark as exiting first, then remove after exit animation
  setTimeout(() => {
    markExiting(id);
  }, duration);

  setTimeout(() => {
    removeNotification(id);
  }, duration + 300); // 300ms for exit animation
}

function markExiting(id: string) {
  notifications = notifications.map((n) =>
    n.id === id ? { ...n, exiting: true } : n
  );
  emitChange();
}

function removeNotification(id: string) {
  notifications = notifications.filter((n) => n.id !== id);
  emitChange();
}

function dismissNotification(id: string) {
  markExiting(id);
  setTimeout(() => {
    removeNotification(id);
  }, 300);
}

// ─── Public API (drop-in replacement for toast from sonner) ──────────────────

export const notify = {
  success: (message: string, opts?: NotifyOptions) => addNotification('success', message, opts),
  error: (message: string, opts?: NotifyOptions) => addNotification('error', message, opts),
  warning: (message: string, opts?: NotifyOptions) => addNotification('warning', message, opts),
  info: (message: string, opts?: NotifyOptions) => addNotification('info', message, opts),
};

// ─── Variant Styles ──────────────────────────────────────────────────────────

const variantConfig: Record<NotificationType, { icon: typeof CircleCheck; border: string; bg: string; text: string; hoverBg: string }> = {
  success: {
    icon: CircleCheck,
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-700 dark:text-emerald-400',
    hoverBg: 'hover:bg-emerald-500/20',
  },
  error: {
    icon: OctagonX,
    border: 'border-red-500/30',
    bg: 'bg-red-500/10',
    text: 'text-red-700 dark:text-red-400',
    hoverBg: 'hover:bg-red-500/20',
  },
  warning: {
    icon: TriangleAlert,
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/10',
    text: 'text-amber-700 dark:text-amber-400',
    hoverBg: 'hover:bg-amber-500/20',
  },
  info: {
    icon: Info,
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/10',
    text: 'text-blue-700 dark:text-blue-400',
    hoverBg: 'hover:bg-blue-500/20',
  },
};

// ─── Provider Component (renders the floating notifications) ─────────────────

export function NotificationProvider() {
  const [items, setItems] = useState<Notification[]>([]);

  useEffect(() => {
    // Sync with module-level store
    setItems(getSnapshot());
    return subscribe(() => {
      setItems(getSnapshot());
    });
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: '420px' }}>
      {items.map((item) => {
        const config = variantConfig[item.type];
        const Icon = config.icon;

        return (
          <div
            key={item.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-lg border ${config.border} ${config.bg} backdrop-blur-md px-4 py-3 text-sm ${config.text} shadow-lg transition-all duration-300 ease-in-out ${
              item.exiting
                ? 'opacity-0 translate-x-8'
                : 'opacity-100 translate-x-0 animate-in slide-in-from-right-5 fade-in duration-300'
            }`}
          >
            <Icon size={16} className="shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-medium leading-snug">{item.message}</p>
              {item.description && (
                <p className="mt-0.5 text-xs opacity-80">{item.description}</p>
              )}
            </div>
            <button
              onClick={() => dismissNotification(item.id)}
              className={`shrink-0 p-0.5 rounded ${config.hoverBg} transition-colors`}
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
