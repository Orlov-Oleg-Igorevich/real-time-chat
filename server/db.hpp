// C++
#pragma once
#include <sqlite3.h>
#include <string>
#include <functional>

class Db {
public:
    explicit Db(const std::string& file);
    ~Db();

    void save_message(int user_id, const std::string& text);
    void load_messages(const std::function<void(int, const std::string&, const std::string&)>& callback);
    // функции регистрации / логина...

private:
    sqlite3* db_;
    void init();
};