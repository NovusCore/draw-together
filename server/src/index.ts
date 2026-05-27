import { createServer } from 'http';
import { randomUUID } from 'crypto';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { RoomManager } from './RoomManager';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  DrawingStroke,
} from './types';

dotenv.config();

const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

const httpServer = createServer();
const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
  httpServer,
  {
    cors: {
      origin: CORS_ORIGIN,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  },
);

const roomManager = new RoomManager();

// Генератор ID для линий (упрощённо, в продакшене используйте крипто-генератор)
function generateStrokeId(): string {
  return `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) => {
  const userId = randomUUID();
  socket.data.userId = userId;

  console.log(`[${new Date().toISOString()}] User connected: ${userId}`);

  // Обработка присоединения к конкретной комнате
  socket.on('join:room' as any, (roomId: string, callback?: (state: DrawingStroke[]) => void) => {
    socket.data.roomId = roomId;
    socket.join(roomId);

    roomManager.addUserToRoom(roomId, userId);
    const userCount = roomManager.getRoomUserCount(roomId);
    const fullState = roomManager.getRoomState(roomId);

    console.log(`[${new Date().toISOString()}] User ${userId} joined room: ${roomId} (total: ${userCount})`);

    // Отправляем новому пользователю полное состояние холста
    if (callback) {
      callback(fullState);
    }

    // Уведомляем остальных пользователей в комнате
    socket.broadcast.to(roomId).emit('room:user-joined', { userId, count: userCount });
  });

  // При отключении
  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (roomId) {
      const isRoomEmpty = roomManager.removeUserFromRoom(roomId, userId);
      const userCount = roomManager.getRoomUserCount(roomId);

      io.to(roomId).emit('room:user-left', { userId, count: userCount });

      if (isRoomEmpty) {
        console.log(`[${new Date().toISOString()}] Room closed: ${roomId}`);
      }
    }

    console.log(`[${new Date().toISOString()}] User disconnected: ${userId}`);
  });

  // Начало рисования
  socket.on('draw:start', (data) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const strokeId = generateStrokeId();
    socket.data.currentStrokeId = strokeId;

    const stroke: DrawingStroke = {
      id: strokeId,
      userId,
      points: [{ x: data.x, y: data.y, timestamp: Date.now() }],
      color: data.color,
      size: data.size,
      createdAt: Date.now(),
    };

    roomManager.addStroke(roomId, stroke);

    io.to(roomId).emit('draw:stroke-started', {
      userId,
      strokeId,
      x: data.x,
      y: data.y,
      color: data.color,
      size: data.size,
    });
  });

  // Движение мыши при рисовании (с throttling на клиенте, но обрабатываем здесь)
  socket.on('draw:move', (data) => {
    const roomId = socket.data.roomId;
    const strokeId = socket.data.currentStrokeId;

    if (!roomId || !strokeId) return;

    roomManager.addPointToStroke(roomId, strokeId, {
      x: data.x,
      y: data.y,
      timestamp: data.timestamp || Date.now(),
    });

    io.to(roomId).emit('draw:point-added', {
      userId,
      strokeId,
      x: data.x,
      y: data.y,
      timestamp: data.timestamp || Date.now(),
    });
  });

  // Завершение рисования
  socket.on('draw:end', (data) => {
    const roomId = socket.data.roomId;
    const strokeId = socket.data.currentStrokeId;

    if (!roomId || !strokeId) return;

    roomManager.finishStroke(roomId, strokeId);
    socket.data.currentStrokeId = undefined;

    io.to(roomId).emit('draw:stroke-ended', {
      userId,
      strokeId,
      timestamp: data.timestamp || Date.now(),
    });
  });

  // Запрос полного состояния (для новых участников или при синхронизации)
  socket.on('request:full-state', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const fullState = roomManager.getRoomState(roomId);
    socket.emit('state:full', { strokes: fullState });
  });
});

httpServer.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   Drawing Server Started              ║
║   Listening on port: ${PORT}              ║
║   CORS Origin: ${CORS_ORIGIN}            ║
╚════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
