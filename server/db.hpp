// C++
#pragma once
#include <sqlite3.h>
#include <string>

class Db {
public:
    explicit Db(const std::string& file);
    ~Db();

    void save_message(int user_id, const std::string& text);
    // функции регистрации / логина...

private:
    sqlite3* db_;
    void init();
};