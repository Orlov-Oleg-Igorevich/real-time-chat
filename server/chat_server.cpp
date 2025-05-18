#include "chat_server.hpp"
#include <boost/asio/post.hpp>
#include <iostream>
#include <functional> // для std::hash

class ChatSession : public std::enable_shared_from_this<ChatSession> {
public:
    ChatSession(tcp::socket socket, ChatServer& server)
        : ws_(std::move(socket)), server_(server), connected_(false) {}

    void start() {
        ws_.async_accept(
            [self = shared_from_this()](beast::error_code ec) {
                if (ec) {
                    std::cerr << "Error accepting WebSocket: " << ec.message() << std::endl;
                    return;
                }
                // Соединение установлено
                self->connected_ = true;
                std::cerr << "WebSocket accepted successfully" << std::endl;
                
                // Отправляем историю чата после успешного соединения
                self->server_.send_chat_history(self);
                
                // Начинаем чтение сообщений
                self->do_read();
            });
    }

    void send(const std::string& msg) {
        // Проверяем, установлено ли соединение
        if (!connected_) {
            std::cerr << "Attempting to send message before connection established, queueing: " << msg << std::endl;
            pending_messages_.push_back(msg);
            return;
        }
        
        // Используем post для избежания состояния гонки
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
    std::vector<std::string> pending_messages_; // Сообщения, ожидающие установки соединения
    bool connected_;                           // Флаг установленного соединения

    void do_read() {
        ws_.async_read(buffer_,
            [self = shared_from_this()](beast::error_code ec, std::size_t) {
                if (ec) {
                    self->server_.leave(self);
                    return;
                }
                auto data = beast::buffers_to_string(self->buffer_.data());
                self->buffer_.consume(self->buffer_.size());
                
                // Парсим JSON и сохраняем сообщение в БД
                try {
                    std::cerr << "Received raw data: " << data << std::endl;
                    
                    json j = json::parse(data);
                    std::cerr << "Parsed JSON: type=" << j.value("type", "unknown") << std::endl;
                    
                    if (j.contains("type") && j["type"] == "register") {
                        // Обработка регистрации нового пользователя
                        std::cerr << "Register request from user: " << j.value("username", "unknown") << std::endl;
                        
                        if (j.contains("username") && j.contains("password")) {
                            std::string username = j["username"];
                            std::string password = j["password"];
                            
                            // Хэшируем пароль
                            std::string password_hash = Auth::hash_password(password);
                            
                            // Пытаемся зарегистрировать пользователя
                            bool success = self->server_.db().register_user(username, password_hash);
                            
                            json response;
                            if (success) {
                                // Получаем созданного пользователя
                                auto user = self->server_.db().get_user_by_name(username);
                                if (user) {
                                    // Создаем JWT токен
                                    std::string token = Auth::create_token(*user);
                                    
                                    response = {
                                        {"type", "register_response"},
                                        {"success", true},
                                        {"token", token},
                                        {"username", username}
                                    };
                                } else {
                                    response = {
                                        {"type", "register_response"},
                                        {"success", false},
                                        {"error", "Ошибка при создании пользователя"}
                                    };
                                }
                            } else {
                                response = {
                                    {"type", "register_response"},
                                    {"success", false},
                                    {"error", "Пользователь с таким именем уже существует"}
                                };
                            }
                            
                            // Отправляем ответ только текущему клиенту
                            self->send(response.dump());
                            self->do_read();
                            return;
                        }
                    }
                    else if (j.contains("type") && j["type"] == "login") {
                        // Обработка логина
                        std::cerr << "Login request from user: " << j.value("username", "unknown") << std::endl;
                        
                        if (j.contains("username") && j.contains("password")) {
                            std::string username = j["username"];
                            std::string password = j["password"];
                            
                            // Хэшируем пароль
                            std::string password_hash = Auth::hash_password(password);
                            
                            // Проверяем логин и пароль
                            auto user = self->server_.db().login_user(username, password_hash);
                            
                            json response;
                            if (user) {
                                // Создаем JWT токен
                                std::string token = Auth::create_token(*user);
                                
                                response = {
                                    {"type", "login_response"},
                                    {"success", true},
                                    {"token", token},
                                    {"username", user->username}
                                };
                            } else {
                                response = {
                                    {"type", "login_response"},
                                    {"success", false},
                                    {"error", "Неверное имя пользователя или пароль"}
                                };
                            }
                            
                            // Отправляем ответ только текущему клиенту
                            self->send(response.dump());
                            self->do_read();
                            return;
                        }
                    }
                    else if (j.contains("type") && j["type"] == "join") {
                        // Обработка сообщения "join" - пользователь присоединился
                        std::cerr << "Join message from user: " << j.value("user", "unknown") << std::endl;
                        
                        // Проверяем JWT токен если он есть
                        bool auth_success = false;
                        std::string username = j.value("user", "unknown");
                        
                        if (j.contains("token")) {
                            std::string token = j["token"];
                            auto user_id = Auth::verify_token(token);
                            
                            if (user_id) {
                                auto user = self->server_.db().get_user_by_id(*user_id);
                                if (user && user->username == username) {
                                    auth_success = true;
                                }
                            }
                        }
                        
                        if (!auth_success) {
                            json response = {
                                {"type", "auth_error"},
                                {"error", "Недействительный токен аутентификации"}
                            };
                            
                            // Отправляем ошибку только текущему клиенту
                            self->send(response.dump());
                            self->do_read();
                            return;
                        }
                        
                        // Отправляем всем только broadcast, чтобы все узнали о новом пользователе
                    }
                    else if (j.contains("type") && j["type"] == "clear_history") {
                        // Обработка команды очистки истории
                        std::cerr << "*** Clear history command received ***" << std::endl;
                        
                        // Очищаем историю чата
                        self->server_.clear_chat_history();
                        
                        // Не пересылаем это сообщение другим клиентам через broadcast
                        self->do_read();
                        return;
                    }
                    else if (j.contains("type") && j["type"] == "message" && j.contains("user") && j.contains("text")) {
                        std::string username = j["user"];
                        std::string message = j["text"];
                        std::cerr << "Message from " << username << ": " << message << std::endl;
                        
                        // Проверяем JWT токен если он есть
                        bool auth_success = false;
                        int user_id = 0;
                        
                        if (j.contains("token")) {
                            std::string token = j["token"];
                            auto verified_user_id = Auth::verify_token(token);
                            
                            if (verified_user_id) {
                                auto user = self->server_.db().get_user_by_id(*verified_user_id);
                                if (user && user->username == username) {
                                    auth_success = true;
                                    user_id = user->id;
                                }
                            }
                        }
                        
                        if (!auth_success) {
                            json response = {
                                {"type", "auth_error"},
                                {"error", "Недействительный токен аутентификации"}
                            };
                            
                            // Отправляем ошибку только текущему клиенту
                            self->send(response.dump());
                            self->do_read();
                            return;
                        }
                        
                        // Сохраняем оригинальное имя пользователя в поле text
                        // в формате JSON, чтобы восстановить позже
                        json msgObj;
                        msgObj["user"] = username;
                        msgObj["text"] = message;
                        std::string jsonText = msgObj.dump();
                        
                        self->server_.db().save_message(user_id, jsonText);
                        std::cerr << "Saved message to DB: user_id=" << user_id << ", content=" << jsonText << std::endl;
                    }
                } catch (const std::exception& e) {
                    // Ошибка парсинга JSON или сохранения в БД
                    std::cerr << "Error parsing/saving message: " << e.what() << std::endl;
                }
                
                self->server_.broadcast(data);           // рассылаем всем
                self->do_read();
            });
    }

    void do_write() {
        // Проверяем, что очередь не пуста и соединение установлено
        if (queue_.empty() || !connected_) {
            return;
        }
        
        ws_.async_write(boost::asio::buffer(queue_.front()),
            [self = shared_from_this()](beast::error_code ec, std::size_t) {
                if (ec) {
                    std::cerr << "Error writing to WebSocket: " << ec.message() << std::endl;
                    self->server_.leave(self);
                    return;
                }
                self->queue_.erase(self->queue_.begin());
                
                // Проверяем отложенные сообщения
                if (self->queue_.empty() && !self->pending_messages_.empty()) {
                    std::cerr << "Processing " << self->pending_messages_.size() << " pending messages" << std::endl;
                    for (const auto& msg : self->pending_messages_) {
                        self->queue_.push_back(msg);
                    }
                    self->pending_messages_.clear();
                }
                
                if (!self->queue_.empty()) self->do_write();
            });
    }
};


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
            // История будет отправлена после установки WebSocket соединения в ChatSession::start()
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
    std::cerr << "Broadcasting message: " << msg << std::endl;
    
    // Проверяем, что это валидный JSON
    try {
        json j = json::parse(msg);
        // Всё в порядке, JSON валидный
    } catch(const std::exception& e) {
        std::cerr << "Warning: Broadcast message is not valid JSON: " << e.what() << std::endl;
    }
    
    for (auto& s : sessions_) s->send(msg);
}

void ChatServer::send_chat_history(std::shared_ptr<ChatSession> session) {
    std::lock_guard<std::mutex> l(mtx_);
    db_.load_messages([session](int user_id, const std::string& text, const std::string& ts) {
        try {
            // Пытаемся распарсить сохраненный JSON
            json msgData;
            std::string username, messageText;
            
            try {
                msgData = json::parse(text);
                // Проверяем наличие полей user и text
                if (msgData.contains("user")) {
                    username = msgData["user"].get<std::string>();
                } else {
                    username = "User_" + std::to_string(user_id);
                }
                
                if (msgData.contains("text")) {
                    messageText = msgData["text"].get<std::string>();
                } else {
                    messageText = text;
                }
            } catch(...) {
                // Если не получилось распарсить как JSON, используем старый формат
                username = "User_" + std::to_string(user_id);
                messageText = text;
            }

            // Создаем JSON сообщение в формате, который ожидает клиент
            json msg;
            msg["type"] = "message";
            msg["user"] = username;
            msg["text"] = messageText;
            // timestamp не используется клиентом, но можем оставить для будущего использования
            msg["timestamp"] = ts;
            
            std::string json_str = msg.dump();
            std::cerr << "Sending history message: " << json_str << std::endl;
            session->send(json_str); // Отправляем сериализованный JSON
        } catch(const std::exception& e) {
            std::cerr << "Error sending chat history: " << e.what() << std::endl;
        }
    });
}

void ChatServer::clear_chat_history() {
    std::lock_guard<std::mutex> l(mtx_);
    try {
        std::cerr << "=======================================" << std::endl;
        std::cerr << "CLEARING CHAT HISTORY FROM DATABASE..." << std::endl;
        std::cerr << "=======================================" << std::endl;
        db_.clear_messages();
        
        // Отправляем всем клиентам сообщение о том, что история очищена
        json notification;
        notification["type"] = "system";
        notification["text"] = "История чата была очищена администратором";
        
        std::string notification_str = notification.dump();
        std::cerr << "Sending notification to all clients: " << notification_str << std::endl;
        for (auto& s : sessions_) s->send(notification_str);
        
        std::cerr << "=======================================" << std::endl;
        std::cerr << "CHAT HISTORY HAS BEEN CLEARED SUCCESSFULLY" << std::endl;
        std::cerr << "=======================================" << std::endl;
    } catch (const std::exception& e) {
        std::cerr << "ERROR CLEARING CHAT HISTORY: " << e.what() << std::endl;
    }
}