# Drawing Service Architecture

## Server Structure

```
server/
├── src/
│   ├── index.ts          # Socket.io сервер (точка входа)
│   ├── types.ts          # TypeScript типы для real-time коммуникации
│   ├── RoomManager.ts    # Управление состоянием комнат и линий
├── dist/                 # Скомпилированный JavaScript
├── package.json          # Зависимости сервера
├── tsconfig.json         # TypeScript конфигурация
└── .env.example          # Пример переменных окружения
```

## Socket.io Events

### Client → Server
- **`join:room(roomId)`** — присоединиться к комнате
- **`draw:start(data)`** — начать рисование
- **`draw:move(data)`** — отправить координаты
- **`draw:end(data)`** — завершить линию
- **`request:full-state()`** — запросить полное состояние

### Server → Client
- **`draw:stroke-started`** — новая линия началась
- **`draw:point-added`** — точка добавлена к линии
- **`draw:stroke-ended`** — линия завершена
- **`state:full`** — полное состояние холста
- **`room:user-joined`** — пользователь вошёл
- **`room:user-left`** — пользователь вышел

## Key Features

✅ **Multi-room Isolation** — каждая комната изолирована
✅ **State Management** — полная синхронизация на join
✅ **Real-time Broadcasting** — все события транслируются в реальном времени
✅ **Graceful Shutdown** — корректное завершение при SIGINT
