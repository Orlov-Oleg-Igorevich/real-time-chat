cmake_minimum_required(VERSION 3.28)
project(real_time_chat)

set(CMAKE_CXX_STANDARD 17)

find_package(nlohmann_json REQUIRED)

# Добавляем поддиректорию сервера
add_subdirectory(server)