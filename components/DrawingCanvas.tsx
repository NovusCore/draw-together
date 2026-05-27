'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  setupCanvasForRetina,
  applyBrushConfig,
  drawLine,
  drawPoint,
  getMousePos,
  BrushConfig,
} from '@/lib/canvas';
import { throttle, THROTTLE_INTERVAL } from '@/lib/throttle';

interface DrawingCanvasProps {
  onDrawStart?: (x: number, y: number, color: string, size: number) => void;
  onDrawMove?: (x: number, y: number, timestamp: number) => void;
  onDrawEnd?: (timestamp: number) => void;
  onRemoteStrokeStart?: (userId: string, strokeId: string, x: number, y: number, color: string, size: number) => void;
  onRemotePointAdded?: (userId: string, strokeId: string, x: number, y: number, timestamp: number) => void;
  remoteStrokes?: Map<string, Array<{ x: number; y: number; color: string; size: number }>>;
}

export const DrawingCanvas = React.forwardRef<HTMLCanvasElement, DrawingCanvasProps>(
  (
    {
      onDrawStart,
      onDrawMove,
      onDrawEnd,
      onRemoteStrokeStart,
      onRemotePointAdded,
      remoteStrokes,
    },
    ref,
  ) => {
    const localCanvasRef = useRef<HTMLCanvasElement>(null);
    const [dpr, setDpr] = useState(1);
    const [isDrawing, setIsDrawing] = useState(false);
    const [brushConfig, setBrushConfig] = useState<BrushConfig>({
      color: '#000000',
      size: 3,
    });
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);
    const strokeStartTimeRef = useRef<number>(0);

    // Инициализация Canvas для Retina
    useEffect(() => {
      const canvas = localCanvasRef.current;
      if (!canvas) return;

      const devicePixelRatio = setupCanvasForRetina(canvas);
      setDpr(devicePixelRatio);

      // Заполнить фон белым
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }, []);

    // Проксировать ref
    useEffect(() => {
      if (ref) {
        if (typeof ref === 'function') {
          ref(localCanvasRef.current);
        } else {
          ref.current = localCanvasRef.current;
        }
      }
    }, [ref]);

    // Функция отправки координат (с throttling)
    const sendDrawingPoint = useCallback(
      throttle((x: number, y: number) => {
        if (onDrawMove) {
          onDrawMove(x, y, Date.now());
        }
      }, THROTTLE_INTERVAL),
      [onDrawMove],
    );

    // Начало рисования
    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = localCanvasRef.current;
      if (!canvas) return;

      const pos = getMousePos(canvas, e.nativeEvent, dpr);
      const ctx = canvas.getContext('2d')!;

      setIsDrawing(true);
      strokeStartTimeRef.current = Date.now();
      lastPointRef.current = pos;

      applyBrushConfig(ctx, brushConfig, dpr);
      drawPoint(ctx, pos.x, pos.y);

      if (onDrawStart) {
        onDrawStart(pos.x, pos.y, brushConfig.color, brushConfig.size);
      }
    };

    // Рисование при движении мыши
    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return;

      const canvas = localCanvasRef.current;
      if (!canvas || !lastPointRef.current) return;

      const pos = getMousePos(canvas, e.nativeEvent, dpr);
      const ctx = canvas.getContext('2d')!;

      applyBrushConfig(ctx, brushConfig, dpr);
      drawLine(ctx, lastPointRef.current.x, lastPointRef.current.y, pos.x, pos.y);

      lastPointRef.current = pos;

      // Отправляем координаты с throttling
      sendDrawingPoint(pos.x, pos.y);
    };

    // Завершение рисования
    const handleMouseUp = () => {
      if (!isDrawing) return;

      setIsDrawing(false);
      lastPointRef.current = null;

      if (onDrawEnd) {
        onDrawEnd(Date.now());
      }
    };

    // Touch события для мобильных устройств
    const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const canvas = localCanvasRef.current;
      if (!canvas) return;

      const pos = getMousePos(canvas, e.nativeEvent as any, dpr);
      const ctx = canvas.getContext('2d')!;

      setIsDrawing(true);
      strokeStartTimeRef.current = Date.now();
      lastPointRef.current = pos;

      applyBrushConfig(ctx, brushConfig, dpr);
      drawPoint(ctx, pos.x, pos.y);

      if (onDrawStart) {
        onDrawStart(pos.x, pos.y, brushConfig.color, brushConfig.size);
      }
    };

    const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return;
      e.preventDefault();

      const canvas = localCanvasRef.current;
      if (!canvas || !lastPointRef.current) return;

      const pos = getMousePos(canvas, e.nativeEvent as any, dpr);
      const ctx = canvas.getContext('2d')!;

      applyBrushConfig(ctx, brushConfig, dpr);
      drawLine(ctx, lastPointRef.current.x, lastPointRef.current.y, pos.x, pos.y);

      lastPointRef.current = pos;
      sendDrawingPoint(pos.x, pos.y);
    };

    const handleTouchEnd = () => {
      if (!isDrawing) return;
      setIsDrawing(false);
      lastPointRef.current = null;

      if (onDrawEnd) {
        onDrawEnd(Date.now());
      }
    };

    return (
      <div className="flex flex-col gap-4">
        {/* Toolbar */}
        <div className="flex gap-3 items-center bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          {/* Цвет */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Цвет:</label>
            <input
              type="color"
              value={brushConfig.color}
              onChange={(e) => setBrushConfig({ ...brushConfig, color: e.target.value })}
              className="w-10 h-10 rounded cursor-pointer"
            />
          </div>

          {/* Размер кисти */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Размер:</label>
            <input
              type="range"
              min="1"
              max="20"
              value={brushConfig.size}
              onChange={(e) => setBrushConfig({ ...brushConfig, size: parseInt(e.target.value) })}
              className="w-32"
            />
            <span className="text-sm text-gray-500 w-8">{brushConfig.size}px</span>
          </div>

          {/* Очистить холст */}
          <button
            onClick={() => {
              const canvas = localCanvasRef.current;
              if (canvas) {
                const ctx = canvas.getContext('2d')!;
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
              }
            }}
            className="ml-auto px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-sm font-medium"
          >
            Очистить
          </button>
        </div>

        {/* Canvas */}
        <canvas
          ref={localCanvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="border-2 border-gray-300 rounded-lg bg-white cursor-crosshair shadow-md"
          style={{ width: '100%', height: '600px', display: 'block' }}
        />

        {/* Информация */}
        <div className="text-xs text-gray-500 text-center">
          Статус: {isDrawing ? '🖌️ Рисование...' : '⏸️ Готово'}
        </div>
      </div>
    );
  },
);

DrawingCanvas.displayName = 'DrawingCanvas';
