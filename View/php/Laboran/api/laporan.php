<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Jayapura");

header("Content-Type: application/json; charset=UTF-8");

function kirimRespons(
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

// 1. SESSION
require_once __DIR__ . "/../../auth/sesi.php";

// 2. AUTENTIKASI
if (!sudahLogin()) {
    kirimRespons(401, false, "Silakan login terlebih dahulu.");
}

$role = (string) ($_SESSION["role"] ?? "");

if (!in_array($role, ["laboran", "kepala_lab"], true)) {
    kirimRespons(403, false, "Anda tidak memiliki akses.");
}

// 3. METODE REQUEST
if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    header("Allow: GET");
    kirimRespons(405, false, "Metode request tidak diizinkan.");
}
// 4. VALIDASI TANGGAL

$tanggal = trim((string) ($_GET["tanggal"] ?? ""));

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $tanggal)) {
    kirimRespons(
        400,
        false,
        "Format tanggal harus YYYY-MM-DD."
    );
}

[$tahun, $bulan, $hari] = array_map(
    'intval',
    explode('-', $tanggal)
);

if (!checkdate($bulan, $hari, $tahun)) {
    kirimRespons(
        400,
        false,
        "Tanggal laporan tidak valid."
    );
}

// 5. DATABASE
require_once __DIR__ . "/../../../config/database.php";

try {

    $query = "
        SELECT
            p.id_pengajuan,
            b.id_booking,

            DATE(p.waktu_mulai) AS tanggal,

            u.nama AS nama_pemohon,
            u.nip_npm,

            p.nama_kegiatan,

            p.waktu_mulai,
            p.waktu_selesai,

            b.status AS status_booking,

            vb.status AS status_presensi,

            sp.skor_jenis_kegiatan,
            sp.skor_fasilitas,
            sp.skor_akhir,
            sp.prioritas,

            COALESCE(a.jenis_kegiatan, '-') AS jenis_kegiatan,

            COALESCE(f.daftar_fasilitas, '-') AS daftar_fasilitas,

            COALESCE(f.total_pc, 0) AS kebutuhan_pc,
            COALESCE(f.total_kursi, 0) AS kebutuhan_kursi

        FROM booking b

        INNER JOIN pengajuan p
            ON p.id_pengajuan = b.id_pengajuan

        INNER JOIN users u
            ON u.id_user = p.id_user
LEFT JOIN (
    SELECT
        pa.id_pengajuan,

        GROUP_CONCAT(
            CONCAT(
                ar.nama_kelompok,
                ': ',
                ak.nama_kriteria
            )
            SEPARATOR '; '
        ) AS jenis_kegiatan

    FROM pengajuan_aturan pa

    INNER JOIN aturan_kriteria ak
        ON ak.id_aturan_kriteria = pa.id_aturan_kriteria

    INNER JOIN aturan ar
        ON ar.id_aturan = ak.id_aturan

    GROUP BY pa.id_pengajuan

) a
    ON a.id_pengajuan = p.id_pengajuan

        LEFT JOIN (
            SELECT
                pf.id_pengajuan,

                GROUP_CONCAT(
                    CONCAT(
                        fa.nama_fasilitas,
                        ' (',
                        pf.jumlah,
                        ')'
                    )
                    SEPARATOR '; '
                ) AS daftar_fasilitas,

                SUM(
                    CASE
                        WHEN LOWER(fa.nama_fasilitas) LIKE '%pc%'
                        THEN pf.jumlah
                        ELSE 0
                    END
                ) AS total_pc,

                SUM(
                    CASE
                        WHEN LOWER(fa.nama_fasilitas) LIKE '%kursi%'
                        THEN pf.jumlah
                        ELSE 0
                    END
                ) AS total_kursi

            FROM pengajuan_fasilitas pf

            INNER JOIN fasilitas fa
                ON fa.id_fasilitas = pf.id_fasilitas

            GROUP BY pf.id_pengajuan
        ) f
            ON f.id_pengajuan = p.id_pengajuan

        LEFT JOIN (
            SELECT
                id_booking,
                MAX(status) AS status
            FROM validasi_booking
            GROUP BY id_booking
        ) vb
            ON vb.id_booking = b.id_booking

        LEFT JOIN skor_pengajuan sp
            ON sp.id_pengajuan = p.id_pengajuan

        WHERE DATE(p.waktu_mulai) = :tanggal

        ORDER BY p.waktu_mulai ASC
    ";

    $stmt = $pdo->prepare($query);

    $stmt->execute([
        ":tanggal" => $tanggal
    ]);

    $hasil = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $data = [];

    foreach ($hasil as $row) {

        $data[] = [
            "idPengajuan" => (int) $row["id_pengajuan"],

            "idBooking" => (int) $row["id_booking"],

            "tanggal" => $row["tanggal"],

            "namaPemohon" => $row["nama_pemohon"],

            "nipNpm" => $row["nip_npm"],

            "namaKegiatan" => $row["nama_kegiatan"],

            "kategoriKegiatan" => $row["jenis_kegiatan"],

            "waktuMulai" => $row["waktu_mulai"],

            "waktuSelesai" => $row["waktu_selesai"],

            "fasilitas" => $row["daftar_fasilitas"],

            "kebutuhanPC" => (int) $row["kebutuhan_pc"],

            "kebutuhanKursi" => (int) $row["kebutuhan_kursi"],

            "status" => $row["status_booking"],

            "presensi" => [
                "status" => $row["status_presensi"] ?? "menunggu"
            ],

            "skorJenisKegiatan" => $row["skor_jenis_kegiatan"],

            "skorFasilitas" => $row["skor_fasilitas"],

            "skorAkhir" => $row["skor_akhir"],

            "prioritas" => $row["prioritas"]
        ];
    }

    kirimRespons(
        200,
        true,
        "Data laporan berhasil diambil.",
        $data
    );

}  catch (Throwable $e) {

    error_log("SILAB API Laporan: " . $e->getMessage());

    kirimRespons(
        500,
        false,
        "DEBUG SQL: " . $e->getMessage()
    );
}

