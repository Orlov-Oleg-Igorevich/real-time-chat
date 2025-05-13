const username = localStorage.getItem("username") || prompt("Введите ваше имя:") || "Аноним";
localStorage.setItem("username", username);

// Удалено сохранение сообщений в localStorage
const savedMessages = [];
const messagesList = document.getElementById("messages");

const ws = new WebSocket("ws://" + location.hostname + ":9002");

ws.onopen = () => {
  console.log("Connected to chat server");
  ws.send(JSON.stringify({ type: "join", user: username }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === "join") {
    const li = document.createElement("li");
    li.textContent = `${data.user} присоединился`;
    li.className = "system-message";
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

  // Прокрутка вниз при появлении нового сообщения
  messagesList.scrollTop = messagesList.scrollHeight;
};

document.getElementById("form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("input");
  if (input.value) {
    ws.send(JSON.stringify({ type: "message", user: username, text: input.value }));
    input.value = "";
  }
});