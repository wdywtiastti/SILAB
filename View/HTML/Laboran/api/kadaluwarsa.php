<?php

declare(strict_types=1);

// =========================================
// SILAB - API PEMERIKSAAN PRESENSI KEDALUWARSA
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
    int $jumlah = 0
): void {
    http_response_code($kode);

    echo json_encode([
        "success" => $success,
        "message" => $message,
        "jumlah_kedaluwarsa" => $jumlah
    ]);

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

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    header("Allow: POST");

    kirimRespons(
        405,
        false,
        "Metode request tidak diizinkan."
    );
}

// =========================================
// 5. MEMANGGIL DATABASE
// =========================================

require_once __DIR__ . "/../../../config/database.php";

// =========================================
// 6. PROSES PEMERIKSAAN KEDALUWARSA
// =========================================

try {

    $sekarang = new DateTimeImmutable(
        "now",
        $zonaWaktu
    );

    $tanggalHariIni = $sekarang->format("Y-m-d");

    $awalHari = $tanggalHariIni . " 00:00:00";

    $awalBesok = $sekarang
        ->modify("+1 day")
        ->setTime(0, 0, 0)
        ->format("Y-m-d H:i:s");

    $waktuSekarang = $sekarang->format("Y-m-d H:i:s");

    $jumlahKedaluwarsa = 0;

    // =====================================
    // 7. MEMULAI TRANSAKSI
    // =====================================

    $pdo->beginTransaction();

    // Mengambil identitas akun sistem.

    $querySistem = "
        SELECT id_user
        FROM users
        WHERE role = 'sistem'
          AND nip_npm = 'SILAB-SYSTEM'
          AND status = 'nonaktif'
        LIMIT 1
        FOR UPDATE
    ";

    $stmtSistem = $pdo->prepare($querySistem);
    $stmtSistem->execute();

    $akunSistem = $stmtSistem->fetch();

    if (!$akunSistem) {
        $pdo->rollBack();

        kirimRespons(
            500,
            false,
            "Akun sistem belum tersedia."
        );
    }

    $idSistem = (int) $akunSistem["id_user"];

    // =====================================
    // 8. MENGAMBIL BOOKING HARI INI
    // =====================================

    $queryBooking = "
        SELECT
            b.id_booking,
            b.status AS status_booking,
            p.waktu_mulai,
            p.waktu_selesai

        FROM booking b

        INNER JOIN pengajuan p
            ON p.id_pengajuan = b.id_pengajuan

        LEFT JOIN validasi_booking vb
            ON vb.id_booking = b.id_booking

        WHERE b.status IN ('terjadwal', 'disetujui')

          AND p.waktu_mulai >= :awal_hari
          AND p.waktu_mulai < :awal_besok

          AND vb.id_booking IS NULL

        FOR UPDATE
    ";

    $stmtBooking = $pdo->prepare($queryBooking);

    $stmtBooking->execute([
        ":awal_hari" => $awalHari,
        ":awal_besok" => $awalBesok
    ]);

    $daftarBooking = $stmtBooking->fetchAll();

    // =====================================
    // 9. MEMERIKSA BATAS VALIDASI 15 MENIT
    // =====================================

    foreach ($daftarBooking as $booking) {

        // Mengambil waktu mulai langsung dari DATETIME.

        $waktuMulai = new DateTimeImmutable(
            $booking["waktu_mulai"],
            $zonaWaktu
        );

        // Mengambil waktu selesai langsung dari DATETIME.

        $waktuSelesai = new DateTimeImmutable(
            $booking["waktu_selesai"],
            $zonaWaktu
        );

        // Memastikan rentang waktu valid.

        if ($waktuMulai >= $waktuSelesai) {
            continue;
        }

        // Menghitung batas validasi 15 menit.

        $batasValidasi = $waktuMulai->modify("+15 minutes");

        // Belum melewati batas validasi.

        if ($sekarang < $batasValidasi) {
            continue;
        }

        // =================================
        // 10. MENYIMPAN VALIDASI OTOMATIS
        // =================================

        $insert = "
            INSERT INTO validasi_booking (
                id_booking,
                id_user_laboran,
                status,
                waktu_divalidasi,
                waktu_dibuat
            ) VALUES (
                :id_booking,
                :id_user_laboran,
                'tidak_digunakan',
                :waktu_divalidasi,
                :waktu_dibuat
            )
        ";

        $stmtInsert = $pdo->prepare($insert);

        $stmtInsert->execute([
            ":id_booking" => $booking["id_booking"],
            ":id_user_laboran" => $idSistem,
            ":waktu_divalidasi" => $waktuSekarang,
            ":waktu_dibuat" => $waktuSekarang
        ]);

        $jumlahKedaluwarsa++;
    }

    // =====================================
    // 11. MENYELESAIKAN TRANSAKSI
    // =====================================

    $pdo->commit();

    kirimRespons(
        200,
        true,
        $jumlahKedaluwarsa > 0
        ? "Pemeriksaan berhasil. Presensi kedaluwarsa berhasil dicatat."
        : "Pemeriksaan berhasil. Tidak ada presensi kedaluwarsa.",
        $jumlahKedaluwarsa
    );

} catch (PDOException $e) {

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log(
        "SILAB API Kedaluwarsa - Database Error: " .
        $e->getMessage()
    );

    kirimRespons(
        500,
        false,
        "Terjadi kesalahan database saat memeriksa presensi."
    );

} catch (Throwable $e) {

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log(
        "SILAB API Kedaluwarsa - Error: " .
        $e->getMessage()
    );

    kirimRespons(
        500,
        false,
        "Terjadi kesalahan pada pemeriksaan presensi."
    );
}
