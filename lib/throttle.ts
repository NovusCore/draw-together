/**
 * Throttle функция для ограничения частоты вызовов
 * Используется для оптимизации сетевых событий координат мыши
 * @param func Функция для оптимизации
 * @param limit Интервал в мс между вызовами
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function (this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Расчёт интервала для 60 FPS
 * 1000ms / 60 FPS ≈ 16.67ms
 */
export const THROTTLE_INTERVAL = 1000 / 60;
