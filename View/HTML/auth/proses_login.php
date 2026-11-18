<?php

declare(strict_types=1);

// =========================================
// SILAB - PROSES LOGIN FINAL
// =========================================

require_once __DIR__ . "/sesi.php";
require_once __DIR__ . "/../../config/database.php";

header("Content-Type: application/json; charset=UTF-8");

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
$plainPassword = $_POST["password"] ?? "";

if ($identifier === "" || $plainPassword === "") {
    responseJSON(false, "NIP/NPM dan password wajib diisi.");
}

if (!preg_match('/^[0-9]+$/', $identifier)) {
    responseJSON(false, "Format NIP/NPM tidak valid.");
}

// =========================================
// PROSES LOGIN
// =========================================

try {

    $stmt = $pdo->prepare("
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
    ");

    $stmt->execute([
        ":identifier" => $identifier
    ]);

    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        responseJSON(false, "NIP/NPM atau password salah.");
    }

    // Verifikasi password
    $passwordHash = (string) $user["password"];

    if (
        $passwordHash === "" ||
        !password_verify($plainPassword, $passwordHash)
    ) {
        responseJSON(false, "NIP/NPM atau password salah.");
    }

    // Periksa status akun
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

    // Periksa role
    $roleDiizinkan = [
        "kepala_lab",
        "laboran",
        "pengguna"
    ];

    if (!in_array($user["role"], $roleDiizinkan, true)) {
        responseJSON(false, "Role akun tidak dikenali.");
    }

    // Buat session
    session_regenerate_id(true);

    $_SESSION["id_user"] = $user["id_user"];
    $_SESSION["role"] = $user["role"];
    $_SESSION["nip_npm"] = $user["nip_npm"];
    $_SESSION["nama"] = $user["nama"];
    $_SESSION["login"] = true;

    responseJSON(
        true,
        "Login berhasil.",
        "aktif",
        $user["role"]
    );

} catch (PDOException $e) {

    error_log("LOGIN DATABASE ERROR: " . $e->getMessage());

    http_response_code(500);
    responseJSON(false, "Terjadi kesalahan pada database.");

} catch (Throwable $e) {

    error_log("LOGIN ERROR: " . $e->getMessage());

    http_response_code(500);
    responseJSON(false, "Terjadi kesalahan pada sistem.");
}
