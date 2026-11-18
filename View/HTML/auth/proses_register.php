<?php

declare(strict_types=1);

// =========================================
// SILAB - PROSES REGISTRASI FINAL
// =========================================

header("Content-Type: application/json; charset=UTF-8");

function responseJSON(
    bool $success,
    string $message,
    ?string $field = null
): void {
    echo json_encode([
        "success" => $success,
        "message" => $message,
        "field" => $field
    ]);
    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    responseJSON(false, "Metode permintaan tidak diizinkan.");
}

// =========================================
// AMBIL DATA FORM
// Gunakan plainPassword agar tidak bentrok
// dengan variabel password database.php
// =========================================

$nama = trim($_POST["nama"] ?? "");
$identifier = trim($_POST["identifier"] ?? "");
$noTelp = trim($_POST["no_telp"] ?? "");

$plainPassword = $_POST["password"] ?? "";
$confirmPassword = $_POST["confirm_password"] ?? "";

$terms = $_POST["terms"] ?? "";

// =========================================
// VALIDASI
// =========================================

if ($nama === "") {
    responseJSON(false, "Nama lengkap wajib diisi.", "nama");
}

if ($identifier === "" || !preg_match('/^[0-9]+$/', $identifier)) {
    responseJSON(false, "NIP/NPM tidak valid.", "identifier");
}

if ($noTelp === "" || !preg_match('/^[0-9]+$/', $noTelp)) {
    responseJSON(false, "Nomor telepon tidak valid.", "no_telp");
}

if (strlen($plainPassword) < 8) {
    responseJSON(false, "Password minimal 8 karakter.", "password");
}

if ($plainPassword !== $confirmPassword) {
    responseJSON(false, "Password dan konfirmasi password tidak sama.", "confirm_password");
}

if ($terms !== "1") {
    responseJSON(false, "Silakan setujui syarat dan ketentuan.", "terms");
}

// =========================================
// DATABASE DAN REGISTRASI
// =========================================

try {

    require_once __DIR__ . "/../../config/database.php";

    // Periksa NPM duplikat
    $stmt = $pdo->prepare("
        SELECT id_user
        FROM users
        WHERE nip_npm = :identifier
        LIMIT 1
    ");

    $stmt->execute([
        ":identifier" => $identifier
    ]);

    if ($stmt->fetch()) {
        http_response_code(409);
        responseJSON(
            false,
            "NIP/NPM sudah terdaftar. Gunakan NIP/NPM lain.",
            "identifier"
        );
    }

    // Buat hash dari password pengguna
    $passwordHash = password_hash(
        $plainPassword,
        PASSWORD_DEFAULT
    );

    if ($passwordHash === false) {
        throw new RuntimeException("Gagal membuat hash password.");
    }

    // Simpan akun
    $stmt = $pdo->prepare("
        INSERT INTO users (
            role,
            nip_npm,
            nama,
            no_telepon,
            password,
            status
        )
        VALUES (
            :role,
            :nip_npm,
            :nama,
            :no_telepon,
            :password,
            :status
        )
    ");

    $stmt->execute([
        ":role" => "pengguna",
        ":nip_npm" => $identifier,
        ":nama" => $nama,
        ":no_telepon" => $noTelp,
        ":password" => $passwordHash,
        ":status" => "menunggu_verifikasi"
    ]);

    // Verifikasi hash setelah disimpan
    $stmt = $pdo->prepare("
        SELECT password
        FROM users
        WHERE nip_npm = :identifier
        LIMIT 1
    ");

    $stmt->execute([
        ":identifier" => $identifier
    ]);

    $akun = $stmt->fetch(PDO::FETCH_ASSOC);

    if (
        !$akun ||
        !password_verify($plainPassword, $akun["password"])
    ) {
        throw new RuntimeException(
            "Verifikasi password setelah penyimpanan gagal."
        );
    }

    http_response_code(201);

    responseJSON(
        true,
        "Pendaftaran berhasil. Akun Anda sedang menunggu verifikasi."
    );

} catch (PDOException $e) {

    error_log("REGISTER DATABASE ERROR: " . $e->getMessage());

    if ($e->getCode() === "23000") {
        http_response_code(409);
        responseJSON(
            false,
            "NIP/NPM sudah terdaftar.",
            "identifier"
        );
    }

    http_response_code(500);
    responseJSON(false, "Terjadi kesalahan pada database.");

} catch (Throwable $e) {

    error_log("REGISTER ERROR: " . $e->getMessage());

    http_response_code(500);
    responseJSON(false, "Terjadi kesalahan pada sistem.");
}
