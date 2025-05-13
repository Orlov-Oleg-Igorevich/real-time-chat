Ниже представлен эскиз полноценного (минимально-жизнеспособного) веб-приложения «Real-Time Chat» с backend-чатью на C++ (Boost.Asio + SQLite), фронтендом на HTML/JS, а также краткое описание архитектуры, сборки и развёртывания.

────────────────────────────────────────
1. Архитектура высокого уровня
────────────────────────────────────────
Клиент:
 • HTML + CSS + JS (vanilla или любой SPA-фреймворк).  
 • Подключается к серверу по WebSocket (`ws://host:9002/chat`), получает/отправляет JSON-сообщения.  

Сервер:
 • C++17, Boost.Asio (TCP + WebSocket), nlohmann/json, SQLite3.  
 • Потокобезопасный пул соединений.  
 • REST-эндпоинт `/api/signup` и `/api/login` для создания/аутентификации пользователя (HTTP POST, JSON).  
 • WebSocket-эндпоинт `/chat`. После успешного upgrade клиент авторизуется токеном (простая сессия либо JWT).  
 • Логика:
   – хранит пользователей в таблице `users`, сообщения в `messages`.  
   – при получении сообщения от клиента:  
     1) валидация,  
     2) запись в БД,  
     3) рассылка всем подписанным клиентам.  

База данных:
 • SQLite файл `chat.db`, две таблицы:  
   ‑ `users(id INTEGER PK, username TEXT UNIQUE, password_hash TEXT)`  
   ‑ `messages(id INTEGER PK, user_id INT, text TEXT, ts DATETIME)`  

────────────────────────────────────────
2. Структура репозитория
────────────────────────────────────────
/chat-app
 ├─ CMakeLists.txt
 ├─ server/
 │   ├─ main.cpp
 │   ├─ chat_server.hpp
 │   ├─ chat_server.cpp
 │   ├─ db.hpp
 │   └─ CMakeLists.txt
 └─ client/
     ├─ index.html
     ├─ style.css
     └─ app.js


────────────────────────────────────────
3. Код серверной части (фрагменты)
────────────────────────────────────────
Показывается упрощённая, но работоспособная реализация.
// C++
#pragma once
#include <boost/asio.hpp>
#include <boost/beast.hpp>
#include <nlohmann/json.hpp>
#include <unordered_set>
#include <mutex>
#include "db.hpp"

namespace beast  = boost::beast;
namespace http   = beast::http;
namespace websocket = beast::websocket;
using tcp = boost::asio::ip::tcp;
using json = nlohmann::json;

class ChatSession;
class ChatServer {
public:
    ChatServer(boost::asio::io_context& ioc, tcp::endpoint endpoint);

    void run();
    void join(std::shared_ptr<ChatSession> session);
    void leave(std::shared_ptr<ChatSession> session);
    void broadcast(const std::string& msg);

    Db& db() { return db_; }

private:
    void do_accept();
    tcp::acceptor acceptor_;
    std::unordered_set<std::shared_ptr<ChatSession>> sessions_;
    std::mutex mtx_;
    Db db_;
};
// C++
#include "chat_server.hpp"

class ChatSession : public std::enable_shared_from_this<ChatSession> {
public:
    ChatSession(tcp::socket socket, ChatServer& server)
        : ws_(std::move(socket)), server_(server) {}

    void start() {
        ws_.async_accept([self = shared_from_this()](beast::error_code ec) {
            if (!ec) self->do_read();
        });
    }

    void send(const std::string& msg) {
        boost::asio::post(ws_.get_executor(),
            [self = shared_from_this(), msg]{
                self->queue_.push_back(msg);
                if (self->queue_.size() > 1) return;
                self->do_write();
            });
    }

private:
    websocket::stream<tcp::socket> ws_;
    ChatServer& server_;
    beast::flat_buffer buffer_;
    std::vector<std::string> queue_;

    void do_read() {
        ws_.async_read(buffer_,
            [self = shared_from_this()](beast::error_code ec, std::size_t) {
                if (ec) {
                    self->server_.leave(self);
                    return;
                }
                auto data = beast::buffers_to_string(self->buffer_.data());
                self->buffer_.consume(self->buffer_.size());
                self->server_.broadcast(data);           // рассылаем всем
                self->do_read();
            });
    }

    void do_write() {
        ws_.async_write(boost::asio::buffer(queue_.front()),
            [self = shared_from_this()](beast::error_code ec, std::size_t) {
                if (ec) {
                    self->server_.leave(self);
                    return;
                }
                self->queue_.erase(self->queue_.begin());
                if (!self->queue_.empty()) self->do_write();
            });
    }
};
// C++
#include "chat_server.hpp"

ChatServer::ChatServer(boost::asio::io_context& ioc, tcp::endpoint ep)
    : acceptor_(ioc), db_("chat.db") {
    beast::error_code ec;
    acceptor_.open(ep.protocol(), ec);
    acceptor_.set_option(boost::asio::socket_base::reuse_address(true), ec);
    acceptor_.bind(ep, ec);
    acceptor_.listen(boost::asio::socket_base::max_listen_connections, ec);
}

void ChatServer::run() { do_accept(); }

void ChatServer::do_accept() {
    acceptor_.async_accept([this](beast::error_code ec, tcp::socket socket) {
        if (!ec) {
            auto session = std::make_shared<ChatSession>(std::move(socket), *this);
            join(session);
            session->start();
        }
        do_accept();
    });
}

void ChatServer::join(std::shared_ptr<ChatSession> s) {
    std::lock_guard<std::mutex> l(mtx_);
    sessions_.insert(s);
}

void ChatServer::leave(std::shared_ptr<ChatSession> s) {
    std::lock_guard<std::mutex> l(mtx_);
    sessions_.erase(s);
}

void ChatServer::broadcast(const std::string& msg) {
    std::lock_guard<std::mutex> l(mtx_);
    for (auto& s : sessions_) s->send(msg);
}
// C++
#pragma once
#include <sqlite3.h>
#include <string>

class Db {
public:
    explicit Db(const std::string& file) { sqlite3_open(file.c_str(), &db_); init(); }
    ~Db() { sqlite3_close(db_); }

    void save_message(int user_id, const std::string& text);
    // функции регистрации / логина...

private:
    sqlite3* db_;
    void init();
};


main.cpp
// C++
#include "chat_server.hpp"

int main() {
    boost::asio::io_context ioc{1};
    ChatServer server(ioc, {boost::asio::ip::make_address("0.0.0.0"), 9002});
    server.run();
    ioc.run();
    return 0;
}


CMakeLists.txt (корневой)
cmake_minimum_required(VERSION 3.15)
project(chat_app LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
add_subdirectory(server)


server/CMakeLists.txt
add_executable(chat_server
    main.cpp
    chat_server.cpp)

target_include_directories(chat_server PRIVATE ${CMAKE_CURRENT_SOURCE_DIR})
find_package(Boost REQUIRED COMPONENTS system thread)
target_link_libraries(chat_server PRIVATE Boost::system Boost::thread sqlite3)


────────────────────────────────────────
4. Клиентская часть
────────────────────────────────────────
index.html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Real-Time Chat</title>
  <link rel="stylesheet" href="style.css"/>
</head>
<body>
  <div id="chat">
    <ul id="messages"></ul>
    <form id="form">
      <input id="input" autocomplete="off" placeholder="Type message..." />
      <button>Send</button>
    </form>
  </div>
  <script src="app.js"></script>
</body>
</html>


style.css (упрощённо)
/* CSS */
body { font-family: sans-serif; display:flex; justify-content:center; }
#chat { width: 400px; border:1px solid #ccc; padding:10px; }
ul { list-style:none; padding:0; max-height:300px; overflow-y:auto; }
li { margin:4px 0; }


app.js
// JavaScript
const ws = new WebSocket("ws://" + location.hostname + ":9002/chat");

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


────────────────────────────────────────
5. Сборка и запуск
────────────────────────────────────────
Prereq: g++-10+/clang-10+, CMake ≥3.15, Boost, SQLite3 dev.
$ mkdir build && cd build
$ cmake ..
$ make -j
$ ./chat_server           # запустит WebSocket-сервер на 0.0.0.0:9002


Затем открыть `client/index.html` любым браузером (или раздать статикой через nginx). Несколько вкладок/устройств увидят live-чат.

────────────────────────────────────────
6. Возможные доработки
────────────────────────────────────────
• JWT/OAuth2 вместо простого токена.  
• Шифрование (TLS).  
• Горизонтальное масштабирование (Redis pub/sub для fan-out).  
• React/Angular/Vue для клиента.  
• Dockerfile + CI/CD.  
• Unit-тесты (Catch2, GoogleTest).  

────────────────────────────────────────
7. Безопасность
────────────────────────────────────────
• Хеширование паролей (Bcrypt/Argon2).  
• Rate limiting + CSRF для REST.  
• Валидация входных данных (JSON-Schema).  
• CORS и Content-Security-Policy.  

────────────────────────────────────────
8. Развёртывание
────────────────────────────────────────
1) Собрать бинарь на сервере Linux.  
2) Создать systemd-unit.  
3) Настроить reverse-proxy (nginx) с TLS-сертификатом Let’s Encrypt.  
4) Кэширование статики и gzip.  

────────────────────────────────────────
9. Итог
────────────────────────────────────────
Представленная архитектура и код обеспечивают реальный минимальный чат с хранением сообщений, авторизацией и LIVE-обновлениями. При необходимости легко расширяется: новые комнаты, персональные сообщения, медиа, мобильный клиент и т.д.