<?php

declare(strict_types=1);

// =========================================
// SILAB - API PENGAMBILAN JADWAL LABORAN
// =========================================

// Zona waktu Laboratorium RPL - WIT
$zonaWaktu = new DateTimeZone("Asia/Jayapura");
date_default_timezone_set("Asia/Jayapura");

// =========================================
// 1. KONFIGURASI RESPONS JSON
// =========================================

header("Content-Type: application/json; charset=UTF-8");

function kirimRespons(
    int $kode,
    bool $success,
    string $message,
    array $data = []
): void {
    http_response_code($kode);

    echo json_encode(
        [
            "success" => $success,
            "message" => $message,
            "data" => $data
        ],
        JSON_UNESCAPED_UNICODE
    );

    exit;
}

// =========================================
// 2. MEMANGGIL SESSION
// =========================================

require_once __DIR__ . "/../../auth/sesi.php";

// =========================================
// 3. PEMERIKSAAN AUTENTIKASI
// =========================================

if (!sudahLogin()) {
    kirimRespons(
        401,
        false,
        "Silakan login terlebih dahulu."
    );
}

if (($_SESSION["role"] ?? "") !== "laboran") {
    kirimRespons(
        403,
        false,
        "Anda tidak memiliki akses."
    );
}

// =========================================
// 4. PEMERIKSAAN METODE REQUEST
// =========================================

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    header("Allow: GET");

    kirimRespons(
        405,
        false,
        "Metode request tidak diizinkan."
    );
}

// =========================================
// 5. VALIDASI TANGGAL
// =========================================

$tanggal = $_GET["tanggal"] ?? "";

if ($tanggal === "") {
    $tanggal = (new DateTimeImmutable(
        "now",
        $zonaWaktu
    ))->format("Y-m-d");
}

$formatTanggal = DateTimeImmutable::createFromFormat(
    "!Y-m-d",
    $tanggal,
    $zonaWaktu
);

if (
    !$formatTanggal ||
    $formatTanggal->format("Y-m-d") !== $tanggal
) {
    kirimRespons(
        400,
        false,
        "Format tanggal tidak valid."
    );
}

// =========================================
// 6. MEMANGGIL DATABASE
// =========================================

require_once __DIR__ . "/../../../config/database.php";

// =========================================
// 7. MENGAMBIL DATA JADWAL
// =========================================

try {

    $query = "
        SELECT
            b.id_booking AS id,
            p.id_pengajuan,

            DATE(p.waktu_mulai) AS tanggal,

            TIME_FORMAT(
                p.waktu_mulai,
                '%H:%i'
            ) AS waktuMulai,

            TIME_FORMAT(
                p.waktu_selesai,
                '%H:%i'
            ) AS waktuSelesai,

            p.nama_kegiatan AS namaKegiatan,

            u.nama AS namaPemohon,

            b.status AS status,

            NULL AS prioritas,

            vb.status AS status_presensi

        FROM booking b

        INNER JOIN pengajuan p
            ON p.id_pengajuan = b.id_pengajuan

        INNER JOIN users u
            ON u.id_user = p.id_user

        LEFT JOIN validasi_booking vb
            ON vb.id_booking = b.id_booking

        WHERE DATE(p.waktu_mulai) = :tanggal

          AND b.status IN (
              'terjadwal',
              'disetujui',
              'digunakan',
              'berlangsung'
          )

        ORDER BY p.waktu_mulai ASC
    ";

    $stmt = $pdo->prepare($query);

    $stmt->execute([
        ":tanggal" => $tanggal
    ]);

    $daftarJadwal = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // =====================================
    // 8. MENYESUAIKAN FORMAT DATA JSON
    // =====================================

    $data = [];

    foreach ($daftarJadwal as $booking) {

        $data[] = [
            "id" => (int) $booking["id"],

            "idPengajuan" => (int) $booking["id_pengajuan"],

            "tanggal" => $booking["tanggal"],

            "waktuMulai" => $booking["waktuMulai"],

            "waktuSelesai" => $booking["waktuSelesai"],

            "namaKegiatan" => $booking["namaKegiatan"],

            "namaPemohon" => $booking["namaPemohon"],

            "prioritas" => $booking["prioritas"],

            "status" => $booking["status"],

            "presensi" => $booking["status_presensi"] !== null
                ? [
                    "status" => $booking["status_presensi"]
                ]
                : null
        ];
    }

    // =====================================
    // 9. MENGIRIM RESPONS
    // =====================================

    kirimRespons(
        200,
        true,
        "Data jadwal berhasil diambil.",
        $data
    );

} catch (PDOException $e) {

    error_log(
        "SILAB API Jadwal - Database Error: " .
        $e->getMessage()
    );

    kirimRespons(
        500,
        false,
        "Terjadi kesalahan database saat mengambil jadwal."
    );

} catch (Throwable $e) {

    error_log(
        "SILAB API Jadwal - Error: " .
        $e->getMessage()
    );

    kirimRespons(
        500,
        false,
        "Terjadi kesalahan pada sistem."
    );
}