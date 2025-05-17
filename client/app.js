const username = localStorage.getItem("username") || prompt("Введите ваше имя:") || "Аноним";
localStorage.setItem("username", username);

// Удалено сохранение сообщений в localStorage
const savedMessages = [];

// Глобальные переменные
let messagesList;
let connectionStatus;
let ws;

// Ждем полную загрузку DOM перед инициализацией элементов
document.addEventListener('DOMContentLoaded', function() {
  console.log("DOM загружен, инициализируем элементы");
  
  messagesList = document.getElementById("messages");
  connectionStatus = document.getElementById("connection-status");
  
  if (!messagesList) {
    console.error("Элемент с ID 'messages' не найден!");
  }
  
  if (!connectionStatus) {
    console.error("Элемент с ID 'connection-status' не найден!");
  } else {
    connectionStatus.textContent = "Connecting...";
    connectionStatus.style.color = "orange";
  }
  
  // Инициализируем WebSocket-соединение
  initWebSocket();
});

// Функция для инициализации WebSocket-соединения
function initWebSocket() {
  // Используем явное localhost для локальной разработки
  ws = new WebSocket("ws://localhost:9002");
  console.log("Connecting to WebSocket server at ws://localhost:9002");
  
  // Настраиваем обработчики WebSocket
  setupWebSocketHandlers();
}

// Функция для настройки обработчиков WebSocket
function setupWebSocketHandlers() {

  ws.onopen = () => {
    console.log("Connected to chat server");
    connectionStatus.textContent = "Connected";
    connectionStatus.style.color = "green";
    
    const joinMsg = { type: "join", user: username };
    console.log("Sending join message:", joinMsg);
    ws.send(JSON.stringify(joinMsg));
  };

  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
    connectionStatus.textContent = "Error";
    connectionStatus.style.color = "red";
  };

  ws.onclose = (event) => {
    console.log("WebSocket connection closed:", event.code, event.reason);
    connectionStatus.textContent = "Disconnected";
    connectionStatus.style.color = "red";
  };

  ws.onmessage = (event) => {
    console.log("Received message:", event.data);
    
    try {
      const data = JSON.parse(event.data);
      console.log("Parsed message:", data);
  
      if (data.type === "join") {
        const li = document.createElement("li");
        li.textContent = `${data.user} присоединился`;
        li.className = "system-message";
        messagesList.appendChild(li);
      } else if (data.type === "system") {
        // Обработка системных сообщений (например, о очистке истории)
        const li = document.createElement("li");
        li.textContent = data.text || "Системное сообщение";
        li.className = "system-message system-notification";
        messagesList.appendChild(li);
      } else if (data.type === "message") {
        const li = document.createElement("li");
        li.className = data.user === username ? "self" : "other";
  
        const container = document.createElement("div");
        container.className = "message-container";
  
        const nameDiv = document.createElement("div");
        nameDiv.textContent = data.user;
        nameDiv.className = "name";
  
        const messageDiv = document.createElement("div");
        messageDiv.textContent = data.text;
        messageDiv.className = "message";
  
        container.appendChild(nameDiv);
        container.appendChild(messageDiv);
        li.appendChild(container);
        messagesList.appendChild(li);
      }
    } catch (err) {
      console.error("Error parsing message:", err);
      console.error("Raw message:", event.data);
    }
  
    // Прокрутка вниз при появлении нового сообщения
    messagesList.scrollTop = messagesList.scrollHeight;
  };
}

// Обработчик для формы отправки сообщений добавим после загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById("form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = document.getElementById("input");
      if (input && input.value) {
        const message = { 
          type: "message", 
          user: username, 
          text: input.value 
        };
        console.log("Sending message:", message);
        try {
          ws.send(JSON.stringify(message));
          console.log("Message sent successfully");
        } catch (error) {
          console.error("Error sending message:", error);
          alert("Failed to send message: " + error.message);
        }
        input.value = "";
      }
    });
  } else {
    console.error("Form element not found!");
  }
});

// Добавляем обработчики событий после полной загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
  console.log("DOM полностью загружен, настраиваем кнопки");
  
  // Обработчик для проверки соединения
  const testConnectionBtn = document.getElementById("test-connection");
  if (testConnectionBtn) {
    console.log("Найдена кнопка проверки соединения, добавляем обработчик");
    testConnectionBtn.addEventListener("click", function() {
      console.log("Кнопка проверки соединения нажата");
      if (ws && ws.readyState === WebSocket.OPEN) {
        console.log("WebSocket соединение открыто");
        alert("WebSocket соединение активно!");
        
        // Отправляем тестовое сообщение
        const testMessage = {
          type: "message",
          user: username,
          text: "Тестовое сообщение: " + new Date().toLocaleTimeString()
        };
        ws.send(JSON.stringify(testMessage));
      } else {
        console.log("WebSocket соединение не открыто. Текущий статус:", ws ? ws.readyState : "undefined");
        alert("WebSocket соединение не установлено! Статус: " + (ws ? ws.readyState : "undefined"));
        
        // Пробуем переподключиться
        location.reload();
      }
    });
  } else {
    console.error("Кнопка проверки соединения не найдена!");
  }

  // Обработчик для очистки истории в UI и БД
  const clearHistoryBtn = document.getElementById("clear-history");
  if (clearHistoryBtn) {
    console.log("Найдена кнопка очистки истории, добавляем обработчик");
    clearHistoryBtn.addEventListener("click", function() {
      console.log("Кнопка очистки истории нажата");
      
      // Очистим историю локально
      const msgList = document.getElementById("messages");
      if (msgList) {
        msgList.innerHTML = "";
        console.log("История чата очищена в UI");
      } else {
        console.error("Список сообщений не найден!");
      }
      
      // Отправим серверу команду на очистку истории в БД
      if (ws && ws.readyState === WebSocket.OPEN) {
        console.log("Отправка команды на очистку истории в БД");
        const clearCommand = {
          type: "clear_history"
        };
        ws.send(JSON.stringify(clearCommand));
        alert("Команда на очистку истории чата отправлена на сервер!");
      } else {
        console.error("WebSocket соединение не активно, невозможно отправить команду очистки истории");
        alert("Не удалось отправить команду очистки истории на сервер! Проверьте соединение.");
      }
    });
  } else {
    console.error("Кнопка очистки истории не найдена!");
  }
});