<?php

declare(strict_types=1);

// =============================================
// SILAB - API TINDAKAN ANTREAN LABORAN
// =============================================

header("Content-Type: application/json; charset=utf-8");

require_once __DIR__ . "/../../auth/sesi.php";
require_once __DIR__ . "/../../../config/database.php";
// =============================================
// 1. FUNGSI RESPONS JSON
// =============================================

function responsJSON(
    bool $success,
    string $message,
    int $httpCode = 200,
    array $data = []
): void {

    http_response_code($httpCode);

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

// =============================================
// 2. VALIDASI SESSION DAN ROLE
// =============================================

if (!sudahLogin()) {
    responsJSON(
        false,
        "Session telah berakhir. Silakan login kembali.",
        401
    );
}

if (($_SESSION["role"] ?? "") !== "laboran") {
    responsJSON(
        false,
        "Anda tidak memiliki kewenangan melakukan tindakan ini.",
        403
    );
}

$idLaboran = (int) ($_SESSION["id_user"] ?? 0);

if ($idLaboran <= 0) {
    responsJSON(
        false,
        "Identitas Laboran tidak valid.",
        401
    );
}

// =============================================
// 3. VALIDASI METODE REQUEST
// =============================================

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    responsJSON(
        false,
        "Metode request harus POST.",
        405
    );
}

// =============================================
// 4. MEMBACA DATA REQUEST
// =============================================

$input = json_decode(
    file_get_contents("php://input"),
    true
);

if (!is_array($input)) {
    responsJSON(
        false,
        "Format request tidak valid.",
        400
    );
}

$aksi = trim(
    (string) ($input["aksi"] ?? "")
);

$idPengajuan = filter_var(
    $input["idPengajuan"] ?? null,
    FILTER_VALIDATE_INT
);

$alasan = trim(
    (string) ($input["alasan"] ?? "")
);

if (!$idPengajuan || $idPengajuan <= 0) {
    responsJSON(
        false,
        "ID pengajuan tidak valid.",
        400
    );
}

// =============================================
// 5. PROSES TRANSAKSI
// =============================================

try {

    $pdo->beginTransaction();

    // Mengambil pengajuan dan mengunci baris.
    $stmt = $pdo->prepare("
        SELECT
            id_pengajuan,
            id_user,
            nama_kegiatan,
            waktu_mulai,
            waktu_selesai,
            status
        FROM pengajuan
        WHERE id_pengajuan = :id
        FOR UPDATE
    ");

    $stmt->execute([
        ":id" => $idPengajuan
    ]);

    $pengajuan = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$pengajuan) {
        throw new RuntimeException(
            "Data pengajuan tidak ditemukan."
        );
    }

    $status = strtolower(
        trim($pengajuan["status"])
    );

    // =========================================
    // A. SETUJUI PENGAJUAN
    // =========================================

    if ($aksi === "setujui") {

        if (
            !in_array(
                $status,
                ["menunggu", "verifikasi", "menunggu_verifikasi"],
                true
            )
        ) {
            throw new RuntimeException(
                "Pengajuan tidak berada dalam antrean verifikasi."
            );
        }

        // Periksa bentrokan waktu dengan booking aktif.
        $stmtKonflik = $pdo->prepare("
            SELECT
                p.id_pengajuan,
                p.nama_kegiatan,
                p.waktu_mulai,
                p.waktu_selesai
            FROM booking b
            INNER JOIN pengajuan p
                ON p.id_pengajuan = b.id_pengajuan
            WHERE
                b.status IN (
                    'terjadwal',
                    'disetujui',
                    'berlangsung',
                    'digunakan'
                )
                AND p.id_pengajuan <> :id
                AND p.waktu_mulai < :waktu_selesai
                AND p.waktu_selesai > :waktu_mulai
            LIMIT 1
        ");

        $stmtKonflik->execute([
            ":id" => $idPengajuan,
            ":waktu_mulai" => $pengajuan["waktu_mulai"],
            ":waktu_selesai" => $pengajuan["waktu_selesai"]
        ]);

        $konflik = $stmtKonflik->fetch(PDO::FETCH_ASSOC);

        if ($konflik) {
            throw new RuntimeException(
                "Pengajuan tidak dapat disetujui karena bertabrakan dengan pengajuan #" .
                $konflik["id_pengajuan"] .
                " (" . $konflik["nama_kegiatan"] . ")."
            );
        }

        // Perbarui status pengajuan.
        $stmtUpdate = $pdo->prepare("
            UPDATE pengajuan
            SET
                status = 'disetujui',
                alasan_penolakan = NULL
            WHERE id_pengajuan = :id
        ");

        $stmtUpdate->execute([
            ":id" => $idPengajuan
        ]);

        // Periksa apakah booking sudah pernah dibuat.
        $stmtBooking = $pdo->prepare("
            SELECT id_booking
            FROM booking
            WHERE id_pengajuan = :id
            FOR UPDATE
        ");

        $stmtBooking->execute([
            ":id" => $idPengajuan
        ]);

        $booking = $stmtBooking->fetch(PDO::FETCH_ASSOC);

        if ($booking) {

            // Aktifkan kembali booking yang dibatalkan.
            $idBooking = (int) $booking["id_booking"];

            $stmtUpdateBooking = $pdo->prepare("
                UPDATE booking
                SET status = 'terjadwal'
                WHERE id_booking = :id
            ");

            $stmtUpdateBooking->execute([
                ":id" => $idBooking
            ]);

        } else {

            // Membuat booking baru.
            $stmtInsertBooking = $pdo->prepare("
                INSERT INTO booking (
                    id_pengajuan,
                    status,
                    waktu_dibuat
                )
                VALUES (
                    :id_pengajuan,
                    'terjadwal',
                    NOW()
                )
            ");

            $stmtInsertBooking->execute([
                ":id_pengajuan" => $idPengajuan
            ]);

            $idBooking = (int) $pdo->lastInsertId();
        }

        // Simpan validasi Laboran.
        $stmtValidasi = $pdo->prepare("
            INSERT INTO validasi_booking (
                id_booking,
                id_user_laboran,
                status,
                waktu_divalidasi,
                waktu_dibuat
            )
            VALUES (
                :id_booking,
                :id_laboran,
                'disetujui',
                NOW(),
                NOW()
            )
            ON DUPLICATE KEY UPDATE
                id_user_laboran = VALUES(id_user_laboran),
                status = 'disetujui',
                waktu_divalidasi = NOW()
        ");

        $stmtValidasi->execute([
            ":id_booking" => $idBooking,
            ":id_laboran" => $idLaboran
        ]);

        $pdo->commit();

        responsJSON(
            true,
            "Pengajuan berhasil disetujui dan booking berhasil dibuat.",
            200,
            [
                "idPengajuan" => $idPengajuan,
                "idBooking" => $idBooking,
                "status" => "disetujui"
            ]
        );
    }

    // =========================================
    // B. TOLAK PENGAJUAN
    // =========================================
    elseif ($aksi === "tolak") {

        if (
            !in_array(
                $status,
                ["menunggu", "verifikasi", "menunggu_verifikasi"],
                true
            )
        ) {
            throw new RuntimeException(
                "Pengajuan tidak berada dalam antrean verifikasi."
            );
        }

        if ($alasan === "") {
            throw new RuntimeException(
                "Alasan penolakan wajib diisi."
            );
        }

        if (mb_strlen($alasan) > 500) {
            throw new RuntimeException(
                "Alasan penolakan maksimal 500 karakter."
            );
        }

        // Pastikan pengajuan belum memiliki booking aktif.
        $stmtBooking = $pdo->prepare("
            SELECT id_booking, status
            FROM booking
            WHERE id_pengajuan = :id
            FOR UPDATE
        ");

        $stmtBooking->execute([
            ":id" => $idPengajuan
        ]);

        $booking = $stmtBooking->fetch(PDO::FETCH_ASSOC);

        if (
            $booking &&
            in_array(
                strtolower($booking["status"]),
                ["terjadwal", "disetujui", "digunakan", "berlangsung"],
                true
            )
        ) {
            throw new RuntimeException(
                "Pengajuan memiliki booking aktif. Batalkan booking melalui prosedur yang sesuai terlebih dahulu."
            );
        }

        $stmtUpdate = $pdo->prepare("
            UPDATE pengajuan
            SET
                status = 'ditolak',
                alasan_penolakan = :alasan
            WHERE id_pengajuan = :id
        ");

        $stmtUpdate->execute([
            ":alasan" => $alasan,
            ":id" => $idPengajuan
        ]);

        $pdo->commit();

        responsJSON(
            true,
            "Pengajuan berhasil ditolak.",
            200,
            [
                "idPengajuan" => $idPengajuan,
                "status" => "ditolak",
                "alasan" => $alasan
            ]
        );
    }

    // =========================================
    // C. BATALKAN PERSETUJUAN
    // =========================================
    elseif ($aksi === "batalkan_persetujuan") {

        if ($status !== "disetujui") {
            throw new RuntimeException(
                "Pengajuan tidak berstatus disetujui."
            );
        }

        $stmtBooking = $pdo->prepare("
            SELECT id_booking, status
            FROM booking
            WHERE id_pengajuan = :id
            FOR UPDATE
        ");

        $stmtBooking->execute([
            ":id" => $idPengajuan
        ]);

        $booking = $stmtBooking->fetch(PDO::FETCH_ASSOC);

        if (!$booking) {
            throw new RuntimeException(
                "Data booking tidak ditemukan."
            );
        }

        if (
            strtolower($booking["status"]) !== "terjadwal"
        ) {
            throw new RuntimeException(
                "Booking tidak lagi berada dalam status terjadwal."
            );
        }

        // Periksa batas waktu presensi 15 menit.
        $waktuMulai = new DateTimeImmutable(
            $pengajuan["waktu_mulai"],
            new DateTimeZone("Asia/Jayapura")
        );

        $sekarang = new DateTimeImmutable(
            "now",
            new DateTimeZone("Asia/Jayapura")
        );

        $batasPresensi = $waktuMulai->modify("+15 minutes");

        if ($sekarang >= $batasPresensi) {
            throw new RuntimeException(
                "Batas waktu presensi 15 menit sudah habis. Pembatalan tidak dapat dilakukan."
            );
        }

        // Batalkan booking.
        $stmtUpdateBooking = $pdo->prepare("
            UPDATE booking
            SET status = 'dibatalkan'
            WHERE id_booking = :id
        ");

        $stmtUpdateBooking->execute([
            ":id" => $booking["id_booking"]
        ]);

        // Kembalikan pengajuan ke antrean.
        $stmtUpdatePengajuan = $pdo->prepare("
            UPDATE pengajuan
            SET status = 'menunggu'
            WHERE id_pengajuan = :id
        ");

        $stmtUpdatePengajuan->execute([
            ":id" => $idPengajuan
        ]);

        // Perbarui riwayat validasi.
        $stmtUpdateValidasi = $pdo->prepare("
            UPDATE validasi_booking
            SET
                status = 'dibatalkan',
                waktu_divalidasi = NOW()
            WHERE id_booking = :id
        ");

        $stmtUpdateValidasi->execute([
            ":id" => $booking["id_booking"]
        ]);

        $pdo->commit();

        responsJSON(
            true,
            "Persetujuan berhasil dibatalkan. Pengajuan dikembalikan ke antrean verifikasi.",
            200,
            [
                "idPengajuan" => $idPengajuan,
                "idBooking" => (int) $booking["id_booking"],
                "status" => "menunggu",
                "statusBooking" => "dibatalkan"
            ]
        );
    }

    // =========================================
    // D. AKSI TIDAK DIKENALI
    // =========================================
    else {

        throw new RuntimeException(
            "Jenis tindakan tidak dikenali."
        );
    }

} catch (RuntimeException $e) {

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    responsJSON(
        false,
        $e->getMessage(),
        400
    );

} catch (Throwable $e) {

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log(
        "SILAB tindakan antrean: " . $e->getMessage()
    );

    responsJSON(
        false,
        "Terjadi kesalahan pada server saat memproses tindakan.",
        500
    );
}