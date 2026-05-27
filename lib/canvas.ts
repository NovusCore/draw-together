/**
 * Утилиты для работы с Canvas API
 */

interface CanvasContextOptions {
  context: CanvasRenderingContext2D;
  dpr?: number;
}

/**
 * Инициализация Canvas для Retina-дисплеев
 * @param canvas HTML Canvas элемент
 * @returns Device pixel ratio
 */
export function setupCanvasForRetina(canvas: HTMLCanvasElement): number {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  // Установка размеров canvas с учётом DPR
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  // Масштабирование контекста
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  // CSS размеры
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;

  return dpr;
}

/**
 * Конфигурация кисти для рисования
 */
export interface BrushConfig {
  color: string;
  size: number;
  lineCap?: CanvasLineCap;
  lineJoin?: CanvasLineJoin;
}

/**
 * Применение конфигурации кисти к контексту canvas
 */
export function applyBrushConfig(
  context: CanvasRenderingContext2D,
  config: BrushConfig,
  dpr: number = 1,
): void {
  context.strokeStyle = config.color;
  context.lineWidth = config.size * dpr;
  context.lineCap = config.lineCap || 'round';
  context.lineJoin = config.lineJoin || 'round';
  context.lineStyle = 'round';
}

/**
 * Рисование линии между двумя точками
 */
export function drawLine(
  context: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): void {
  context.beginPath();
  context.moveTo(fromX, fromY);
  context.lineTo(toX, toY);
  context.stroke();
  context.closePath();
}

/**
 * Рисование точки
 */
export function drawPoint(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  context.beginPath();
  context.arc(x, y, context.lineWidth / 2, 0, Math.PI * 2);
  context.fill();
  context.closePath();
}

/**
 * Получение позиции мыши относительно canvas
 */
export function getMousePos(
  canvas: HTMLCanvasElement,
  event: MouseEvent | TouchEvent,
  dpr: number = 1,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();

  let clientX: number;
  let clientY: number;

  if (event instanceof TouchEvent) {
    clientX = event.touches[0].clientX;
    clientY = event.touches[0].clientY;
  } else {
    clientX = event.clientX;
    clientY = event.clientY;
  }

  return {
    x: (clientX - rect.left) * dpr,
    y: (clientY - rect.top) * dpr,
  };
}
