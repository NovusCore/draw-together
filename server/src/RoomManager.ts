// Управление состоянием комнат
import {
  RoomState,
  DrawingStroke,
  DrawingCoordinate,
} from './types';

export class RoomManager {
  private rooms: Map<string, RoomState> = new Map();

  createRoom(roomId: string): RoomState {
    if (this.rooms.has(roomId)) {
      return this.rooms.get(roomId)!;
    }

    const room: RoomState = {
      id: roomId,
      strokes: new Map(),
      users: new Set(),
      createdAt: Date.now(),
    };

    this.rooms.set(roomId, room);
    return room;
  }

  getRoom(roomId: string): RoomState | undefined {
    return this.rooms.get(roomId);
  }

  addUserToRoom(roomId: string, userId: string): RoomState {
    const room = this.createRoom(roomId);
    room.users.add(userId);
    return room;
  }

  removeUserFromRoom(roomId: string, userId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    room.users.delete(userId);

    // Удаляем пустую комнату
    if (room.users.size === 0) {
      this.rooms.delete(roomId);
      return true;
    }

    return false;
  }

  addStroke(roomId: string, stroke: DrawingStroke): void {
    const room = this.getRoom(roomId);
    if (!room) return;
    room.strokes.set(stroke.id, stroke);
  }

  addPointToStroke(
    roomId: string,
    strokeId: string,
    point: DrawingCoordinate,
  ): void {
    const room = this.getRoom(roomId);
    if (!room) return;

    const stroke = room.strokes.get(strokeId);
    if (!stroke) return;

    stroke.points.push(point);
  }

  finishStroke(roomId: string, strokeId: string): void {
    const room = this.getRoom(roomId);
    if (!room) return;

    const stroke = room.strokes.get(strokeId);
    if (stroke) {
      // Отметить как завершённый (если нужно дополнительное поле)
      // stroke.completed = true;
    }
  }

  getRoomState(roomId: string): DrawingStroke[] {
    const room = this.getRoom(roomId);
    if (!room) return [];
    return Array.from(room.strokes.values());
  }

  getRoomUserCount(roomId: string): number {
    const room = this.getRoom(roomId);
    return room?.users.size ?? 0;
  }
}
