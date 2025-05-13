find_package(nlohmann_json REQUIRED)
target_link_libraries(chat_server PRIVATE nlohmann_json::nlohmann_json)

cmake_minimum_required(VERSION 3.28)
project(real_time_chat)

set(CMAKE_CXX_STANDARD 17)
add_subdirectory(server)