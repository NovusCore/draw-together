// Типы для координат и состояния чертежа
export interface DrawingCoordinate {
  x: number;
  y: number;
  timestamp: number;
}

export interface DrawingStroke {
  id: string;
  userId: string;
  points: DrawingCoordinate[];
  color: string;
  size: number;
  createdAt: number;
}

export interface RoomState {
  id: string;
  strokes: Map<string, DrawingStroke>;
  users: Set<string>;
  createdAt: number;
}

export interface ClientToServerEvents {
  'draw:start': (data: { x: number; y: number; color: string; size: number }) => void;
  'draw:move': (data: { x: number; y: number; timestamp: number }) => void;
  'draw:end': (data: { timestamp: number }) => void;
  'request:full-state': () => void;
}

export interface ServerToClientEvents {
  'draw:stroke-started': (data: {
    userId: string;
    strokeId: string;
    x: number;
    y: number;
    color: string;
    size: number;
  }) => void;
  'draw:point-added': (data: {
    userId: string;
    strokeId: string;
    x: number;
    y: number;
    timestamp: number;
  }) => void;
  'draw:stroke-ended': (data: {
    userId: string;
    strokeId: string;
    timestamp: number;
  }) => void;
  'state:full': (data: { strokes: DrawingStroke[] }) => void;
  'room:user-joined': (data: { userId: string; count: number }) => void;
  'room:user-left': (data: { userId: string; count: number }) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  userId: string;
  roomId: string;
  currentStrokeId?: string;
}
