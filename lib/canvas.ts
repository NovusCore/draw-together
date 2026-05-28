/**
 * Утилиты для работы с Canvas API
 */

/**
 * Инициализация Canvas для Retina-дисплеев
 * @param canvas HTML Canvas элемент
 * @returns Device pixel ratio
 */
export function setupCanvasForRetina(canvas: HTMLCanvasElement): number {
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  // Установка размеров canvas с учётом DPR
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);

  const context = canvas.getContext('2d');
  context?.setTransform(dpr, 0, 0, dpr, 0, 0);

  // CSS размеры

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
): void {
  context.strokeStyle = config.color;
  context.lineWidth = config.size;
  context.lineCap = config.lineCap || 'round';
  context.lineJoin = config.lineJoin || 'round';
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
    x: clientX - rect.left - canvas.clientLeft,
    y: clientY - rect.top - canvas.clientTop,
  };
}

/**
 * Рисование квадрата
 */
export function drawRectangle(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  filled: boolean = false,
): void {
  if (filled) {
    context.fillRect(x, y, width, height);
  } else {
    context.strokeRect(x, y, width, height);
  }
}

/**
 * Рисование круга
 */
export function drawCircle(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  filled: boolean = false,
): void {
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  if (filled) {
    context.fill();
  } else {
    context.stroke();
  }
  context.closePath();
}

/**
 * Рисование треугольника
 */
export function drawTriangle(
  context: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  filled: boolean = false,
): void {
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.lineTo(x3, y3);
  context.closePath();
  if (filled) {
    context.fill();
  } else {
    context.stroke();
  }
}

/**
 * Рисование текста
 */
export function drawText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontSize: number = 16,
  fontFamily: string = 'Arial',
): void {
  context.font = `${fontSize}px ${fontFamily}`;
  context.fillText(text, x, y);
}

/**
 * Получение цвета пикселя (для пипетки)
 */
export function getPixelColor(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
): string {
  const canvas = context.canvas;
  const rect = canvas.getBoundingClientRect();
  const scaleX = rect.width ? canvas.width / rect.width : 1;
  const scaleY = rect.height ? canvas.height / rect.height : 1;
  const imageData = context.getImageData(Math.round(x * scaleX), Math.round(y * scaleY), 1, 1);
  const data = imageData.data;
  return `rgb(${data[0]}, ${data[1]}, ${data[2]})`;
}

/**
 * Преобразование RGB в HEX
 */
export function rgbToHex(rgb: string): string {
  const match = rgb.match(/\d+/g);
  if (!match || match.length < 3) return '#000000';
  const r = parseInt(match[0]).toString(16).padStart(2, '0');
  const g = parseInt(match[1]).toString(16).padStart(2, '0');
  const b = parseInt(match[2]).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}
