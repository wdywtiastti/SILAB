<?php

declare(strict_types=1);

// =============================================
// SILAB - API REKOMENDASI PENGGUNA
// =============================================

require_once __DIR__ . "/../auth/sesi.php";
require_once __DIR__ . "/../../config/database.php";

header("Content-Type: application/json; charset=UTF-8");

// =============================================
// RESPONSE JSON
// =============================================

function jsonResponse(
    bool $success,
    string $message,
    array $data = [],
    int $httpCode = 200
): void {
    http_response_code($httpCode);

    echo json_encode([
        "success" => $success,
        "message" => $message,
        "data" => $data
    ], JSON_UNESCAPED_UNICODE);

    exit;
}

// =============================================
// VALIDASI SESSION
// =============================================

if (
    !sudahLogin() ||
    ($_SESSION["role"] ?? "") !== "pengguna"
) {
    jsonResponse(false, "Akses ditolak. Silakan login.", [], 403);
}

$idUser = (int) ($_SESSION["id_user"] ?? 0);

if ($idUser <= 0) {
    jsonResponse(false, "Sesi pengguna tidak valid.", [], 401);
}

// =============================================
// FUNGSI BANTU
// =============================================

function getInput(): array
{
    $contentType = $_SERVER["CONTENT_TYPE"] ?? "";

    if (stripos($contentType, "application/json") !== false) {
        $input = json_decode(file_get_contents("php://input"), true);
        return is_array($input) ? $input : [];
    }

    return $_POST;
}

function validId($value): bool
{
    return filter_var(
        $value,
        FILTER_VALIDATE_INT,
        ["options" => ["min_range" => 1]]
    ) !== false;
}

$method = $_SERVER["REQUEST_METHOD"] ?? "GET";
$input = getInput();
$action = $input["action"] ?? $_GET["action"] ?? "";

try {

    // =========================================
    // 1. AMBIL REKOMENDASI
    // =========================================

    if ($method === "GET" && $action === "list") {

        // Perbarui rekomendasi yang sudah kedaluwarsa.
        $stmt = $pdo->prepare("
            UPDATE rekomendasi r
            INNER JOIN pengajuan p
                ON p.id_pengajuan = r.id_pengajuan
            SET r.status = 'Kedaluwarsa'
            WHERE p.id_user = :id_user
            AND r.status = 'Dikirim'
            AND r.batas_waktu IS NOT NULL
            AND r.batas_waktu <= NOW()
        ");

        $stmt->execute([":id_user" => $idUser]);

        // Nama pengguna.
        $stmt = $pdo->prepare("
            SELECT nama
            FROM users
            WHERE id_user = :id_user
            LIMIT 1
        ");

        $stmt->execute([":id_user" => $idUser]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        // Ambil rekomendasi yang masih menunggu.
        $stmt = $pdo->prepare("
            SELECT
                r.id_rekomendasi,
                r.id_pengajuan,
                r.catatan,
                r.status,
                r.waktu_dikirim,
                r.batas_waktu,
                p.nama_kegiatan,
                p.waktu_mulai AS waktu_mulai_awal,
                p.waktu_selesai AS waktu_selesai_awal

            FROM rekomendasi r

            INNER JOIN pengajuan p
                ON p.id_pengajuan = r.id_pengajuan

            WHERE p.id_user = :id_user
                AND r.status = 'Dikirim'
                AND (
                    r.batas_waktu IS NULL
                    OR r.batas_waktu > NOW()
                )

            ORDER BY
                r.waktu_dikirim DESC,
                r.id_rekomendasi DESC

            LIMIT 1
        ");

        $stmt->execute([":id_user" => $idUser]);

        $rekomendasi = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$rekomendasi) {
            jsonResponse(
                true,
                "Belum ada rekomendasi jadwal.",
                [
                    "nama_pengguna" => $user["nama"] ?? "Pengguna",
                    "recommendation" => null
                ]
            );
        }

        // Ambil alternatif jadwal.
        $stmt = $pdo->prepare("
            SELECT
                id_alternatif_rekomendasi,
                waktu_mulai,
                waktu_selesai,
                status

            FROM alternatif_rekomendasi

            WHERE id_rekomendasi = :id_rekomendasi

            ORDER BY waktu_mulai ASC
        ");

        $stmt->execute([
            ":id_rekomendasi" =>
                (int) $rekomendasi["id_rekomendasi"]
        ]);

        $alternatif = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $rekomendasi["id_rekomendasi"] =
            (int) $rekomendasi["id_rekomendasi"];

        $rekomendasi["id_pengajuan"] =
            (int) $rekomendasi["id_pengajuan"];

        $rekomendasi["alternatives"] = array_map(
            function ($item) {
                return [
                    "id" => (int) $item["id_alternatif_rekomendasi"],
                    "waktuMulai" => $item["waktu_mulai"],
                    "waktuSelesai" => $item["waktu_selesai"],
                    "status" => $item["status"]
                ];
            },
            $alternatif
        );

        jsonResponse(
            true,
            "Rekomendasi berhasil diambil.",
            [
                "nama_pengguna" => $user["nama"] ?? "Pengguna",
                "recommendation" => $rekomendasi
            ]
        );
    }

    // =========================================
    // 2. MENERIMA REKOMENDASI
    // =========================================

    if ($method === "POST" && $action === "accept") {

        $idRekomendasi = $input["id_rekomendasi"] ?? null;

        $idAlternatif =
            $input["id_alternatif_rekomendasi"] ?? null;

        if (
            !validId($idRekomendasi) ||
            !validId($idAlternatif)
        ) {
            jsonResponse(false, "ID tidak valid.", [], 422);
        }

        $pdo->beginTransaction();

        try {

            // Pastikan rekomendasi milik pengguna.
            $stmt = $pdo->prepare("
                SELECT
                    r.id_rekomendasi,
                    r.id_pengajuan,
                    r.status,
                    r.batas_waktu

                FROM rekomendasi r

                INNER JOIN pengajuan p
                    ON p.id_pengajuan = r.id_pengajuan

                WHERE r.id_rekomendasi = :id_rekomendasi
                  AND p.id_user = :id_user

                FOR UPDATE
            ");

            $stmt->execute([
                ":id_rekomendasi" => (int) $idRekomendasi,
                ":id_user" => $idUser
            ]);

            $rekomendasi = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$rekomendasi) {
                throw new DomainException(
                    "Rekomendasi tidak ditemukan."
                );
            }

            if ($rekomendasi["status"] !== "Dikirim") {
                throw new DomainException(
                    "Rekomendasi sudah tidak dapat diproses."
                );
            }

            if (
                !empty($rekomendasi["batas_waktu"]) &&
                strtotime($rekomendasi["batas_waktu"]) <= time()
            ) {
                $stmt = $pdo->prepare("
                    UPDATE rekomendasi
                    SET status = 'Kedaluwarsa'
                    WHERE id_rekomendasi = :id
                ");

                $stmt->execute([
                    ":id" => (int) $idRekomendasi
                ]);

                $pdo->commit();

                jsonResponse(
                    false,
                    "Batas waktu rekomendasi telah berakhir.",
                    [],
                    422
                );
            }

            // Pastikan alternatif milik rekomendasi.
            $stmt = $pdo->prepare("
                SELECT
                    waktu_mulai,
                    waktu_selesai

                FROM alternatif_rekomendasi

                WHERE id_alternatif_rekomendasi = :id_alternatif
                  AND id_rekomendasi = :id_rekomendasi

                FOR UPDATE
            ");

            $stmt->execute([
                ":id_alternatif" => (int) $idAlternatif,
                ":id_rekomendasi" => (int) $idRekomendasi
            ]);

            $alternatif = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$alternatif) {
                throw new DomainException(
                    "Alternatif jadwal tidak ditemukan."
                );
            }

            if (
                strtotime($alternatif["waktu_mulai"]) <= time() ||
                strtotime($alternatif["waktu_selesai"]) <=
                strtotime($alternatif["waktu_mulai"])
            ) {
                throw new DomainException(
                    "Waktu alternatif tidak valid atau sudah berlalu."
                );
            }

            // Semua alternatif menjadi Tidak dipilih.
            $stmt = $pdo->prepare("
                UPDATE alternatif_rekomendasi
                SET status = 'Tidak dipilih'
                WHERE id_rekomendasi = :id_rekomendasi
            ");

            $stmt->execute([
                ":id_rekomendasi" => (int) $idRekomendasi
            ]);

            // Alternatif pilihan menjadi Dipilih.
            $stmt = $pdo->prepare("
                UPDATE alternatif_rekomendasi
                SET status = 'Dipilih'

                WHERE id_alternatif_rekomendasi = :id_alternatif
                  AND id_rekomendasi = :id_rekomendasi
            ");

            $stmt->execute([
                ":id_alternatif" => (int) $idAlternatif,
                ":id_rekomendasi" => (int) $idRekomendasi
            ]);

            // Status rekomendasi menjadi Diterima.
            $stmt = $pdo->prepare("
                UPDATE rekomendasi
                SET status = 'Diterima'
                WHERE id_rekomendasi = :id_rekomendasi
            ");

            $stmt->execute([
                ":id_rekomendasi" => (int) $idRekomendasi
            ]);

            // Perbarui waktu pengajuan.
            $stmt = $pdo->prepare("
                UPDATE pengajuan

                SET
                    waktu_mulai = :waktu_mulai,
                    waktu_selesai = :waktu_selesai

                WHERE id_pengajuan = :id_pengajuan
                  AND id_user = :id_user
            ");

            $stmt->execute([
                ":waktu_mulai" => $alternatif["waktu_mulai"],
                ":waktu_selesai" => $alternatif["waktu_selesai"],
                ":id_pengajuan" => (int) $rekomendasi["id_pengajuan"],
                ":id_user" => $idUser
            ]);

            // Buat booking agar jadwal yang diterima
            // muncul pada halaman jadwal Laboran.
            // UNIQUE(id_pengajuan) mencegah booking ganda.
            $stmt = $pdo->prepare("
                INSERT INTO booking (
                    id_pengajuan,
                    status
                ) VALUES (
                    :id_pengajuan,
                    'terjadwal'
                )
                ON DUPLICATE KEY UPDATE
                    status = 'terjadwal'
            ");

            $stmt->execute([
                ":id_pengajuan" =>
                    (int) $rekomendasi["id_pengajuan"]
            ]);

            $pdo->commit();

            jsonResponse(
                true,
                "Rekomendasi berhasil diterima dan jadwal pengajuan diperbarui.",
                [
                    "id_pengajuan" =>
                        (int) $rekomendasi["id_pengajuan"]
                ]
            );

        } catch (Throwable $e) {

            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $e;
        }
    }

    // =========================================
    // 3. MENOLAK REKOMENDASI
    // =========================================

    if ($method === "POST" && $action === "reject") {

        $idRekomendasi = $input["id_rekomendasi"] ?? null;

        if (!validId($idRekomendasi)) {
            jsonResponse(false, "ID rekomendasi tidak valid.", [], 422);
        }

        $pdo->beginTransaction();

        try {

            $stmt = $pdo->prepare("
                SELECT r.status

                FROM rekomendasi r

                INNER JOIN pengajuan p
                    ON p.id_pengajuan = r.id_pengajuan

                WHERE r.id_rekomendasi = :id_rekomendasi
                  AND p.id_user = :id_user

                FOR UPDATE
            ");

            $stmt->execute([
                ":id_rekomendasi" => (int) $idRekomendasi,
                ":id_user" => $idUser
            ]);

            $rekomendasi = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$rekomendasi) {
                throw new DomainException(
                    "Rekomendasi tidak ditemukan."
                );
            }

            if ($rekomendasi["status"] !== "Dikirim") {
                throw new DomainException(
                    "Rekomendasi sudah tidak dapat ditolak."
                );
            }

            // Ubah status rekomendasi.
            $stmt = $pdo->prepare("
                UPDATE rekomendasi
                SET status = 'Ditolak'
                WHERE id_rekomendasi = :id_rekomendasi
            ");

            $stmt->execute([
                ":id_rekomendasi" => (int) $idRekomendasi
            ]);

            // Tidak ada alternatif yang dipilih.
            $stmt = $pdo->prepare("
                UPDATE alternatif_rekomendasi
                SET status = 'Tidak dipilih'
                WHERE id_rekomendasi = :id_rekomendasi
            ");

            $stmt->execute([
                ":id_rekomendasi" => (int) $idRekomendasi
            ]);

            $pdo->commit();

            jsonResponse(
                true,
                "Rekomendasi berhasil ditolak."
            );

        } catch (Throwable $e) {

            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $e;
        }
    }

    jsonResponse(false, "Aksi API tidak dikenali.", [], 400);

} catch (DomainException $e) {

    jsonResponse(false, $e->getMessage(), [], 422);

} catch (Throwable $e) {

    error_log("API REKOMENDASI: " . $e->getMessage());

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    jsonResponse(
        false,
        "Terjadi kesalahan pada sistem atau database.",
        [],
        500
    );
}
