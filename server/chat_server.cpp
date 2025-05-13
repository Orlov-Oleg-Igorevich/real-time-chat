#include "chat_server.hpp"
#include <boost/asio/post.hpp>

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