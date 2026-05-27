'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

export interface SocketHookOptions {
  roomId?: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: any) => void;
}

/**
 * Хук для управления Socket.io соединением
 * Автоматически подключается к серверу и присоединяется к комнате
 */
export function useSocket(options: SocketHookOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const { roomId, onConnect, onDisconnect, onError } = options;

  // Инициализация Socket.io
  useEffect(() => {
    if (socketRef.current) return;

    try {
      const socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
      });

      socket.on('connect', () => {
        console.log('✅ Socket connected:', socket.id);
        onConnect?.();

        // Присоединяемся к комнате если она указана
        if (roomId) {
          socket.emit('join:room', roomId, (state: any) => {
            console.log('📥 Received full state:', state);
          });
        }
      });

      socket.on('disconnect', (reason) => {
        console.log('❌ Socket disconnected:', reason);
        onDisconnect?.();
      });

      socket.on('connect_error', (error) => {
        console.error('⚠️ Socket connection error:', error);
        onError?.(error);
      });

      socketRef.current = socket;
    } catch (error) {
      console.error('Failed to initialize Socket.io:', error);
      onError?.(error);
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [roomId, onConnect, onDisconnect, onError]);

  // Присоединиться к комнате (может быть вызвано динамически)
  const joinRoom = useCallback((newRoomId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('join:room', newRoomId, (state: any) => {
        console.log('📥 Received full state for room:', newRoomId, state);
      });
    }
  }, []);

  // Начать рисование
  const startDrawing = useCallback(
    (x: number, y: number, color: string, size: number) => {
      if (!socketRef.current?.connected) return;
      socketRef.current.emit('draw:start', { x, y, color, size });
    },
    [],
  );

  // Добавить точку к рисованию
  const addDrawingPoint = useCallback((x: number, y: number, timestamp: number) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('draw:move', { x, y, timestamp });
  }, []);

  // Завершить рисование
  const endDrawing = useCallback((timestamp: number) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('draw:end', { timestamp });
  }, []);

  // Запросить полное состояние
  const requestFullState = useCallback(() => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('request:full-state');
  }, []);

  // Регистрация обработчика события
  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, handler);
    }
  }, []);

  // Удаление обработчика события
  const off = useCallback((event: string, handler?: (...args: any[]) => void) => {
    if (socketRef.current) {
      socketRef.current.off(event, handler);
    }
  }, []);

  return {
    socket: socketRef.current,
    isConnected: socketRef.current?.connected || false,
    joinRoom,
    startDrawing,
    addDrawingPoint,
    endDrawing,
    requestFullState,
    on,
    off,
  };
}
