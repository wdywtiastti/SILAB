<?php

declare(strict_types=1);

// =========================================
// SILAB - PROSES LOGIN
// =========================================

require_once __DIR__ . "/sesi.php";
require_once __DIR__ . "/../../config/database.php";

header("Content-Type: application/json; charset=UTF-8");

// =========================================
// FUNGSI RESPONSE
// =========================================

function responseJSON(
    bool $success,
    string $message,
    ?string $status = null,
    ?string $role = null
): void {

    echo json_encode([
        "success" => $success,
        "message" => $message,
        "status" => $status,
        "role" => $role
    ]);

    exit;
}

// =========================================
// VALIDASI REQUEST
// =========================================

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    responseJSON(false, "Metode permintaan tidak diizinkan.");
}

// =========================================
// AMBIL INPUT
// =========================================

$identifier = trim($_POST["identifier"] ?? "");
$password = $_POST["password"] ?? "";

if ($identifier === "" || $password === "") {
    responseJSON(false, "NIP/NPM dan password wajib diisi.");
}

if (!preg_match('/^[0-9]+$/', $identifier)) {
    responseJSON(false, "Format NIP/NPM tidak valid.");
}

// =========================================
// CARI AKUN DI DATABASE
// =========================================

try {

    $query = "
        SELECT
            id_user,
            role,
            nip_npm,
            nama,
            password,
            status
        FROM users
        WHERE nip_npm = :identifier
        LIMIT 1
    ";

    $stmt = $pdo->prepare($query);

    $stmt->execute([
        ":identifier" => $identifier
    ]);

    $user = $stmt->fetch();

    // =====================================
    // PERIKSA PASSWORD
    // =====================================

    if (
        !$user ||
        !password_verify($password, $user["password"])
    ) {
        responseJSON(
            false,
            "NIP/NPM atau password salah."
        );
    }

    // =====================================
    // PERIKSA STATUS AKUN
    // =====================================

    $status = $user["status"];

    if ($status !== "aktif") {

        $pesanStatus = [
            "menunggu_verifikasi" =>
                "Akun Anda masih menunggu verifikasi.",

            "ditolak" =>
                "Pendaftaran akun Anda telah ditolak.",

            "nonaktif" =>
                "Akun Anda saat ini dinonaktifkan."
        ];

        responseJSON(
            false,
            $pesanStatus[$status] ?? "Status akun tidak dikenali.",
            $status
        );
    }

    // =====================================
    // PERIKSA ROLE
    // =====================================

    $roleDiizinkan = [
        "kepala_lab",
        "laboran",
        "pengguna"
    ];

    if (!in_array($user["role"], $roleDiizinkan, true)) {
        responseJSON(false, "Role akun tidak dikenali.");
    }

    // =====================================
    // BUAT SESSION
    // =====================================

    session_regenerate_id(true);

    $_SESSION["id_user"] = $user["id_user"];
    $_SESSION["role"] = $user["role"];
    $_SESSION["nip_npm"] = $user["nip_npm"];
    $_SESSION["nama"] = $user["nama"];
    $_SESSION["login"] = true;

    // =====================================
    // LOGIN BERHASIL
    // =====================================

    responseJSON(
        true,
        "Login berhasil.",
        "aktif",
        $user["role"]
    );

} catch (PDOException $e) {

    error_log("Database Login Error: " . $e->getMessage());

    http_response_code(500);

    responseJSON(
        false,
        "Terjadi kesalahan pada database."
    );

} catch (Throwable $e) {

    error_log("Login Error: " . $e->getMessage());

    http_response_code(500);

    responseJSON(
        false,
        "Terjadi kesalahan pada sistem."
    );
}
