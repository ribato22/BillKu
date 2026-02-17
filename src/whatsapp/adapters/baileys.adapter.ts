import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  Browsers,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as fs from 'fs';
import * as path from 'path';
import * as QRCode from 'qrcode';
import { EventEmitter } from 'events';
import pino from 'pino';

export interface BaileysSession {
  socket: WASocket | null;
  qr: string | null;
  isConnected: boolean;
  phoneNumber: string | null;
}

@Injectable()
export class BaileysAdapter extends EventEmitter implements OnModuleDestroy {
  private readonly logger = new Logger(BaileysAdapter.name);
  private sessions: Map<string, BaileysSession> = new Map();
  private readonly sessionDir = path.join(process.cwd(), '.wa-sessions');

  constructor() {
    super();
    // Ensure session directory exists
    if (!fs.existsSync(this.sessionDir)) {
      fs.mkdirSync(this.sessionDir, { recursive: true });
    }
  }

  async onModuleDestroy() {
    // Clean up all connections on shutdown
    for (const [businessId, session] of this.sessions) {
      if (session.socket) {
        this.logger.log(`Closing WhatsApp connection for business: ${businessId}`);
        session.socket.end(undefined);
      }
    }
  }

  /**
   * Start WhatsApp connection for a business
   * Returns QR code if not yet authenticated
   */
  async connect(businessId: string): Promise<{ qr?: string; connected: boolean }> {
    const sessionPath = path.join(this.sessionDir, businessId);
    
    // Use multi-file auth state for session persistence
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    
    const socket = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.ubuntu('Chrome'),
      logger: pino({ level: 'silent' }) as any,
    });

    // Track session
    this.sessions.set(businessId, {
      socket,
      qr: null,
      isConnected: false,
      phoneNumber: null,
    });

    // Handle connection updates
    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      const session = this.sessions.get(businessId);
      
      if (qr && session) {
        // Generate QR code as data URL
        const qrDataUrl = await QRCode.toDataURL(qr);
        session.qr = qrDataUrl;
        this.emit('qr', { businessId, qr: qrDataUrl });
        this.logger.log(`QR code generated for business: ${businessId}`);
      }

      if (connection === 'close') {
        const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
        
        if (reason === DisconnectReason.loggedOut) {
          // User logged out, clean up session
          this.logger.warn(`WhatsApp logged out for business: ${businessId}`);
          await this.disconnect(businessId, true);
        } else if (reason !== DisconnectReason.connectionReplaced) {
          // Reconnect if not replaced by new connection
          this.logger.log(`Reconnecting WhatsApp for business: ${businessId}`);
          await this.connect(businessId);
        }
      }

      if (connection === 'open' && session) {
        session.isConnected = true;
        session.qr = null;
        session.phoneNumber = socket.user?.id?.split(':')[0] || null;
        this.emit('connected', { 
          businessId, 
          phoneNumber: session.phoneNumber 
        });
        this.logger.log(`WhatsApp connected for business: ${businessId}, phone: ${session.phoneNumber}`);
      }
    });

    // Save credentials when updated
    socket.ev.on('creds.update', saveCreds);

    // Wait a bit for initial QR or connection
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const session = this.sessions.get(businessId);
    return {
      qr: session?.qr || undefined,
      connected: session?.isConnected || false,
    };
  }

  /**
   * Disconnect WhatsApp session
   */
  async disconnect(businessId: string, clearSession = false): Promise<void> {
    const session = this.sessions.get(businessId);
    
    if (session?.socket) {
      session.socket.end(undefined);
    }
    
    this.sessions.delete(businessId);
    
    if (clearSession) {
      const sessionPath = path.join(this.sessionDir, businessId);
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true });
        this.logger.log(`Session cleared for business: ${businessId}`);
      }
    }
  }

  /**
   * Get current QR code for a business
   */
  getQRCode(businessId: string): string | null {
    return this.sessions.get(businessId)?.qr || null;
  }

  /**
   * Check if business is connected
   */
  isConnected(businessId: string): boolean {
    return this.sessions.get(businessId)?.isConnected || false;
  }

  /**
   * Get connected phone number
   */
  getPhoneNumber(businessId: string): string | null {
    return this.sessions.get(businessId)?.phoneNumber || null;
  }

  /**
   * Send WhatsApp message
   */
  async sendMessage(
    businessId: string,
    phoneNumber: string,
    message: string,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const session = this.sessions.get(businessId);
    
    if (!session?.socket || !session.isConnected) {
      return { success: false, error: 'WhatsApp not connected' };
    }

    try {
      // Format phone number to WhatsApp JID
      const jid = this.formatJid(phoneNumber);
      
      const result = await session.socket.sendMessage(jid, { text: message });
      
      this.logger.log(`Message sent to ${phoneNumber} for business: ${businessId}`);
      
      return { 
        success: true, 
        messageId: result?.key?.id ?? undefined 
      };
    } catch (error) {
      this.logger.error(`Failed to send message: ${error.message}`);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Send WhatsApp document (e.g., PDF)
   */
  async sendDocument(
    businessId: string,
    phoneNumber: string,
    document: Buffer,
    filename: string,
    caption?: string,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const session = this.sessions.get(businessId);
    
    if (!session?.socket || !session.isConnected) {
      return { success: false, error: 'WhatsApp not connected' };
    }

    try {
      const jid = this.formatJid(phoneNumber);
      
      const result = await session.socket.sendMessage(jid, {
        document,
        mimetype: 'application/pdf',
        fileName: filename,
        caption: caption || undefined,
      });
      
      this.logger.log(`Document sent to ${phoneNumber} for business: ${businessId}`);
      
      return { 
        success: true, 
        messageId: result?.key?.id ?? undefined 
      };
    } catch (error) {
      this.logger.error(`Failed to send document: ${error.message}`);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Format phone number to WhatsApp JID
   */
  private formatJid(phoneNumber: string): string {
    // Remove non-numeric characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Handle Indonesian numbers
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.substring(1);
    }
    
    // Add WhatsApp suffix
    return `${cleaned}@s.whatsapp.net`;
  }
}
