<?php

declare(strict_types=1);

// =========================================
// SILAB - MANAJEMEN SESSION
// =========================================

// Konfigurasi keamanan session
if (session_status() === PHP_SESSION_NONE) {

    ini_set("session.use_strict_mode", "1");

    session_set_cookie_params([
        "lifetime" => 0,
        "path" => "/",
        "secure" => false,
        "httponly" => true,
        "samesite" => "Lax"
    ]);

    session_start();
}

// =========================================
// 1. MEMERIKSA STATUS LOGIN
// =========================================

function sudahLogin(): bool
{
    return isset(
        $_SESSION["login"],
        $_SESSION["id_user"],
        $_SESSION["role"]
    ) && $_SESSION["login"] === true;
}

// =========================================
// 2. MENGAMBIL IDENTITAS PENGGUNA
// =========================================

function penggunaLogin(): ?array
{
    if (!sudahLogin()) {
        return null;
    }

    return [
        "id_user" => $_SESSION["id_user"],
        "role" => $_SESSION["role"],
        "nip_npm" => $_SESSION["nip_npm"] ?? null,
        "nama" => $_SESSION["nama"] ?? null
    ];
}

// =========================================
// 3. MELINDUNGI HALAMAN
// =========================================

function wajibLogin(string $loginUrl): void
{
    if (!sudahLogin()) {
        header("Location: " . $loginUrl);
        exit;
    }
}

// =========================================
// 4. MEMERIKSA ROLE PENGGUNA
// =========================================

function wajibRole(
    array $roleDiizinkan,
    string $loginUrl
): void {

    wajibLogin($loginUrl);

    if (!in_array($_SESSION["role"], $roleDiizinkan, true)) {

        http_response_code(403);

        exit("403 - Anda tidak memiliki akses ke halaman ini.");
    }
}

// =========================================
// 5. MENGAKHIRI SESSION
// =========================================

function logoutSILAB(): void
{
    $_SESSION = [];

    if (ini_get("session.use_cookies")) {

        $params = session_get_cookie_params();

        setcookie(
            session_name(),
            "",
            [
                "expires" => time() - 42000,
                "path" => $params["path"],
                "domain" => $params["domain"],
                "secure" => $params["secure"],
                "httponly" => $params["httponly"],
                "samesite" => $params["samesite"]
            ]
        );
    }

    session_destroy();
}
