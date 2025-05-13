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