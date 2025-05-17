// Создаем модальное окно для ввода имени при первом запуске
function showUsernameModal() {
  // Создаем оверлей
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  overlay.style.display = 'flex';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';
  overlay.style.zIndex = '1000';
  
  // Создаем модальное окно
  const modal = document.createElement('div');
  modal.style.backgroundColor = 'white';
  modal.style.borderRadius = '8px';
  modal.style.padding = '20px';
  modal.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
  modal.style.width = '300px';
  modal.style.textAlign = 'center';
  
  // Заголовок
  const title = document.createElement('h2');
  title.textContent = 'Добро пожаловать в чат!';
  title.style.marginBottom = '15px';
  title.style.color = '#4361ee';
  
  // Инструкция
  const instruction = document.createElement('p');
  instruction.textContent = 'Пожалуйста, введите ваше имя:';
  instruction.style.marginBottom = '15px';
  
  // Поле ввода
  const input = document.createElement('input');
  input.style.width = '100%';
  input.style.padding = '10px';
  input.style.marginBottom = '15px';
  input.style.borderRadius = '4px';
  input.style.border = '1px solid #ddd';
  input.style.boxSizing = 'border-box';
  
  // Кнопка подтверждения
  const button = document.createElement('button');
  button.textContent = 'Начать общение';
  button.style.backgroundColor = '#4361ee';
  button.style.color = 'white';
  button.style.border = 'none';
  button.style.padding = '10px 15px';
  button.style.borderRadius = '4px';
  button.style.cursor = 'pointer';
  button.style.width = '100%';
  
  // Сборка модального окна
  modal.appendChild(title);
  modal.appendChild(instruction);
  modal.appendChild(input);
  modal.appendChild(button);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // Устанавливаем фокус на поле ввода
  input.focus();
  
  // Возвращаем промис, который разрешается с введенным именем
  return new Promise((resolve) => {
    button.addEventListener('click', () => {
      const name = input.value.trim() || 'Аноним';
      document.body.removeChild(overlay);
      resolve(name);
    });
    
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const name = input.value.trim() || 'Аноним';
        document.body.removeChild(overlay);
        resolve(name);
      }
    });
  });
}

// При первом запуске показываем модальное окно
let username;
// Глобальные переменные
let messagesList;
let connectionStatus;
let ws;
let typingTimer;
let isTyping = false;

// Ждем полную загрузку DOM перед инициализацией элементов
document.addEventListener('DOMContentLoaded', async function() {
  console.log("DOM загружен, инициализируем элементы");
  
  // Запрашиваем имя пользователя через красивое модальное окно
  if (!localStorage.getItem("username")) {
    username = await showUsernameModal();
    localStorage.setItem("username", username);
  } else {
    username = localStorage.getItem("username");
  }
  
  messagesList = document.getElementById("messages");
  connectionStatus = document.getElementById("connection-status");
  
  if (!messagesList) {
    console.error("Элемент с ID 'messages' не найден!");
  }
  
  if (!connectionStatus) {
    console.error("Элемент с ID 'connection-status' не найден!");
  } else {
    connectionStatus.textContent = "Подключение...";
  }
  
  // Настраиваем обработчик кнопок эмодзи и вложений
  setupUiHandlers();
  
  // Инициализируем WebSocket-соединение
  initWebSocket();
  
  // Инициализируем обработчик отправки сообщений
  setupMessageForm();
});

// Функция для инициализации WebSocket-соединения
function initWebSocket() {
  // Определяем протокол WebSocket на основе протокола страницы
  const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
  const wsUrl = `${protocol}localhost:9002`;
  
  // Устанавливаем соединение
  ws = new WebSocket(wsUrl);
  console.log(`Connecting to WebSocket server at ${wsUrl}`);
  
  // Настраиваем обработчики WebSocket
  setupWebSocketHandlers();
}

// Функция для настройки обработчиков WebSocket
function setupWebSocketHandlers() {

  ws.onopen = () => {
    console.log("Connected to chat server");
    connectionStatus.textContent = "В сети";
    connectionStatus.style.backgroundColor = "#4ade80";
    
    const joinMsg = { type: "join", user: username };
    console.log("Sending join message:", joinMsg);
    ws.send(JSON.stringify(joinMsg));
  };

  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
    connectionStatus.textContent = "Ошибка";
    connectionStatus.style.backgroundColor = "#ef4444";
  };

  ws.onclose = (event) => {
    console.log("WebSocket connection closed:", event.code, event.reason);
    connectionStatus.textContent = "Не в сети";
    connectionStatus.style.backgroundColor = "#ef4444";
    
    // Автоматическое переподключение через 5 секунд
    setTimeout(() => {
      console.log("Attempting to reconnect...");
      initWebSocket();
    }, 5000);
  };

  ws.onmessage = (event) => {
    console.log("Received message:", event.data);
    
    try {
      const data = JSON.parse(event.data);
      console.log("Parsed message:", data);
      
      // Скрываем индикатор печатания, если он есть
      removeTypingIndicator();
  
      if (data.type === "join") {
        const li = document.createElement("li");
        li.innerHTML = `<i class="fas fa-user-plus"></i> ${data.user} присоединился к чату`;
        li.className = "system-message";
        messagesList.appendChild(li);
      } else if (data.type === "system") {
        // Обработка системных сообщений (например, о очистке истории)
        const li = document.createElement("li");
        li.innerHTML = `<i class="fas fa-info-circle"></i> ${data.text || "Системное сообщение"}`;
        li.className = "system-message system-notification";
        messagesList.appendChild(li);
      } else if (data.type === "typing") {
        // Показываем, что кто-то печатает
        if (data.user !== username) {
          showTypingIndicator(data.user);
        }
      } else if (data.type === "message") {
        const li = document.createElement("li");
        li.className = data.user === username ? "self" : "other";
        
        // Создаем аватар
        const avatar = document.createElement("div");
        avatar.className = "avatar";
        
        // Генерируем цвет аватара на основе имени
        const avatarColor = generateColorFromName(data.user);
        avatar.style.backgroundColor = avatarColor;
        
        // Добавляем инициалы пользователя
        const initials = getInitials(data.user);
        avatar.textContent = initials;
  
        const container = document.createElement("div");
        container.className = "message-container";
  
        const nameDiv = document.createElement("div");
        nameDiv.textContent = data.user;
        nameDiv.className = "name";
  
        const messageDiv = document.createElement("div");
        messageDiv.textContent = data.text;
        messageDiv.className = "message";
        
        // Добавляем время сообщения
        const timeDiv = document.createElement("div");
        const now = new Date();
        timeDiv.textContent = now.getHours().toString().padStart(2, '0') + ':' + 
                             now.getMinutes().toString().padStart(2, '0');
        timeDiv.className = "message-time";
  
        container.appendChild(nameDiv);
        container.appendChild(messageDiv);
        li.appendChild(avatar);
        li.appendChild(container);
        li.appendChild(timeDiv);
        messagesList.appendChild(li);
      }
    } catch (err) {
      console.error("Error parsing message:", err);
      console.error("Raw message:", event.data);
    }
  
    // Прокрутка вниз при появлении нового сообщения
    const chatContainer = document.getElementById("chat");
    chatContainer.scrollTop = chatContainer.scrollHeight;
  };
}

// Функция для настройки формы отправки сообщений
function setupMessageForm() {
  const form = document.getElementById("form");
  const input = document.getElementById("input");
  
  if (form && input) {
    // Обработчик отправки формы
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (input.value.trim()) {
        const message = { 
          type: "message", 
          user: username, 
          text: input.value 
        };
        console.log("Sending message:", message);
        try {
          ws.send(JSON.stringify(message));
          console.log("Message sent successfully");
          
          // Сбрасываем статус печатания
          isTyping = false;
          clearTimeout(typingTimer);
        } catch (error) {
          console.error("Error sending message:", error);
          showToast("Не удалось отправить сообщение");
        }
        input.value = "";
      }
    });
    
    // Обработчик для индикации печатия
    input.addEventListener("input", () => {
      if (!isTyping && input.value.trim()) {
        isTyping = true;
        const typingMsg = {
          type: "typing",
          user: username
        };
        ws.send(JSON.stringify(typingMsg));
        
        // Сбрасываем статус печатания через 2 секунды бездействия
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
          isTyping = false;
        }, 2000);
      }
    });
  } else {
    console.error("Form or input element not found!");
  }
}

// Функция для отображения индикатора "печатает..."
function showTypingIndicator(user) {
  // Удаляем существующий индикатор, если он есть
  removeTypingIndicator();
  
  // Создаем новый индикатор
  const typingEl = document.createElement("div");
  typingEl.id = "typing-indicator";
  typingEl.className = "typing-indicator";
  
  // Добавляем анимированные точки
  const dots = document.createElement("div");
  dots.className = "dots";
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement("div");
    dot.className = "dot";
    dots.appendChild(dot);
  }
  
  typingEl.innerHTML = `<i class="fas fa-keyboard"></i> ${user} печатает`;
  typingEl.appendChild(dots);
  
  // Добавляем индикатор перед блоком формы
  const chatContainer = document.getElementById("chat");
  chatContainer.appendChild(typingEl);
  
  // Прокручиваем чат вниз
  chatContainer.scrollTop = chatContainer.scrollHeight;
  
  // Автоматически удаляем индикатор через 5 секунд, если новое сообщение не пришло
  setTimeout(() => {
    removeTypingIndicator();
  }, 5000);
}

// Функция для удаления индикатора "печатает..."
function removeTypingIndicator() {
  const typingEl = document.getElementById("typing-indicator");
  if (typingEl) {
    typingEl.remove();
  }
}

// Функция загрузки эмодзи в панель
function loadEmojis() {
  const container = document.getElementById("emoji-container");
  if (!container) return;
  
  // Очищаем контейнер перед загрузкой
  container.innerHTML = "";
  
  // Загружаем эмодзи из emoji.js
  emojiList.forEach(emoji => {
    const span = document.createElement("span");
    span.className = "emoji-item";
    span.textContent = emoji;
    span.addEventListener("click", () => {
      // Добавляем выбранный эмодзи в поле ввода
      const input = document.getElementById("input");
      if (input) {
        const cursorPos = input.selectionStart;
        const textBefore = input.value.substring(0, cursorPos);
        const textAfter = input.value.substring(input.selectionEnd);
        input.value = textBefore + emoji + textAfter;
        
        // Перемещаем курсор после вставленного эмодзи
        input.selectionStart = cursorPos + emoji.length;
        input.selectionEnd = cursorPos + emoji.length;
        input.focus();
        
        // Вызываем событие input, чтобы сработал обработчик печатания
        const event = new Event('input', { bubbles: true });
        input.dispatchEvent(event);
      }
      
      // Закрываем панель эмодзи
      document.getElementById("emoji-overlay").classList.add("hidden");
    });
    container.appendChild(span);
  });
  
  // Настраиваем вкладки категорий
  setupEmojiTabs();
}

// Функция для настройки вкладок в панели эмодзи
function setupEmojiTabs() {
  const tabs = document.querySelectorAll(".emoji-tab");
  if (tabs.length === 0) return;
  
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      // Удаляем класс active у всех вкладок
      tabs.forEach(t => t.classList.remove("active"));
      // Добавляем класс active к нажатой вкладке
      tab.classList.add("active");
      
      // Здесь можно добавить логику для отображения разных категорий эмодзи
      const category = tab.getAttribute("data-category");
      console.log(`Выбрана категория эмодзи: ${category}`);
      
      // В будущей версии: загрузка эмодзи по категориям
      // loadEmojisByCategory(category);
    });
  });
}

// Функция для отображения всплывающего уведомления
function showToast(message) {
  // Удаляем существующее уведомление, если оно есть
  const existingToast = document.querySelector(".toast");
  if (existingToast) {
    existingToast.remove();
  }
  
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  // Автоматически удаляем уведомление через 3 секунды
  setTimeout(() => {
    if (document.body.contains(toast)) {
      document.body.removeChild(toast);
    }
  }, 3000);
}

// Функция настройки интерфейсных элементов
function setupUiHandlers() {
  // Инициализация темы из localStorage или установка светлой темы по умолчанию
  const savedTheme = localStorage.getItem("chatTheme") || "theme-light";
  document.getElementById("chat-app").className = savedTheme;
  updateThemeIcon(savedTheme);
  
  // Настраиваем контекстное меню
  setupContextMenu();
  
  // Обработчик кнопки эмодзи и панели эмодзи
  const emojiBtn = document.querySelector(".emoji-btn");
  const emojiOverlay = document.getElementById("emoji-overlay");
  const input = document.getElementById("input");
  
  if (emojiBtn && input && emojiOverlay) {
    emojiBtn.addEventListener("click", () => {
      if (emojiOverlay.classList.contains('hidden')) {
        emojiOverlay.classList.remove('hidden');
        loadEmojis();
      } else {
        emojiOverlay.classList.add('hidden');
      }
    });
    
    // Закрытие панели эмодзи при клике вне её
    document.addEventListener('click', (e) => {
      if (!emojiBtn.contains(e.target) && 
          !emojiOverlay.contains(e.target) && 
          !emojiOverlay.classList.contains('hidden')) {
        emojiOverlay.classList.add('hidden');
      }
    });
  }
  
  // Обработчик кнопки прикрепления файлов
  const attachBtn = document.querySelector(".attach-btn");
  if (attachBtn) {
    attachBtn.addEventListener("click", () => {
      showToast("Функция прикрепления файлов будет доступна в следующей версии");
    });
  }
  
  // Настроим кнопку отправки сообщения для активации при нажатии
  const sendBtn = document.querySelector(".send-btn");
  if (sendBtn) {
    sendBtn.addEventListener("click", () => {
      const form = document.getElementById("form");
      if (form) {
        // Создаем событие отправки формы
        const submitEvent = new Event("submit", {
          bubbles: true,
          cancelable: true
        });
        form.dispatchEvent(submitEvent);
      }
    });
  }
  
  // Добавляем возможность изменить имя пользователя по клику на заголовок
  const chatTitle = document.querySelector(".chat-title");
  if (chatTitle) {
    chatTitle.style.cursor = "pointer";
    chatTitle.addEventListener("click", async () => {
      username = await showUsernameModal();
      localStorage.setItem("username", username);
      showToast(`Ваше имя изменено на: ${username}`);
      // Обновляем аватарку пользователя на основе имени
      updateAvatars();
    });
  }
  
  // Переключение темы
  const themeToggle = document.getElementById("theme-toggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const chatApp = document.getElementById("chat-app");
      const currentTheme = chatApp.className;
      const newTheme = currentTheme === "theme-light" ? "theme-dark" : "theme-light";
      
      chatApp.className = newTheme;
      localStorage.setItem("chatTheme", newTheme);
      
      updateThemeIcon(newTheme);
      showToast(newTheme === "theme-light" ? "Включена светлая тема" : "Включена тёмная тема");
    });
  }
  
  // Отображение меню опций
  const moreOptions = document.getElementById("more-options");
  const contextMenu = document.getElementById("context-menu");
  
  if (moreOptions && contextMenu) {
    console.log("Настраиваем кнопку дополнительных опций");
    moreOptions.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault(); // Предотвращаем стандартное поведение
      console.log("Нажата кнопка дополнительных опций");
      
      const rect = moreOptions.getBoundingClientRect();
      
      // Устанавливаем позицию меню
      contextMenu.style.position = "fixed"; 
      contextMenu.style.top = `${rect.bottom + 5}px`;
      contextMenu.style.left = `${rect.left - 180 + rect.width}px`; 
      
      // Используем два метода отображения для большей надежности
      contextMenu.style.display = "block";
      contextMenu.classList.add('visible'); // Добавляем класс для CSS-стилей
      
      // Добавляем проверку фактического отображения спустя небольшую задержку
      setTimeout(() => {
        const computedStyle = window.getComputedStyle(contextMenu);
        console.log("Проверка видимости меню:", {
          display: computedStyle.display,
          visibility: computedStyle.visibility,
          opacity: computedStyle.opacity,
          position: computedStyle.position,
          top: computedStyle.top,
          left: computedStyle.left,
          zIndex: computedStyle.zIndex
        });
      }, 50);
    });
    
    // Закрытие меню при клике в любом месте
    document.addEventListener("click", (e) => {
      if (contextMenu.style.display === "block" && 
          !contextMenu.contains(e.target) && 
          e.target !== moreOptions && 
          !moreOptions.contains(e.target)) {
        console.log("Закрываем контекстное меню");
        contextMenu.style.display = "none";
        contextMenu.classList.remove('visible');
      }
    });
  } else {
    console.error("Элементы меню не найдены:", { moreOptions: !!moreOptions, contextMenu: !!contextMenu });
  }
}

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
  
  // Обновляем аватары для всех сообщений
  updateAvatars();
});

// Функция для обновления аватаров пользователей на основе их имен
function updateAvatars() {
  // Получаем все сообщения
  const allMessages = document.querySelectorAll("#messages li");
  
  // Для каждого сообщения добавляем аватар, если его еще нет
  allMessages.forEach(message => {
    // Проверяем, есть ли уже аватар
    if (!message.querySelector('.avatar')) {
      const messageContainer = message.querySelector('.message-container');
      if (messageContainer) {
        const nameDiv = messageContainer.querySelector('.name');
        if (nameDiv) {
          const userName = nameDiv.textContent;
          
          // Создаем аватар
          const avatar = document.createElement('div');
          avatar.className = 'avatar';
          
          // Генерируем цвет аватара на основе имени пользователя
          const avatarColor = generateColorFromName(userName);
          avatar.style.backgroundColor = avatarColor;
          
          // Добавляем инициалы пользователя
          const initials = getInitials(userName);
          avatar.textContent = initials;
          
          // Вставляем аватар перед контейнером сообщения
          message.insertBefore(avatar, messageContainer);
        }
      }
    }
  });
}

// Функция для генерации цвета аватара на основе имени
function generateColorFromName(name) {
  // Преобразуем имя в число для определения цвета
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Создаем HSL цвет с фиксированной яркостью и насыщенностью
  const hue = (hash % 360);
  return `hsl(${hue}, 70%, 60%)`;
}

// Функция для получения инициалов из имени
function getInitials(name) {
  // Разделяем имя на части и берем первые буквы каждой части
  const nameParts = name.split(' ');
  if (nameParts.length > 1) {
    return (nameParts[0][0] + nameParts[1][0]).toUpperCase();
  } else {
    // Если имя состоит из одного слова, берем первые две буквы
    return name.substring(0, 2).toUpperCase();
  }
}

// Функция для обновления иконки темы
function updateThemeIcon(theme) {
  const themeToggle = document.getElementById("theme-toggle");
  if (themeToggle) {
    const icon = themeToggle.querySelector('i');
    if (icon) {
      if (theme === "theme-dark") {
        icon.className = "fas fa-sun"; // Иконка солнца для тёмной темы (чтобы переключиться на светлую)
      } else {
        icon.className = "fas fa-moon"; // Иконка луны для светлой темы (чтобы переключиться на тёмную)
      }
    }
  }
}

// Функция настройки контекстного меню
function setupContextMenu() {
  console.log("Настраиваем контекстное меню");
  
  const clearChatBtn = document.getElementById("clear-chat");
  if (clearChatBtn) {
    console.log("Найдена кнопка очистки чата, добавляем обработчик");
    clearChatBtn.addEventListener("click", () => {
      console.log("Нажата кнопка очистки чата");
      // Очищаем историю сообщений
      const messages = document.getElementById("messages");
      if (messages) {
        // Запрашиваем подтверждение у пользователя перед очисткой
        if (confirm("Вы уверены, что хотите очистить историю чата?")) {
          console.log("Подтверждена очистка чата");
          messages.innerHTML = "";
          
          // Отправляем на сервер команду очистки истории чата
          if (ws && ws.readyState === WebSocket.OPEN) {
            const clearMsg = {
              type: "clear_history",
              user: username
            };
            ws.send(JSON.stringify(clearMsg));
            console.log("Отправлена команда очистки истории:", clearMsg);
          }
          
          showToast("История чата очищена");
        }
      }
      
      // Скрываем контекстное меню
      const contextMenu = document.getElementById("context-menu");
      if (contextMenu) {
        contextMenu.style.display = "none";
        contextMenu.classList.remove('visible');
      }
    });
  } else {
    console.error("Кнопка очистки чата не найдена!");
  }
  
  const changeBgBtn = document.getElementById("change-bg");
  if (changeBgBtn) {
    changeBgBtn.addEventListener("click", () => {
      // Показываем уведомление о том, что функция будет доступна в следующей версии
      showToast("Функция смены фона будет доступна в следующей версии");
      
      // Скрываем контекстное меню
      const contextMenu = document.getElementById("context-menu");
      contextMenu.style.display = "none";
      contextMenu.classList.remove('visible');
    });
  }
  
  // Добавляем обработчик для третьей кнопки меню
  const testConnectionBtn = document.getElementById("test-connection");
  if (testConnectionBtn) {
    testConnectionBtn.addEventListener("click", () => {
      // Скрываем контекстное меню при нажатии
      const contextMenu = document.getElementById("context-menu");
      if (contextMenu) {
        contextMenu.style.display = "none";
      }
    });
  }
}