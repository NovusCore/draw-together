'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [roomId, setRoomId] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const getRoomIdFromInput = (value: string) => {
    const trimmedValue = value.trim();

    try {
      const url = new URL(trimmedValue);
      const roomIdFromPath = url.pathname.match(/^\/room\/(.+)$/)?.[1];
      return roomIdFromPath ? decodeURIComponent(roomIdFromPath) : trimmedValue;
    } catch {
      const roomIdFromPath = trimmedValue.match(/^\/?room\/(.+)$/)?.[1];
      return roomIdFromPath ? decodeURIComponent(roomIdFromPath) : trimmedValue;
    }
  };

  const handleRoomIdPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text');
    const pastedRoomId = getRoomIdFromInput(pastedText);

    if (pastedRoomId) {
      e.preventDefault();
      setRoomId(pastedRoomId);
    }
  };

  const handlePasteRoomId = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      const pastedRoomId = getRoomIdFromInput(clipboardText);

      if (pastedRoomId) {
        setRoomId(pastedRoomId);
      }
    } catch {
      // Browser permissions can block programmatic clipboard access.
    }
  };

  const handleCreateRoom = () => {
    setIsLoading(true);
    // Генерируем уникальный ID комнаты
    const newRoomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setTimeout(() => {
      router.push(`/room/${newRoomId}`);
      setIsLoading(false);
    }, 300);
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedRoomId = getRoomIdFromInput(roomId);
    if (!normalizedRoomId) return;

    setIsLoading(true);
    setTimeout(() => {
      router.push(`/room/${encodeURIComponent(normalizedRoomId)}`);
      setIsLoading(false);
    }, 300);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Карточка */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-6">
          {/* Заголовок */}
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">🎨 Рисовалка</h1>
            <p className="text-gray-600">Совместное рисование в реальном времени</p>
          </div>

          {/* Создание новой комнаты */}
          <button
            onClick={handleCreateRoom}
            disabled={isLoading}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '⏳ Загрузка...' : '✨ Создать новую комнату'}
          </button>

          {/* Разделитель */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">или</span>
            </div>
          </div>

          {/* Присоединение к существующей комнате */}
          <form onSubmit={handleJoinRoom} className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="ID комнаты"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                onPaste={handleRoomIdPaste}
                className="min-w-0 flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 caret-indigo-600 focus:outline-none focus:border-indigo-500 font-mono text-sm"
              />
              <button
                type="button"
                onClick={handlePasteRoomId}
                className="shrink-0 px-4 py-3 bg-indigo-100 text-indigo-700 font-semibold rounded-lg hover:bg-indigo-200 transition-colors text-sm"
              >
                Вставить
              </button>
            </div>
            <button
              type="submit"
              disabled={!roomId.trim() || isLoading}
              className="w-full py-3 px-4 bg-gray-800 text-white font-semibold rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '⏳ Загрузка...' : '🚪 Присоединиться'}
            </button>
          </form>

          {/* Информация */}
          <div className="bg-blue-50 rounded-lg p-4 text-sm text-gray-700">
            <p className="font-semibold mb-2">💡 Как это работает:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Создайте новую комнату или присоединитесь к существующей</li>
              <li>Рисуйте вместе с другими пользователями в реальном времени</li>
              <li>Все изменения синхронизируются мгновенно</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
