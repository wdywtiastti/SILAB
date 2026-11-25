<?php

declare(strict_types=1);

// =========================================
// SILAB - API EDIT PROFIL
// Berlaku untuk Kepala Lab, Laboran, Pengguna
// =========================================

require_once __DIR__ . "/sesi.php";

header("Content-Type: application/json; charset=UTF-8");

// =========================================
// RESPONSE JSON
// =========================================

function responseProfil(
    bool $success,
    string $message,
    int $code = 200,
    array $data = []
): void {

    http_response_code($code);

    echo json_encode(
        array_merge([
            "success" => $success,
            "message" => $message
        ], $data),
        JSON_UNESCAPED_UNICODE
    );

    exit;
}

// =========================================
// AUTENTIKASI
// =========================================

if (!sudahLogin()) {
    responseProfil(
        false,
        "Silakan login kembali.",
        401
    );
}

$roleDiizinkan = [
    "kepala_lab",
    "laboran",
    "pengguna"
];

if (!in_array($_SESSION["role"] ?? "", $roleDiizinkan, true)) {
    responseProfil(
        false,
        "Anda tidak memiliki akses.",
        403
    );
}

// =========================================
// VALIDASI METHOD
// =========================================

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    header("Allow: POST");

    responseProfil(
        false,
        "Metode request tidak diizinkan.",
        405
    );
}

// =========================================
// VALIDASI CSRF
// =========================================

$token = $_POST["csrf_token"] ?? "";
$tokenSession = $_SESSION["csrf_profile"] ?? "";

if (
    !is_string($token) ||
    !is_string($tokenSession) ||
    $token === "" ||
    $tokenSession === "" ||
    !hash_equals($tokenSession, $token)
) {
    responseProfil(
        false,
        "Permintaan tidak valid. Silakan muat ulang halaman.",
        403
    );
}

// =========================================
// AMBIL INPUT
// =========================================

$idUser = (int) $_SESSION["id_user"];

$nama = trim($_POST["nama"] ?? "");
$nipNpm = trim($_POST["nip_npm"] ?? "");
$passwordBaru = $_POST["password_baru"] ?? "";

// =========================================
// VALIDASI NAMA
// =========================================

if ($nama === "") {
    responseProfil(
        false,
        "Nama lengkap wajib diisi.",
        422
    );
}

if (mb_strlen($nama) > 100) {
    responseProfil(
        false,
        "Nama maksimal 100 karakter.",
        422
    );
}

// =========================================
// VALIDASI NIP / NPM
// =========================================

if (
    $nipNpm === "" ||
    strlen($nipNpm) > 30 ||
    !preg_match('/^[0-9]+$/', $nipNpm)
) {
    responseProfil(
        false,
        "Format NIP/NPM tidak valid.",
        422
    );
}

// =========================================
// VALIDASI PASSWORD BARU
// =========================================

if (!is_string($passwordBaru)) {
    responseProfil(
        false,
        "Format password tidak valid.",
        422
    );
}

if (
    $passwordBaru !== "" &&
    (
        strlen($passwordBaru) < 8 ||
        strlen($passwordBaru) > 72
    )
) {
    responseProfil(
        false,
        "Password baru harus 8 sampai 72 karakter.",
        422
    );
}

// =========================================
// KONEKSI DATABASE
// =========================================

require_once __DIR__ . "/../../config/database.php";

try {

    // =====================================
    // PERIKSA AKUN YANG SEDANG LOGIN
    // =====================================

    $cekUser = $pdo->prepare("
        SELECT id_user, role, status
        FROM users
        WHERE id_user = :id
        LIMIT 1
    ");

    $cekUser->execute([
        ":id" => $idUser
    ]);

    $user = $cekUser->fetch(PDO::FETCH_ASSOC);

    if (!$user || $user["status"] !== "aktif") {
        responseProfil(
            false,
            "Akun tidak ditemukan atau sudah tidak aktif.",
            403
        );
    }

    if ($user["role"] !== $_SESSION["role"]) {
        responseProfil(
            false,
            "Identitas akun tidak valid.",
            403
        );
    }

    // =====================================
    // CEK NIP/NPM DUPLIKAT
    // =====================================

    $cekNip = $pdo->prepare("
        SELECT id_user
        FROM users
        WHERE nip_npm = :nip
        AND id_user != :id
        LIMIT 1
    ");

    $cekNip->execute([
        ":nip" => $nipNpm,
        ":id" => $idUser
    ]);

    if ($cekNip->fetch()) {
        responseProfil(
            false,
            "NIP/NPM sudah digunakan akun lain.",
            409
        );
    }

    // =====================================
    // SIMPAN PROFIL
    // =====================================

    if ($passwordBaru !== "") {

        $passwordHash = password_hash(
            $passwordBaru,
            PASSWORD_DEFAULT
        );

        $stmt = $pdo->prepare("
            UPDATE users
            SET
                nama = :nama,
                nip_npm = :nip,
                password = :password
            WHERE id_user = :id
            AND status = 'aktif'
        ");

        $stmt->execute([
            ":nama" => $nama,
            ":nip" => $nipNpm,
            ":password" => $passwordHash,
            ":id" => $idUser
        ]);

    } else {

        $stmt = $pdo->prepare("
            UPDATE users
            SET
                nama = :nama,
                nip_npm = :nip
            WHERE id_user = :id
            AND status = 'aktif'
        ");

        $stmt->execute([
            ":nama" => $nama,
            ":nip" => $nipNpm,
            ":id" => $idUser
        ]);
    }

    // =====================================
    // PERBARUI SESSION
    // =====================================

    $_SESSION["nama"] = $nama;
    $_SESSION["nip_npm"] = $nipNpm;

    // =====================================
    // RESPONSE BERHASIL
    // =====================================

    responseProfil(
        true,
        "Profil berhasil diperbarui.",
        200,
        [
            "data" => [
                "nama" => $nama,
                "nip_npm" => $nipNpm
            ]
        ]
    );

} catch (PDOException $e) {

    error_log(
        "SILAB EDIT PROFIL DATABASE: " . $e->getMessage()
    );

    if ($e->getCode() === "23000") {
        responseProfil(
            false,
            "NIP/NPM sudah digunakan akun lain.",
            409
        );
    }

    responseProfil(
        false,
        "Terjadi kesalahan saat menyimpan profil.",
        500
    );

} catch (Throwable $e) {

    error_log(
        "SILAB EDIT PROFIL ERROR: " . $e->getMessage()
    );

    responseProfil(
        false,
        "Terjadi kesalahan pada sistem.",
        500
    );
}
