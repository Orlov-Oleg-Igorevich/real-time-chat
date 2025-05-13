#include "chat_server.hpp"
#include <boost/asio.hpp>

int main() {
    boost::asio::io_context ioc{1};
    ChatServer server(ioc, {boost::asio::ip::make_address("0.0.0.0"), 9002});
    server.run();
    ioc.run();
    return 0;
}