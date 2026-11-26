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
    kirimRespons(
        401,
        false,
        "Silakan login terlebih dahulu."
    );
}

$role = (string) ($_SESSION["role"] ?? "");

if (!in_array($role, ["laboran", "kepala_lab"], true)) {
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

    // API ini hanya bertugas mengambil data jadwal.
    // Tidak melakukan perubahan status booking.
    // Pemeriksaan presensi kedaluwarsa ditangani
    // sepenuhnya oleh kadaluwarsa.php.

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

            -- HASIL PERHITUNGAN PRIORITAS
            sp.skor_akhir AS skorAkhir,
            sp.prioritas AS prioritas,

            ak.nama_kriteria AS kategori,

        CASE
            -- K1: Mata Kuliah Wajib
            WHEN LOWER(TRIM(ak.nama_kriteria))
                LIKE 'mata kuliah wajib%'
                THEN 'K1'

            -- K2: Kelas Mata Kuliah Pengganti
            WHEN LOWER(TRIM(ak.nama_kriteria))
                LIKE 'kelas pengganti%'
                OR LOWER(TRIM(ak.nama_kriteria))
                LIKE 'mata kuliah pengganti%'
                THEN 'K2'

            -- K3: Praktikum dan Asistensi
            WHEN LOWER(TRIM(ak.nama_kriteria))
                LIKE 'praktikum%'
                OR LOWER(TRIM(ak.nama_kriteria))
                LIKE 'asistensi%'
                THEN 'K3'

            -- K4: Organisasi HMTI
            WHEN LOWER(TRIM(ak.nama_kriteria))
                LIKE 'hmti%'
                OR LOWER(TRIM(ak.nama_kriteria))
                LIKE 'organisasi%'
                THEN 'K4'

            -- K5: Belajar Mandiri Mahasiswa
            WHEN LOWER(TRIM(ak.nama_kriteria))
                LIKE 'belajar mandiri%'
                THEN 'K5'

            ELSE NULL
        END AS kodeKategori,

            vb.status AS status_presensi

        FROM booking b

        INNER JOIN pengajuan p
            ON p.id_pengajuan = b.id_pengajuan

        INNER JOIN users u
            ON u.id_user = p.id_user

        LEFT JOIN skor_pengajuan sp
    ON sp.id_pengajuan = p.id_pengajuan

        LEFT JOIN pengajuan_aturan pa
            ON pa.id_pengajuan_aturan = (
                SELECT MIN(pa2.id_pengajuan_aturan)
                FROM pengajuan_aturan pa2

                INNER JOIN aturan_kriteria ak2
                    ON ak2.id_aturan_kriteria =
                       pa2.id_aturan_kriteria

                INNER JOIN aturan a2
                    ON a2.id_aturan = ak2.id_aturan

                WHERE pa2.id_pengajuan = p.id_pengajuan
                  AND a2.nama_kelompok = 'Jenis Kegiatan'
            )

        LEFT JOIN aturan_kriteria ak
            ON ak.id_aturan_kriteria = pa.id_aturan_kriteria

        LEFT JOIN aturan a
            ON a.id_aturan = ak.id_aturan
           AND a.nama_kelompok = 'Jenis Kegiatan'

       LEFT JOIN (
    SELECT
        vb1.id_booking,
        vb1.id_validasi_booking,
        vb1.status
    FROM validasi_booking vb1

    INNER JOIN (
        SELECT
            id_booking,
            MAX(id_validasi_booking) AS id_terakhir
        FROM validasi_booking
        GROUP BY id_booking
    ) terbaru
        ON terbaru.id_terakhir = vb1.id_validasi_booking
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
    // 8. MENYESUAIKAN FORMAT DATA JSON
    // =====================================

    // =====================================
    // 8. MENYESUAIKAN FORMAT DATA JSON
    // =====================================

    $data = [];

    foreach ($daftarJadwal as $booking) {

        $statusPresensi = strtolower(
            trim((string) ($booking["status_presensi"] ?? ""))
        );

        $data[] = [
            "id" => (int) $booking["id"],

            "idPengajuan" => (int) $booking["id_pengajuan"],

            "tanggal" => $booking["tanggal"],

            "waktuMulai" => $booking["waktuMulai"],

            "waktuSelesai" => $booking["waktuSelesai"],

            "namaKegiatan" => $booking["namaKegiatan"],

            "namaPemohon" => $booking["namaPemohon"],

            "kategori" => $booking["kategori"],

            "kodeKategori" => $booking["kodeKategori"],

            // HASIL SKOR DAN PRIORITAS
            "skorAkhir" => $booking["skorAkhir"] !== null
                ? (float) $booking["skorAkhir"]
                : null,

            "prioritas" => $booking["prioritas"] !== null
                ? (int) $booking["prioritas"]
                : null,

            "status" => $booking["status"],

            // Status presensi terakhir
            "presensi" => $statusPresensi !== ""
                ? [
                    "status" => $statusPresensi
                ]
                : null,

            // Hanya presensi final yang dianggap sudah tercatat
            "sudahPresensi" => in_array(
                $statusPresensi,
                ["digunakan", "tidak_digunakan"],
                true
            )
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

} catch (Throwable $e) {

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
