<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Jayapura");

header("Content-Type: application/json; charset=UTF-8");
header("Cache-Control: no-store, no-cache, must-revalidate");

require_once __DIR__ . "/../auth/sesi.php";

function respons(int $kode, bool $success, string $message, array $data = []): void
{
    http_response_code($kode);
    echo json_encode([
        "success" => $success,
        "message" => $message,
        "data" => $data
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

if (!sudahLogin()) {
    respons(401, false, "Silakan login terlebih dahulu.");
}

if (($_SESSION["role"] ?? "") !== "pengguna") {
    respons(403, false, "Anda tidak memiliki akses.");
}

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    header("Allow: GET");
    respons(405, false, "Metode request tidak diizinkan.");
}

require_once __DIR__ . "/../../config/database.php";

try {
    $tanggal = (new DateTimeImmutable(
        "now",
        new DateTimeZone("Asia/Jayapura")
    ))->format("Y-m-d");

    $sql = "
        SELECT
            b.id_booking AS id,
            p.waktu_mulai,
            p.waktu_selesai,
            p.nama_kegiatan,
            u.nama AS nama_pemohon,
            b.status

        FROM booking b

        INNER JOIN pengajuan p
            ON p.id_pengajuan = b.id_pengajuan

        INNER JOIN users u
            ON u.id_user = p.id_user

        WHERE DATE(p.waktu_mulai) = :tanggal

        AND LOWER(TRIM(p.status)) = 'disetujui'

        AND LOWER(TRIM(b.status)) IN (
            'terjadwal',
            'disetujui',
            'digunakan',
            'berlangsung',
            'tidak_digunakan',
            'tidak digunakan'
        )

        AND LOWER(TRIM(b.status)) IN (
            'terjadwal',
            'disetujui',
            'digunakan',
            'berlangsung',
            'tidak_digunakan',
            'tidak digunakan'
        )

        ORDER BY p.waktu_mulai ASC
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([":tanggal" => $tanggal]);

    $hasil = [];

    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $hasil[] = [
            "id" => (int) $row["id"],
            "waktuMulai" => date("H:i", strtotime($row["waktu_mulai"])),
            "waktuSelesai" => date("H:i", strtotime($row["waktu_selesai"])),
            "namaKegiatan" => $row["nama_kegiatan"],
            "namaPemohon" => $row["nama_pemohon"],
            "status" => $row["status"]
        ];
    }

    respons(200, true, "Jadwal berhasil diambil.", $hasil);

} catch (Throwable $e) {
    error_log("API Jadwal Pengguna: " . $e->getMessage());

    respons(500, false, "Terjadi kesalahan saat mengambil jadwal.");
}
