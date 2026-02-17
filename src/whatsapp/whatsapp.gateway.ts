import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { BaileysAdapter } from './adapters/baileys.adapter';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/whatsapp',
})
export class WhatsAppGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WhatsAppGateway.name);

  constructor(private readonly baileysAdapter: BaileysAdapter) {}

  afterInit() {
    this.logger.log('WhatsApp WebSocket Gateway initialized');

    // Forward BaileysAdapter events to WebSocket clients
    this.baileysAdapter.on('qr', ({ businessId, qr }) => {
      this.server.to(`business:${businessId}`).emit('whatsapp:qr', { qr });
      this.logger.debug(`QR emitted via WebSocket for business: ${businessId}`);
    });

    this.baileysAdapter.on('connected', ({ businessId, phoneNumber }) => {
      this.server.to(`business:${businessId}`).emit('whatsapp:connected', { phoneNumber });
      this.logger.log(`Connected event emitted via WebSocket for business: ${businessId}`);
    });
  }

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  /**
   * Client subscribes to a business's WhatsApp events
   * Payload: { businessId: string }
   */
  @SubscribeMessage('subscribe')
  handleSubscribe(client: Socket, payload: { businessId: string }) {
    if (!payload?.businessId) return;
    const room = `business:${payload.businessId}`;
    client.join(room);
    this.logger.debug(`Client ${client.id} subscribed to ${room}`);

    // Send current status immediately
    const isConnected = this.baileysAdapter.isConnected(payload.businessId);
    const phoneNumber = this.baileysAdapter.getPhoneNumber(payload.businessId);
    const qr = this.baileysAdapter.getQRCode(payload.businessId);

    client.emit('whatsapp:status', { isConnected, phoneNumber, qr });
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(client: Socket, payload: { businessId: string }) {
    if (!payload?.businessId) return;
    const room = `business:${payload.businessId}`;
    client.leave(room);
    this.logger.debug(`Client ${client.id} unsubscribed from ${room}`);
  }
}
