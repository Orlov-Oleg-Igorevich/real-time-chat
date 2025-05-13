const ws = new WebSocket("ws://" + location.hostname + ":9002");

ws.onopen = () => console.log("Connected to chat server");

ws.onmessage = (event) => {
  const li = document.createElement("li");
  li.textContent = event.data;
  document.getElementById("messages").appendChild(li);
};

document.getElementById("form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("input");
  if (input.value) {
    ws.send(input.value);
    input.value = "";
  }
});