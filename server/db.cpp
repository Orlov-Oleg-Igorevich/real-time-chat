#include "db.hpp"
#include <stdexcept>

Db::Db(const std::string& file) {
    if (sqlite3_open(file.c_str(), &db_) != SQLITE_OK)
        throw std::runtime_error("Cannot open database");
    init();
}

Db::~Db() {
    sqlite3_close(db_);
}

void Db::init() {
    const char* sql =
        "CREATE TABLE IF NOT EXISTS messages ("
        "id INTEGER PRIMARY KEY,"
        "user_id INTEGER,"
        "text TEXT,"
        "ts DATETIME DEFAULT CURRENT_TIMESTAMP);";
    char* err = nullptr;
    if (sqlite3_exec(db_, sql, nullptr, nullptr, &err) != SQLITE_OK) {
        std::string e = err;
        sqlite3_free(err);
        throw std::runtime_error("DB init failed: " + e);
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