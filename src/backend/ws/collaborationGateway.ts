import type { Server as HttpServer } from 'http';
import type { Server as IOServer, Socket } from 'socket.io';
import type Redis from 'ioredis';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import config from '../config.js';
import logger from '../logger.js';

export interface CollaborationGatewayOptions {
  io?: IOServer;
  server?: HttpServer;
  redis: Redis;
}

export const createCollaborationGateway = ({ io: existingIo, server, redis }: CollaborationGatewayOptions): IOServer => {
  if (!existingIo && !server) {
    throw new Error('Either io or server must be provided to initialize collaboration gateway');
  }

  const io = existingIo ?? new SocketIOServer(server!, {
    cors: {
      origin: config.corsOrigins,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  const pubClient = redis;
  const subClient = redis.duplicate();
  io.adapter(createAdapter(pubClient, subClient));

  io.of('/collaboration').on('connection', (socket: Socket) => {
    const { sessionId, userId } = socket.handshake.query as { sessionId?: string; userId?: string };

    if (!sessionId || !userId) {
      logger.warn({ sessionId, userId }, '[CollaborationGateway] Missing sessionId or userId');
      socket.disconnect(true);
      return;
    }

    const room = `collab:${sessionId}`;
    socket.join(room);
    logger.info({ sessionId, userId }, '[CollaborationGateway] Client connected');

    socket.broadcast.to(room).emit('user-joined', { userId });

    socket.on('cursor-update', (payload) => {
      socket.broadcast.to(room).emit('cursor-update', payload);
    });

    socket.on('code-change', (payload) => {
      socket.broadcast.to(room).emit('code-change', payload);
    });

    socket.on('code-changes-batch', (payload) => {
      socket.broadcast.to(room).emit('code-changes-batch', payload);
    });

    socket.on('resolve-conflict', (payload) => {
      socket.broadcast.to(room).emit('resolve-conflict', payload);
    });

    socket.on('voice-state', (payload) => {
      socket.broadcast.to(room).emit('voice-state', payload);
    });

    socket.on('heartbeat', () => {
      socket.emit('heartbeat-ack');
    });

    socket.on('disconnect', (reason) => {
      logger.info({ sessionId, userId, reason }, '[CollaborationGateway] Client disconnected');
      socket.broadcast.to(room).emit('user-left', { userId });
    });

    socket.on('error', (error) => {
      logger.error({ sessionId, userId, error }, '[CollaborationGateway] Socket error');
    });
  });

  return io;
};

export default createCollaborationGateway;
