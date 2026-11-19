<?php

declare(strict_types=1);

// =========================================
// SILAB - API PENGAMBILAN ANTREAN LABORAN
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
        JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE
    );

    exit;
}

// =========================================
// 1. SESSION DAN AUTENTIKASI
// =========================================

require_once __DIR__ . "/../../auth/sesi.php";

if (!sudahLogin()) {
    kirimRespons(401, false, "Silakan login terlebih dahulu.");
}

if (($_SESSION["role"] ?? "") !== "laboran") {
    kirimRespons(403, false, "Anda tidak memiliki akses.");
}

// =========================================
// 2. PEMERIKSAAN METODE REQUEST
// =========================================

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    header("Allow: GET");
    kirimRespons(405, false, "Metode request tidak diizinkan.");
}

// =========================================
// 3. KONEKSI DATABASE
// =========================================

require_once __DIR__ . "/../../../config/database.php";

// =========================================
// 4. MENGAMBIL DATA ANTREAN
// =========================================

try {
    /*
     * Query menggunakan kolom yang sudah terkonfirmasi
     * pada struktur tabel SILAB saat ini.
     *
     * Kolom skor, prioritas, kebutuhan PC/kursi, dan kategori
     * belum diambil karena belum tersedia/terkonfirmasi pada
     * struktur tabel pengajuan yang diberikan.
     */

    $query = "
        SELECT
            p.id_pengajuan,
            p.id_user,
            p.nama_kegiatan,
            p.waktu_mulai,
            p.waktu_selesai,
            p.status AS status_pengajuan,
            p.waktu_dibuat,

            u.nama AS nama_pemohon,
            u.nip_npm AS identifier,

            b.id_booking,
            b.status AS status_booking,

            vb.status AS status_presensi

        FROM pengajuan p

        INNER JOIN users u
            ON u.id_user = p.id_user

        LEFT JOIN booking b
            ON b.id_pengajuan = p.id_pengajuan

        LEFT JOIN validasi_booking vb
            ON vb.id_booking = b.id_booking

        ORDER BY
            p.waktu_dibuat DESC,
            p.id_pengajuan DESC
    ";

    $stmt = $pdo->prepare($query);
    $stmt->execute();

    $daftarPengajuan = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // =====================================
    // 5. NORMALISASI DATA JSON
    // =====================================

    $data = [];

    foreach ($daftarPengajuan as $item) {
        $statusPengajuan = strtolower(trim((string) $item["status_pengajuan"]));
        $statusBooking = strtolower(trim((string) ($item["status_booking"] ?? "")));

        // Booking yang sudah tercatat sebagai jadwal dianggap disetujui.
        if (
            in_array(
                $statusBooking,
                ["terjadwal", "disetujui", "berlangsung", "digunakan"],
                true
            )
        ) {
            $statusTampilan = "disetujui";
        } else {
            $statusTampilan = $statusPengajuan;
        }

        $mulai = new DateTimeImmutable((string) $item["waktu_mulai"]);
        $selesai = new DateTimeImmutable((string) $item["waktu_selesai"]);

        $data[] = [
            "id" => (int) $item["id_pengajuan"],
            "idPengajuan" => (int) $item["id_pengajuan"],
            "idUser" => (int) $item["id_user"],
            "idBooking" => $item["id_booking"] !== null
                ? (int) $item["id_booking"]
                : null,

            "namaKegiatan" => $item["nama_kegiatan"],
            "namaPemohon" => $item["nama_pemohon"],
            "identifier" => $item["identifier"],

            "tanggal" => $mulai->format("Y-m-d"),
            "waktuMulai" => $mulai->format("H:i"),
            "waktuSelesai" => $selesai->format("H:i"),

            // Akan diisi setelah integrasi data kebutuhan fasilitas.
            "kebutuhanPC" => null,
            "kebutuhanKursi" => null,
            "kategori" => null,

            // Akan diisi oleh backend pembobotan setelah tersedia.
            "skor" => null,
            "prioritas" => null,

            "status" => $statusTampilan,
            "statusPengajuan" => $statusPengajuan,
            "statusBooking" => $item["status_booking"],
            "statusPresensi" => $item["status_presensi"],
            "waktuDibuat" => $item["waktu_dibuat"]
        ];
    }

    kirimRespons(
        200,
        true,
        "Data antrean berhasil diambil.",
        $data
    );

} catch (PDOException $e) {
    error_log("SILAB API Antrean - Database Error: " . $e->getMessage());

    kirimRespons(
        500,
        false,
        "Terjadi kesalahan database saat mengambil antrean."
    );

} catch (Throwable $e) {
    error_log("SILAB API Antrean - Error: " . $e->getMessage());

    kirimRespons(
        500,
        false,
        "Terjadi kesalahan pada proses pengambilan antrean."
    );
}