'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { DrawingCanvas } from '@/components/DrawingCanvas';
import { useSocket } from '@/lib/useSocket';

interface RemoteStroke {
  userId: string;
  strokeId: string;
  points: Array<{ x: number; y: number }>;
  color: string;
  size: number;
}

export default function RoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [userCount, setUserCount] = useState(1);
  const [remoteStrokes, setRemoteStrokes] = useState<Map<string, RemoteStroke>>(new Map());
  const [copySuccess, setCopySuccess] = useState(false);

  // Socket.io хук
  const { isConnected, startDrawing, addDrawingPoint, endDrawing, on, off } = useSocket({
    roomId,
  });

  // Регистрация обработчиков Socket.io событий
  useEffect(() => {
    // Новая линия от другого пользователя
    const handleRemoteStrokeStart = (data: any) => {
      console.log('📍 Remote stroke started:', data);

      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d')!;

      // Рисуем начальную точку
      ctx.fillStyle = data.color;
      ctx.beginPath();
      ctx.arc(data.x, data.y, data.size / 2, 0, Math.PI * 2);
      ctx.fill();

      // Сохраняем линию в состояние
      setRemoteStrokes((prev) => {
        const newMap = new Map(prev);
        newMap.set(data.strokeId, {
          userId: data.userId,
          strokeId: data.strokeId,
          points: [{ x: data.x, y: data.y }],
          color: data.color,
          size: data.size,
        });
        return newMap;
      });
    };

    // Добавление точки к линии
    const handleRemotePointAdded = (data: any) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d')!;
      ctx.strokeStyle = data.color;
      ctx.lineWidth = data.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      setRemoteStrokes((prev) => {
        const newMap = new Map(prev);
        const stroke = newMap.get(data.strokeId);

        if (stroke && stroke.points.length > 0) {
          const lastPoint = stroke.points[stroke.points.length - 1];

          // Рисуем линию от последней точки к новой
          ctx.beginPath();
          ctx.moveTo(lastPoint.x, lastPoint.y);
          ctx.lineTo(data.x, data.y);
          ctx.stroke();

          stroke.points.push({ x: data.x, y: data.y });
        }

        return newMap;
      });
    };

    // Присоединение пользователя
    const handleUserJoined = (data: any) => {
      console.log('👤 User joined:', data.userId, `(total: ${data.count})`);
      setUserCount(data.count);
    };

    // Отключение пользователя
    const handleUserLeft = (data: any) => {
      console.log('👤 User left:', data.userId, `(total: ${data.count})`);
      setUserCount(data.count);
    };

    on('draw:stroke-started', handleRemoteStrokeStart);
    on('draw:point-added', handleRemotePointAdded);
    on('room:user-joined', handleUserJoined);
    on('room:user-left', handleUserLeft);

    return () => {
      off('draw:stroke-started', handleRemoteStrokeStart);
      off('draw:point-added', handleRemotePointAdded);
      off('room:user-joined', handleUserJoined);
      off('room:user-left', handleUserLeft);
    };
  }, [on, off]);

  const handleCopyRoomLink = () => {
    const url = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto p-6">
        {/* Заголовок */}
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">🎨 Совместное рисование</h1>
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}
              />
              <span className="text-gray-700 font-medium">
                {isConnected ? 'Подключено' : 'Отключено'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-gray-700 font-medium">👥 Участников: {userCount}</span>
            </div>

            <div className="ml-auto flex gap-2">
              <code className="bg-gray-200 px-3 py-1 rounded text-sm font-mono text-gray-700">
                {roomId}
              </code>
              <button
                onClick={handleCopyRoomLink}
                className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors font-medium text-sm"
              >
                {copySuccess ? '✅ Скопировано' : '📋 Скопировать ссылку'}
              </button>
            </div>
          </div>
        </div>

        {/* Canvas */}
        <DrawingCanvas
          ref={canvasRef}
          onDrawStart={(x, y, color, size) => {
            console.log('🖌️ Draw start');
            startDrawing(x, y, color, size);
          }}
          onDrawMove={(x, y, timestamp) => {
            addDrawingPoint(x, y, timestamp);
          }}
          onDrawEnd={(timestamp) => {
            console.log('✋ Draw end');
            endDrawing(timestamp);
          }}
        />
      </div>
    </div>
  );
}
