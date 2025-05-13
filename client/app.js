const username = prompt("Введите ваше имя:") || "Аноним";

const ws = new WebSocket("ws://" + location.hostname + ":9002");

ws.onopen = () => {
  console.log("Connected to chat server");
  ws.send(JSON.stringify({ type: "join", user: username }));
};

ws.onmessage = (event) => {
  const li = document.createElement("li");
  li.textContent = event.data;
  document.getElementById("messages").appendChild(li);
};

document.getElementById("form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("input");
  if (input.value) {
    ws.send(JSON.stringify({ type: "message", user: username, text: input.value }));
    input.value = "";
  }
});