<?php

declare(strict_types=1);

// =========================================
// SILAB - API MANAJEMEN USER
// =========================================

require_once __DIR__ . "/../auth/sesi.php";

wajibRole(["kepala_lab"], "../auth/login.php");

require_once __DIR__ . "/../../config/database.php";

header("Content-Type: application/json; charset=UTF-8");

function jsonResponse(
    bool $success,
    string $message,
    array $data = [],
    int $httpCode = 200
): void {
    http_response_code($httpCode);

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
// GET: AMBIL DATA PENGGUNA
// =========================================

if ($_SERVER["REQUEST_METHOD"] === "GET") {

    try {

        $stmt = $pdo->query("
            SELECT
                id_user,
                role,
                nip_npm,
                nama,
                no_telepon,
                status
            FROM users
            WHERE status IN ('aktif', 'nonaktif')
            ORDER BY id_user DESC
        ");

        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $summary = $pdo->query("
            SELECT
                COUNT(CASE WHEN status IN ('aktif', 'nonaktif') THEN 1 END) AS total,
                COUNT(CASE WHEN status = 'aktif' THEN 1 END) AS aktif,
                COUNT(CASE WHEN status = 'nonaktif' THEN 1 END) AS nonaktif,
                COUNT(CASE WHEN status = 'menunggu_verifikasi' THEN 1 END) AS menunggu
            FROM users
        ")->fetch(PDO::FETCH_ASSOC);

        jsonResponse(true, "Data pengguna berhasil dimuat.", [
            "users" => array_map(function ($user) {
                return [
                    "id" => (string) $user["id_user"],
                    "role" => $user["role"],
                    "nama" => $user["nama"],
                    "nipNpm" => $user["nip_npm"],
                    "noTelepon" => $user["no_telepon"],
                    "status" => $user["status"]
                ];
            }, $users),
            "summary" => $summary
        ]);

    } catch (PDOException $e) {

        error_log("MANAJEMEN USER GET: " . $e->getMessage());

        jsonResponse(false, "Gagal mengambil data pengguna.", [], 500);
    }
}

// =========================================
// POST: TAMBAH, EDIT, HAPUS
// =========================================

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    jsonResponse(false, "Metode tidak diizinkan.", [], 405);
}

$action = $_POST["action"] ?? "";

try {

    // =====================================
    // TAMBAH PENGGUNA
    // =====================================

    if ($action === "add") {

    $nama = trim($_POST["nama"] ?? "");
    $nipNpm = trim($_POST["nip_npm"] ?? "");
    $password = $_POST["password"] ?? "";
    $role = $_POST["role"] ?? "pengguna";

    $roleDiizinkan = [
        "laboran",
        "pengguna"
    ];

    if (!in_array($role, $roleDiizinkan, true)) {
        jsonResponse(
            false,
            "Role hanya boleh Laboran atau Pengguna.",
            [],
            422
        );
    }
        if ($nama === "" || $nipNpm === "" || $password === "") {
            jsonResponse(false, "Semua data wajib diisi.", [], 422);
        }

        if (mb_strlen($nama) > 100) {
            jsonResponse(false, "Nama maksimal 100 karakter.", [], 422);
        }

        if (strlen($nipNpm) > 30 || !preg_match('/^[0-9]+$/', $nipNpm)) {
            jsonResponse(false, "Format NIP/NPM tidak valid.", [], 422);
        }

        if (strlen($password) < 8) {
            jsonResponse(false, "Password minimal 8 karakter.", [], 422);
        }

        if (strlen($password) > 72) {
            jsonResponse(false, "Password maksimal 72 karakter.", [], 422);
        }

        $check = $pdo->prepare("
            SELECT id_user
            FROM users
            WHERE nip_npm = :nip
            LIMIT 1
        ");

        $check->execute([":nip" => $nipNpm]);

        if ($check->fetch()) {
            jsonResponse(false, "NIP/NPM sudah digunakan.", [], 409);
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);

        $stmt = $pdo->prepare("
INSERT INTO users (
    role,
    nip_npm,
    nama,
    no_telepon,
    password,
    status
) VALUES (
    :role,
    :nip,
    :nama,
    '',
    :password,
    'aktif'
)
        ");

        $stmt->execute([
            ":nip" => $nipNpm,
            ":nama" => $nama,
            ":password" => $hash,
            ":role" => $role,
        ]);

        jsonResponse(true, "Pengguna berhasil ditambahkan.");
    }

    // =====================================
    // EDIT PENGGUNA
    // =====================================

    if ($action === "update") {

        $id = filter_var(
            $_POST["id_user"] ?? null,
            FILTER_VALIDATE_INT
        );

        $nama = trim($_POST["nama"] ?? "");
        $nipNpm = trim($_POST["nip_npm"] ?? "");
        $status = $_POST["status"] ?? "";
        $password = $_POST["password"] ?? "";


        if (!$id || $nama === "" || $nipNpm === "") {
            jsonResponse(false, "Data pengguna tidak lengkap.", [], 422);
        }


$role = $_POST["role"] ?? "";

// =====================================
// CEK AKUN YANG AKAN DIEDIT
// =====================================

$cekTarget = $pdo->prepare("
    SELECT id_user, role
    FROM users
    WHERE id_user = :id
    AND status IN ('aktif', 'nonaktif')
    LIMIT 1
");

$cekTarget->execute([
    ":id" => $id
]);

$targetUser = $cekTarget->fetch(PDO::FETCH_ASSOC);

if (!$targetUser) {
    jsonResponse(false, "Pengguna tidak ditemukan.", [], 404);
}

// =====================================
// PERLINDUNGAN KEPALA LAB
// =====================================

if ($targetUser["role"] === "kepala_lab") {

    // Role Kepala Lab harus tetap
    $role = "kepala_lab";

} else {

    // Akun biasa hanya boleh Laboran atau Pengguna
    $roleDiizinkan = [
        "laboran",
        "pengguna"
    ];

    if (!in_array($role, $roleDiizinkan, true)) {
        jsonResponse(
            false,
            "Role hanya boleh Laboran atau Pengguna.",
            [],
            422
        );
    }
}


        if (mb_strlen($nama) > 100) {
            jsonResponse(false, "Nama maksimal 100 karakter.", [], 422);
        }

        if (strlen($nipNpm) > 30 || !preg_match('/^[0-9]+$/', $nipNpm)) {
            jsonResponse(false, "Format NIP/NPM tidak valid.", [], 422);
        }

        if (!in_array($status, ["aktif", "nonaktif"], true)) {
            jsonResponse(false, "Status akun tidak valid.", [], 422);
        }

        if ($password !== "" && (strlen($password) < 8 || strlen($password) > 72)) {
            jsonResponse(false, "Password harus 8 sampai 72 karakter.", [], 422);
        }

        $check = $pdo->prepare("
            SELECT id_user
            FROM users
            WHERE nip_npm = :nip
            AND id_user != :id
            LIMIT 1
        ");

        $check->execute([
            ":nip" => $nipNpm,
            ":id" => $id
        ]);

        if ($check->fetch()) {
            jsonResponse(false, "NIP/NPM sudah digunakan pengguna lain.", [], 409);
        }


        if ($password !== "") {

            $hash = password_hash($password, PASSWORD_DEFAULT);

            $stmt = $pdo->prepare("
                UPDATE users
                SET
                    nama = :nama,
                    nip_npm = :nip,
                    role = :role,
                    status = :status,
                    password = :password
                WHERE id_user = :id
                AND status IN ('aktif', 'nonaktif')
            ");

            $stmt->execute([
                ":nama" => $nama,
                ":nip" => $nipNpm,
                ":role" => $role,
                ":status" => $status,
                ":password" => $hash,
                ":id" => $id
            ]);

        } else {

            $stmt = $pdo->prepare("
                UPDATE users
                SET
                    nama = :nama,
                    nip_npm = :nip,
                    role = :role,
                    status = :status
                WHERE id_user = :id
                AND status IN ('aktif', 'nonaktif')
            ");

            $stmt->execute([
                ":nama" => $nama,
                ":nip" => $nipNpm,
                ":role" => $role,
                ":status" => $status,
                ":id" => $id
            ]);
        }


        if ($stmt->rowCount() === 0) {
            $exists = $pdo->prepare("
                SELECT id_user
                FROM users
                WHERE id_user = :id
                AND status IN ('aktif', 'nonaktif')
            ");

            $exists->execute([":id" => $id]);

            if (!$exists->fetch()) {
                jsonResponse(false, "Pengguna tidak ditemukan.", [], 404);
            }
        }

        // =====================================
// UPDATE SESSION JIKA YANG DIEDIT
// ADALAH AKUN YANG SEDANG LOGIN
// =====================================

if (
    isset($_SESSION["id_user"]) &&
    (string) $_SESSION["id_user"] === (string) $id
) {
    $_SESSION["nama"] = $nama;
    $_SESSION["nip_npm"] = $nipNpm;
    $_SESSION["role"] = $role;
}

        jsonResponse(true, "Data pengguna berhasil diperbarui.");
    }


// =====================================
// HAPUS PENGGUNA
// =====================================

if ($action === "delete") {

    $id = filter_var(
        $_POST["id_user"] ?? null,
        FILTER_VALIDATE_INT
    );

    if (!$id) {
        jsonResponse(false, "ID pengguna tidak valid.", [], 422);
    }

    // =================================
    // CEK AKUN TARGET
    // =================================

    $check = $pdo->prepare("
        SELECT id_user, role
        FROM users
        WHERE id_user = :id
        AND status IN ('aktif', 'nonaktif')
        LIMIT 1
    ");

    $check->execute([
        ":id" => $id
    ]);

    $targetUser = $check->fetch(PDO::FETCH_ASSOC);

    if (!$targetUser) {
        jsonResponse(false, "Pengguna tidak ditemukan.", [], 404);
    }

    // =================================
    // LARANG HAPUS AKUN SENDIRI
    // =================================

    $idLogin = $_SESSION["id_user"] ?? null;

    if (
        $idLogin !== null &&
        (string) $idLogin === (string) $targetUser["id_user"]
    ) {
        jsonResponse(
            false,
            "Anda tidak dapat menghapus akun sendiri.",
            [],
            403
        );
    }

    // =================================
    // LARANG HAPUS KEPALA LAB
    // =================================

    if ($targetUser["role"] === "kepala_lab") {
        jsonResponse(
            false,
            "Akun Kepala Lab tidak dapat dihapus.",
            [],
            403
        );
    }

    // =================================
    // HAPUS AKUN
    // =================================


$stmt = $pdo->prepare("
    UPDATE users
    SET status = 'dihapus'
    WHERE id_user = :id
    AND status IN ('aktif', 'nonaktif')
    AND role != 'kepala_lab'
");

$stmt->execute([
    ":id" => $id
]);

if ($stmt->rowCount() !== 1) {
    jsonResponse(
        false,
        "Pengguna gagal dihapus atau tidak ditemukan.",
        [],
        404
    );
}

jsonResponse(
    true,
    "Akun berhasil dihapus. Riwayat transaksi tetap tersimpan."
);


    $stmt->execute([
        ":id" => $id
    ]);

    if ($stmt->rowCount() !== 1) {
        jsonResponse(
            false,
            "Pengguna gagal dihapus atau tidak ditemukan.",
            [],
            404
        );
    }

    jsonResponse(true, "Pengguna berhasil dihapus.");
}


    jsonResponse(false, "Aksi tidak dikenali.", [], 400);


} catch (PDOException $e) {

    error_log("MANAJEMEN USER POST: " . $e->getMessage());

    if ($e->getCode() === "23000") {

        // Jika error terjadi saat menghapus akun
        if ($action === "delete") {
            jsonResponse(
                false,
                "Akun tidak dapat dihapus karena masih memiliki data terkait.",
                [],
                409
            );
        }

        // Jika error terjadi saat menambah atau mengedit
        jsonResponse(
            false,
            "NIP/NPM sudah terdaftar.",
            [],
            409
        );
    }

    jsonResponse(
        false,
        "Terjadi kesalahan pada database.",
        [],
        500
    );

} catch (Throwable $e) {

    error_log("MANAJEMEN USER ERROR: " . $e->getMessage());

    jsonResponse(
        false,
        "Terjadi kesalahan pada sistem.",
        [],
        500
    );
}
