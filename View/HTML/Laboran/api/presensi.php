<?php

declare(strict_types=1);

// =========================================
// SILAB - API VALIDASI PRESENSI LABORAN
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
    string $message
): void {
    http_response_code($kode);

    echo json_encode([
        "success" => $success,
        "message" => $message
    ]);

    exit;
}

// =========================================
// 2. MEMANGGIL SESSION DAN DATABASE
// =========================================

require_once __DIR__ . "/../../auth/sesi.php";

// =========================================
// 3. PEMERIKSAAN AUTENTIKASI
// =========================================

if (!sudahLogin()) {
    kirimRespons(401, false, "Silakan login terlebih dahulu.");
}

if (($_SESSION["role"] ?? "") !== "laboran") {
    kirimRespons(403, false, "Anda tidak memiliki akses.");
}

$idLaboran = filter_var(
    $_SESSION["id_user"] ?? null,
    FILTER_VALIDATE_INT
);

if (!$idLaboran || $idLaboran <= 0) {
    kirimRespons(401, false, "Identitas Laboran tidak valid.");
}

// =========================================
// 4. PEMERIKSAAN METODE REQUEST
// =========================================

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    header("Allow: POST");
    kirimRespons(405, false, "Metode request tidak diizinkan.");
}

// =========================================
// 5. VALIDASI INPUT
// =========================================

$idBooking = filter_var(
    $_POST["booking_id"] ?? null,
    FILTER_VALIDATE_INT
);

$status = $_POST["status"] ?? "";

if (!$idBooking || $idBooking <= 0) {
    kirimRespons(400, false, "ID booking tidak valid.");
}

if (!in_array($status, ["digunakan", "tidak_digunakan"], true)) {
    kirimRespons(400, false, "Status presensi tidak valid.");
}

// =========================================
// 6. MEMANGGIL KONEKSI DATABASE
// =========================================

require_once __DIR__ . "/../../../config/database.php";

// =========================================
// 7. PROSES VALIDASI PRESENSI
// =========================================

try {

    $pdo->beginTransaction();

    // Mengunci data booking agar tidak divalidasi
    // secara bersamaan oleh beberapa request.

    $query = "
        SELECT
            b.id_booking,
            b.status AS status_booking,
            p.waktu_mulai,
            p.waktu_selesai,
            vb.id_validasi_booking

        FROM booking b

        INNER JOIN pengajuan p
            ON p.id_pengajuan = b.id_pengajuan

        LEFT JOIN validasi_booking vb
            ON vb.id_booking = b.id_booking

        WHERE b.id_booking = :id_booking

        FOR UPDATE
    ";

    $stmt = $pdo->prepare($query);

    $stmt->execute([
        ":id_booking" => $idBooking
    ]);

    $booking = $stmt->fetch();

    // Booking harus ditemukan.

    if (!$booking) {
        $pdo->rollBack();

        kirimRespons(404, false, "Booking tidak ditemukan.");
    }

    // Memastikan booking masih berlaku.

    $statusBooking = strtolower(
        trim($booking["status_booking"])
    );

    if (!in_array(
        $statusBooking,
        ["terjadwal", "disetujui"],
        true
    )) {
        $pdo->rollBack();

        kirimRespons(
            409,
            false,
            "Booking tidak berada dalam status yang dapat divalidasi."
        );
    }

    // Memastikan belum pernah dilakukan presensi.

    if ($booking["id_validasi_booking"] !== null) {
        $pdo->rollBack();

        kirimRespons(
            409,
            false,
            "Presensi untuk booking ini sudah tercatat."
        );
    }

    // =====================================
    // 8. PEMERIKSAAN WAKTU PRESENSI
    // =====================================

    $sekarang = new DateTimeImmutable("now", $zonaWaktu);

    $waktuMulai = new DateTimeImmutable(
        $booking["waktu_mulai"],
        $zonaWaktu
    );

    $waktuSelesai = new DateTimeImmutable(
        $booking["waktu_selesai"],
        $zonaWaktu
    );

    // Sesi belum dimulai.

    if ($sekarang < $waktuMulai) {
        $pdo->rollBack();

        kirimRespons(
            409,
            false,
            "Sesi peminjaman belum dimulai."
        );
    }

    // Sesi sudah berakhir.

    if ($sekarang >= $waktuSelesai) {
        $pdo->rollBack();

        kirimRespons(
            409,
            false,
            "Sesi peminjaman sudah berakhir."
        );
    }

    // Batas validasi 15 menit.

    $batasValidasi = $waktuMulai->modify("+15 minutes");

    if ($sekarang >= $batasValidasi) {
        $pdo->rollBack();

        kirimRespons(
            409,
            false,
            "Batas validasi presensi 15 menit telah berakhir."
        );
    }

    // =====================================
    // 9. MENYIMPAN HASIL VALIDASI
    // =====================================

    $waktuSekarang = $sekarang->format("Y-m-d H:i:s");

    $insert = "
        INSERT INTO validasi_booking (
            id_booking,
            id_user_laboran,
            status,
            waktu_validasi,
            waktu_dibuat
        ) VALUES (
            :id_booking,
            :id_user_laboran,
            :status,
            :waktu_validasi,
            :waktu_dibuat
        )
    ";

    $stmtInsert = $pdo->prepare($insert);

    $stmtInsert->execute([
        ":id_booking" => $idBooking,
        ":id_user_laboran" => $idLaboran,
        ":status" => $status,
        ":waktu_validasi" => $waktuSekarang,
        ":waktu_dibuat" => $waktuSekarang
    ]);

    // =====================================
    // 10. COMMIT TRANSAKSI
    // =====================================

    $pdo->commit();

    $pesan = $status === "digunakan"
        ? "Presensi berhasil dicatat. Pengguna dinyatakan hadir."
        : "Presensi berhasil dicatat. Booking dinyatakan tidak digunakan.";

    kirimRespons(200, true, $pesan);

} catch (PDOException $e) {

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log(
        "SILAB API Presensi - Database Error: " .
        $e->getMessage()
    );

    kirimRespons(
        500,
        false,
        "Terjadi kesalahan database saat menyimpan presensi."
    );

} catch (Throwable $e) {

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log(
        "SILAB API Presensi - Error: " .
        $e->getMessage()
    );

    kirimRespons(
        500,
        false,
        "Terjadi kesalahan pada proses validasi presensi."
    );
}
