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
  type: 'line' | 'text' | 'rectangle' | 'circle' | 'triangle' | 'eraser';
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

interface DrawObject {
  id: string;
  type: 'line' | 'text' | 'rectangle' | 'circle' | 'triangle' | 'eraser';
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
  fontFamily?: string;
  filled?: boolean;
  width?: number;
  height?: number;
  radius?: number;
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
    const [tool, setTool] = useState<'brush' | 'text' | 'rectangle' | 'circle' | 'triangle' | 'eyedropper' | 'move' | 'eraser'>('brush');
    const [shapesFilled, setShapesFilled] = useState(false);
    const [textInput, setTextInput] = useState('');
    const [fontSize, setFontSize] = useState(16);
    const [fontFamily, setFontFamily] = useState('Arial');
    const [showTextModal, setShowTextModal] = useState(false);
    const [editingObjectId, setEditingObjectId] = useState<string | null>(null);
    const [objects, setObjects] = useState<DrawObject[]>([]);
    const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
    const [isDarkTheme, setIsDarkTheme] = useState(false);
    const [showShapesMenu, setShowShapesMenu] = useState(false);
    const [currentStrokeId, setCurrentStrokeId] = useState<string | null>(null);
    const [eraserCursorPos, setEraserCursorPos] = useState<{ x: number; y: number } | null>(null);
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
        ctx.fillStyle = isDarkTheme ? '#1f2937' : 'white';
        ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      };

      resizeCanvas();

      const resizeObserver = new ResizeObserver(resizeCanvas);
      resizeObserver.observe(canvas);

      return () => {
        resizeObserver.disconnect();
      };
    }, [isDarkTheme]);

    // Перерисовка всех объектов
    const getTextLines = (text: string) => text.split(/\r?\n/);

    const drawTextObject = (ctx: CanvasRenderingContext2D, obj: DrawObject) => {
      const lines = getTextLines(obj.text || '');
      const lineHeight = (obj.fontSize || 16) * 1.25;
      const fontFamilyStr = obj.fontFamily || 'Arial';

      ctx.font = `${obj.fontSize || 16}px ${fontFamilyStr}`;
      ctx.textBaseline = 'top';
      ctx.fillStyle = obj.color;
      lines.forEach((line, index) => {
        ctx.fillText(line, obj.x, obj.y + index * lineHeight);
      });
    };

    const getTextBounds = (obj: DrawObject) => {
      const canvas = localCanvasRef.current;
      const ctx = canvas?.getContext('2d');
      const fontSizeValue = obj.fontSize || 16;
      const fontFamilyStr = obj.fontFamily || 'Arial';
      const lines = getTextLines(obj.text || '');

      if (ctx) {
        ctx.font = `${fontSizeValue}px ${fontFamilyStr}`;
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
      ctx.fillStyle = isDarkTheme ? '#1f2937' : 'white';
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
          ctx.globalCompositeOperation = 'source-over';
          ctx.beginPath();
          ctx.moveTo(obj.points[0].x, obj.points[0].y);
          obj.points.slice(1).forEach((point) => {
            ctx.lineTo(point.x, point.y);
          });
          ctx.stroke();
          ctx.closePath();
        } else if (obj.type === 'eraser' && obj.points && obj.points.length > 0) {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.strokeStyle = 'rgba(0,0,0,1)';
          ctx.beginPath();
          ctx.moveTo(obj.points[0].x, obj.points[0].y);
          obj.points.slice(1).forEach((point) => {
            ctx.lineTo(point.x, point.y);
          });
          ctx.stroke();
          ctx.closePath();
          ctx.globalCompositeOperation = 'source-over';
        } else if (obj.type === 'text') {
          ctx.globalCompositeOperation = 'source-over';
          drawTextObject(ctx, obj);
        } else if (obj.type === 'rectangle') {
          ctx.globalCompositeOperation = 'source-over';
          drawRectangle(ctx, obj.x, obj.y, obj.width || 0, obj.height || 0, obj.filled);
        } else if (obj.type === 'circle') {
          ctx.globalCompositeOperation = 'source-over';
          drawCircle(ctx, obj.x, obj.y, obj.radius || 0, obj.filled);
        } else if (obj.type === 'triangle') {
          ctx.globalCompositeOperation = 'source-over';
          drawTriangle(ctx, obj.x, obj.y, obj.x2 || 0, obj.y2 || 0, obj.x3 || 0, obj.y3 || 0, obj.filled);
        }

        ctx.setLineDash([]);
      });

      // Draw eraser cursor preview
      if (tool === 'eraser' && eraserCursorPos && !isDrawing) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = isDarkTheme ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(eraserCursorPos.x, eraserCursorPos.y, brushConfig.size / 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.closePath();
        ctx.globalCompositeOperation = 'source-over';
      }
    }, [objects, selectedObjectId, isDarkTheme, tool, eraserCursorPos, isDrawing, brushConfig.size]);

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
        const hitArea = 20;

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
      currentStrokeRef.current = [pos];

      if (tool === 'brush' || tool === 'eraser') {
        const strokeId = Math.random().toString();
        setCurrentStrokeId(strokeId);

        const newStroke: DrawObject = {
          id: strokeId,
          type: tool === 'eraser' ? 'eraser' : 'line',
          x: pos.x,
          y: pos.y,
          points: [pos],
          color: brushConfig.color,
          size: brushConfig.size,
        };

        setObjects((prev) => [...prev, newStroke]);

        if (onDrawStart && tool === 'brush') {
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

      // Update eraser cursor position
      if (tool === 'eraser') {
        setEraserCursorPos(pos);
      }

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

      if (tool === 'brush' || tool === 'eraser') {
        if (!lastPointRef.current || !currentStrokeId) return;

        setObjects((prev) =>
          prev.map((obj) =>
            obj.id === currentStrokeId && (obj.type === 'line' || obj.type === 'eraser')
              ? {
                  ...obj,
                  points: [...(obj.points || []), pos],
                }
              : obj,
          ),
        );

        lastPointRef.current = pos;
        if (tool === 'brush') {
          sendDrawingPoint(pos.x, pos.y);
        }
      } else if (tool === 'rectangle' || tool === 'circle' || tool === 'triangle') {
        // Redraw canvas with preview for shapes
        if (!lastPointRef.current) return;

        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = isDarkTheme ? '#1f2937' : 'white';
        ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

        // Draw all objects
        objects.forEach((obj) => {
          ctx.strokeStyle = obj.color;
          ctx.fillStyle = obj.color;
          ctx.lineWidth = obj.size;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.globalCompositeOperation = 'source-over';

          if (obj.type === 'line' && obj.points && obj.points.length > 0) {
            ctx.beginPath();
            ctx.moveTo(obj.points[0].x, obj.points[0].y);
            obj.points.slice(1).forEach((point) => {
              ctx.lineTo(point.x, point.y);
            });
            ctx.stroke();
            ctx.closePath();
          } else if (obj.type === 'eraser' && obj.points && obj.points.length > 0) {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.strokeStyle = 'rgba(0,0,0,1)';
            ctx.beginPath();
            ctx.moveTo(obj.points[0].x, obj.points[0].y);
            obj.points.slice(1).forEach((point) => {
              ctx.lineTo(point.x, point.y);
            });
            ctx.stroke();
            ctx.closePath();
            ctx.globalCompositeOperation = 'source-over';
          } else if (obj.type === 'text') {
            drawTextObject(ctx, obj);
          } else if (obj.type === 'rectangle') {
            drawRectangle(ctx, obj.x, obj.y, obj.width || 0, obj.height || 0, obj.filled);
          } else if (obj.type === 'circle') {
            drawCircle(ctx, obj.x, obj.y, obj.radius || 0, obj.filled);
          } else if (obj.type === 'triangle') {
            drawTriangle(ctx, obj.x, obj.y, obj.x2 || 0, obj.y2 || 0, obj.x3 || 0, obj.y3 || 0, obj.filled);
          }
        });

        // Draw preview shape
        ctx.strokeStyle = brushConfig.color;
        ctx.fillStyle = brushConfig.color;
        ctx.lineWidth = brushConfig.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = 'source-over';

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
          const botY = Math.max(lastPointRef.current.y, pos.y);
          drawTriangle(ctx, midX, topY, lastPointRef.current.x, botY, pos.x, botY, shapesFilled);
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

      if (tool === 'brush' || tool === 'eraser') {
        setCurrentStrokeId(null);
        if (onDrawEnd) {
          onDrawEnd(Date.now());
        }
        return;
      }

      if (!lastPointRef.current || !currentPointRef.current) {
        lastPointRef.current = null;
        return;
      }

      const startPoint = lastPointRef.current;
      const pos = currentPointRef.current;

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

    const handleMouseLeave = () => {
      setEraserCursorPos(null);
      handleMouseUp();
    };

    // Touch события
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
      currentStrokeRef.current = [pos];

      if (tool === 'brush' || tool === 'eraser') {
        const strokeId = Math.random().toString();
        setCurrentStrokeId(strokeId);

        const newStroke: DrawObject = {
          id: strokeId,
          type: tool === 'eraser' ? 'eraser' : 'line',
          x: pos.x,
          y: pos.y,
          points: [pos],
          color: brushConfig.color,
          size: brushConfig.size,
        };

        setObjects((prev) => [...prev, newStroke]);

        if (onDrawStart && tool === 'brush') {
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

      if ((tool === 'brush' || tool === 'eraser') && lastPointRef.current && currentStrokeId) {
        setObjects((prev) =>
          prev.map((obj) =>
            obj.id === currentStrokeId && (obj.type === 'line' || obj.type === 'eraser')
              ? {
                  ...obj,
                  points: [...(obj.points || []), pos],
                }
              : obj,
          ),
        );
        lastPointRef.current = pos;
        if (tool === 'brush') {
          sendDrawingPoint(pos.x, pos.y);
        }
      } else if (tool === 'rectangle' || tool === 'circle' || tool === 'triangle') {
        // Redraw canvas with preview for shapes (touch)
        if (!lastPointRef.current) return;

        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = isDarkTheme ? '#1f2937' : 'white';
        ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

        // Draw all objects
        objects.forEach((obj) => {
          ctx.strokeStyle = obj.color;
          ctx.fillStyle = obj.color;
          ctx.lineWidth = obj.size;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.globalCompositeOperation = 'source-over';

          if (obj.type === 'line' && obj.points && obj.points.length > 0) {
            ctx.beginPath();
            ctx.moveTo(obj.points[0].x, obj.points[0].y);
            obj.points.slice(1).forEach((point) => {
              ctx.lineTo(point.x, point.y);
            });
            ctx.stroke();
            ctx.closePath();
          } else if (obj.type === 'eraser' && obj.points && obj.points.length > 0) {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.strokeStyle = 'rgba(0,0,0,1)';
            ctx.beginPath();
            ctx.moveTo(obj.points[0].x, obj.points[0].y);
            obj.points.slice(1).forEach((point) => {
              ctx.lineTo(point.x, point.y);
            });
            ctx.stroke();
            ctx.closePath();
            ctx.globalCompositeOperation = 'source-over';
          } else if (obj.type === 'text') {
            drawTextObject(ctx, obj);
          } else if (obj.type === 'rectangle') {
            drawRectangle(ctx, obj.x, obj.y, obj.width || 0, obj.height || 0, obj.filled);
          } else if (obj.type === 'circle') {
            drawCircle(ctx, obj.x, obj.y, obj.radius || 0, obj.filled);
          } else if (obj.type === 'triangle') {
            drawTriangle(ctx, obj.x, obj.y, obj.x2 || 0, obj.y2 || 0, obj.x3 || 0, obj.y3 || 0, obj.filled);
          }
        });

        // Draw preview shape
        ctx.strokeStyle = brushConfig.color;
        ctx.fillStyle = brushConfig.color;
        ctx.lineWidth = brushConfig.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = 'source-over';

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
          const botY = Math.max(lastPointRef.current.y, pos.y);
          drawTriangle(ctx, midX, topY, lastPointRef.current.x, botY, pos.x, botY, shapesFilled);
        }
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

      if (tool === 'brush' || tool === 'eraser') {
        setCurrentStrokeId(null);
        if (onDrawEnd) {
          onDrawEnd(Date.now());
        }
      }

      lastPointRef.current = null;
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
                  fontFamily,
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
          fontFamily,
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
      setFontFamily(selectedObject.fontFamily || 'Arial');
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

    const handleClearAll = () => {
      setObjects([]);
      setSelectedObjectId(null);
      setEditingObjectId(null);
    };

    const bgColorClass = isDarkTheme ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900';
    const toolbarBgClass = isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200';
    const buttonBgClass = isDarkTheme ? 'bg-gray-600 text-white hover:bg-gray-500' : 'bg-gray-100 text-gray-700 hover:bg-gray-200';
    const canvasBgClass = isDarkTheme ? 'bg-gray-900' : 'bg-white';

    return (
      <div className={`flex flex-col gap-4 ${bgColorClass} p-4 rounded-lg`}>
        {/* Main Toolbar - 3 Primary Tools */}
        <div className={`flex gap-3 ${toolbarBgClass} p-3 rounded-lg shadow-sm border`}>
          <button
            onClick={() => {
              setTool('brush');
              setShowShapesMenu(false);
            }}
            className={`px-4 py-2 rounded font-medium transition-colors ${
              tool === 'brush'
                ? 'bg-blue-500 text-white'
                : buttonBgClass
            }`}
            title="Кисть"
          >
            🖌️ Кисть
          </button>

          <button
            onClick={() => {
              setTool('text');
              setShowShapesMenu(false);
            }}
            className={`px-4 py-2 rounded font-medium transition-colors ${
              tool === 'text'
                ? 'bg-blue-500 text-white'
                : buttonBgClass
            }`}
            title="Текст"
          >
            📝 Текст
          </button>

          <div className="relative">
            <button
              onClick={() => setShowShapesMenu(!showShapesMenu)}
              className={`px-4 py-2 rounded font-medium transition-colors ${
                ['rectangle', 'circle', 'triangle'].includes(tool)
                  ? 'bg-blue-500 text-white'
                  : buttonBgClass
              }`}
              title="Фигуры"
            >
              ⬜ Фигуры ▼
            </button>
            {showShapesMenu && (
              <div className={`absolute top-full left-0 mt-1 ${toolbarBgClass} border rounded-lg shadow-lg p-2 z-50 flex flex-col gap-1`}>
                <button
                  onClick={() => {
                    setTool('rectangle');
                    setShowShapesMenu(false);
                  }}
                  className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                    tool === 'rectangle'
                      ? 'bg-blue-500 text-white'
                      : buttonBgClass
                  }`}
                >
                  ◽ Квадрат
                </button>
                <button
                  onClick={() => {
                    setTool('circle');
                    setShowShapesMenu(false);
                  }}
                  className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                    tool === 'circle'
                      ? 'bg-blue-500 text-white'
                      : buttonBgClass
                  }`}
                >
                  ⭕ Круг
                </button>
                <button
                  onClick={() => {
                    setTool('triangle');
                    setShowShapesMenu(false);
                  }}
                  className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                    tool === 'triangle'
                      ? 'bg-blue-500 text-white'
                      : buttonBgClass
                  }`}
                >
                  △ Треугольник
                </button>
                {['rectangle', 'circle', 'triangle'].includes(tool) && (
                  <label className="flex items-center gap-2 text-sm px-3 py-2 border-t mt-1">
                    <input
                      type="checkbox"
                      checked={shapesFilled}
                      onChange={(e) => setShapesFilled(e.target.checked)}
                      className="cursor-pointer"
                    />
                    <span>Заполнить</span>
                  </label>
                )}
              </div>
            )}
          </div>

          {/* Right-aligned buttons */}
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => {
                setTool('eraser');
                setShowShapesMenu(false);
              }}
              className={`px-4 py-2 rounded font-medium transition-colors ${
                tool === 'eraser'
                  ? 'bg-red-500 text-white'
                  : `${buttonBgClass}`
              }`}
              title="Стерать"
            >
              🧹 Стерать
            </button>

            <button
              onClick={() => setIsDarkTheme(!isDarkTheme)}
              className={`px-4 py-2 rounded font-medium transition-colors ${buttonBgClass}`}
              title="Переключить тему"
            >
              {isDarkTheme ? '☀️ Свет' : '🌙 Темная'}
            </button>

            <button
              onClick={handleClearAll}
              className="px-4 py-2 bg-red-500 text-white rounded font-medium hover:bg-red-600 transition-colors"
              title="Очистить холст"
            >
              ✕ Очистить
            </button>
          </div>
        </div>

        {/* Settings Toolbar */}
        <div className={`flex gap-3 items-center ${toolbarBgClass} p-3 rounded-lg shadow-sm border flex-wrap`}>
          {/* Color Picker */}
          <div className="flex items-center gap-2">
            <label className="font-medium text-sm">Цвет:</label>
            <input
              type="color"
              value={brushConfig.color}
              onChange={(e) => setBrushConfig({ ...brushConfig, color: e.target.value })}
              className="w-10 h-10 rounded cursor-pointer"
            />
          </div>

          {/* Brush Size */}
          {tool === 'brush' && (
            <div className="flex items-center gap-2">
              <label className="font-medium text-sm">Размер:</label>
              <input
                type="range"
                min="1"
                max="20"
                value={brushConfig.size}
                onChange={(e) => setBrushConfig({ ...brushConfig, size: parseInt(e.target.value) })}
                className="w-32"
              />
              <span className="text-sm w-10">{brushConfig.size}px</span>
            </div>
          )}

          {/* Eraser Size */}
          {tool === 'eraser' && (
            <div className="flex items-center gap-2">
              <label className="font-medium text-sm">Размер:</label>
              <input
                type="range"
                min="5"
                max="50"
                value={brushConfig.size}
                onChange={(e) => setBrushConfig({ ...brushConfig, size: parseInt(e.target.value) })}
                className="w-32"
              />
              <span className="text-sm w-10">{brushConfig.size}px</span>
            </div>
          )}

          {/* Font Size */}
          {tool === 'text' && (
            <>
              <div className="flex items-center gap-2">
                <label className="font-medium text-sm">Размер:</label>
                <input
                  type="range"
                  min="8"
                  max="72"
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value))}
                  className="w-32"
                />
                <span className="text-sm w-10">{fontSize}px</span>
              </div>

              <div className="flex items-center gap-2">
                <label className="font-medium text-sm">Шрифт:</label>
                <select
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  className={`px-3 py-1 rounded cursor-pointer ${
                    isDarkTheme
                      ? 'bg-gray-600 border-gray-500 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  } border`}
                >
                  <option value="Arial">Arial</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Courier New">Courier New</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Verdana">Verdana</option>
                  <option value="Comic Sans MS">Comic Sans MS</option>
                  <option value="Trebuchet MS">Trebuchet MS</option>
                  <option value="Impact">Impact</option>
                </select>
              </div>
            </>
          )}

          {/* Shape Line Width */}
          {['rectangle', 'circle', 'triangle'].includes(tool) && (
            <div className="flex items-center gap-2">
              <label className="font-medium text-sm">Толщина:</label>
              <input
                type="range"
                min="1"
                max="20"
                value={brushConfig.size}
                onChange={(e) => setBrushConfig({ ...brushConfig, size: parseInt(e.target.value) })}
                className="w-32"
              />
              <span className="text-sm w-10">{brushConfig.size}px</span>
            </div>
          )}
        </div>

        {/* Selected Object Actions */}
        {selectedObject && (
          <div className={`flex gap-2 ${toolbarBgClass} p-3 rounded-lg shadow-sm border`}>
            {selectedObject.type === 'text' && (
              <button
                onClick={handleEditSelectedText}
                className="px-4 py-2 rounded font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors"
              >
                ✏️ Редактировать
              </button>
            )}
            <button
              onClick={handleDeleteSelectedObject}
              className="px-4 py-2 rounded font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              🗑️ Удалить
            </button>
          </div>
        )}

        {/* Canvas */}
        <canvas
          ref={localCanvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={`border-2 rounded-lg shadow-md ${canvasBgClass} border-blue-400 ${
            tool === 'eraser' ? 'cursor-none' : 'cursor-crosshair'
          }`}
          style={{ width: '100%', height: '600px', display: 'block' }}
        />

        {/* Text Modal */}
        {showTextModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
            <div className={`${bgColorClass} p-6 rounded-lg shadow-2xl w-96 border`}>
              <h2 className="text-xl font-bold mb-4">
                {editingObjectId ? 'Редактировать текст' : 'Добавить текст'}
              </h2>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Введите текст..."
                className={`w-full p-3 border-2 rounded mb-4 resize-none h-24 focus:outline-none focus:border-blue-500 ${
                  isDarkTheme 
                    ? 'bg-gray-600 border-gray-500 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                }`}
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
                  className={`px-4 py-2 rounded font-medium transition-colors ${buttonBgClass}`}
                >
                  Отмена
                </button>
                <button
                  onClick={handleAddText}
                  className="px-4 py-2 bg-blue-500 text-white rounded font-medium hover:bg-blue-600 transition-colors"
                >
                  {editingObjectId ? 'Сохранить' : 'Добавить'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Status Info */}
        <div className="text-xs opacity-60 text-center">
          Статус: {isDrawing ? '🖌️ Рисование...' : '⏸️ Готово'} | Инструмент: {tool === 'brush' && 'Кисть'}{tool === 'text' && 'Текст'}{tool === 'rectangle' && 'Квадрат'}{tool === 'circle' && 'Круг'}{tool === 'triangle' && 'Треугольник'}{tool === 'eraser' && 'Стерать'} | Объектов: {objects.length}
        </div>
      </div>
    );
  },
);

DrawingCanvas.displayName = 'DrawingCanvas';

export default DrawingCanvas;
