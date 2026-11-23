<?php

declare(strict_types=1);

// =========================================
// SILAB - SESSION MANAGEMENT
// =========================================

define('SESSION_TIMEOUT', 300); // 5 menit tidak aktif
define('SESSION_MAX_LIFETIME', 28800); // maksimal 8 jam

// =========================================
// 1. KONFIGURASI SESSION
// =========================================

if (session_status() === PHP_SESSION_NONE) {

    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.use_trans_sid', '0');

    $isHttps = (
        (!empty($_SERVER['HTTPS']) &&
        $_SERVER['HTTPS'] !== 'off')
        ||
        (($_SERVER['SERVER_PORT'] ?? '') == 443)
    );

    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $isHttps,
        'httponly' => true,
        'samesite' => 'Lax'
    ]);

    session_start();
}

// =========================================
// 2. SESSION TIMEOUT
// =========================================

if (isset($_SESSION['login']) &&
    $_SESSION['login'] === true) {

    $sekarang = time();

    $aktivitasTerakhir =
        (int) ($_SESSION['last_activity'] ?? $sekarang);

    $waktuLogin =
        (int) ($_SESSION['login_time'] ?? $sekarang);

    $tidakAktif =
        ($sekarang - $aktivitasTerakhir) > SESSION_TIMEOUT;

    $maksimalWaktu =
        ($sekarang - $waktuLogin) > SESSION_MAX_LIFETIME;

    if ($tidakAktif || $maksimalWaktu) {

        $_SESSION = [];

        session_regenerate_id(true);

    } else {

        $_SESSION['last_activity'] = $sekarang;
    }
}

// =========================================
// 3. MEMERIKSA STATUS LOGIN
// =========================================

function sudahLogin(): bool
{
    return isset(
        $_SESSION['login'],
        $_SESSION['id_user'],
        $_SESSION['role']
    ) && $_SESSION['login'] === true;
}

// =========================================
// 4. IDENTITAS PENGGUNA
// =========================================

function penggunaLogin(): ?array
{
    if (!sudahLogin()) {
        return null;
    }

    return [
        'id_user' => $_SESSION['id_user'],
        'role' => $_SESSION['role'],
        'nip_npm' => $_SESSION['nip_npm'] ?? null,
        'nama' => $_SESSION['nama'] ?? null
    ];
}

// =========================================
// 5. PROTEKSI LOGIN
// =========================================

function wajibLogin(string $loginUrl): void
{
    if (!sudahLogin()) {

        header('Location: ' . $loginUrl);
        exit;
    }
}

// =========================================
// 6. PROTEKSI ROLE
// =========================================

function wajibRole(
    array $roleDiizinkan,
    string $loginUrl
): void {

    wajibLogin($loginUrl);

    if (!in_array(
        $_SESSION['role'],
        $roleDiizinkan,
        true
    )) {

        http_response_code(403);

        exit(
            '403 - Anda tidak memiliki akses ke halaman ini.'
        );
    }
}

// =========================================
// 7. LOGOUT
// =========================================

function logoutSILAB(): void
{
    $_SESSION = [];

    if (ini_get('session.use_cookies')) {

        $params = session_get_cookie_params();

        setcookie(
            session_name(),
            '',
            [
                'expires' => time() - 42000,
                'path' => $params['path'],
                'domain' => $params['domain'],
                'secure' => $params['secure'],
                'httponly' => $params['httponly'],
                'samesite' => $params['samesite']
            ]
        );
    }

    session_destroy();
}
