// Вспомогательные функции для аутентификации

// Функция для установки базовых обработчиков WebSocket для аутентификации
function setupAuthWebSocketHandlers(socket, messageCallback) {
  // Сохраняем оригинальный обработчик сообщений, если он есть
  const originalMessageHandler = socket.onmessage;
  
  socket.onmessage = (event) => {
    console.log("Получено сообщение в базовом обработчике аутентификации:", event.data);
    
    try {
      const data = JSON.parse(event.data);
      
      // Вызываем переданный колбэк для конкретной обработки сообщения
      if (messageCallback) {
        messageCallback(data, event);
      }
      
      // Если есть оригинальный обработчик и он не был вызван в колбэке,
      // вызываем его здесь (это обеспечит обратную совместимость)
      if (originalMessageHandler && typeof originalMessageHandler === 'function') {
        originalMessageHandler(event);
      }
    } catch (err) {
      console.error("Ошибка в обработчике сообщений аутентификации:", err);
    }
  };
  
  // Функция для очистки обработчиков после успешной аутентификации
  return function cleanup() {
    socket.onmessage = originalMessageHandler;
  };
}
