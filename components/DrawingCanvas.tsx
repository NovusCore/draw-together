'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  setupCanvasForRetina,
  applyBrushConfig,
  drawLine,
  drawPoint,
  getMousePos,
  drawRectangle,
  drawCircle,
  drawTriangle,
  getPixelColor,
  rgbToHex,
  BrushConfig,
} from '@/lib/canvas';
import { throttle, THROTTLE_INTERVAL } from '@/lib/throttle';

interface DrawObject {
  id: string;
  type: 'line' | 'text' | 'rectangle' | 'circle' | 'triangle';
  x: number;
  y: number;
  points?: Array<{ x: number; y: number }>;
  x2?: number;
  y2?: number;
  x3?: number;
  y3?: number;
  color: string;
  size: number;
  text?: string;
  fontSize?: number;
  filled?: boolean;
  width?: number;
  height?: number;
  radius?: number;
}

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
    },
    ref,
  ) => {
    const localCanvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [brushConfig, setBrushConfig] = useState<BrushConfig>({
      color: '#000000',
      size: 3,
    });
    const [tool, setTool] = useState<'brush' | 'text' | 'rectangle' | 'circle' | 'triangle' | 'eyedropper' | 'move'>('brush');
    const [shapesFilled, setShapesFilled] = useState(false);
    const [textInput, setTextInput] = useState('');
    const [fontSize, setFontSize] = useState(16);
    const [showTextModal, setShowTextModal] = useState(false);
    const [editingObjectId, setEditingObjectId] = useState<string | null>(null);
    const [objects, setObjects] = useState<DrawObject[]>([]);
    const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);
    const currentPointRef = useRef<{ x: number; y: number } | null>(null);
    const currentStrokeRef = useRef<Array<{ x: number; y: number }>>([]);
    const strokeStartTimeRef = useRef<number>(0);
    const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);

    // Инициализация Canvas для Retina
    useEffect(() => {
      const canvas = localCanvasRef.current;
      if (!canvas) return;

      const resizeCanvas = () => {
        setupCanvasForRetina(canvas);

        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      };

      resizeCanvas();

      const resizeObserver = new ResizeObserver(resizeCanvas);
      resizeObserver.observe(canvas);

      return () => {
        resizeObserver.disconnect();
      };
    }, []);

    // Перерисовка всех объектов
    const getTextLines = (text: string) => text.split(/\r?\n/);

    const drawTextObject = (ctx: CanvasRenderingContext2D, obj: DrawObject) => {
      const lines = getTextLines(obj.text || '');
      const lineHeight = (obj.fontSize || 16) * 1.25;

      ctx.font = `${obj.fontSize || 16}px Arial`;
      ctx.textBaseline = 'top';
      lines.forEach((line, index) => {
        ctx.fillText(line, obj.x, obj.y + index * lineHeight);
      });
    };

    const getTextBounds = (obj: DrawObject) => {
      const canvas = localCanvasRef.current;
      const ctx = canvas?.getContext('2d');
      const fontSizeValue = obj.fontSize || 16;
      const lines = getTextLines(obj.text || '');

      if (ctx) {
        ctx.font = `${fontSizeValue}px Arial`;
      }

      const width = Math.max(
        1,
        ...lines.map((line) => ctx?.measureText(line).width || line.length * fontSizeValue * 0.6),
      );
      const height = Math.max(1, lines.length) * fontSizeValue * 1.25;

      return { width, height };
    };

    const redrawCanvas = useCallback(() => {
      const canvas = localCanvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

      objects.forEach((obj) => {
        ctx.strokeStyle = obj.color;
        ctx.fillStyle = obj.color;
        ctx.lineWidth = obj.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Выделение выбранного объекта
        if (obj.id === selectedObjectId) {
          ctx.strokeStyle = '#0066FF';
          ctx.lineWidth = 3;
          ctx.setLineDash([5, 5]);
        }

        if (obj.type === 'line' && obj.points && obj.points.length > 0) {
          ctx.beginPath();
          ctx.moveTo(obj.points[0].x, obj.points[0].y);
          obj.points.slice(1).forEach((point) => {
            ctx.lineTo(point.x, point.y);
          });
          ctx.stroke();
          ctx.closePath();
        } else if (obj.type === 'text') {
          drawTextObject(ctx, obj);
        } else if (obj.type === 'rectangle') {
          drawRectangle(ctx, obj.x, obj.y, obj.width || 0, obj.height || 0, obj.filled);
        } else if (obj.type === 'circle') {
          drawCircle(ctx, obj.x, obj.y, obj.radius || 0, obj.filled);
        } else if (obj.type === 'triangle') {
          drawTriangle(ctx, obj.x, obj.y, obj.x2 || 0, obj.y2 || 0, obj.x3 || 0, obj.y3 || 0, obj.filled);
        }

        ctx.setLineDash([]);
      });
    }, [objects, selectedObjectId]);

    // Перерисовка при изменении объектов
    useEffect(() => {
      redrawCanvas();
    }, [objects, selectedObjectId, redrawCanvas]);

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

    // Поиск объекта под мышью
    const findObjectAtPosition = (x: number, y: number): DrawObject | null => {
      for (let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i];
        const hitArea = 20; // Область попадания в пиксели

        if (obj.type === 'text' && obj.text) {
          const { width, height } = getTextBounds(obj);
          if (x >= obj.x && x <= obj.x + width && y >= obj.y && y <= obj.y + height) {
            return obj;
          }
        } else if (obj.type === 'rectangle') {
          if (x >= obj.x - hitArea && x <= obj.x + (obj.width || 0) + hitArea &&
              y >= obj.y - hitArea && y <= obj.y + (obj.height || 0) + hitArea) {
            return obj;
          }
        } else if (obj.type === 'circle') {
          const dist = Math.sqrt(Math.pow(x - obj.x, 2) + Math.pow(y - obj.y, 2));
          if (dist <= (obj.radius || 0) + hitArea) {
            return obj;
          }
        } else if (obj.type === 'triangle') {
          const minX = Math.min(obj.x, obj.x2 || 0, obj.x3 || 0) - hitArea;
          const maxX = Math.max(obj.x, obj.x2 || 0, obj.x3 || 0) + hitArea;
          const minY = Math.min(obj.y, obj.y2 || 0, obj.y3 || 0) - hitArea;
          const maxY = Math.max(obj.y, obj.y2 || 0, obj.y3 || 0) + hitArea;
          if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
            return obj;
          }
        }
      }
      return null;
    };

    // Начало рисования
    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = localCanvasRef.current;
      if (!canvas) return;

      const pos = getMousePos(canvas, e.nativeEvent);
      const ctx = canvas.getContext('2d')!;

      if (tool === 'move') {
        const obj = findObjectAtPosition(pos.x, pos.y);
        if (obj) {
          setSelectedObjectId(obj.id);
          dragOffsetRef.current = { x: pos.x - obj.x, y: pos.y - obj.y };
          setIsDrawing(true);
        }
        return;
      }

      if (tool === 'eyedropper') {
        const rgbColor = getPixelColor(ctx, pos.x, pos.y);
        const hexColor = rgbToHex(rgbColor);
        setBrushConfig({ ...brushConfig, color: hexColor });
        return;
      }

      if (tool === 'text') {
        setShowTextModal(true);
        setEditingObjectId(null);
        setTextInput('');
        lastPointRef.current = pos;
        return;
      }

      setIsDrawing(true);
      strokeStartTimeRef.current = Date.now();
      lastPointRef.current = pos;

      if (tool === 'brush') {
        applyBrushConfig(ctx, brushConfig);
        drawPoint(ctx, pos.x, pos.y);

        if (onDrawStart) {
          onDrawStart(pos.x, pos.y, brushConfig.color, brushConfig.size);
        }
      }
    };

    // Рисование при движении мыши
    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = localCanvasRef.current;
      if (!canvas) return;

      const pos = getMousePos(canvas, e.nativeEvent);
      currentPointRef.current = pos;

      // Режим перемещения
      if (tool === 'move' && isDrawing && selectedObjectId && dragOffsetRef.current) {
        const newX = pos.x - dragOffsetRef.current.x;
        const newY = pos.y - dragOffsetRef.current.y;

        setObjects((prev) =>
          prev.map((obj) =>
            obj.id === selectedObjectId
              ? {
                  ...obj,
                  x: newX,
                  y: newY,
                  x2: obj.x2 ? obj.x2 + (newX - obj.x) : undefined,
                  y2: obj.y2 ? obj.y2 + (newY - obj.y) : undefined,
                  x3: obj.x3 ? obj.x3 + (newX - obj.x) : undefined,
                  y3: obj.y3 ? obj.y3 + (newY - obj.y) : undefined,
                }
              : obj,
          ),
        );
        return;
      }

      if (!isDrawing) return;
      if (tool === 'eyedropper' || tool === 'text') return;

      const ctx = canvas.getContext('2d')!;

      if (tool === 'brush') {
        if (!lastPointRef.current) return;
        applyBrushConfig(ctx, brushConfig);
        drawLine(ctx, lastPointRef.current.x, lastPointRef.current.y, pos.x, pos.y);
        lastPointRef.current = pos;
        sendDrawingPoint(pos.x, pos.y);
      } else if (tool === 'rectangle' || tool === 'circle' || tool === 'triangle') {
        if (!lastPointRef.current) return;
        redrawCanvas();

        applyBrushConfig(ctx, brushConfig);

        if (tool === 'rectangle') {
          const width = pos.x - lastPointRef.current.x;
          const height = pos.y - lastPointRef.current.y;
          drawRectangle(ctx, lastPointRef.current.x, lastPointRef.current.y, width, height, shapesFilled);
        } else if (tool === 'circle') {
          const radius = Math.sqrt(
            Math.pow(pos.x - lastPointRef.current.x, 2) + Math.pow(pos.y - lastPointRef.current.y, 2),
          );
          drawCircle(ctx, lastPointRef.current.x, lastPointRef.current.y, radius, shapesFilled);
        } else if (tool === 'triangle') {
          const midX = (lastPointRef.current.x + pos.x) / 2;
          const topY = Math.min(lastPointRef.current.y, pos.y);
          drawTriangle(
            ctx,
            midX,
            topY,
            lastPointRef.current.x,
            Math.max(lastPointRef.current.y, pos.y),
            pos.x,
            Math.max(lastPointRef.current.y, pos.y),
            shapesFilled,
          );
        }
      }
    };

    // Завершение рисования
    const handleMouseUp = () => {
      if (tool === 'move') {
        setIsDrawing(false);
        dragOffsetRef.current = null;
        return;
      }

      if (!isDrawing) return;
      setIsDrawing(false);

      if (!lastPointRef.current || !currentPointRef.current) {
        lastPointRef.current = null;
        return;
      }

      const startPoint = lastPointRef.current;
      const pos = currentPointRef.current;

      // Добавляем созданные фигуры в объекты
      if (tool === 'rectangle') {
        const width = pos.x - lastPointRef.current.x;
        const height = pos.y - lastPointRef.current.y;

        setObjects((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            type: 'rectangle',
            x: startPoint.x,
            y: startPoint.y,
            width,
            height,
            color: brushConfig.color,
            size: brushConfig.size,
            filled: shapesFilled,
          },
        ]);
      } else if (tool === 'circle') {
        const radius = Math.sqrt(
          Math.pow(pos.x - lastPointRef.current.x, 2) + Math.pow(pos.y - lastPointRef.current.y, 2),
        );

        setObjects((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            type: 'circle',
            x: startPoint.x,
            y: startPoint.y,
            radius,
            color: brushConfig.color,
            size: brushConfig.size,
            filled: shapesFilled,
          },
        ]);
      } else if (tool === 'triangle') {
        const midX = (lastPointRef.current.x + pos.x) / 2;
        const topY = Math.min(lastPointRef.current.y, pos.y);
        const botY = Math.max(lastPointRef.current.y, pos.y);

        setObjects((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            type: 'triangle',
            x: midX,
            y: topY,
            x2: startPoint.x,
            y2: botY,
            x3: pos.x,
            y3: botY,
            color: brushConfig.color,
            size: brushConfig.size,
            filled: shapesFilled,
          },
        ]);
      }

      lastPointRef.current = null;
      currentPointRef.current = null;

      if (onDrawEnd) {
        onDrawEnd(Date.now());
      }
    };

    // Touch события для мобильных устройств
    const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const canvas = localCanvasRef.current;
      if (!canvas) return;

      const pos = getMousePos(canvas, e.nativeEvent);
      const ctx = canvas.getContext('2d')!;

      if (tool === 'move') {
        const obj = findObjectAtPosition(pos.x, pos.y);
        if (obj) {
          setSelectedObjectId(obj.id);
          dragOffsetRef.current = { x: pos.x - obj.x, y: pos.y - obj.y };
          setIsDrawing(true);
        }
        return;
      }

      if (tool === 'eyedropper') {
        const rgbColor = getPixelColor(ctx, pos.x, pos.y);
        const hexColor = rgbToHex(rgbColor);
        setBrushConfig({ ...brushConfig, color: hexColor });
        return;
      }

      if (tool === 'text') {
        setShowTextModal(true);
        setEditingObjectId(null);
        setTextInput('');
        lastPointRef.current = pos;
        return;
      }

      setIsDrawing(true);
      strokeStartTimeRef.current = Date.now();
      lastPointRef.current = pos;

      if (tool === 'brush') {
        applyBrushConfig(ctx, brushConfig);
        drawPoint(ctx, pos.x, pos.y);

        if (onDrawStart) {
          onDrawStart(pos.x, pos.y, brushConfig.color, brushConfig.size);
        }
      }
    };

    const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const canvas = localCanvasRef.current;
      if (!canvas) return;

      const pos = getMousePos(canvas, e.nativeEvent);
      currentPointRef.current = pos;

      if (tool === 'move' && isDrawing && selectedObjectId && dragOffsetRef.current) {
        const newX = pos.x - dragOffsetRef.current.x;
        const newY = pos.y - dragOffsetRef.current.y;

        setObjects((prev) =>
          prev.map((obj) =>
            obj.id === selectedObjectId
              ? {
                  ...obj,
                  x: newX,
                  y: newY,
                  x2: obj.x2 ? obj.x2 + (newX - obj.x) : undefined,
                  y2: obj.y2 ? obj.y2 + (newY - obj.y) : undefined,
                  x3: obj.x3 ? obj.x3 + (newX - obj.x) : undefined,
                  y3: obj.y3 ? obj.y3 + (newY - obj.y) : undefined,
                }
              : obj,
          ),
        );
        return;
      }

      if (!isDrawing) return;

      const ctx = canvas.getContext('2d')!;

      if (tool === 'brush' && lastPointRef.current) {
        applyBrushConfig(ctx, brushConfig);
        drawLine(ctx, lastPointRef.current.x, lastPointRef.current.y, pos.x, pos.y);
        lastPointRef.current = pos;
        sendDrawingPoint(pos.x, pos.y);
      }
    };

    const handleTouchEnd = () => {
      if (tool === 'move') {
        setIsDrawing(false);
        dragOffsetRef.current = null;
        return;
      }

      if (!isDrawing) return;
      setIsDrawing(false);
      lastPointRef.current = null;

      if (onDrawEnd) {
        onDrawEnd(Date.now());
      }
    };

    const handleAddText = () => {
      if (!textInput.trim()) return;

      if (editingObjectId) {
        setObjects((prev) =>
          prev.map((obj) =>
            obj.id === editingObjectId
              ? {
                  ...obj,
                  text: textInput,
                  fontSize,
                  color: brushConfig.color,
                  size: brushConfig.size,
                }
              : obj,
          ),
        );

        setTextInput('');
        setShowTextModal(false);
        setEditingObjectId(null);
        return;
      }

      if (!lastPointRef.current) return;

      const textPoint = lastPointRef.current;

      setObjects((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          type: 'text',
          x: textPoint.x,
          y: textPoint.y,
          text: textInput,
          fontSize,
          color: brushConfig.color,
          size: brushConfig.size,
        },
      ]);

      setTextInput('');
      setShowTextModal(false);
      lastPointRef.current = null;
    };

    const selectedObject = objects.find((obj) => obj.id === selectedObjectId) || null;

    const handleEditSelectedText = () => {
      if (!selectedObject || selectedObject.type !== 'text') return;

      setEditingObjectId(selectedObject.id);
      setTextInput(selectedObject.text || '');
      setFontSize(selectedObject.fontSize || fontSize);
      setBrushConfig((prev) => ({
        ...prev,
        color: selectedObject.color,
        size: selectedObject.size,
      }));
      setShowTextModal(true);
    };

    const handleDeleteSelectedObject = () => {
      if (!selectedObjectId) return;

      setObjects((prev) => prev.filter((obj) => obj.id !== selectedObjectId));
      setSelectedObjectId(null);
      setEditingObjectId(null);
    };

    return (
      <div className="flex flex-col gap-4">
        {/* Toolbar - Tools */}
        <div className="flex gap-2 bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex-wrap">
          <div className="flex gap-2 border-r pr-3">
            <button
              onClick={() => setTool('brush')}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                tool === 'brush'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title="Кисть"
            >
              🖌️ Кисть
            </button>
            <button
              onClick={() => setTool('text')}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                tool === 'text'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title="Текст"
            >
              📝 Текст
            </button>
          </div>

          <div className="flex gap-2 border-r pr-3">
            <button
              onClick={() => setTool('rectangle')}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                tool === 'rectangle'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title="Квадрат"
            >
              ◽ Квадрат
            </button>
            <button
              onClick={() => setTool('circle')}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                tool === 'circle'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title="Круг"
            >
              ⭕ Круг
            </button>
            <button
              onClick={() => setTool('triangle')}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                tool === 'triangle'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title="Треугольник"
            >
              △ Треугольник
            </button>
            {['rectangle', 'circle', 'triangle'].includes(tool) && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={shapesFilled}
                  onChange={(e) => setShapesFilled(e.target.checked)}
                  className="cursor-pointer"
                />
                <span className="text-gray-700">Заполнить</span>
              </label>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setTool('eyedropper')}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                tool === 'eyedropper'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title="Пипетка"
            >
              🎨 Пипетка
            </button>
            <button
              onClick={() => setTool('move')}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                tool === 'move'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title="Перемещение"
            >
              ↔️ Перемещать
            </button>
          </div>

          {selectedObject && (
            <div className="flex gap-2 border-l pl-3">
              {selectedObject.type === 'text' && (
                <button
                  onClick={handleEditSelectedText}
                  className="px-3 py-2 rounded text-sm font-medium bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors"
                >
                  Редактировать
                </button>
              )}
              <button
                onClick={handleDeleteSelectedObject}
                className="px-3 py-2 rounded text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
              >
                Удалить
              </button>
            </div>
          )}
        </div>

        {/* Toolbar - Color & Size */}
        <div className="flex gap-3 items-center bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex-wrap">
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
          {tool === 'brush' && (
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
          )}

          {/* Размер шрифта */}
          {tool === 'text' && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Шрифт:</label>
              <input
                type="range"
                min="8"
                max="72"
                value={fontSize}
                onChange={(e) => setFontSize(parseInt(e.target.value))}
                className="w-32"
              />
              <span className="text-sm text-gray-500 w-8">{fontSize}px</span>
            </div>
          )}

          {/* Размер кисти для фигур */}
          {['rectangle', 'circle', 'triangle'].includes(tool) && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Толщина линии:</label>
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
          )}

          {/* Очистить холст */}
          <button
            onClick={() => {
              const canvas = localCanvasRef.current;
              if (canvas) {
                const ctx = canvas.getContext('2d')!;
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
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

        {/* Text Modal */}
        {showTextModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
            <div className="bg-white p-6 rounded-lg shadow-2xl w-96">
              <h2 className="text-xl font-bold mb-4 text-gray-800">
                {editingObjectId ? 'Редактировать текст' : 'Добавить текст'}
              </h2>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Введите текст..."
                className="w-full p-3 border-2 border-gray-300 rounded mb-4 resize-none h-24 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500"
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    handleAddText();
                  }
                }}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowTextModal(false);
                    setTextInput('');
                    setEditingObjectId(null);
                    lastPointRef.current = null;
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 transition-colors font-medium"
                >
                  Отмена
                </button>
                <button
                  onClick={handleAddText}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors font-medium"
                >
                  {editingObjectId ? 'Сохранить' : 'Добавить'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Информация */}
        <div className="text-xs text-gray-500 text-center">
          Статус: {isDrawing ? '🖌️ Рисование...' : '⏸️ Готово'} | Инструмент: {tool === 'brush' && 'Кисть'} {tool === 'text' && 'Текст'} {tool === 'rectangle' && 'Квадрат'} {tool === 'circle' && 'Круг'} {tool === 'triangle' && 'Треугольник'} {tool === 'eyedropper' && 'Пипетка'} {tool === 'move' && 'Перемещение'} | Объектов: {objects.length}
        </div>
      </div>
    );
  },
);

DrawingCanvas.displayName = 'DrawingCanvas';
