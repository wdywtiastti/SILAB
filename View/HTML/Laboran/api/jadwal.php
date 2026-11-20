<?php

declare(strict_types=1);

// =========================================
// SILAB - API PENGAMBILAN JADWAL LABORAN
// =========================================

// Zona waktu Laboratorium RPL - WIT
$zonaWaktu = new DateTimeZone("Asia/Jayapura");
date_default_timezone_set("Asia/Jayapura");

header("Content-Type: application/json; charset=UTF-8");

// =========================================
// 1. KONFIGURASI RESPONS JSON
// =========================================

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
        JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE
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
    kirimRespons(401, false, "Silakan login terlebih dahulu.");
}

$role = (string) ($_SESSION["role"] ?? "");

if (!in_array($role, ["laboran", "kepala_lab"], true)) {
    kirimRespons(403, false, "Anda tidak memiliki akses.");
}
// =========================================
// 4. PEMERIKSAAN METODE REQUEST
// =========================================

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    header("Allow: GET");
    kirimRespons(405, false, "Metode request tidak diizinkan.");
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
    kirimRespons(400, false, "Format tanggal tidak valid.");
}

// =========================================
// 6. MEMANGGIL DATABASE
// =========================================

require_once __DIR__ . "/../../../config/database.php";

// =========================================
// 7. STATUS YANG MENANDAKAN PRESENSI
// =========================================

$statusPresensiAktif = [
    "hadir",
    "presensi",
    "sudah_presensi",
    "tercatat",
    "digunakan",
    "sedang_berjalan",
    "berlangsung",
    "selesai",
    "checked_in",
    "check_in"
];

// =========================================
// 8. PEMERIKSAAN BATAS WAKTU PRESENSI
// =========================================

try {

    $pdo->beginTransaction();

    // Waktu sekarang berdasarkan WIT.
    $sekarang = new DateTimeImmutable(
        "now",
        $zonaWaktu
    );

    // Batas presensi adalah 15 menit setelah waktu mulai.
    $batasWaktu = $sekarang
        ->modify("-15 minutes")
        ->format("Y-m-d H:i:s");

    // -------------------------------------
    // 8A. UPDATE BOOKING KADALUWARSA
    // -------------------------------------

    // Booking yang sudah melewati batas presensi
    // dan belum melakukan presensi akan menjadi
    // tidak_digunakan.

    $queryUpdate = "
        UPDATE booking b

        INNER JOIN pengajuan p
            ON p.id_pengajuan = b.id_pengajuan

        SET b.status = 'tidak_digunakan'

        WHERE b.status IN (
            'terjadwal',
            'disetujui'
        )

        AND p.waktu_mulai <= :batas_waktu

        AND NOT EXISTS (
            SELECT 1
            FROM validasi_booking vb

            WHERE vb.id_booking = b.id_booking

            AND LOWER(TRIM(vb.status)) IN (
                'hadir',
                'presensi',
                'sudah_presensi',
                'tercatat',
                'digunakan',
                'sedang_berjalan',
                'berlangsung',
                'selesai',
                'checked_in',
                'check_in'
            )
        )
    ";

    $stmtUpdate = $pdo->prepare($queryUpdate);

    $stmtUpdate->execute([
        ":batas_waktu" => $batasWaktu
    ]);

    $jumlahTidakDigunakan = $stmtUpdate->rowCount();

    // =====================================
    // 9. MENGAMBIL DATA JADWAL
    // =====================================

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

            sp.prioritas AS prioritas,

            vb.status AS status_presensi

        FROM booking b

        INNER JOIN pengajuan p
            ON p.id_pengajuan = b.id_pengajuan

        INNER JOIN users u
            ON u.id_user = p.id_user

LEFT JOIN skor_pengajuan sp
    ON sp.id_pengajuan = p.id_pengajuan

LEFT JOIN (
    SELECT
        id_booking,
        MAX(status) AS status
    FROM validasi_booking
    GROUP BY id_booking
) vb
    ON vb.id_booking = b.id_booking

WHERE DATE(p.waktu_mulai) = :tanggal

        AND b.status IN (
            'terjadwal',
            'disetujui',
            'digunakan',
            'berlangsung',
            'tidak_digunakan'
        )

        ORDER BY p.waktu_mulai ASC
    ";

    $stmt = $pdo->prepare($query);

    $stmt->execute([
        ":tanggal" => $tanggal
    ]);

    $daftarJadwal = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // =====================================
    // 10. MENYESUAIKAN FORMAT DATA JSON
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
    // 11. COMMIT TRANSAKSI
    // =====================================

    $pdo->commit();

    // =====================================
    // 12. MENGIRIM RESPONS
    // =====================================

    kirimRespons(
        200,
        true,
        "Data jadwal berhasil diambil.",
        $data
    );

} catch (Throwable $e) {

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log(
        "SILAB API Jadwal Laboran: " .
        $e->getMessage()
    );

    kirimRespons(
        500,
        false,
        "Terjadi kesalahan saat memproses data jadwal."
    );
}
