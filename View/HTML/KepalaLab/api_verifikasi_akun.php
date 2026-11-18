<?php

declare(strict_types=1);

// =========================================
// SILAB - API VERIFIKASI AKUN
// =========================================

require_once __DIR__ . "/../auth/sesi.php";

header("Content-Type: application/json; charset=UTF-8");

function apiResponse(
    bool $success,
    string $message,
    array $data = []
): void {
    echo json_encode(array_merge([
        "success" => $success,
        "message" => $message
    ], $data));

    exit;
}

// Proteksi khusus Kepala Lab
if (
    !sudahLogin() ||
    ($_SESSION["role"] ?? null) !== "kepala_lab"
) {
    http_response_code(403);
    apiResponse(false, "Anda tidak memiliki akses.");
}

require_once __DIR__ . "/../../config/database.php";

// =========================================
// AMBIL DAFTAR AKUN
// =========================================

if ($_SERVER["REQUEST_METHOD"] === "GET") {

    try {

        $stmt = $pdo->query("
            SELECT
                id_user,
                nama,
                nip_npm,
                role,
                status
            FROM users
            WHERE status IN (
                'menunggu_verifikasi',
                'ditolak'
            )
            ORDER BY
                CASE
                    WHEN status = 'menunggu_verifikasi' THEN 1
                    WHEN status = 'ditolak' THEN 2
                END,
                id_user DESC
        ");

        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $data = array_map(function ($user) {
            return [
                "id" => $user["id_user"],
                "nama" => $user["nama"],
                "nipNpm" => $user["nip_npm"],
                "role" => $user["role"],
                "status" => $user["status"]
            ];
        }, $users);

        apiResponse(true, "Data akun berhasil dimuat.", [
            "users" => $data
        ]);

    } catch (PDOException $e) {

        error_log("API VERIFIKASI GET: " . $e->getMessage());

        http_response_code(500);
        apiResponse(false, "Gagal mengambil data akun.");
    }
}

// =========================================
// PROSES VERIFIKASI / PENOLAKAN
// =========================================

if ($_SERVER["REQUEST_METHOD"] === "POST") {

    $userId = filter_input(INPUT_POST, "user_id", FILTER_VALIDATE_INT);
    $action = $_POST["action"] ?? "";

    if (!$userId || !in_array(
        $action,
        ["approve", "reject", "reapprove"],
        true
    )) {
        http_response_code(400);
        apiResponse(false, "Permintaan tidak valid.");
    }

    try {

        if ($action === "approve") {

            $stmt = $pdo->prepare("
                UPDATE users
                SET status = 'aktif'
                WHERE id_user = :id
                AND status = 'menunggu_verifikasi'
            ");

            $message = "Akun berhasil diverifikasi.";

        } elseif ($action === "reject") {

            $stmt = $pdo->prepare("
                UPDATE users
                SET status = 'ditolak'
                WHERE id_user = :id
                AND status = 'menunggu_verifikasi'
            ");

            $message = "Akun berhasil ditolak.";

        } else {

            $stmt = $pdo->prepare("
                UPDATE users
                SET status = 'aktif'
                WHERE id_user = :id
                AND status = 'ditolak'
            ");

            $message = "Akun yang sebelumnya ditolak berhasil diverifikasi kembali.";
        }

        $stmt->execute([
            ":id" => $userId
        ]);

        if ($stmt->rowCount() !== 1) {
            apiResponse(
                false,
                "Status akun sudah berubah atau akun tidak ditemukan."
            );
        }

        apiResponse(true, $message);

    } catch (PDOException $e) {

        error_log("API VERIFIKASI POST: " . $e->getMessage());

        http_response_code(500);
        apiResponse(false, "Gagal memperbarui status akun.");
    }
}

// =========================================
// METODE TIDAK DIIZINKAN
// =========================================

http_response_code(405);
apiResponse(false, "Metode permintaan tidak diizinkan.");
