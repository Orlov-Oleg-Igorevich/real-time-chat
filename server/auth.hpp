#pragma once
#include <string>
#include <jwt-cpp/jwt.h>
#include <openssl/evp.h>
#include <openssl/sha.h>
#include <iomanip>
#include <sstream>
#include "db.hpp"

// Ключ для подписи JWT - в реальном приложении должен храниться безопасно
// и быть более длинным и уникальным
const std::string JWT_SECRET = "secureJwtSecretKey2025";

class Auth {
public:
    static std::string hash_password(const std::string& password) {
        unsigned char hash[EVP_MAX_MD_SIZE];
        unsigned int hash_len;
        
        // Используем современный EVP интерфейс вместо устаревших SHA функций
        EVP_MD_CTX* ctx = EVP_MD_CTX_new();
        if (!ctx) {
            return ""; // Ошибка создания контекста
        }
        
        if (!EVP_DigestInit_ex(ctx, EVP_sha256(), nullptr)) {
            EVP_MD_CTX_free(ctx);
            return ""; // Ошибка инициализации
        }
        
        if (!EVP_DigestUpdate(ctx, password.c_str(), password.size())) {
            EVP_MD_CTX_free(ctx);
            return ""; // Ошибка обновления
        }
        
        if (!EVP_DigestFinal_ex(ctx, hash, &hash_len)) {
            EVP_MD_CTX_free(ctx);
            return ""; // Ошибка финализации
        }
        
        EVP_MD_CTX_free(ctx);
        
        // Преобразуем хеш в строку в шестнадцатеричном формате
        std::stringstream ss;
        for (unsigned int i = 0; i < hash_len; i++) {
            ss << std::hex << std::setw(2) << std::setfill('0') << static_cast<int>(hash[i]);
        }
        
        return ss.str();
    }

    // Создает JWT токен для пользователя
    static std::string create_token(const User& user) {
        auto token = jwt::create()
            .set_issuer("auth0")
            .set_type("JWS")
            .set_payload_claim("user_id", jwt::claim(std::to_string(user.id)))
            .set_payload_claim("nickname", jwt::claim(user.nickname))
            .set_payload_claim("display_name", jwt::claim(user.display_name))
            // Токен действителен 24 часа
            .set_expires_at(std::chrono::system_clock::now() + std::chrono::hours{24})
            .sign(jwt::algorithm::hs256{JWT_SECRET});
            
        return token;
    }

    // Проверяет JWT токен и возвращает ID пользователя
    static std::optional<int> verify_token(const std::string& token) {
        try {
            auto decoded = jwt::decode(token);
            
            // Проверка подписи и срока действия
            auto verifier = jwt::verify()
                .allow_algorithm(jwt::algorithm::hs256{JWT_SECRET})
                .with_issuer("auth0");
            
            verifier.verify(decoded);
            
            // Извлекаем ID пользователя из токена
            if (decoded.has_payload_claim("user_id")) {
                return std::stoi(decoded.get_payload_claim("user_id").as_string());
            } else {
                return std::nullopt;
            }
        } catch (std::exception& e) {
            std::cerr << "JWT verification error: " << e.what() << std::endl;
            return std::nullopt;
        }
        
        return std::nullopt;
    }
};
