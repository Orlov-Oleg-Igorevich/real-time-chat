// C++
#pragma once
#include <sqlite3.h>
#include <string>
#include <functional>
#include <optional>

struct User {
    int id;
    std::string username;
    std::string password_hash;
};

class Db {
public:
    explicit Db(const std::string& file);
    ~Db();

    void save_message(int user_id, const std::string& text);
    void load_messages(const std::function<void(int, const std::string&, const std::string&)>& callback);
    void clear_messages(); // Новый метод для очистки истории сообщений
    
    // Методы для работы с пользователями
    bool register_user(const std::string& username, const std::string& password_hash);
    std::optional<User> login_user(const std::string& username, const std::string& password_hash);
    std::optional<User> get_user_by_id(int user_id);
    std::optional<User> get_user_by_name(const std::string& username);

private:
    sqlite3* db_;
    void init();
};