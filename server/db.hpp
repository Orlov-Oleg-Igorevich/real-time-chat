// C++
#pragma once
#include <sqlite3.h>
#include <string>
#include <functional>
#include <optional>

struct User {
    int id;
    std::string nickname;    // Уникальный никнейм для идентификации пользователя
    std::string display_name; // Отображаемое имя
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
    bool register_user(const std::string& nickname, const std::string& display_name, const std::string& password_hash);
    std::optional<User> login_user(const std::string& nickname, const std::string& password_hash);
    std::optional<User> get_user_by_id(int user_id);
    std::optional<User> get_user_by_nickname(const std::string& nickname);
    bool check_nickname_exists(const std::string& nickname); // Проверка существования никнейма

private:
    sqlite3* db_;
    void init();
};