<?php

declare(strict_types=1);

date_default_timezone_set('Asia/Jayapura');

// =============================================
// SILAB - API PENGAJUAN PENGGUNA
// =============================================

// Session dan koneksi database
require_once __DIR__ . "/../auth/sesi.php";
require_once __DIR__ . "/../../config/database.php";
require_once __DIR__ . "/../../config/algoritma_silab.php";

header("Content-Type: application/json; charset=UTF-8");

// =============================================
// RESPONSE JSON
// =============================================

function jsonResponse(
    bool $success,
    string $message,
    array $data = [],
    int $httpCode = 200
): void {
    http_response_code($httpCode);

    echo json_encode([
        "success" => $success,
        "message" => $message,
        "data" => $data
    ], JSON_UNESCAPED_UNICODE);

    exit;
}

// =============================================
// VALIDASI SESSION PENGGUNA
// =============================================

if (
    !sudahLogin() ||
    ($_SESSION["role"] ?? "") !== "pengguna"
) {
    jsonResponse(
        false,
        "Akses ditolak. Silakan login sebagai Pengguna.",
        [],
        403
    );
}

$idUser = (int) ($_SESSION["id_user"] ?? 0);

if ($idUser <= 0) {
    jsonResponse(
        false,
        "Sesi pengguna tidak valid.",
        [],
        401
    );
}

// =============================================
// FUNGSI BANTU
// =============================================

function getInput(): array
{
    $contentType = $_SERVER["CONTENT_TYPE"] ?? "";

    if (stripos($contentType, "application/json") !== false) {
        $input = json_decode(
            file_get_contents("php://input"),
            true
        );

        return is_array($input) ? $input : [];
    }

    return $_POST;
}

function validId($value): bool
{
    return filter_var(
        $value,
        FILTER_VALIDATE_INT,
        ["options" => ["min_range" => 1]]
    ) !== false;
}

function validDateTime(string $value): ?DateTime
{
    $date = DateTime::createFromFormat(
        "!Y-m-d\TH:i",
        $value
    );

    $errors = DateTime::getLastErrors();

    if (
        !$date ||
        ($errors !== false &&
            ($errors["warning_count"] > 0 ||
                $errors["error_count"] > 0)) ||
        $date->format("Y-m-d\TH:i") !== $value
    ) {
        return null;
    }

    return $date;
}

// =============================================
// REQUEST DAN ACTION
// =============================================

$method = $_SERVER["REQUEST_METHOD"] ?? "GET";
$input = getInput();

$action = $input["action"] ?? $_GET["action"] ?? "";

try {

    // =========================================
    // 0. AMBIL RIWAYAT PENGAJUAN PENGGUNA
    // GET ?action=history
    // =========================================


    // =========================================
// 0. AMBIL RIWAYAT PENGAJUAN PENGGUNA
// =========================================

    if ($method === "GET" && $action === "history") {

        $stmt = $pdo->prepare("
        SELECT
            p.id_pengajuan,
            p.nama_kegiatan,
            p.waktu_mulai,
            p.waktu_selesai,
            p.status,
            p.waktu_dibuat,

            COALESCE(
                GROUP_CONCAT(
                    DISTINCT ak.nama_kriteria
                    ORDER BY ak.nama_kriteria
                    SEPARATOR ', '
                ),
                '-'
            ) AS kategori

        FROM pengajuan p

        LEFT JOIN pengajuan_aturan pa
            ON pa.id_pengajuan = p.id_pengajuan

        LEFT JOIN aturan_kriteria ak
            ON ak.id_aturan_kriteria = pa.id_aturan_kriteria

        WHERE p.id_user = :id_user

        GROUP BY
            p.id_pengajuan,
            p.nama_kegiatan,
            p.waktu_mulai,
            p.waktu_selesai,
            p.status,
            p.waktu_dibuat

        ORDER BY
            CASE
                WHEN LOWER(TRIM(p.status)) = 'disetujui' THEN 1
                WHEN LOWER(TRIM(p.status)) = 'tergeser' THEN 2
                ELSE 3
            END ASC,

            p.waktu_dibuat DESC,
            p.id_pengajuan DESC
    ");

        $stmt->execute([
            ":id_user" => $idUser
        ]);

        $history = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $history = array_map(
            function ($item) {

                return [
                    "id_pengajuan" => (int) $item["id_pengajuan"],
                    "namaKegiatan" => $item["nama_kegiatan"],
                    "waktuMulai" => $item["waktu_mulai"],
                    "waktuSelesai" => $item["waktu_selesai"],
                    "createdAt" => $item["waktu_dibuat"],
                    "status" => $item["status"],
                    "kategori" => $item["kategori"]
                ];

            },
            $history
        );

        jsonResponse(
            true,
            "Riwayat pengajuan berhasil diambil.",
            [
                "history" => $history
            ]
        );
    }


    // =========================================
    // 1. AMBIL ATURAN, KRITERIA, DAN FASILITAS
    // GET ?action=config
    // =========================================

    if ($method === "GET" && $action === "config") {

        // Ambil kelompok aturan.
        $stmt = $pdo->query("
            SELECT
                id_aturan,
                nama_kelompok,
                bobot
            FROM aturan
            ORDER BY id_aturan ASC
        ");

        $rules = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Ambil kriteria.
        $stmt = $pdo->query("
            SELECT
                id_aturan_kriteria,
                id_aturan,
                nama_kriteria,
                bobot
            FROM aturan_kriteria
            ORDER BY id_aturan ASC,
                     id_aturan_kriteria ASC
        ");

        $criteria = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Gabungkan kriteria berdasarkan kelompok aturan.
        foreach ($rules as &$rule) {

            $rule["id"] = (string) $rule["id_aturan"];
            $rule["name"] = $rule["nama_kelompok"];
            $rule["criteria"] = [];

            foreach ($criteria as $item) {

                if (
                    (int) $item["id_aturan"] ===
                    (int) $rule["id_aturan"]
                ) {
                    $rule["criteria"][] = [
                        "id" => (string) $item["id_aturan_kriteria"],
                        "name" => $item["nama_kriteria"],
                        "weight" => (float) $item["bobot"]
                    ];
                }
            }
        }

        unset($rule);

        // Ambil fasilitas.
        $stmt = $pdo->query("
            SELECT
                id_fasilitas,
                nama_fasilitas,
                kapasitas_maksimum,
                bobot,
                deskripsi
            FROM fasilitas
            ORDER BY id_fasilitas ASC
        ");

        $facilities = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $facilities = array_map(
            function ($item) {
                return [
                    "id" => (string) $item["id_fasilitas"],
                    "name" => $item["nama_fasilitas"],
                    "capacity" => (int) $item["kapasitas_maksimum"],
                    "weight" => (float) $item["bobot"],
                    "description" => $item["deskripsi"]
                ];
            },
            $facilities
        );

        jsonResponse(
            true,
            "Konfigurasi pengajuan berhasil diambil.",
            [
                "rules" => $rules,
                "facilities" => $facilities
            ]
        );
    }

    // =========================================
    // 2. SIMPAN PENGAJUAN
    // POST ?action=submit
    // =========================================

    if ($method === "POST" && $action === "submit") {

        $namaKegiatan = trim(
            $input["namaKegiatan"] ?? ""
        );

        $waktuMulai = trim(
            $input["waktuMulai"] ?? ""
        );

        $waktuSelesai = trim(
            $input["waktuSelesai"] ?? ""
        );

        $selectedCriteria = $input["aturanKriteria"] ?? [];
        $facilityRequests = $input["fasilitas"] ?? [];

        // -------------------------------------
        // VALIDASI NAMA KEGIATAN
        // -------------------------------------

        if (
            $namaKegiatan === "" ||
            mb_strlen($namaKegiatan) > 150
        ) {
            jsonResponse(
                false,
                "Nama kegiatan wajib diisi dan maksimal 150 karakter.",
                [],
                422
            );
        }

        // -------------------------------------
        // VALIDASI WAKTU
        // -------------------------------------

        $mulai = validDateTime($waktuMulai);
        $selesai = validDateTime($waktuSelesai);

        if (!$mulai || !$selesai) {
            jsonResponse(
                false,
                "Format tanggal dan waktu tidak valid.",
                [],
                422
            );
        }

        $sekarang = new DateTime();

        if ($mulai <= $sekarang) {
            jsonResponse(
                false,
                "Waktu mulai tidak boleh berada di masa lalu.",
                [],
                422
            );
        }

        if ($selesai <= $mulai) {
            jsonResponse(
                false,
                "Waktu selesai harus setelah waktu mulai.",
                [],
                422
            );
        }

        if (
            $mulai->format("Y-m-d") !==
            $selesai->format("Y-m-d")
        ) {
            jsonResponse(
                false,
                "Peminjaman tidak boleh melewati pergantian tanggal.",
                [],
                422
            );
        }

        $jamMulai = (int) $mulai->format("H");
        $jamSelesai = (int) $selesai->format("H");

        if ($jamMulai < 6 || $jamMulai >= 22) {
            jsonResponse(
                false,
                "Waktu mulai harus berada antara pukul 06.00–22.00 WIT.",
                [],
                422
            );
        }

        if (
            $jamSelesai > 22 ||
            ($jamSelesai === 22 && $selesai->format("i") !== "00")
        ) {
            jsonResponse(
                false,
                "Waktu selesai tidak boleh melewati pukul 22.00 WIT.",
                [],
                422
            );
        }

        // -------------------------------------
        // VALIDASI FORMAT PILIHAN
        // -------------------------------------

        if (
            !is_array($selectedCriteria) ||
            !is_array($facilityRequests)
        ) {
            jsonResponse(
                false,
                "Format pilihan pengajuan tidak valid.",
                [],
                422
            );
        }

        // =====================================
        // VALIDASI KRITERIA DARI DATABASE
        // =====================================

        $stmt = $pdo->query("
            SELECT
                a.id_aturan,
                a.nama_kelompok,
                ak.id_aturan_kriteria
            FROM aturan a
            INNER JOIN aturan_kriteria ak
                ON ak.id_aturan = a.id_aturan
            ORDER BY a.id_aturan ASC
        ");

        $databaseCriteria = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $requiredRules = [];
        $validCriteria = [];

        foreach ($databaseCriteria as $item) {

            $namaKelompok = $item["nama_kelompok"];

            if (
                stripos($namaKelompok, "waktu pengajuan") !== false
            ) {
                continue;
            }

            $idAturan = (int) $item["id_aturan"];

            $requiredRules[$idAturan] = true;

            $validCriteria[
                (int) $item["id_aturan_kriteria"]
            ] = $idAturan;
        }

        $selectedByRule = [];

        foreach ($selectedCriteria as $criteriaId) {

            if (!validId($criteriaId)) {
                jsonResponse(
                    false,
                    "Pilihan kriteria tidak valid.",
                    [],
                    422
                );
            }

            $criteriaId = (int) $criteriaId;

            if (!isset($validCriteria[$criteriaId])) {
                jsonResponse(
                    false,
                    "Kriteria tidak ditemukan.",
                    [],
                    422
                );
            }

            $ruleId = $validCriteria[$criteriaId];

            if (isset($selectedByRule[$ruleId])) {
                jsonResponse(
                    false,
                    "Satu kelompok aturan hanya boleh memiliki satu pilihan.",
                    [],
                    422
                );
            }

            $selectedByRule[$ruleId] = $criteriaId;
        }

        foreach ($requiredRules as $ruleId => $required) {

            if (!isset($selectedByRule[$ruleId])) {
                jsonResponse(
                    false,
                    "Semua kelompok aturan wajib dipilih.",
                    [],
                    422
                );
            }
        }

        // =====================================
        // VALIDASI FASILITAS
        // =====================================

        $stmt = $pdo->query("
            SELECT
                id_fasilitas,
                nama_fasilitas,
                kapasitas_maksimum
            FROM fasilitas
        ");

        $databaseFacilities = [];

        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $item) {

            $databaseFacilities[
                (int) $item["id_fasilitas"]
            ] = $item;
        }

        $validFacilities = [];
        $selectedFacilityIds = [];

        foreach ($facilityRequests as $item) {

            if (!is_array($item)) {
                jsonResponse(
                    false,
                    "Format fasilitas tidak valid.",
                    [],
                    422
                );
            }

            $facilityId = $item["id_fasilitas"] ?? "";
            $quantity = $item["jumlah"] ?? "";

            if (
                !validId($facilityId) ||
                filter_var(
                    $quantity,
                    FILTER_VALIDATE_INT,
                    ["options" => ["min_range" => 0]]
                ) === false
            ) {
                jsonResponse(
                    false,
                    "ID atau jumlah fasilitas tidak valid.",
                    [],
                    422
                );
            }

            $facilityId = (int) $facilityId;
            $quantity = (int) $quantity;

            if (isset($selectedFacilityIds[$facilityId])) {
                jsonResponse(
                    false,
                    "Fasilitas tidak boleh dikirim berulang.",
                    [],
                    422
                );
            }

            $selectedFacilityIds[$facilityId] = true;

            if ($quantity === 0) {
                continue;
            }

            if (!isset($databaseFacilities[$facilityId])) {
                jsonResponse(
                    false,
                    "Fasilitas tidak ditemukan.",
                    [],
                    422
                );
            }

            $facility = $databaseFacilities[$facilityId];

            if (
                $quantity >
                (int) $facility["kapasitas_maksimum"]
            ) {
                jsonResponse(
                    false,
                    "Jumlah fasilitas {$facility['nama_fasilitas']} melebihi kapasitas maksimum.",
                    [],
                    422
                );
            }

            $validFacilities[] = [
                "id_fasilitas" => $facilityId,
                "jumlah" => $quantity
            ];
        }

        if (count($validFacilities) === 0) {
            jsonResponse(
                false,
                "Pilih minimal satu fasilitas.",
                [],
                422
            );
        }

        // =====================================
        // SIMPAN PENGAJUAN + VALIDASI ANTI-SPAM
        // =====================================

        $pdo->beginTransaction();

        try {

            // 1. Kunci data pengguna agar tidak bisa
            // mengirim dua pengajuan secara bersamaan.

            $stmtLock = $pdo->prepare("
                SELECT id_user
                FROM users
                WHERE id_user = :id_user
                FOR UPDATE
            ");

            $stmtLock->execute([
                ":id_user" => $idUser
            ]);

            if (!$stmtLock->fetch(PDO::FETCH_ASSOC)) {
                throw new RuntimeException(
                    "Data pengguna tidak ditemukan."
                );
            }

            // 2. Periksa pengajuan terakhir pengguna.
            // Batas pengiriman ulang: 60 detik.

            $stmt = $pdo->prepare("
                SELECT
                    TIMESTAMPDIFF(
                        SECOND,
                        NOW(),
                        DATE_ADD(
                            MAX(waktu_dibuat),
                            INTERVAL 60 SECOND
                        )
                    ) AS sisa_detik

                FROM pengajuan

                WHERE id_user = :id_user

                HAVING sisa_detik > 0
            ");

            $stmt->execute([
                ":id_user" => $idUser
            ]);

            $lastSubmission = $stmt->fetch(PDO::FETCH_ASSOC);

            if (
                $lastSubmission &&
                (int) $lastSubmission["sisa_detik"] > 0
            ) {

                $sisaDetik = (int) $lastSubmission["sisa_detik"];

                $pdo->rollBack();

                jsonResponse(
                    false,
                    "Anda baru saja mengirim pengajuan. Silakan tunggu "
                    . ceil($sisaDetik / 60)
                    . " menit lagi.",
                    [
                        "retry_after_seconds" => $sisaDetik
                    ],
                    429
                );
            }

            // 3. Simpan data utama ke tabel pengajuan.

            $stmtPengajuan = $pdo->prepare("
                INSERT INTO pengajuan (
                    id_user,
                    nama_kegiatan,
                    waktu_mulai,
                    waktu_selesai,
                    status
                ) VALUES (
                    :id_user,
                    :nama_kegiatan,
                    :waktu_mulai,
                    :waktu_selesai,
                    'Menunggu'
                )
            ");

            $stmtPengajuan->execute([
                ":id_user" => $idUser,
                ":nama_kegiatan" => $namaKegiatan,
                ":waktu_mulai" => $mulai->format("Y-m-d H:i:s"),
                ":waktu_selesai" => $selesai->format("Y-m-d H:i:s")
            ]);

            $idPengajuan = (int) $pdo->lastInsertId();

            // 4. Simpan pilihan kriteria.

            $stmtAturan = $pdo->prepare("
                INSERT INTO pengajuan_aturan (
                    id_pengajuan,
                    id_aturan_kriteria
                ) VALUES (
                    :id_pengajuan,
                    :id_aturan_kriteria
                )
            ");

            foreach ($selectedByRule as $criteriaId) {

                $stmtAturan->execute([
                    ":id_pengajuan" => $idPengajuan,
                    ":id_aturan_kriteria" => $criteriaId
                ]);
            }

            // 5. Simpan fasilitas.

            $stmtFasilitas = $pdo->prepare("
                INSERT INTO pengajuan_fasilitas (
                    id_pengajuan,
                    id_fasilitas,
                    jumlah
                ) VALUES (
                    :id_pengajuan,
                    :id_fasilitas,
                    :jumlah
                )
            ");

            foreach ($validFacilities as $facility) {

                $stmtFasilitas->execute([
                    ":id_pengajuan" => $idPengajuan,
                    ":id_fasilitas" => $facility["id_fasilitas"],
                    ":jumlah" => $facility["jumlah"]
                ]);
            }

            // 6. Hitung skor dan klasifikasi prioritas.

            $hasilSkor = hitungSkorPengajuan(
                $pdo,
                $idPengajuan
            );

            // 7. Simpan seluruh transaksi.

            $pdo->commit();

            jsonResponse(
                true,
                "Pengajuan berhasil dikirim dan skor berhasil dihitung.",
                [
                    "id_pengajuan" => $idPengajuan,
                    "penilaian" => $hasilSkor
                ]
            );

        } catch (Throwable $e) {

            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $e;
        }
    }

    // =========================================
    // 3. AMBIL JADWAL PENGGUNA
    // GET ?action=schedule
    // =========================================


    // =========================================
// 3. AMBIL JADWAL HARI INI PENGGUNA
// GET ?action=schedule
// =========================================

    if ($method === "GET" && $action === "schedule") {

        $zonaWaktu = new DateTimeZone("Asia/Jayapura");

        $sekarang = new DateTimeImmutable("now", $zonaWaktu);

        $tanggalHariIni = $sekarang->format("Y-m-d");

        $waktuSekarang = $sekarang->format("Y-m-d H:i:s");

        $stmt = $pdo->prepare("

        SELECT
            p.id_pengajuan,
            p.nama_kegiatan,
            p.waktu_mulai,
            p.waktu_selesai,
            p.status AS status_pengajuan,

            b.id_booking,
            b.status AS status_booking,

            u.nama AS nama_pemohon,

            (
                SELECT COALESCE(SUM(pf.jumlah), 0)
                FROM pengajuan_fasilitas pf

                INNER JOIN fasilitas f
                    ON f.id_fasilitas = pf.id_fasilitas

                WHERE pf.id_pengajuan = p.id_pengajuan
                  AND LOWER(f.nama_fasilitas) LIKE '%pc%'

            ) AS kebutuhan_pc,

            (
                SELECT COALESCE(SUM(pf.jumlah), 0)
                FROM pengajuan_fasilitas pf

                INNER JOIN fasilitas f
                    ON f.id_fasilitas = pf.id_fasilitas

                WHERE pf.id_pengajuan = p.id_pengajuan
                  AND LOWER(f.nama_fasilitas) LIKE '%kursi%'

            ) AS kebutuhan_kursi

        FROM pengajuan p

        INNER JOIN booking b
            ON b.id_pengajuan = p.id_pengajuan

        INNER JOIN users u
            ON u.id_user = p.id_user

        WHERE p.id_user = :id_user

          AND LOWER(TRIM(p.status)) = 'disetujui'

          AND LOWER(TRIM(b.status)) = 'terjadwal'

          AND DATE(p.waktu_mulai) = :tanggal

          AND p.waktu_selesai >= :sekarang

        ORDER BY
            p.waktu_mulai ASC

    ");

        $stmt->execute([
            ":id_user" => $idUser,
            ":tanggal" => $tanggalHariIni,
            ":sekarang" => $waktuSekarang
        ]);

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $jadwal = [];

        foreach ($rows as $row) {

            $jadwal[] = [

                "id" => (int) $row["id_pengajuan"],

                "id_booking" => (int) $row["id_booking"],

                "kegiatan" => $row["nama_kegiatan"],

                "tanggal" => date(
                    "Y-m-d",
                    strtotime($row["waktu_mulai"])
                ),

                "mulai" => date(
                    "H:i",
                    strtotime($row["waktu_mulai"])
                ),

                "selesai" => date(
                    "H:i",
                    strtotime($row["waktu_selesai"])
                ),

                "pc" => (int) $row["kebutuhan_pc"],

                "kursi" => (int) $row["kebutuhan_kursi"],

                "kelas" => "Penggunaan Laboratorium",

                "pemohon" => $row["nama_pemohon"],

                "status" => $row["status_booking"],

                "status_pengajuan" => $row["status_pengajuan"]

            ];
        }

        jsonResponse(
            true,
            "Jadwal hari ini berhasil diambil.",
            [
                "jadwal" => $jadwal
            ]
        );
    }


    // =========================================
    // ACTION TIDAK DIKENALI
    // =========================================

    jsonResponse(
        false,
        "Aksi API tidak dikenali.",
        [],
        400
    );

} catch (PDOException $e) {

    error_log(
        "API PENGAJUAN DATABASE ERROR: " . $e->getMessage()
    );

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    jsonResponse(
        false,
        "Terjadi kesalahan saat memproses pengajuan.",
        [],
        500
    );

} catch (Throwable $e) {

    error_log(
        "API PENGAJUAN ERROR: " . $e->getMessage()
    );

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    jsonResponse(
        false,
        "Terjadi kesalahan saat memproses pengajuan.",
        [],
        500
    );
}
