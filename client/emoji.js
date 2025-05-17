// База популярных эмодзи для быстрого выбора
const emojiList = [
  "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇",
  "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚",
  "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩",
  "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖",
  "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "❣️", "💕", "💞",
  "👍", "👎", "👏", "🙌", "👐", "🤲", "🤝", "👌", "👋", "✌️"
];

// Функция для открытия панели эмодзи
function openEmojiPanel(targetInput) {
  // Проверяем, существует ли уже панель эмодзи
  let emojiPanel = document.getElementById('emoji-panel');
  
  // Если панель уже открыта, закрываем её
  if (emojiPanel) {
    emojiPanel.remove();
    return;
  }
  
  // Создаем панель эмодзи
  emojiPanel = document.createElement('div');
  emojiPanel.id = 'emoji-panel';
  emojiPanel.className = 'emoji-panel';
  
  // Создаем контейнер для эмодзи
  const emojiContainer = document.createElement('div');
  emojiContainer.className = 'emoji-container';
  
  // Добавляем эмодзи в панель
  emojiList.forEach(emoji => {
    const emojiSpan = document.createElement('span');
    emojiSpan.className = 'emoji-item';
    emojiSpan.textContent = emoji;
    emojiSpan.addEventListener('click', () => {
      // Вставляем выбранный эмодзи в поле ввода
      targetInput.value += emoji;
      // Устанавливаем фокус обратно на поле ввода
      targetInput.focus();
      // Закрываем панель
      emojiPanel.remove();
      // Вызываем событие input, чтобы сработал обработчик печатания
      const event = new Event('input', { bubbles: true });
      targetInput.dispatchEvent(event);
    });
    emojiContainer.appendChild(emojiSpan);
  });
  
  emojiPanel.appendChild(emojiContainer);
  
  // Определяем позицию для панели
  const emojiBtn = document.querySelector('.emoji-btn');
  const rect = emojiBtn.getBoundingClientRect();
  
  // Позиционируем панель над кнопкой эмодзи
  emojiPanel.style.position = 'absolute';
  emojiPanel.style.bottom = `${window.innerHeight - rect.top + 5}px`;
  emojiPanel.style.left = `${rect.left}px`;
  
  // Добавляем панель в документ
  document.body.appendChild(emojiPanel);
  
  // Закрытие панели при клике вне её
  document.addEventListener('click', function closePanel(e) {
    if (!emojiPanel.contains(e.target) && 
        e.target !== document.querySelector('.emoji-btn') && 
        document.body.contains(emojiPanel)) {
      emojiPanel.remove();
      document.removeEventListener('click', closePanel);
    }
  });
}

// Экспортируем функцию для использования в основном файле
window.openEmojiPanel = openEmojiPanel;
