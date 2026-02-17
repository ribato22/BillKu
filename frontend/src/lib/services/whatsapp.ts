// WhatsApp service for frontend
// Uses authService.fetchWithAuth for authenticated API calls
// Uses Socket.IO for real-time QR code and status updates

import { authService } from "@/lib/auth";
import { io, Socket } from "socket.io-client";

export interface WhatsAppStatus {
  isConnected: boolean;
  phoneNumber: string | null;
  provider: 'BAILEYS' | 'CLOUD_API' | 'FONTTE';
}

export interface ReminderSchedule {
  id: string;
  triggerDays: number;
  template: string;
  isActive: boolean;
  createdAt: string;
}

export interface ReminderLog {
  id: string;
  phoneNumber: string;
  message: string;
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  sentAt: string | null;
  error: string | null;
  createdAt: string;
}

class WhatsAppServiceClass {
  private socket: Socket | null = null;

  /**
   * Connect to WebSocket for real-time QR/status updates
   * Returns a cleanup function to disconnect
   */
  connectWebSocket(
    businessId: string,
    callbacks: {
      onQr?: (qr: string) => void;
      onConnected?: (data: { phoneNumber: string }) => void;
      onStatus?: (data: { isConnected: boolean; phoneNumber: string | null; qr: string | null }) => void;
      onDisconnect?: () => void;
    },
  ): () => void {
    // Derive WebSocket URL from API URL (strip /api/v1)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    let wsUrl: string;
    if (apiUrl.startsWith('http')) {
      wsUrl = apiUrl.replace(/\/api\/v1\/?$/, '');
    } else {
      // Relative URL — use current origin
      wsUrl = typeof window !== 'undefined' ? window.location.origin : '';
    }

    this.socket = io(`${wsUrl}/whatsapp`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => {
      this.socket?.emit('subscribe', { businessId });
    });

    this.socket.on('whatsapp:qr', (data: { qr: string }) => {
      callbacks.onQr?.(data.qr);
    });

    this.socket.on('whatsapp:connected', (data: { phoneNumber: string }) => {
      callbacks.onConnected?.(data);
    });

    this.socket.on('whatsapp:status', (data: { isConnected: boolean; phoneNumber: string | null; qr: string | null }) => {
      callbacks.onStatus?.(data);
    });

    this.socket.on('disconnect', () => {
      callbacks.onDisconnect?.();
    });

    // Return cleanup function
    return () => {
      if (this.socket) {
        this.socket.emit('unsubscribe', { businessId });
        this.socket.disconnect();
        this.socket = null;
      }
    };
  }

  // Connection management
  async connect(): Promise<{ qr?: string; connected: boolean }> {
    const response = await authService.fetchWithAuth('/whatsapp/connect', {
      method: 'POST',
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Gagal menghubungkan WhatsApp');
    }
    const data = await response.json();
    return data.data;
  }

  async getQRCode(): Promise<string | null> {
    const response = await authService.fetchWithAuth('/whatsapp/qr');
    if (!response.ok) return null;
    const data = await response.json();
    return data.data?.qr || null;
  }

  async getStatus(): Promise<WhatsAppStatus> {
    const response = await authService.fetchWithAuth('/whatsapp/status');
    if (!response.ok) {
      // Return default status on error instead of crashing
      return { isConnected: false, phoneNumber: null, provider: 'BAILEYS' };
    }
    const data = await response.json();
    return data.data;
  }

  async disconnect(): Promise<void> {
    const response = await authService.fetchWithAuth('/whatsapp/disconnect', {
      method: 'POST',
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Gagal memutuskan WhatsApp');
    }
  }

  // Send message
  async sendMessage(phoneNumber: string, message: string): Promise<{ success: boolean; error?: string }> {
    const response = await authService.fetchWithAuth('/whatsapp/send', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber, message }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return { success: false, error: error.message || 'Gagal mengirim pesan' };
    }
    const data = await response.json();
    return data.data;
  }

  // Invoice reminder
  async sendInvoiceReminder(invoiceId: string, template?: string): Promise<{ success: boolean; error?: string }> {
    const response = await authService.fetchWithAuth(`/whatsapp/invoices/${invoiceId}/remind`, {
      method: 'POST',
      body: JSON.stringify({ template }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return { success: false, error: error.message || 'Gagal mengirim reminder' };
    }
    const data = await response.json();
    return data.data;
  }

  async getReminderLogs(invoiceId: string): Promise<ReminderLog[]> {
    const response = await authService.fetchWithAuth(`/whatsapp/invoices/${invoiceId}/reminder-logs`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.data || [];
  }

  // Reminder schedules
  async listSchedules(): Promise<ReminderSchedule[]> {
    const response = await authService.fetchWithAuth('/whatsapp/reminder-schedules');
    if (!response.ok) return [];
    const data = await response.json();
    return data.data || [];
  }

  async createSchedule(triggerDays: number, template: string): Promise<ReminderSchedule> {
    const response = await authService.fetchWithAuth('/whatsapp/reminder-schedules', {
      method: 'POST',
      body: JSON.stringify({ triggerDays, template }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Gagal membuat jadwal');
    }
    const data = await response.json();
    return data.data;
  }

  async updateSchedule(id: string, data: { template?: string; isActive?: boolean }): Promise<ReminderSchedule> {
    const response = await authService.fetchWithAuth(`/whatsapp/reminder-schedules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Gagal mengubah jadwal');
    }
    const result = await response.json();
    return result.data;
  }

  async deleteSchedule(id: string): Promise<void> {
    const response = await authService.fetchWithAuth(`/whatsapp/reminder-schedules/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Gagal menghapus jadwal');
    }
  }
}

export const whatsappService = new WhatsAppServiceClass();

