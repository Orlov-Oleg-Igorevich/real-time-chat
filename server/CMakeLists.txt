cmake_minimum_required(VERSION 3.28)
project(chat_server)

# Включаем поддержку OpenSSL для JWT и хеширования паролей
find_package(OpenSSL REQUIRED)
if(NOT OPENSSL_FOUND)
    message(FATAL_ERROR "OpenSSL not found")
endif()

add_executable(chat_server
    main.cpp
    chat_server.cpp
    db.cpp)

target_include_directories(chat_server PRIVATE 
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_CURRENT_SOURCE_DIR}/jwt-cpp/include
)
find_package(Boost REQUIRED COMPONENTS system thread)
find_package(nlohmann_json REQUIRED)
target_link_libraries(chat_server PRIVATE 
    Boost::system 
    Boost::thread 
    sqlite3 
    OpenSSL::SSL 
    OpenSSL::Crypto 
    nlohmann_json::nlohmann_json)