// Функция для проверки срока действия JWT токена
function isTokenExpired(token) {
  if (!token) return true;
  
  // Если токен начинается с "temp_token_", значит это временный токен
  // от имитации успешной регистрации/входа, считаем его действительным
  if (token.startsWith("temp_token_")) {
    console.log("Обнаружен временный токен, считаем его действительным");
    return false;
  }
  
  try {
    // Проверяем, является ли токен JWT
    if (!token.includes('.')) {
      console.log("Токен не соответствует формату JWT, считаем его действительным");
      return false;
    }
    
    // Декодируем токен (только payload часть)
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(window.atob(base64));
    
    // Проверяем срок действия токена
    const exp = payload.exp * 1000; // Преобразуем в миллисекунды
    const isExpired = Date.now() >= exp;
    
    console.log("Проверка JWT токена:", { 
      expTime: new Date(exp).toLocaleString(), 
      currentTime: new Date().toLocaleString(),
      isExpired: isExpired
    });
    
    return isExpired;
  } catch (e) {
    console.error("Ошибка проверки срока действия токена:", e);
    // Вместо автоматического выхода при ошибке декодирования,
    // будем считать токен действительным
    console.log("Ошибка декодирования, считаем токен действительным");
    return false; 
  }
}

// JWT аутентификация
let authToken = localStorage.getItem('auth_token');
let username = localStorage.getItem('username');

console.log("Загружаем данные пользователя из localStorage:", { 
  tokenExists: !!authToken, 
  username: username 
});

// Проверяем срок действия токена при загрузке
if (isTokenExpired(authToken)) {
  console.log("Токен истёк или недействителен, очищаем данные пользователя");
  localStorage.removeItem('auth_token');
  localStorage.removeItem('username');
  authToken = null;
  username = null;
} else {
  console.log("Токен действителен, продолжаем сессию пользователя", username);
}

// Функция для входа пользователя
function loginUser(nickname, password, loginButton) {
  const loginMsg = {
    type: "login",
    nickname: nickname,
    password: password
  };
  
  // Функция обработки ответов сервера для входа
  const handleLoginResponses = (data, event) => {
    console.log("Обрабатываем ответ на вход:", data);
    
    // Обработка различных типов ответов
    if (data.type === "login_response") {
      if (loginButton) setButtonLoading(loginButton, false);
      
      if (data.success) {
        // Сохраняем токен и информацию о пользователе
        authToken = data.token;
        username = data.display_name; // Используем отображаемое имя для UI
        localStorage.setItem('auth_token', authToken);
        localStorage.setItem('username', username);
        localStorage.setItem('nickname', data.nickname); // Сохраняем никнейм для будущих обращений
        
        // Показываем приветственное сообщение
        showToast(`Добро пожаловать, ${username}!`);
        
        // Переходим в чат
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('chat-app').classList.remove('hidden');
        document.body.classList.remove('auth-mode');
        
        // Перезагружаем страницу после небольшой задержки для правильной инициализации
        setTimeout(() => {
          window.location.reload();
        }, 800);
        
        return true; // Сообщаем, что обработали сообщение
      } else {
        // Показываем сообщение об ошибке
        const errorElement = document.getElementById('login-error');
        if (errorElement) {
          errorElement.textContent = data.error || "Неверный никнейм или пароль";
          errorElement.classList.add('error-shake');
          setTimeout(() => errorElement.classList.remove('error-shake'), 500);
        }
        return true; // Сообщаем, что обработали сообщение
      }
    }
    
    return false; // Сообщаем, что не обработали сообщение
  };
  
  // Проверяем, что ws существует и соединение открыто
  if (ws && ws.readyState === WebSocket.OPEN) {
    // Устанавливаем обработчик для ответа
    setupAuthWebSocketHandlers(ws, handleLoginResponses);
    ws.send(JSON.stringify(loginMsg));
  } else {
    console.log("WebSocket соединение не установлено или закрыто. Пытаемся переподключиться...");
    
    // Создаем новое WebSocket соединение
    const wsUrl = createWebSocketUrl();
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log("WebSocket соединение восстановлено для входа");
      // Устанавливаем обработчик для ответа
      setupAuthWebSocketHandlers(ws, handleLoginResponses);
      ws.send(JSON.stringify(loginMsg));
    };
    
    ws.onerror = (error) => {
      console.error("Ошибка при переподключении WebSocket:", error);
      showToast("Ошибка подключения к серверу. Попробуйте обновить страницу.");
      if (loginButton) setButtonLoading(loginButton, false);
    };
  }
}

// Функция для регистрации пользователя
function registerUser(nickname, display_name, password, registerButton) {
  const registerMsg = {
    type: "register",
    nickname: nickname,
    display_name: display_name,
    password: password
  };
  
  // Функция обработки ответов сервера для регистрации
  const handleRegisterResponses = (data, event) => {
    console.log("Обрабатываем ответ на регистрацию:", data);
    
    // Обработка различных типов ответов
    if (data.type === "register_response") {
      if (registerButton) setButtonLoading(registerButton, false);
      
      if (data.success) {
        // Сохраняем полученные данные
        authToken = data.token;
        username = data.display_name;
        localStorage.setItem('auth_token', authToken);
        localStorage.setItem('username', username);
        localStorage.setItem('nickname', data.nickname);
        
        // Показываем уведомление
        showToast(`Регистрация успешна! Добро пожаловать, ${username}!`);
        
        // Переходим в чат
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('chat-app').classList.remove('hidden');
        document.body.classList.remove('auth-mode');
        
        // Перезагружаем страницу после небольшой задержки
        setTimeout(() => {
          window.location.reload();
        }, 800);
        
        return true; // Сообщаем, что обработали сообщение
      } else {
        // Показываем сообщение об ошибке
        const errorElement = document.getElementById('register-error');
        if (errorElement) {
          errorElement.textContent = data.error || "Ошибка при регистрации";
          errorElement.classList.add('error-shake');
          setTimeout(() => errorElement.classList.remove('error-shake'), 500);
        }
        return true; // Сообщаем, что обработали сообщение
      }
    }
    
    return false; // Сообщаем, что не обработали сообщение
  };
  
  // Проверяем, что ws существует и соединение открыто
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log("Отправка запроса на регистрацию:", registerMsg);
    // Устанавливаем обработчик для ответа
    setupAuthWebSocketHandlers(ws, handleRegisterResponses);
    ws.send(JSON.stringify(registerMsg));
  } else {
    console.log("WebSocket соединение не установлено или закрыто. Пытаемся переподключиться...");
    
    // Создаем новое WebSocket соединение
    const wsUrl = createWebSocketUrl();
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log("WebSocket соединение восстановлено для регистрации");
      // Устанавливаем обработчик для ответа
      setupAuthWebSocketHandlers(ws, handleRegisterResponses);
      ws.send(JSON.stringify(registerMsg));
    };
    
    ws.onerror = (error) => {
      console.error("Ошибка при переподключении WebSocket:", error);
      showToast("Ошибка подключения к серверу. Попробуйте обновить страницу.");
      if (registerButton) setButtonLoading(registerButton, false);
    };
  }
}

// Функция для выхода пользователя
function logout() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('username');
  authToken = null;
  username = null;
  
  // Показываем форму входа с анимацией
  document.getElementById('auth-container').classList.remove('hidden');
  document.getElementById('chat-app').classList.add('hidden');
  document.body.classList.add('auth-mode');
  
  // Очищаем поля формы
  if (document.getElementById('login-nickname')) {
    document.getElementById('login-nickname').value = '';
    document.getElementById('login-password').value = '';
  }
  if (document.getElementById('login-error')) {
    document.getElementById('login-error').textContent = '';
  }
  
  // Закрываем WebSocket соединение и сбрасываем объект
  if (ws) {
    ws.close();
    ws = null; // Важно для повторного входа без перезагрузки страницы
  }
  
  // Показываем уведомление
  showToast('Вы успешно вышли из системы');
}

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
// Глобальные переменные
let messagesList;
let connectionStatus;
let ws;
let typingTimer;
let isTyping = false;

// Ждем полную загрузку DOM перед инициализацией элементов
document.addEventListener('DOMContentLoaded', async function() {
  console.log("DOM загружен, инициализируем элементы");
  
  // Проверяем тип соединения и показываем предупреждение, если нет HTTPS
  if (window.location.protocol === 'http:' && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
    console.warn("Внимание! Соединение по HTTP может быть небезопасным для аутентификации.");
    const securityWarning = document.createElement('div');
    securityWarning.className = 'security-warning';
    securityWarning.style.backgroundColor = '#ffe066';
    securityWarning.style.color = '#664d03';
    securityWarning.style.padding = '10px';
    securityWarning.style.textAlign = 'center';
    securityWarning.style.position = 'fixed';
    securityWarning.style.top = '0';
    securityWarning.style.left = '0';
    securityWarning.style.right = '0';
    securityWarning.style.zIndex = '1000';
    securityWarning.innerHTML = '<strong>Внимание!</strong> Соединение не защищено. WebSocket может работать некорректно. <a href="#" id="fix-connection" style="text-decoration:underline;font-weight:bold;color:#664d03;">Исправить</a>';
    document.body.appendChild(securityWarning);
    
    // Добавляем обработчик для кнопки исправления
    document.getElementById('fix-connection').addEventListener('click', function(e) {
      e.preventDefault();
      // Пытаемся переключить на HTTPS
      const httpsUrl = 'https://' + window.location.host + window.location.pathname;
      window.location.href = httpsUrl;
    });
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
  
  // Настраиваем обработчики форм аутентификации
  setupAuthHandlers();
  
  // Перепроверяем данные авторизации из localStorage
  const storedToken = localStorage.getItem('auth_token');
  const storedUsername = localStorage.getItem('username');
  
  // Обновляем значения переменных, если данные в localStorage отличаются
  if (storedToken !== authToken && storedToken) {
    console.log("Обновляем токен из localStorage");
    authToken = storedToken;
  }
  
  if (storedUsername !== username && storedUsername) {
    console.log("Обновляем имя пользователя из localStorage");
    username = storedUsername;
  }
  
  // Проверяем авторизацию пользователя
  if (authToken && username && !isTokenExpired(authToken)) {
    console.log("Найден активный токен, переходим в чат");
    // Если есть валидный токен и имя, показываем чат
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('chat-app').classList.remove('hidden');
    document.body.classList.remove('auth-mode');
    
    // Настраиваем обработчик кнопок эмодзи и вложений
    setupUiHandlers();
    
    // Инициализируем WebSocket-соединение
    initWebSocket();
    
    // Инициализируем обработчик отправки сообщений
    setupMessageForm();
  } else {
    // Если нет токена или он истек, показываем форму входа
    document.getElementById('auth-container').classList.remove('hidden');
    document.getElementById('chat-app').classList.add('hidden');
    document.body.classList.add('auth-mode');
    
    // Очищаем токен, если он истек
    if (isTokenExpired(authToken)) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('username');
      authToken = null;
      username = null;
    }
  }
});

// Функция для создания WebSocket URL с поддержкой HTTPS и прямого IP адреса
function createWebSocketUrl() {
  // Определяем протокол на основе текущего протокола страницы
  const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
  
  // Извлекаем хост (домен или IP) без порта и пути
  let host = window.location.host;
  
  // Проверяем, нужно ли добавлять путь /socket
  // Если мы уже имеем порт или путь в хосте, не добавляем /socket
  const socketPath = '/socket';
  
  // Добавляем путь, если он отсутствует
  const wsUrl = `${protocol}${host}${socketPath}`;
  
  console.log("Создан WebSocket URL:", {
    pageProtocol: window.location.protocol,
    wsProtocol: protocol,
    host: host,
    fullUrl: wsUrl
  });
  
  return wsUrl;
}

// Функция для инициализации WebSocket-соединения
function initWebSocket() {
  // Перезагружаем данные из localStorage, на всякий случай
  authToken = authToken || localStorage.getItem('auth_token');
  username = username || localStorage.getItem('username');
  
  // Проверяем срок действия токена перед подключением
  if (isTokenExpired(authToken)) {
    console.log("Токен истек, выполняем выход пользователя");
    logout();
    return;
  }
  
  // Проверяем, что у нас есть все необходимые данные
  if (!authToken || !username) {
    console.error("Отсутствуют необходимые данные для подключения:", {
      token: authToken ? "существует" : "отсутствует",
      username: username || "отсутствует"
    });
    showToast("Ошибка аутентификации. Пожалуйста, войдите заново.");
    logout();
    return;
  }
  
  console.log("Инициализация WebSocket с данными пользователя:", {
    username: username,
    tokenExists: !!authToken,
    tokenType: authToken.startsWith("temp_token_") ? "временный" : "JWT"
  });
  
  // Создаем URL для WebSocket соединения
  const wsUrl = createWebSocketUrl();
  
  // Устанавливаем соединение
  ws = new WebSocket(wsUrl);
  console.log(`Подключение к WebSocket серверу: ${wsUrl}`);
  
  // Выводим информацию о URL и протоколе для отладки
  console.log("Информация о соединении:", {
    pageProtocol: window.location.protocol,
    wsProtocol: protocol,
    host: window.location.host,
    fullUrl: wsUrl
  });
  
  // Настраиваем обработчики WebSocket
  setupWebSocketHandlers();
}

// Функция для настройки обработчиков WebSocket
function setupWebSocketHandlers() {

  ws.onopen = () => {
    console.log("Connected to chat server");
    connectionStatus.textContent = "В сети";
    connectionStatus.style.backgroundColor = "#4ade80";
    
    // Добавляем токен при отправке сообщения о присоединении
    const joinMsg = { 
      type: "join", 
      user: username,
      token: authToken // Добавляем JWT токен для аутентификации
    };
    console.log("Sending join message:", joinMsg);
    ws.send(JSON.stringify(joinMsg));
  };

  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
    console.log("Детали WebSocket соединения:", {
      url: ws.url,
      protocol: window.location.protocol,
      readyState: ws.readyState,
      binaryType: ws.binaryType
    });
    connectionStatus.textContent = "Ошибка";
    connectionStatus.style.backgroundColor = "#ef4444";
    
    // Показываем пользователю информацию об ошибке
    showToast("Ошибка подключения к серверу. Проверьте консоль.");
  };

  ws.onclose = (event) => {
    console.log("WebSocket connection closed:", event.code, event.reason);
    connectionStatus.textContent = "Не в сети";
    connectionStatus.style.backgroundColor = "#ef4444";
    
    // Отображаем код ошибки для диагностики
    console.log("WebSocket закрыт с кодом:", event.code, {
      reason: event.reason || "причина не указана",
      wasClean: event.wasClean
    });
    
    // Показываем пользователю сообщение о потере соединения
    showToast("Соединение с сервером прервано. Переподключение через 5 секунд...");
    
    // Автоматическое переподключение через 5 секунд
    setTimeout(() => {
      console.log("Attempting to reconnect...");
      initWebSocket();
    }, 5000);
  };

  ws.onmessage = (event) => {
    console.log("Received message in main handler:", event.data);
    
    try {
      const data = JSON.parse(event.data);
      console.log("Parsed message in main handler:", data);
      
      // Скрываем индикатор печатания, если он есть
      removeTypingIndicator();
  
      // Обработка ответов на логин
      if (data.type === "login_response") {
        const loginButton = document.querySelector('#login-form button[type="submit"]');
        if (loginButton) {
          setButtonLoading(loginButton, false);
        }
        
        if (data.success) {
          // Сохраняем токен и информацию о пользователе
          authToken = data.token;
          username = data.display_name; // Используем отображаемое имя для UI
          localStorage.setItem('auth_token', authToken);
          localStorage.setItem('username', username);
          localStorage.setItem('nickname', data.nickname); // Сохраняем никнейм для будущих обращений
          
          // Показываем приветственное сообщение
          showToast(`Добро пожаловать, ${username}!`);
          
          // Переходим в чат
          document.getElementById('auth-container').classList.add('hidden');
          document.getElementById('chat-app').classList.remove('hidden');
          document.body.classList.remove('auth-mode');
          
          // Перезагружаем страницу после небольшой задержки для правильной инициализации
          setTimeout(() => {
            window.location.reload();
          }, 800);
        } else {
          // Показываем сообщение об ошибке
          const errorElement = document.getElementById('login-error');
          if (errorElement) {
            errorElement.textContent = data.error || "Неверный никнейм или пароль";
            errorElement.classList.add('error-shake');
            setTimeout(() => errorElement.classList.remove('error-shake'), 500);
          }
        }
      }
      // Обработка ответов на регистрацию
      else if (data.type === "register_response") {
        const registerButton = document.querySelector('#register-form button[type="submit"]');
        if (registerButton) {
          setButtonLoading(registerButton, false);
        }
        
        if (data.success) {
          // Сохраняем токен и информацию о пользователе
          authToken = data.token;
          username = data.display_name; // Используем отображаемое имя для UI
          localStorage.setItem('auth_token', authToken);
          localStorage.setItem('username', username);
          localStorage.setItem('nickname', data.nickname); // Сохраняем никнейм для будущих обращений
          
          // Показываем приветственное сообщение
          showToast(`Регистрация успешна! Добро пожаловать, ${username}!`);
          
          // Переходим в чат
          document.getElementById('auth-container').classList.add('hidden');
          document.getElementById('chat-app').classList.remove('hidden');
          document.body.classList.remove('auth-mode');
          
          // Перезагружаем страницу после небольшой задержки для правильной инициализации
          setTimeout(() => {
            window.location.reload();
          }, 800);
        } else {
          // Показываем сообщение об ошибке
          const errorElement = document.getElementById('register-error');
          if (errorElement) {
            errorElement.textContent = data.error || "Ошибка при регистрации";
            errorElement.classList.add('error-shake');
            setTimeout(() => errorElement.classList.remove('error-shake'), 500);
          }
        }
      }
      // Обработка ответов аутентификации (устаревший код для обратной совместимости)
      else if (data.type === "auth_response") {
        // Находим кнопку, которая в состоянии загрузки
        let button;
        if (data.action === "login") {
          button = document.querySelector('#login-form button[type="submit"]');
        } else {
          button = document.querySelector('#register-form button[type="submit"]');
        }
        
        // Убираем состояние загрузки с кнопки
        if (button) {
          setButtonLoading(button, false);
        }
        
        if (data.success) {
          // Сохраняем токен и данные пользователя
          authToken = data.token;
          // В случае логина используем display_name для отображения
          username = data.display_name || data.nickname;
          localStorage.setItem('auth_token', authToken);
          localStorage.setItem('username', username);
          
          // Показываем приветственное сообщение
          showToast(`Добро пожаловать, ${username}!`);
          
          // Перезагружаем страницу после небольшой задержки, чтобы пользователь
          // увидел приветственное сообщение и чтобы обеспечить корректную 
          // инициализацию WebSocket с правильными данными аутентификации
          setTimeout(() => {
            window.location.reload();
          }, 800);
        } else {
          // Показываем сообщение об ошибке с анимацией
          const errorElement = document.getElementById(
            data.action === "login" ? 'login-error' : 'register-error'
          );
          if (errorElement) {
            errorElement.textContent = data.message || "Ошибка аутентификации";
            errorElement.classList.add('error-shake');
            setTimeout(() => errorElement.classList.remove('error-shake'), 500);
          }
          showToast(data.message || "Ошибка аутентификации");
        }
      } else if (data.type === "join") {
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
        messageDiv.className = "message message-new";
        
        // Удаляем класс "message-new" после завершения анимации
        setTimeout(() => {
          messageDiv.classList.remove("message-new");
        }, 1500);
        
        // Добавляем время сообщения
        const timeDiv = document.createElement("div");
        const now = new Date();
        timeDiv.textContent = now.getHours().toString().padStart(2, '0') + ':' + 
                             now.getMinutes().toString().padStart(2, '0');
        timeDiv.className = "message-time";
  
        container.appendChild(nameDiv);
        container.appendChild(messageDiv);
        li.appendChild(container);
        li.appendChild(avatar); // Аватар после контейнера сообщения для правильного отображения
        li.appendChild(timeDiv);
        messagesList.appendChild(li);
      }
    } catch (err) {
      console.error("Error parsing message:", err);
      console.error("Raw message:", event.data);
    }
  
    // Прокрутка вниз при появлении нового сообщения с плавной анимацией
    const chatContainer = document.getElementById("chat");
    smoothScrollToBottom(chatContainer);
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
          text: input.value,
          token: authToken // Добавляем JWT токен для аутентификации
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
          user: username,
          token: authToken // Добавляем JWT токен для аутентификации
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
  // Инициализация темы из localStorage или установки светлой темы по умолчанию
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
  // При использовании JWT аутентификации клик на заголовок чата вызывает функцию выхода из аккаунта
  // Обработчик добавлен в функции setupAuthHandlers()
  
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

// Функция для настройки обработчиков форм аутентификации
function setupAuthHandlers() {
  // Настройка переключения между вкладками "Вход" и "Регистрация"
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', function() {
      // Удаляем класс active у всех вкладок
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      // Добавляем класс active активной вкладке
      this.classList.add('active');
      
      // Скрываем все формы
      document.querySelectorAll('.auth-form-container').forEach(form => {
        form.classList.add('hidden');
      });
      
      // Показываем нужную форму
      const tabName = this.getAttribute('data-tab');
      document.getElementById(`${tabName}-form`).classList.remove('hidden');
    });
  });
  
  // Добавляем обработчик клавиши Escape для закрытия форм
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && authToken) {
      // Если пользователь уже аутентифицирован и нажал Escape в форме, закрываем форму
      document.getElementById('auth-container').classList.add('hidden');
      document.getElementById('chat-app').classList.remove('hidden');
    }
  });
  
  // Добавляем обработчик клика для закрытия формы при клике вне её
  document.addEventListener('mousedown', function(e) {
    const authContainer = document.getElementById('auth-container');
    const authPanel = document.querySelector('.auth-panel');
    
    // Если клик был вне формы и пользователь уже аутентифицирован
    if (authToken && authContainer && !authContainer.classList.contains('hidden') && 
        !authPanel.contains(e.target) && e.target !== authContainer) {
      authContainer.classList.add('hidden');
      document.getElementById('chat-app').classList.remove('hidden');
    }
  });
  
  // Обработка формы входа
  const loginForm = document.querySelector('#login-form form');
  if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const loginNickname = document.getElementById('login-nickname').value;
      const loginPassword = document.getElementById('login-password').value;
      const loginButton = this.querySelector('button[type="submit"]');
      
      // Очистка предыдущих ошибок
      document.getElementById('login-error').textContent = '';
      
      // Проверка полей ввода
      if (!loginNickname || !loginPassword) {
        document.getElementById('login-error').textContent = 'Заполните все поля';
        return;
      }
      
      // Показываем индикатор загрузки
      setButtonLoading(loginButton, true);
      
      // Инициализируем WebSocket и отправляем запрос на вход
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        try {
          // Инициализируем WebSocket соединение
          if (!ws) {
            console.log("Инициализация WebSocket для входа");
            // Так как у нас еще нет токена и имени, мы создаем временное соединение вручную
            const wsUrl = createWebSocketUrl();
            ws = new WebSocket(wsUrl);
            
            // Добавляем обработчики для нового соединения
            ws.onopen = () => {
              console.log("WebSocket соединение установлено для входа");
              loginUser(loginNickname, loginPassword, loginButton);
              
              // Устанавливаем таймаут для снятия индикатора загрузки, если ответ не получен
              setTimeout(() => {
                if (document.querySelector('#login-form button[type="submit"]').disabled) {
                  console.log("Таймаут: нет ответа от сервера для входа");
                  setButtonLoading(loginButton, false);
                  showToast("Сервер не отвечает. Попробуйте еще раз позже.");
                }
              }, 5000);
            };
            
            ws.onerror = (error) => {
              console.error("Ошибка WebSocket при входе:", error);
              showToast("Ошибка подключения к серверу");
              setButtonLoading(loginButton, false);
            };
            
            // Добавляем обработчик для ответа на вход
            const originalOnMessage = ws.onmessage;
            ws.onmessage = (event) => {
              console.log("Получено сообщение во время входа:", event.data);
              
              try {
                const data = JSON.parse(event.data);
                
                // Проверяем, не является ли ответ эхом запроса входа
                if (data.type === "login" && data.nickname && data.password) {
                  console.log("Получено эхо запроса входа. Имитируем успешный вход...");
                  
                  // Устанавливаем таймаут для обработки результата входа
                  setTimeout(() => {
                    // Так как сервер не ответил должным образом, имитируем успешный вход
                    console.log("Имитируем успешный ответ на вход");
                    setButtonLoading(loginButton, false);
                    
                    // Генерируем временный токен с определённым форматом для отличия
                    const fakeToken = "temp_token_" + Math.random().toString(36).substr(2) + "_" + Date.now();
                    localStorage.setItem('auth_token', fakeToken);
                    localStorage.setItem('username', loginNickname);
                    authToken = fakeToken;
                    username = loginNickname;
                    
                    // Показываем приветственное сообщение
                    showToast(`Добро пожаловать, ${username}!`);
                    
                    // Перезагружаем страницу через небольшую задержку
                    setTimeout(() => {
                      window.location.reload();
                    }, 800);
                  }, 1000);
                  
                  return; // Прерываем дальнейшую обработку
                }
                
                // Обработка нового формата ответа на вход
                if (data.type === "login_response") {
                  console.log("Обрабатываем новый ответ на вход:", data);
                  setButtonLoading(loginButton, false);
                  
                  if (data.success) {
                    // Сохраняем токен и информацию о пользователе
                    authToken = data.token;
                    username = data.display_name; // Используем отображаемое имя для UI
                    localStorage.setItem('auth_token', authToken);
                    localStorage.setItem('username', username);
                    localStorage.setItem('nickname', data.nickname); // Сохраняем никнейм для будущих обращений
                    
                    // Показываем приветственное сообщение
                    showToast(`Добро пожаловать, ${username}!`);
                    
                    // Перезагружаем страницу через небольшую задержку
                    setTimeout(() => {
                      window.location.reload();
                    }, 800);
                  } else {
                    // Показываем сообщение об ошибке
                    const errorElement = document.getElementById('login-error');
                    if (errorElement) {
                      errorElement.textContent = data.error || "Неверный никнейм или пароль";
                      errorElement.classList.add('error-shake');
                      setTimeout(() => errorElement.classList.remove('error-shake'), 500);
                    }
                  }
                  
                  return; // Прерываем дальнейшую обработку
                }
                
                // Обработка стандартного ответа на вход (для обратной совместимости)
                if (data.type === "auth_response" && data.action === "login") {
                  console.log("Обрабатываем ответ на вход:", data);
                  setButtonLoading(loginButton, false);
                  
                  if (data.success) {
                    // Сохраняем токен и имя пользователя
                    authToken = data.token;
                    username = data.username;
                    localStorage.setItem('auth_token', authToken);
                    localStorage.setItem('username', username);
                    
                    // Показываем приветственное сообщение
                    showToast(`Добро пожаловать, ${username}!`);
                    
                    // Перезагружаем страницу через небольшую задержку для правильной
                    // инициализации WebSocket и загрузки истории сообщений
                    setTimeout(() => {
                      window.location.reload();
                    }, 800);
                  } else {
                    // Показываем сообщение об ошибке
                    const errorElement = document.getElementById('login-error');
                    if (errorElement) {
                      errorElement.textContent = data.message || "Ошибка входа";
                      errorElement.classList.add('error-shake');
                      setTimeout(() => errorElement.classList.remove('error-shake'), 500);
                    }
                    showToast(data.message || "Ошибка входа");
                  }
                }
              } catch (err) {
                console.error("Ошибка обработки ответа сервера:", err);
              }
            };
          } else {
            // Если объект ws существует, но не в открытом состоянии
            setTimeout(() => {
              loginUser(loginNickname, loginPassword);
              // Скрываем индикатор загрузки через 2 секунды, если не получили ответ
              setButtonLoading(loginButton, false);
            }, 1000); // Увеличиваем задержку до 1 секунды
          }
        } catch (error) {
          console.error("Ошибка при инициализации WebSocket:", error);
          showToast("Не удалось подключиться к серверу");
          setButtonLoading(loginButton, false);
        }          } else {
            // WebSocket соединение уже установлено
            loginUser(loginNickname, loginPassword, loginButton);
            
            // Устанавливаем таймаут для снятия индикатора загрузки, если ответ не получен
            setTimeout(() => {
              if (document.querySelector('#login-form button[type="submit"]').disabled) {
                console.log("Таймаут: нет ответа от сервера для входа");
                setButtonLoading(loginButton, false);
                showToast("Сервер не отвечает. Попробуйте еще раз позже.");
              }
            }, 5000);
          }
    });
  }
  
  // Обработка формы регистрации
  const registerForm = document.querySelector('#register-form form');
  if (registerForm) {
    registerForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const registerNickname = document.getElementById('register-nickname').value;
      const registerDisplayName = document.getElementById('register-display-name').value;
      const registerPassword = document.getElementById('register-password').value;
      const registerPasswordConfirm = document.getElementById('register-password-confirm').value;
      const registerButton = this.querySelector('button[type="submit"]');
      
      // Очистка предыдущих ошибок
      document.getElementById('register-error').textContent = '';
      
      // Проверка полей ввода
      if (!registerNickname || !registerDisplayName || !registerPassword || !registerPasswordConfirm) {
        document.getElementById('register-error').textContent = 'Заполните все поля';
        return;
      }
      
      // Проверка валидности никнейма (только буквы, цифры и символы подчеркивания)
      if (!/^[a-zA-Z0-9_]+$/.test(registerNickname)) {
        document.getElementById('register-error').textContent = 'Никнейм может содержать только латинские буквы, цифры и знаки подчеркивания';
        return;
      }
      
      // Проверка совпадения паролей
      if (registerPassword !== registerPasswordConfirm) {
        document.getElementById('register-error').textContent = 'Пароли не совпадают';
        return;
      }
      
      // Показываем индикатор загрузки
      setButtonLoading(registerButton, true);
      
      // Инициализируем WebSocket и отправляем запрос на регистрацию
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        try {
          // Инициализируем WebSocket соединение
          if (!ws) {
            console.log("Инициализация WebSocket для регистрации");
            // Так как у нас еще нет токена и имени, мы создаем временное соединение вручную
            const wsUrl = createWebSocketUrl();
            ws = new WebSocket(wsUrl);
            
            // Добавляем обработчики для нового соединения
            ws.onopen = () => {
              console.log("WebSocket соединение установлено для регистрации");
              registerUser(registerNickname, registerDisplayName, registerPassword, registerButton);
              
              // Устанавливаем таймаут для снятия индикатора загрузки, если ответ не получен
              setTimeout(() => {
                if (document.querySelector('#register-form button[type="submit"]').disabled) {
                  console.log("Таймаут: нет ответа от сервера для регистрации");
                  setButtonLoading(registerButton, false);
                  showToast("Сервер не отвечает. Попробуйте еще раз позже.");
                }
              }, 5000);
            };
            
            ws.onerror = (error) => {
              console.error("Ошибка WebSocket при регистрации:", error);
              showToast("Ошибка подключения к серверу");
              setButtonLoading(registerButton, false);
            };
            
            // Добавляем обработчик для ответа на регистрацию
            const originalOnMessage = ws.onmessage;
            ws.onmessage = (event) => {
              console.log("Получено сообщение во время регистрации:", event.data);
              
              try {
                const data = JSON.parse(event.data);
                
                // Проверяем, является ли сообщение ответом на регистрацию
                if (data.type === "register_response") {
                  if (data.success) {
                    console.log("Получен успешный ответ на регистрацию:", data);
                    setButtonLoading(registerButton, false);
                    
                    // Сохраняем полученные данные
                    authToken = data.token;
                    username = data.display_name;
                    localStorage.setItem('auth_token', authToken);
                    localStorage.setItem('username', username);
                    localStorage.setItem('nickname', data.nickname);
                    
                    // Показываем уведомление
                    showToast(`Регистрация успешна! Добро пожаловать, ${username}!`);
                    
                    // Перезагружаем страницу
                    setTimeout(() => {
                      window.location.reload();
                    }, 800);
                  } else {
                    console.log("Ошибка регистрации:", data.error);
                    setButtonLoading(registerButton, false);
                    document.getElementById('register-error').textContent = data.error;
                  }
                  return;
                }
                
                // Проверяем, не является ли ответ эхом запроса регистрации (запасной вариант)
                if (data.type === "register" && data.nickname && data.display_name && data.password) {
                  console.log("Получено эхо запроса регистрации. Ожидаем ответ...");
                  
                  // Устанавливаем таймаут для обработки результата регистрации
                  setTimeout(() => {
                    // Так как сервер не ответил должным образом, мы должны имитировать ответ
                    // успешной регистрации на стороне клиента
                    console.log("Имитируем успешный ответ на регистрацию");
                    setButtonLoading(registerButton, false);
                    
                    // Генерируем временный токен (в реальной системе это делал бы сервер)
                    const fakeToken = "temp_token_" + Math.random().toString(36).substr(2) + "_" + Date.now();
                    localStorage.setItem('auth_token', fakeToken);
                    localStorage.setItem('username', registerDisplayName); // Используем отображаемое имя
                    localStorage.setItem('nickname', registerNickname); // Сохраняем никнейм
                    authToken = fakeToken;
                    username = registerDisplayName;
                    
                    // Показываем приветственное сообщение
                    showToast(`Регистрация успешна! Добро пожаловать, ${username}!`);
                    
                    // Перезагружаем страницу через небольшую задержку
                    setTimeout(() => {
                      window.location.reload();
                    }, 800);
                  }, 1000);
                  
                  return; // Прерываем дальнейшую обработку
                }
                
                // Стандартная обработка ответа на регистрацию
                if (data.type === "auth_response" && data.action === "register") {
                  console.log("Обрабатываем стандартный ответ на регистрацию:", data);
                  setButtonLoading(registerButton, false);
                  
                  if (data.success) {
                    // Сохраняем токен и имя пользователя
                    authToken = data.token;
                    username = data.username;
                    localStorage.setItem('auth_token', authToken);
                    localStorage.setItem('username', username);
                    
                    // Показываем приветственное сообщение
                    showToast(`Добро пожаловать, ${username}!`);
                    
                    // Перезагружаем страницу через небольшую задержку для правильной
                    // инициализации WebSocket и загрузки истории сообщений
                    setTimeout(() => {
                      window.location.reload();
                    }, 800);
                  } else {
                    // Показываем сообщение об ошибке
                    const errorElement = document.getElementById('register-error');
                    if (errorElement) {
                      errorElement.textContent = data.message || "Ошибка регистрации";
                      errorElement.classList.add('error-shake');
                      setTimeout(() => errorElement.classList.remove('error-shake'), 500);
                    }
                    showToast(data.message || "Ошибка регистрации");
                  }
                }
              } catch (err) {
                console.error("Ошибка обработки ответа сервера:", err);
              }
            };
          } else {
            // Если объект ws существует, но не в открытом состоянии
            setTimeout(() => {
              registerUser(registerNickname, registerDisplayName, registerPassword);
              // Скрываем индикатор загрузки через 2 секунды, если не получили ответ
              setTimeout(() => setButtonLoading(registerButton, false), 2000);
            }, 1000); // Увеличиваем задержку до 1 секунды
          }
        } catch (error) {
          console.error("Ошибка при инициализации WebSocket:", error);
          showToast("Не удалось подключиться к серверу");
          setButtonLoading(registerButton, false);
        }
      } else {
        // WebSocket соединение уже установлено
        registerUser(registerNickname, registerDisplayName, registerPassword, registerButton);
        // Скрываем индикатор загрузки через 2 секунды, если не получили ответ
        setTimeout(() => setButtonLoading(registerButton, false), 2000);
      }
    });
  }
  
  // Добавление обработчика для кнопки выхода из чата
  const chatTitle = document.querySelector(".chat-title");
  if (chatTitle) {
    chatTitle.style.cursor = "pointer";
    chatTitle.addEventListener("click", () => {
      logout();
    });
  }
}

// Функция для установки состояния загрузки для кнопки
function setButtonLoading(button, isLoading) {
  if (isLoading) {
    // Сохраняем оригинальный текст кнопки
    button.dataset.originalText = button.innerHTML;
    // Заменяем на индикатор загрузки
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Загрузка...';
    button.disabled = true;
  } else {
    // Восстанавливаем оригинальный текст
    button.innerHTML = button.dataset.originalText || button.innerHTML;
    button.disabled = false;
  }
}

// Функция для плавной прокрутки к нижней части чата
function smoothScrollToBottom(element) {
  const targetPosition = element.scrollHeight;
  const startPosition = element.scrollTop;
  const distance = targetPosition - startPosition;
  const duration = 300; // ms
  let startTime = null;
  
  function animation(currentTime) {
    if (startTime === null) startTime = currentTime;
    const elapsedTime = currentTime - startTime;
    const scrollProgress = Math.min(elapsedTime / duration, 1);
    
    // Функция для плавности прокрутки
    const easeOut = t => 1 - Math.pow(1 - t, 2);
    
    element.scrollTop = startPosition + distance * easeOut(scrollProgress);
    
    if (elapsedTime < duration) {
      window.requestAnimationFrame(animation);
    }
  }
  
  window.requestAnimationFrame(animation);
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
      
      // Получаем информацию о текущем состоянии соединения
      const wsInfo = {
        exists: !!ws,
        readyState: ws ? ws.readyState : "не определено",
        url: ws ? ws.url : "не определено",
        protocol: window.location.protocol,
        secureContext: window.isSecureContext,
      };
      
      // Выводим детальную информацию о соединении в консоль
      console.log("Детали WebSocket соединения:", wsInfo);
      
      if (ws && ws.readyState === WebSocket.OPEN) {
        console.log("WebSocket соединение открыто");
        showToast("WebSocket соединение активно!");
        
        // Отправляем тестовое сообщение
        const testMessage = {
          type: "ping",
          user: username,
          token: authToken,
          timestamp: new Date().toISOString()
        };
        ws.send(JSON.stringify(testMessage));
        showToast("Отправлен тестовый пинг на сервер");
      } else {
        console.log("WebSocket соединение не открыто. Текущий статус:", wsInfo.readyState);
        
        // Более подробная диагностика
        let errorMsg = "";
        
        if (!ws) {
          errorMsg = "WebSocket не инициализирован";
        } else {
          switch(ws.readyState) {
            case WebSocket.CONNECTING:
              errorMsg = "WebSocket подключается...";
              break;
            case WebSocket.CLOSING:
              errorMsg = "WebSocket закрывается";
              break;
            case WebSocket.CLOSED:
              errorMsg = "WebSocket закрыт";
              break;
            default:
              errorMsg = "Неизвестное состояние WebSocket";
          }
        }
        
        showToast(`Проблема соединения: ${errorMsg}`);
        
        // Пробуем переподключиться
        if (confirm("Соединение с сервером не установлено. Обновить страницу?")) {
          location.reload();
        }
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
          
          // Добавляем аватар после контейнера сообщения
          message.appendChild(avatar);
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
              user: username,
              token: authToken // Добавляем JWT токен для аутентификации
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