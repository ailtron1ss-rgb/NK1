/**
 * Autonomous Notification & Push Service for Kurisu AI Companion.
 * Supports Browser Notifications API and simulated SMS toasts when user is away/idle.
 */

export interface SMSNotification {
  id: string;
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
  type: 'sms' | 'system' | 'autonomous_prompt' | 'dr_pepper_reminder';
}

class NotificationEngine {
  private notifications: SMSNotification[] = [];
  private listeners: ((notes: SMSNotification[]) => void)[] = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const saved = localStorage.getItem('kurisu_notifications');
      if (saved) {
        this.notifications = JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load notifications:', e);
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem('kurisu_notifications', JSON.stringify(this.notifications.slice(0, 30)));
    } catch (e) {
      console.error('Failed to save notifications:', e);
    }
  }

  public subscribe(listener: (notes: SMSNotification[]) => void) {
    this.listeners.push(listener);
    listener(this.notifications);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(l => l(this.notifications));
  }

  public async requestBrowserPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }

  public sendNotification(
    title: string,
    body: string,
    type: SMSNotification['type'] = 'sms',
    showNativePush: boolean = true
  ): SMSNotification {
    const note: SMSNotification = {
      id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title,
      body,
      timestamp: Date.now(),
      read: false,
      type
    };

    this.notifications.unshift(note);
    this.saveToStorage();
    this.notifyListeners();

    // Trigger Browser Push if allowed
    if (showNativePush && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(`[Kurisu SMS] ${title}`, {
          body,
          icon: '/favicon.ico',
          tag: note.id
        });
      } catch (e) {
        console.warn('Browser push failed, falling back to in-app SMS toast:', e);
      }
    }

    // Play subtle audio ping
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15); // E6
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      // AudioContext muted/blocked, non-fatal
    }

    return note;
  }

  public sendSMS(
    title: string,
    text: string,
    expression?: string
  ): SMSNotification {
    return this.sendNotification(title, text, 'sms', true);
  }

  public markAsRead(id: string) {
    const note = this.notifications.find(n => n.id === id);
    if (note) {
      note.read = true;
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  public getNotifications(): SMSNotification[] {
    return this.notifications;
  }

  public markAllAsRead() {
    this.notifications.forEach(n => (n.read = true));
    this.saveToStorage();
    this.notifyListeners();
  }

  public clearAll() {
    this.notifications = [];
    this.saveToStorage();
    this.notifyListeners();
  }
}

export const notificationEngine = new NotificationEngine();
