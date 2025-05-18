#include "db.hpp"
#include <stdexcept>
#include <iostream>

Db::Db(const std::string& file) {
    if (sqlite3_open(file.c_str(), &db_) != SQLITE_OK)
        throw std::runtime_error("Cannot open database");
    init();
}

Db::~Db() {
    sqlite3_close(db_);
}

void Db::init() {
    const char* messages_sql =
        "CREATE TABLE IF NOT EXISTS messages ("
        "id INTEGER PRIMARY KEY,"
        "user_id INTEGER,"
        "text TEXT,"
        "ts DATETIME DEFAULT CURRENT_TIMESTAMP);";
    
    const char* users_sql =
        "CREATE TABLE IF NOT EXISTS users ("
        "id INTEGER PRIMARY KEY,"
        "nickname TEXT UNIQUE NOT NULL," // Уникальный никнейм пользователя
        "display_name TEXT NOT NULL,"    // Отображаемое имя пользователя
        "password_hash TEXT NOT NULL);";
    
    // Миграция старой схемы при необходимости (если таблица существует в старом формате)
    const char* check_column_sql = 
        "SELECT COUNT(*) FROM pragma_table_info('users') WHERE name='display_name';";
    
    char* err = nullptr;
    if (sqlite3_exec(db_, messages_sql, nullptr, nullptr, &err) != SQLITE_OK) {
        std::string e = err;
        sqlite3_free(err);
        throw std::runtime_error("DB messages table init failed: " + e);
    }

    if (sqlite3_exec(db_, users_sql, nullptr, nullptr, &err) != SQLITE_OK) {
        std::string e = err;
        sqlite3_free(err);
        throw std::runtime_error("DB users table init failed: " + e);
    }
    
    // Проверяем, нужна ли миграция данных
    sqlite3_stmt* stmt;
    bool needs_migration = false;
    
    if (sqlite3_prepare_v2(db_, check_column_sql, -1, &stmt, nullptr) == SQLITE_OK) {
        if (sqlite3_step(stmt) == SQLITE_ROW) {
            int has_display_name = sqlite3_column_int(stmt, 0);
            needs_migration = (has_display_name == 0);
        }
        sqlite3_finalize(stmt);
    }
    
    // Если нужна миграция, выполняем её
    if (needs_migration) {
        const char* migration_sql[] = {
            "BEGIN TRANSACTION;",
            "ALTER TABLE users RENAME TO users_old;",
            "CREATE TABLE users ("
            "id INTEGER PRIMARY KEY,"
            "nickname TEXT UNIQUE NOT NULL,"
            "display_name TEXT NOT NULL,"
            "password_hash TEXT NOT NULL);",
            "INSERT INTO users (id, nickname, display_name, password_hash) "
            "SELECT id, username, username, password_hash FROM users_old;",
            "DROP TABLE users_old;",
            "COMMIT;"
        };
        
        for (const char* sql : migration_sql) {
            if (sqlite3_exec(db_, sql, nullptr, nullptr, &err) != SQLITE_OK) {
                std::string e = err;
                sqlite3_free(err);
                sqlite3_exec(db_, "ROLLBACK;", nullptr, nullptr, nullptr);
                std::cerr << "Migration failed: " << e << std::endl;
                break;
            }
        }
    }
}

void Db::save_message(int user_id, const std::string& text) {
    const char* sql = "INSERT INTO messages(user_id, text) VALUES(?, ?);";
    sqlite3_stmt* stmt;
    sqlite3_prepare_v2(db_, sql, -1, &stmt, nullptr);
    sqlite3_bind_int(stmt, 1, user_id);
    sqlite3_bind_text(stmt, 2, text.c_str(), -1, SQLITE_TRANSIENT);
    if (sqlite3_step(stmt) != SQLITE_DONE) {
        sqlite3_finalize(stmt);
        throw std::runtime_error("Failed to save message");
    }
    sqlite3_finalize(stmt);
}

void Db::load_messages(const std::function<void(int, const std::string&, const std::string&)>& callback) {
    const char* sql = "SELECT user_id, text, ts FROM messages ORDER BY id ASC;";
    sqlite3_stmt* stmt;
    if (sqlite3_prepare_v2(db_, sql, -1, &stmt, nullptr) != SQLITE_OK) {
        throw std::runtime_error("Failed to load messages");
    }
    while (sqlite3_step(stmt) == SQLITE_ROW) {
        int user_id = sqlite3_column_int(stmt, 0);
        const char* text = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 1));
        const char* ts = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 2));
        callback(user_id, text, ts);
    }
    sqlite3_finalize(stmt);
}

void Db::clear_messages() {
    const char* sql = "DELETE FROM messages;";
    char* err = nullptr;
    if (sqlite3_exec(db_, sql, nullptr, nullptr, &err) != SQLITE_OK) {
        std::string e = err;
        sqlite3_free(err);
        throw std::runtime_error("Failed to clear messages: " + e);
    }
}

bool Db::register_user(const std::string& nickname, const std::string& display_name, const std::string& password_hash) {
    const char* sql = "INSERT INTO users(nickname, display_name, password_hash) VALUES(?, ?, ?);";
    sqlite3_stmt* stmt;
    
    if (sqlite3_prepare_v2(db_, sql, -1, &stmt, nullptr) != SQLITE_OK) {
        return false;
    }
    
    sqlite3_bind_text(stmt, 1, nickname.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(stmt, 2, display_name.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(stmt, 3, password_hash.c_str(), -1, SQLITE_TRANSIENT);
    
    bool result = sqlite3_step(stmt) == SQLITE_DONE;
    sqlite3_finalize(stmt);
    
    return result;
}

std::optional<User> Db::login_user(const std::string& nickname, const std::string& password_hash) {
    const char* sql = "SELECT id, nickname, display_name, password_hash FROM users WHERE nickname = ? AND password_hash = ? LIMIT 1;";
    sqlite3_stmt* stmt;
    
    if (sqlite3_prepare_v2(db_, sql, -1, &stmt, nullptr) != SQLITE_OK) {
        return std::nullopt;
    }
    
    sqlite3_bind_text(stmt, 1, nickname.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(stmt, 2, password_hash.c_str(), -1, SQLITE_TRANSIENT);
    
    if (sqlite3_step(stmt) == SQLITE_ROW) {
        User user;
        user.id = sqlite3_column_int(stmt, 0);
        user.nickname = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 1));
        user.display_name = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 2));
        user.password_hash = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 3));
        
        sqlite3_finalize(stmt);
        return user;
    }
    
    sqlite3_finalize(stmt);
    return std::nullopt;
}

std::optional<User> Db::get_user_by_id(int user_id) {
    const char* sql = "SELECT id, nickname, display_name, password_hash FROM users WHERE id = ? LIMIT 1;";
    sqlite3_stmt* stmt;
    
    if (sqlite3_prepare_v2(db_, sql, -1, &stmt, nullptr) != SQLITE_OK) {
        return std::nullopt;
    }
    
    sqlite3_bind_int(stmt, 1, user_id);
    
    if (sqlite3_step(stmt) == SQLITE_ROW) {
        User user;
        user.id = sqlite3_column_int(stmt, 0);
        user.nickname = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 1));
        user.display_name = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 2));
        user.password_hash = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 3));
        
        sqlite3_finalize(stmt);
        return user;
    }
    
    sqlite3_finalize(stmt);
    return std::nullopt;
}

std::optional<User> Db::get_user_by_nickname(const std::string& nickname) {
    const char* sql = "SELECT id, nickname, display_name, password_hash FROM users WHERE nickname = ? LIMIT 1;";
    sqlite3_stmt* stmt;
    
    if (sqlite3_prepare_v2(db_, sql, -1, &stmt, nullptr) != SQLITE_OK) {
        return std::nullopt;
    }
    
    sqlite3_bind_text(stmt, 1, nickname.c_str(), -1, SQLITE_TRANSIENT);
    
    if (sqlite3_step(stmt) == SQLITE_ROW) {
        User user;
        user.id = sqlite3_column_int(stmt, 0);
        user.nickname = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 1));
        user.display_name = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 2));
        user.password_hash = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 3));
        
        sqlite3_finalize(stmt);
        return user;
    }
    
    sqlite3_finalize(stmt);
    return std::nullopt;
}

bool Db::check_nickname_exists(const std::string& nickname) {
    const char* sql = "SELECT COUNT(*) FROM users WHERE nickname = ? LIMIT 1;";
    sqlite3_stmt* stmt;
    
    if (sqlite3_prepare_v2(db_, sql, -1, &stmt, nullptr) != SQLITE_OK) {
        return false; // В случае ошибки возвращаем false
    }
    
    sqlite3_bind_text(stmt, 1, nickname.c_str(), -1, SQLITE_TRANSIENT);
    
    bool exists = false;
    if (sqlite3_step(stmt) == SQLITE_ROW) {
        int count = sqlite3_column_int(stmt, 0);
        exists = (count > 0);
    }
    
    sqlite3_finalize(stmt);
    return exists;
}