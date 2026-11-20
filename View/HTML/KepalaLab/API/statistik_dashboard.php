<?php

declare(strict_types=1);

header("Content-Type: application/json; charset=UTF-8");

date_default_timezone_set("Asia/Jayapura");

// =========================================
// SILAB - API STATISTIK DASHBOARD KEPALA LAB
// =========================================

require_once __DIR__ . "/../../auth/sesi.php";

if (!sudahLogin()) {
    http_response_code(401);
    echo json_encode([
        "success" => false,
        "message" => "Silakan login terlebih dahulu.",
        "data" => []
    ]);
    exit;
}

if (($_SESSION["role"] ?? "") !== "kepala_lab") {
    http_response_code(403);
    echo json_encode([
        "success" => false,
        "message" => "Anda tidak memiliki akses.",
        "data" => []
    ]);
    exit;
}

require_once __DIR__ . "/../../../config/database.php";

function kirimJSON(
    int $kode,
    bool $success,
    string $message,
    array $data = []
): void {
    http_response_code($kode);

    echo json_encode([
        "success" => $success,
        "message" => $message,
        "data" => $data
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);

    exit;
}

try {

    // Samakan zona waktu database dengan WIT.
    $pdo->exec("SET time_zone = '+09:00'");

    $tanggalHariIni = date("Y-m-d");

    // =====================================
    // 1. RINGKASAN JADWAL HARI INI
    // =====================================

    $stmtJadwal = $pdo->prepare("
        SELECT
            COUNT(*) AS total_sesi,

            SUM(
                CASE
                    WHEN p.waktu_mulai <= NOW()
                    AND p.waktu_selesai >= NOW()
                    THEN 1
                    ELSE 0
                END
            ) AS sesi_berlangsung,

            MIN(p.waktu_mulai) AS jadwal_mulai,

            MAX(p.waktu_selesai) AS jadwal_selesai

        FROM booking b

        INNER JOIN pengajuan p
            ON p.id_pengajuan = b.id_pengajuan

        WHERE DATE(p.waktu_mulai) = :tanggal

        AND LOWER(TRIM(b.status)) IN (
            'terjadwal',
            'disetujui',
            'berlangsung',
            'digunakan'
        )
    ");

    $stmtJadwal->execute([
        ":tanggal" => $tanggalHariIni
    ]);

    $jadwal = $stmtJadwal->fetch(PDO::FETCH_ASSOC);

    // =====================================
    // 2. RINGKASAN PEMINJAMAN LAB
    // =====================================

    $stmtPengajuan = $pdo->query("
        SELECT
            COUNT(*) AS total_pengajuan,

            SUM(
                CASE
                    WHEN LOWER(TRIM(status)) = 'disetujui'
                    THEN 1
                    ELSE 0
                END
            ) AS disetujui

        FROM pengajuan
    ");

    $peminjaman = $stmtPengajuan->fetch(PDO::FETCH_ASSOC);

    // =====================================
    // 3. EVALUASI BENTROKAN
    // =====================================

    $stmtKonflik = $pdo->query("
        SELECT
            COUNT(*) AS total_konflik,

            SUM(
                CASE
                    WHEN LOWER(TRIM(status)) = 'menunggu_keputusan'
                    THEN 1
                    ELSE 0
                END
            ) AS menunggu_keputusan

        FROM konflik

        WHERE LOWER(TRIM(status)) NOT IN (
            'selesai',
            'ditutup',
            'dibatalkan'
        )
    ");

    $konflik = $stmtKonflik->fetch(PDO::FETCH_ASSOC);

    // =====================================
    // 4. FORMAT RESPONS
    // =====================================

    kirimJSON(
        200,
        true,
        "Statistik dashboard berhasil dimuat.",
        [
            "tanggal" => $tanggalHariIni,

            "jadwal" => [
                "totalSesi" => (int) ($jadwal["total_sesi"] ?? 0),
                "sesiBerlangsung" => (int) ($jadwal["sesi_berlangsung"] ?? 0),
                "jadwalMulai" => $jadwal["jadwal_mulai"],
                "jadwalSelesai" => $jadwal["jadwal_selesai"]
            ],

            "peminjaman" => [
                "totalPengajuan" => (int) ($peminjaman["total_pengajuan"] ?? 0),
                "disetujui" => (int) ($peminjaman["disetujui"] ?? 0)
            ],

            "konflik" => [
                "totalKonflik" => (int) ($konflik["total_konflik"] ?? 0),
                "menungguKeputusan" => (int) ($konflik["menunggu_keputusan"] ?? 0)
            ]
        ]
    );

} catch (Throwable $e) {

    error_log(
        "SILAB STATISTIK DASHBOARD: " . $e->getMessage()
    );

    kirimJSON(
        500,
        false,
        "Terjadi kesalahan saat mengambil statistik dashboard."
    );
}
