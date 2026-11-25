<?php

declare(strict_types=1);

// =========================================
// SILAB - API PEMERIKSAAN PRESENSI KEDALUWARSA
// =========================================

// Zona waktu Laboratorium RPL - WIT
$zonaWaktu = new DateTimeZone("Asia/Jayapura");
date_default_timezone_set("Asia/Jayapura");

header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Pragma: no-cache");
header("Content-Type: application/json; charset=UTF-8");

// =========================================
// 1. RESPONS JSON
// =========================================

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
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);

    exit;
}

// =========================================
// 2. SESSION
// =========================================

require_once __DIR__ . "/../../auth/sesi.php";

// =========================================
// 3. AUTENTIKASI
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
// 4. METODE REQUEST
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
// 5. DATABASE
// =========================================

require_once __DIR__ . "/../../../config/database.php";

// =========================================
// 6. PEMERIKSAAN KEDALUWARSA
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

    // Batas maksimal presensi adalah 15 menit
    // setelah waktu mulai penggunaan laboratorium.

    $batasValidasi = $sekarang
        ->modify("-15 minutes")
        ->format("Y-m-d H:i:s");

    $waktuSekarang = $sekarang->format("Y-m-d H:i:s");

    $jumlahKedaluwarsa = 0;

    // =====================================
    // 7. MEMULAI TRANSAKSI
    // =====================================

    $pdo->beginTransaction();

    // =====================================
    // 8. MENGAMBIL BOOKING KEDALUWARSA
    // =====================================

    $queryBooking = "

        SELECT
            b.id_booking,
            b.status AS status_booking,

            p.waktu_mulai,
            p.waktu_selesai,

            vb.id_validasi_booking,
            vb.status AS status_presensi

        FROM booking b

        INNER JOIN pengajuan p
            ON p.id_pengajuan = b.id_pengajuan

        LEFT JOIN validasi_booking vb
            ON vb.id_booking = b.id_booking

        WHERE b.status IN (
            'terjadwal',
            'disetujui'
        )

        AND p.waktu_mulai >= :awal_hari

        AND p.waktu_mulai < :awal_besok

        AND p.waktu_mulai <= :batas_validasi

        AND p.waktu_selesai > p.waktu_mulai

        AND (
            vb.id_validasi_booking IS NULL
            OR vb.status = 'disetujui'
        )

        ORDER BY p.waktu_mulai ASC

        FOR UPDATE

    ";

    $stmtBooking = $pdo->prepare($queryBooking);

    $stmtBooking->execute([

        ":awal_hari" => $awalHari,

        ":awal_besok" => $awalBesok,

        ":batas_validasi" => $batasValidasi

    ]);

    $daftarBooking = $stmtBooking->fetchAll(PDO::FETCH_ASSOC);

    // =====================================
    // 9. MENYIAPKAN AKUN SISTEM
    // =====================================

    $idSistem = null;

    foreach ($daftarBooking as $booking) {

        if ($booking["id_validasi_booking"] === null) {

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

            $akunSistem = $stmtSistem->fetch(PDO::FETCH_ASSOC);

            if (!$akunSistem) {

                throw new RuntimeException(
                    "Akun sistem belum tersedia."
                );

            }

            $idSistem = (int) $akunSistem["id_user"];

            break;
        }
    }

    // =====================================
    // 10. MEMPROSES SETIAP BOOKING
    // =====================================

    foreach ($daftarBooking as $booking) {

        $idBooking = (int) $booking["id_booking"];

        // ---------------------------------
        // A. BOOKING BELUM MEMILIKI VALIDASI
        // ---------------------------------

        if ($booking["id_validasi_booking"] === null) {

            $queryInsert = "

                INSERT INTO validasi_booking (

                    id_booking,

                    id_user_laboran,

                    status,

                    waktu_validasi,

                    waktu_dibuat

                ) VALUES (

                    :id_booking,

                    :id_user_laboran,

                    'tidak_digunakan',

                    :waktu_validasi,

                    :waktu_dibuat

                )

            ";

            $stmtInsert = $pdo->prepare($queryInsert);

            $stmtInsert->execute([

                ":id_booking" => $idBooking,

                ":id_user_laboran" => $idSistem,

                ":waktu_validasi" => $waktuSekarang,

                ":waktu_dibuat" => $waktuSekarang

            ]);

        }

        // ---------------------------------
        // B. BOOKING SUDAH DISETUJUI
        // ---------------------------------
        else {

            $queryUpdateValidasi = "

                UPDATE validasi_booking

                SET status = 'tidak_digunakan'

                WHERE id_booking = :id_booking

                  AND status = 'disetujui'

            ";

            $stmtUpdateValidasi = $pdo->prepare(
                $queryUpdateValidasi
            );

            $stmtUpdateValidasi->execute([

                ":id_booking" => $idBooking

            ]);

        }

        // ---------------------------------
        // C. SINKRONISASI STATUS BOOKING
        // ---------------------------------

        $queryUpdateBooking = "

            UPDATE booking

            SET status = 'tidak_digunakan'

            WHERE id_booking = :id_booking

              AND status IN (
                  'terjadwal',
                  'disetujui'
              )

        ";

        $stmtUpdateBooking = $pdo->prepare(
            $queryUpdateBooking
        );

        $stmtUpdateBooking->execute([

            ":id_booking" => $idBooking

        ]);

        $jumlahKedaluwarsa++;

    }

    // =====================================
    // 11. COMMIT TRANSAKSI
    // =====================================

    $pdo->commit();

    kirimRespons(

        200,

        true,

        $jumlahKedaluwarsa > 0

        ? "Pemeriksaan berhasil. Presensi kedaluwarsa berhasil diperbarui."

        : "Pemeriksaan berhasil. Tidak ada presensi kedaluwarsa.",

        $jumlahKedaluwarsa

    );

} catch (Throwable $e) {

    if ($pdo->inTransaction()) {

        $pdo->rollBack();

    }

    error_log(
        "SILAB API Kedaluwarsa: " . $e->getMessage()
    );

    kirimRespons(

        500,

        false,

        "Terjadi kesalahan saat memproses presensi kedaluwarsa."

    );

}
