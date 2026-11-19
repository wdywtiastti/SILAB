<?php

declare(strict_types=1);

// =============================================
// SILAB - API UBAH PASSWORD
// Digunakan oleh 3 Role
// =============================================

require_once __DIR__ . "/../auth/sesi.php";
require_once __DIR__ . "/../../config/database.php";

header("Content-Type: application/json; charset=UTF-8");

// =============================================
// RESPONSE JSON
// =============================================

function responsePassword(
    bool $success,
    string $message,
    int $code = 200
): void {

    http_response_code($code);

    echo json_encode([
        "success" => $success,
        "message" => $message
    ], JSON_UNESCAPED_UNICODE);

    exit;
}

// =============================================
// VALIDASI SESSION
// =============================================

if (!sudahLogin()) {
    responsePassword(
        false,
        "Sesi login berakhir. Silakan login kembali.",
        401
    );
}

$idUser = filter_var(
    $_SESSION["id_user"],
    FILTER_VALIDATE_INT,
    ["options" => ["min_range" => 1]]
);

$role = strtolower(trim((string) $_SESSION["role"]));

$allowedRoles = [
    "pengguna",
    "laboran",
    "kepala_lab",
    "kepala_laboratorium",
    "kepala laboratorium"
];

if (!$idUser || !in_array($role, $allowedRoles, true)) {
    responsePassword(
        false,
        "Akses tidak diizinkan.",
        403
    );
}

// =============================================
// VALIDASI METHOD
// =============================================

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    responsePassword(
        false,
        "Metode permintaan tidak diizinkan.",
        405
    );
}

// =============================================
// AMBIL DATA JSON
// =============================================

$input = json_decode(
    file_get_contents("php://input"),
    true
);

if (!is_array($input)) {
    responsePassword(
        false,
        "Format data tidak valid.",
        400
    );
}

// =============================================
// VALIDASI CSRF
// =============================================

$csrfToken = (string) ($input["csrf_token"] ?? "");

$sessionToken = (string) (
    $_SESSION["csrf_password"] ?? ""
);

if (
    $csrfToken === "" ||
    $sessionToken === "" ||
    !hash_equals($sessionToken, $csrfToken)
) {
    responsePassword(
        false,
        "Token keamanan tidak valid. Muat ulang halaman.",
        403
    );
}

// =============================================
// VALIDASI PASSWORD BARU
// =============================================

$passwordBaru = $input["password_baru"] ?? "";

if (!is_string($passwordBaru)) {
    responsePassword(
        false,
        "Password tidak valid.",
        422
    );
}

if (strlen($passwordBaru) < 8) {
    responsePassword(
        false,
        "Password minimal 8 karakter.",
        422
    );
}

if (strlen($passwordBaru) > 72) {
    responsePassword(
        false,
        "Password terlalu panjang.",
        422
    );
}

// =============================================
// PROSES UPDATE DATABASE
// =============================================

try {

    // Pastikan akun masih aktif.
    $stmt = $pdo->prepare("
        SELECT id_user
        FROM users
        WHERE id_user = :id_user
          AND role = :role
          AND status = 'aktif'
        LIMIT 1
    ");

    $stmt->execute([
        ":id_user" => $idUser,
        ":role" => $_SESSION["role"]
    ]);

    $akun = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$akun) {
        responsePassword(
            false,
            "Akun tidak ditemukan atau tidak aktif.",
            404
        );
    }

    // Enkripsi password.
    $passwordHash = password_hash(
        $passwordBaru,
        PASSWORD_DEFAULT
    );

    if ($passwordHash === false) {
        throw new RuntimeException(
            "Gagal mengenkripsi password."
        );
    }

    // Update hanya akun yang sedang login.
    $stmt = $pdo->prepare("
        UPDATE users
        SET password = :password
        WHERE id_user = :id_user
          AND role = :role
          AND status = 'aktif'
    ");

    $stmt->execute([
        ":password" => $passwordHash,
        ":id_user" => $idUser,
        ":role" => $_SESSION["role"]
    ]);

    if ($stmt->rowCount() !== 1) {
        throw new RuntimeException(
            "Password gagal diperbarui."
        );
    }

    // Token tidak digunakan kembali.
    unset($_SESSION["csrf_password"]);

    responsePassword(
        true,
        "Password berhasil diperbarui."
    );

} catch (Throwable $e) {

    error_log(
        "API UBAH PASSWORD: " . $e->getMessage()
    );

    responsePassword(
        false,
        "Terjadi kesalahan saat memperbarui password.",
        500
    );
}
