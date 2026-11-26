<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=UTF-8');
date_default_timezone_set('Asia/Jayapura');

/*
==================================================
1. RESPONSE JSON
==================================================
*/

function responsJSON(
    bool $success,
    string $message,
    int $httpCode = 200,
    array $data = []
): void {

    http_response_code($httpCode);

    echo json_encode([
        'success' => $success,
        'message' => $message,
        'data' => $data
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);

    exit;
}

/*
==================================================
2. SESSION DAN DATABASE
==================================================
*/

require_once __DIR__ . '/../../auth/sesi.php';
require_once __DIR__ . '/../../../config/database.php';

/*
==================================================
3. VALIDASI AKSES LABORAN
==================================================
*/

if (!sudahLogin()) {
    responsJSON(
        false,
        'Silakan login terlebih dahulu.',
        401
    );
}

$role = strtolower(trim((string) ($_SESSION['role'] ?? '')));

if ($role !== 'laboran') {
    responsJSON(
        false,
        'Akses ditolak. API ini hanya untuk Laboran.',
        403
    );
}

$idLaboran = (int) ($_SESSION['id_user'] ?? 0);

if ($idLaboran <= 0) {
    responsJSON(
        false,
        'Identitas Laboran tidak valid.',
        401
    );
}

/*
==================================================
4. PEMBACAAN REQUEST
==================================================
*/

function ambilInput(): array
{
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';

    if (stripos($contentType, 'application/json') !== false) {

        $input = json_decode(
            file_get_contents('php://input'),
            true
        );

        return is_array($input) ? $input : [];
    }

    return $_POST;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

$input = ambilInput();

$action = $input['action']
    ?? $_GET['action']
    ?? 'list_tergeser';

/*
==================================================
5. FUNGSI BANTU
==================================================
*/

function statusNorm(?string $status): string
{
    return strtolower(trim((string) $status));
}

/*
Mengubah waktu menjadi format database.
*/

function normalisasiWaktu(string $waktu): string
{
    try {

        $tanggal = new DateTimeImmutable(
            $waktu,
            new DateTimeZone('Asia/Jayapura')
        );

        return $tanggal->format('Y-m-d H:i:s');

    } catch (Throwable $e) {

        throw new InvalidArgumentException(
            'Format waktu alternatif tidak valid.'
        );
    }
}

/*
Mengambil data pengajuan yang tergeser.
*/

function ambilPengajuanTergeser(
    PDO $pdo,
    int $idPengajuan
): ?array {

    $sql = "

        SELECT

            p.id_pengajuan AS id,

            p.id_pengajuan,

            p.id_user,

            u.nama AS namaPemohon,

            u.nip_npm AS nipNpm,

            p.nama_kegiatan AS namaKegiatan,

            p.waktu_mulai,

            p.waktu_selesai,

            p.status,

            (
                SELECT COALESCE(SUM(pf.jumlah), 0)

                FROM pengajuan_fasilitas pf

                INNER JOIN fasilitas f
                    ON f.id_fasilitas = pf.id_fasilitas

                WHERE pf.id_pengajuan = p.id_pengajuan

                  AND LOWER(f.nama_fasilitas) LIKE '%pc%'

            ) AS kebutuhanPC,

            (
                SELECT COALESCE(SUM(pf.jumlah), 0)

                FROM pengajuan_fasilitas pf

                INNER JOIN fasilitas f
                    ON f.id_fasilitas = pf.id_fasilitas

                WHERE pf.id_pengajuan = p.id_pengajuan

                  AND LOWER(f.nama_fasilitas) LIKE '%kursi%'

            ) AS kebutuhanKursi

        FROM pengajuan p

        LEFT JOIN users u
            ON u.id_user = p.id_user

        WHERE p.id_pengajuan = :id

        LIMIT 1

    ";

    $stmt = $pdo->prepare($sql);

    $stmt->execute([
        ':id' => $idPengajuan
    ]);

    $data = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$data) {
        return null;
    }

    return $data;
}

/*
Memeriksa bentrokan dengan booking aktif.

Booking aktif:
- status booking = terjadwal
- status pengajuan = disetujui
*/

function periksaBentrokanBooking(
    PDO $pdo,
    string $mulai,
    string $selesai
): bool {

    $sql = "

        SELECT COUNT(*)

        FROM booking b

        INNER JOIN pengajuan p
            ON p.id_pengajuan = b.id_pengajuan

        WHERE LOWER(b.status) = 'terjadwal'

          AND LOWER(p.status) = 'disetujui'

          AND p.waktu_mulai < :selesai

          AND p.waktu_selesai > :mulai

    ";

    $stmt = $pdo->prepare($sql);

    $stmt->execute([
        ':mulai' => $mulai,
        ':selesai' => $selesai
    ]);

    return (int) $stmt->fetchColumn() > 0;
}

/*
Memeriksa bentrok dengan rekomendasi lain
yang sudah dikirim kepada pemohon.
*/

function periksaBentrokanRekomendasi(
    PDO $pdo,
    string $mulai,
    string $selesai
): bool {

    $sql = "

        SELECT COUNT(*)

        FROM alternatif_rekomendasi ar

        INNER JOIN rekomendasi r
            ON r.id_rekomendasi = ar.id_rekomendasi

        WHERE LOWER(r.status) = 'dikirim'

          AND ar.waktu_mulai < :selesai

          AND ar.waktu_selesai > :mulai

    ";

    $stmt = $pdo->prepare($sql);

    $stmt->execute([
        ':mulai' => $mulai,
        ':selesai' => $selesai
    ]);

    return (int) $stmt->fetchColumn() > 0;
}

/*
Memastikan rekomendasi dimiliki Laboran yang login.
*/

function ambilRekomendasiMilikLaboran(
    PDO $pdo,
    int $idRekomendasi,
    int $idLaboran
): ?array {

    $stmt = $pdo->prepare("

        SELECT *

        FROM rekomendasi

        WHERE id_rekomendasi = :id

          AND id_user_laboran = :laboran

        LIMIT 1

    ");

    $stmt->execute([
        ':id' => $idRekomendasi,
        ':laboran' => $idLaboran
    ]);

    $data = $stmt->fetch(PDO::FETCH_ASSOC);

    return $data ?: null;
}

function validasiBentrokanAlternatif(
    array $alternatifValid,
    string $mulai,
    string $selesai
): void {

    // Jadwal tidak boleh melewati pergantian tanggal.
    if (
        substr($mulai, 0, 10) !==
        substr($selesai, 0, 10)
    ) {
        throw new InvalidArgumentException(
            'Jadwal tidak boleh melewati pergantian tanggal.'
        );
    }

    // Periksa bentrokan dengan alternatif sebelumnya.
    foreach ($alternatifValid as $item) {

        $bentrok =
            $mulai < $item['waktu_selesai'] &&
            $selesai > $item['waktu_mulai'];

        if ($bentrok) {
            throw new InvalidArgumentException(
                'Alternatif jadwal tidak boleh saling bertabrakan.'
            );
        }
    }
}

/*
==================================================
6. PROSES API
==================================================
*/

try {

    /*
    ==============================================
    ACTION 1: DAFTAR PENGAJUAN TERGESER
    GET ?action=list_tergeser
    ==============================================
    */

    if ($method === 'GET' && $action === 'list_tergeser') {

        $sql = "

            SELECT

                p.id_pengajuan,

                p.id_pengajuan AS id,

                p.id_user,

                u.nama AS namaPemohon,

                u.nip_npm AS nipNpm,

                p.nama_kegiatan AS namaKegiatan,

                p.waktu_mulai,

                p.waktu_selesai,

                p.status,

                (
                    SELECT COALESCE(SUM(pf.jumlah), 0)

                    FROM pengajuan_fasilitas pf

                    INNER JOIN fasilitas f
                        ON f.id_fasilitas = pf.id_fasilitas

                    WHERE pf.id_pengajuan = p.id_pengajuan

                      AND LOWER(f.nama_fasilitas) LIKE '%pc%'

                ) AS kebutuhanPC,

                (
                    SELECT COALESCE(SUM(pf.jumlah), 0)

                    FROM pengajuan_fasilitas pf

                    INNER JOIN fasilitas f
                        ON f.id_fasilitas = pf.id_fasilitas

                    WHERE pf.id_pengajuan = p.id_pengajuan

                      AND LOWER(f.nama_fasilitas) LIKE '%kursi%'

                ) AS kebutuhanKursi

            FROM pengajuan p

            INNER JOIN users u
                ON u.id_user = p.id_user

            WHERE LOWER(p.status) = 'tergeser'

            AND NOT EXISTS (
                SELECT 1
                FROM rekomendasi r
                WHERE r.id_pengajuan = p.id_pengajuan
                AND LOWER(r.status) NOT IN (
                    'ditolak',
                    'dibatalkan',
                    'kedaluwarsa',
                    'expired',
                    'rejected',
                    'cancelled'
                )
            )

            ORDER BY
                p.waktu_mulai ASC,
                p.id_pengajuan ASC

        ";

        $stmt = $pdo->query($sql);

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $hasil = [];

        foreach ($rows as $row) {

            $waktu = new DateTimeImmutable(
                $row['waktu_mulai'],
                new DateTimeZone('Asia/Jayapura')
            );

            $hasil[] = [

                'id' => (int) $row['id'],

                'kasusId' => (int) $row['id'],

                'namaPemohon' => $row['namaPemohon'],

                'nipNpm' => $row['nipNpm'] ?? '-',

                'namaKegiatan' => $row['namaKegiatan'],

                'jadwalAsal' => $row['waktu_mulai'],

                'waktuMulai' => $row['waktu_mulai'],

                'waktuSelesai' => $row['waktu_selesai'],

                'kebutuhanPC' => (int) $row['kebutuhanPC'],

                'kebutuhanKursi' => (int) $row['kebutuhanKursi'],

                'status' => $row['status'],

                'prioritas' => null

            ];
        }

        responsJSON(
            true,
            'Daftar pengajuan tergeser berhasil diambil.',
            200,
            $hasil
        );
    }

    /*
    ==============================================
    ACTION 2: DAFTAR REKOMENDASI
    GET ?action=list_rekomendasi
    ==============================================
    */

    if ($method === 'GET' && $action === 'list_rekomendasi') {

        // Acuan waktu server: Asia/Jayapura.
        $sekarang = new DateTimeImmutable(
            'now',
            new DateTimeZone('Asia/Jayapura')
        );

        $waktuSekarang = $sekarang->format('Y-m-d H:i:s');

        // Kedaluwarsakan rekomendasi yang sudah melewati 24 jam.
        $stmt = $pdo->prepare("
        UPDATE rekomendasi
        SET status = 'Kedaluwarsa'
        WHERE id_user_laboran = :laboran
        AND LOWER(status) = 'dikirim'
        AND (
            batas_waktu IS NULL
            OR batas_waktu <= :sekarang
        )
    ");

        $stmt->execute([
            ':laboran' => $idLaboran,
            ':sekarang' => $waktuSekarang
        ]);
        $stmt = $pdo->prepare("

            SELECT

                r.id_rekomendasi,

                r.id_pengajuan AS kasusId,

                r.id_user_laboran,

                r.catatan,

                r.status,

                r.waktu_dibuat,

                r.waktu_dikirim,

                r.batas_waktu

            FROM rekomendasi r

            WHERE r.id_user_laboran = :laboran

            AND LOWER(r.status) <> 'kedaluwarsa'

            ORDER BY r.waktu_dibuat DESC

        ");

        $stmt->execute([
            ':laboran' => $idLaboran
        ]);

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $hasil = [];

        foreach ($rows as $row) {

            $hasil[] = [

                'id' => (int) $row['id_rekomendasi'],

                'kasusId' => (int) $row['kasusId'],

                'catatan' => $row['catatan'],

                'status' => $row['status'],

                'waktuDibuat' => $row['waktu_dibuat'],

                'waktuDikirim' => $row['waktu_dikirim'],

                'batasWaktu' => $row['batas_waktu']

            ];
        }

        responsJSON(
            true,
            'Daftar rekomendasi berhasil diambil.',
            200,
            $hasil
        );
    }

    /*
    ==============================================
    ACTION 3: DETAIL PENGAJUAN
    GET ?action=detail&id_pengajuan=1
    ==============================================
    */

    if ($method === 'GET' && $action === 'detail') {

        $idPengajuan = filter_var(
            $_GET['id_pengajuan'] ?? null,
            FILTER_VALIDATE_INT
        );

        if (!$idPengajuan || $idPengajuan <= 0) {

            responsJSON(
                false,
                'ID pengajuan tidak valid.',
                422
            );
        }

        $data = ambilPengajuanTergeser(
            $pdo,
            (int) $idPengajuan
        );

        if (!$data || statusNorm($data['status']) !== 'tergeser') {

            responsJSON(
                false,
                'Pengajuan tergeser tidak ditemukan.',
                404
            );
        }

        responsJSON(
            true,
            'Detail pengajuan berhasil diambil.',
            200,
            $data
        );
    }

    /*
    ==============================================
    ACTION 4: RIWAYAT REKOMENDASI
    GET ?action=riwayat&id_pengajuan=1
    ==============================================
    */

    if ($method === 'GET' && $action === 'riwayat') {

        $idPengajuan = filter_var(
            $_GET['id_pengajuan'] ?? null,
            FILTER_VALIDATE_INT
        );

        if (!$idPengajuan || $idPengajuan <= 0) {

            responsJSON(
                false,
                'ID pengajuan tidak valid.',
                422
            );
        }

        $stmt = $pdo->prepare("

            SELECT *

            FROM rekomendasi

            WHERE id_pengajuan = :pengajuan

              AND id_user_laboran = :laboran

            ORDER BY waktu_dibuat DESC

        ");

        $stmt->execute([
            ':pengajuan' => $idPengajuan,
            ':laboran' => $idLaboran
        ]);

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $hasil = [];

        foreach ($rows as $row) {

            $stmtAlternatif = $pdo->prepare("

                SELECT *

                FROM alternatif_rekomendasi

                WHERE id_rekomendasi = :id

                ORDER BY waktu_mulai ASC

            ");

            $stmtAlternatif->execute([
                ':id' => $row['id_rekomendasi']
            ]);

            $hasil[] = [

                'id_rekomendasi' =>
                    (int) $row['id_rekomendasi'],

                'catatan' => $row['catatan'],

                'status' => $row['status'],

                'waktu_dibuat' => $row['waktu_dibuat'],

                'waktu_dikirim' => $row['waktu_dikirim'],

                'batas_waktu' => $row['batas_waktu'],

                'alternatif' =>
                    $stmtAlternatif->fetchAll(PDO::FETCH_ASSOC)

            ];
        }

        responsJSON(
            true,
            'Riwayat rekomendasi berhasil diambil.',
            200,
            $hasil
        );
    }

    /*
    ==============================================
    ACTION 5: DAFTAR ALTERNATIF
    GET ?action=alternatif&id_rekomendasi=1
    ==============================================
    */

    if ($method === 'GET' && $action === 'alternatif') {

        $idRekomendasi = filter_var(
            $_GET['id_rekomendasi'] ?? null,
            FILTER_VALIDATE_INT
        );

        if (!$idRekomendasi || $idRekomendasi <= 0) {

            responsJSON(
                false,
                'ID rekomendasi tidak valid.',
                422
            );
        }

        $rekomendasi = ambilRekomendasiMilikLaboran(
            $pdo,
            (int) $idRekomendasi,
            $idLaboran
        );

        if (!$rekomendasi) {

            responsJSON(
                false,
                'Rekomendasi tidak ditemukan.',
                404
            );
        }

        $stmt = $pdo->prepare("

            SELECT *

            FROM alternatif_rekomendasi

            WHERE id_rekomendasi = :id

            ORDER BY waktu_mulai ASC

        ");

        $stmt->execute([
            ':id' => $idRekomendasi
        ]);

        responsJSON(
            true,
            'Alternatif jadwal berhasil diambil.',
            200,
            $stmt->fetchAll(PDO::FETCH_ASSOC)
        );
    }

    /*
    ==============================================
    VALIDASI REQUEST POST
    ==============================================
    */

    if ($method !== 'POST') {

        header('Allow: GET, POST');

        responsJSON(
            false,
            'Metode request tidak diizinkan.',
            405
        );
    }

    /*
    ==============================================
    ACTION 6: SIMPAN REKOMENDASI
    POST action=simpan
    ==============================================
    */

    if ($action === 'simpan') {

        $idPengajuan = filter_var(
            $input['id_pengajuan'] ?? null,
            FILTER_VALIDATE_INT
        );

        $catatan = trim(
            (string) ($input['catatan'] ?? '')
        );

        $alternatif = $input['alternatif']
            ?? $input['alternatif_jadwal']
            ?? [];

        if (!$idPengajuan || $idPengajuan <= 0) {

            responsJSON(
                false,
                'ID pengajuan tidak valid.',
                422
            );
        }

        if (!is_array($alternatif) || count($alternatif) === 0) {

            responsJSON(
                false,
                'Tambahkan minimal satu alternatif jadwal.',
                422
            );
        }

        if (count($alternatif) > 2) {
            responsJSON(
                false,
                'Maksimal hanya 2 alternatif jadwal.',
                422
            );
        }

        /*
        1. PASTIKAN PENGAJUAN TERGERSER
        */

        $pengajuan = ambilPengajuanTergeser(
            $pdo,
            (int) $idPengajuan
        );

        if (
            !$pengajuan ||
            statusNorm($pengajuan['status']) !== 'tergeser'
        ) {

            responsJSON(
                false,
                'Pengajuan tidak tersedia untuk direkomendasikan.',
                422
            );
        }

        /*
        2. PERIKSA REKOMENDASI AKTIF SEBELUMNYA
        */

        $stmt = $pdo->prepare("

            SELECT id_rekomendasi

            FROM rekomendasi

            WHERE id_pengajuan = :pengajuan

              AND id_user_laboran = :laboran

              AND LOWER(status) NOT IN (
                  'dibatalkan',
                  'ditolak',
                  'kedaluwarsa',
                  'expired',
                  'rejected',
                  'cancelled'
              )

            LIMIT 1

        ");

        $stmt->execute([
            ':pengajuan' => $idPengajuan,
            ':laboran' => $idLaboran
        ]);

        if ($stmt->fetch()) {

            responsJSON(
                false,
                'Pengajuan ini sudah memiliki rekomendasi aktif.',
                409
            );
        }

        /*
        3. VALIDASI SELURUH ALTERNATIF
        */

        $alternatifValid = [];

        foreach ($alternatif as $index => $item) {

            if (!is_array($item)) {

                responsJSON(
                    false,
                    'Format alternatif jadwal tidak valid.',
                    422
                );
            }

            $mulaiInput = $item['waktu_mulai']
                ?? $item['mulai']
                ?? '';

            $selesaiInput = $item['waktu_selesai']
                ?? $item['selesai']
                ?? '';

            if (
                !is_string($mulaiInput) ||
                !is_string($selesaiInput) ||
                trim($mulaiInput) === '' ||
                trim($selesaiInput) === ''
            ) {

                responsJSON(
                    false,
                    'Waktu mulai dan selesai alternatif wajib diisi.',
                    422
                );
            }

            $mulai = normalisasiWaktu($mulaiInput);
            $selesai = normalisasiWaktu($selesaiInput);

            // Waktu mulai tidak boleh di masa lalu
            if ($mulai <= date('Y-m-d H:i:s')) {
                responsJSON(
                    false,
                    'Waktu mulai alternatif harus setelah waktu sekarang.',
                    422
                );
            }

            if ($mulai >= $selesai) {
                responsJSON(
                    false,
                    'Waktu selesai harus setelah waktu mulai.',
                    422
                );
            }

            // Memeriksa bentrokan antaralternatif.
            validasiBentrokanAlternatif(
                $alternatifValid,
                $mulai,
                $selesai
            );

            /*
            Periksa bentrokan dengan booking aktif.
            */

            if (
                periksaBentrokanBooking(
                    $pdo,
                    $mulai,
                    $selesai
                )
            ) {

                responsJSON(
                    false,
                    'Alternatif ke-' . ($index + 1) .
                    ' berbenturan dengan jadwal booking aktif.',
                    409
                );
            }

            if (
                periksaBentrokanRekomendasi(
                    $pdo,
                    $mulai,
                    $selesai
                )
            ) {
                responsJSON(
                    false,
                    'Alternatif ke-' . ($index + 1) .
                    ' berbenturan dengan rekomendasi jadwal lain yang sudah dikirim.',
                    409
                );
            }

            $alternatifValid[] = [

                'waktu_mulai' => $mulai,

                'waktu_selesai' => $selesai

            ];
        }

        /*
        4. SIMPAN DALAM TRANSAKSI
        */

        $pdo->beginTransaction();

        /*
        Buat data rekomendasi.
        */

        $stmt = $pdo->prepare("

            INSERT INTO rekomendasi (

                id_pengajuan,

                id_user_laboran,

                catatan,

                status,

                waktu_dibuat

            )

            VALUES (

                :pengajuan,

                :laboran,

                :catatan,

                'Menunggu',

                NOW()

            )

        ");

        $stmt->execute([

            ':pengajuan' => $idPengajuan,

            ':laboran' => $idLaboran,

            ':catatan' => $catatan !== ''
                ? $catatan
                : null

        ]);

        $idRekomendasi = (int) $pdo->lastInsertId();

        /*
        Simpan seluruh alternatif.
        */

        $stmtAlternatif = $pdo->prepare("

            INSERT INTO alternatif_rekomendasi (

                id_rekomendasi,

                waktu_mulai,

                waktu_selesai,

                status

            )

            VALUES (

                :rekomendasi,

                :mulai,

                :selesai,

                'Menunggu'

            )

        ");

        foreach ($alternatifValid as $item) {

            $stmtAlternatif->execute([

                ':rekomendasi' => $idRekomendasi,

                ':mulai' => $item['waktu_mulai'],

                ':selesai' => $item['waktu_selesai']

            ]);
        }

        $pdo->commit();

        responsJSON(
            true,
            'Rekomendasi dan alternatif jadwal berhasil disimpan.',
            201,
            [

                'id_rekomendasi' => $idRekomendasi,

                'id_pengajuan' => (int) $idPengajuan,

                'jumlah_alternatif' => count($alternatifValid),

                'status' => 'Menunggu'

            ]
        );
    }


    /*
    ==================================================
    ACTION 7: EDIT REKOMENDASI
    POST action=edit
    ==================================================
    */

    if ($action === 'edit') {

        $idRekomendasi = filter_var(
            $input['id_rekomendasi'] ?? null,
            FILTER_VALIDATE_INT
        );

        $catatan = trim(
            (string) ($input['catatan'] ?? '')
        );

        $alternatif = $input['alternatif']
            ?? $input['alternatif_jadwal']
            ?? [];

        if (!$idRekomendasi || $idRekomendasi <= 0) {
            responsJSON(
                false,
                'ID rekomendasi tidak valid.',
                422
            );
        }

        if (
            !is_array($alternatif) ||
            count($alternatif) === 0 ||
            count($alternatif) > 2
        ) {

            responsJSON(
                false,
                'Rekomendasi harus memiliki 1 sampai 2 alternatif jadwal.',
                422
            );
        }

        try {

            $pdo->beginTransaction();

            /*
            1. Ambil dan kunci rekomendasi.
            */

            $stmt = $pdo->prepare("
            SELECT *
            FROM rekomendasi
            WHERE id_rekomendasi = :id
              AND id_user_laboran = :laboran
            LIMIT 1
            FOR UPDATE
        ");

            $stmt->execute([
                ':id' => $idRekomendasi,
                ':laboran' => $idLaboran
            ]);

            $rekomendasi = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$rekomendasi) {
                throw new RuntimeException(
                    'Rekomendasi tidak ditemukan atau bukan milik Anda.'
                );
            }

            /*
            2. Hanya status Menunggu yang boleh diedit.
            */

            if (
                statusNorm($rekomendasi['status']) !== 'menunggu'
            ) {
                throw new RuntimeException(
                    'Rekomendasi yang sudah dikirim tidak dapat diedit.'
                );
            }

            /*
            3. Pastikan pengajuan masih tergeser.
            */

            $pengajuan = ambilPengajuanTergeser(
                $pdo,
                (int) $rekomendasi['id_pengajuan']
            );

            if (
                !$pengajuan ||
                statusNorm($pengajuan['status']) !== 'tergeser'
            ) {
                throw new RuntimeException(
                    'Pengajuan tidak lagi tersedia untuk direkomendasikan.'
                );
            }

            /*
            4. Validasi seluruh alternatif.
            */

            $alternatifValid = [];

            foreach ($alternatif as $index => $item) {

                if (!is_array($item)) {
                    throw new InvalidArgumentException(
                        'Format alternatif jadwal tidak valid.'
                    );
                }

                $mulaiInput = $item['waktu_mulai']
                    ?? $item['mulai']
                    ?? '';

                $selesaiInput = $item['waktu_selesai']
                    ?? $item['selesai']
                    ?? '';

                if (
                    !is_string($mulaiInput) ||
                    !is_string($selesaiInput) ||
                    trim($mulaiInput) === '' ||
                    trim($selesaiInput) === ''
                ) {
                    throw new InvalidArgumentException(
                        'Waktu mulai dan selesai alternatif wajib diisi.'
                    );
                }

                $mulai = normalisasiWaktu($mulaiInput);
                $selesai = normalisasiWaktu($selesaiInput);

                if ($mulai <= date('Y-m-d H:i:s')) {
                    throw new InvalidArgumentException(
                        'Waktu mulai alternatif harus setelah waktu sekarang.'
                    );
                }

                if ($mulai >= $selesai) {
                    throw new InvalidArgumentException(
                        'Waktu selesai harus setelah waktu mulai.'
                    );
                }

                // Memeriksa bentrokan antaralternatif.
                validasiBentrokanAlternatif(
                    $alternatifValid,
                    $mulai,
                    $selesai
                );

                if (
                    periksaBentrokanBooking(
                        $pdo,
                        $mulai,
                        $selesai
                    )
                ) {
                    throw new RuntimeException(
                        'Alternatif ke-' . ($index + 1) .
                        ' berbenturan dengan jadwal booking aktif.'
                    );
                }

                if (
                    periksaBentrokanRekomendasi(
                        $pdo,
                        $mulai,
                        $selesai
                    )
                ) {
                    throw new RuntimeException(
                        'Alternatif ke-' . ($index + 1) .
                        ' berbenturan dengan rekomendasi lain yang sudah dikirim.'
                    );
                }

                $alternatifValid[] = [
                    'waktu_mulai' => $mulai,
                    'waktu_selesai' => $selesai
                ];
            }

            /*
            5. Perbarui catatan rekomendasi.
            */

            $stmt = $pdo->prepare("
            UPDATE rekomendasi
            SET catatan = :catatan
            WHERE id_rekomendasi = :id
              AND id_user_laboran = :laboran
              AND LOWER(status) = 'menunggu'
        ");

            $stmt->execute([
                ':catatan' => $catatan !== ''
                    ? $catatan
                    : null,
                ':id' => $idRekomendasi,
                ':laboran' => $idLaboran
            ]);

            /*
            6. Hapus alternatif lama.
            */

            $stmt = $pdo->prepare("
            DELETE FROM alternatif_rekomendasi
            WHERE id_rekomendasi = :id
        ");

            $stmt->execute([
                ':id' => $idRekomendasi
            ]);

            /*
            7. Simpan alternatif yang baru.
            */

            $stmtAlternatif = $pdo->prepare("
            INSERT INTO alternatif_rekomendasi (
                id_rekomendasi,
                waktu_mulai,
                waktu_selesai,
                status
            )
            VALUES (
                :rekomendasi,
                :mulai,
                :selesai,
                'Menunggu'
            )
        ");

            foreach ($alternatifValid as $item) {

                $stmtAlternatif->execute([
                    ':rekomendasi' => $idRekomendasi,
                    ':mulai' => $item['waktu_mulai'],
                    ':selesai' => $item['waktu_selesai']
                ]);
            }

            /*
            8. Simpan transaksi.
            */

            $pdo->commit();

            responsJSON(
                true,
                'Rekomendasi berhasil diperbarui.',
                200,
                [
                    'id_rekomendasi' => (int) $idRekomendasi,
                    'id_pengajuan' => (int) $rekomendasi['id_pengajuan'],
                    'jumlah_alternatif' => count($alternatifValid),
                    'status' => 'Menunggu'
                ]
            );

        } catch (Throwable $e) {

            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $e;
        }
    }


    /*
    ==============================================
    ACTION 8: KIRIM REKOMENDASI
    POST action=kirim
    ==============================================
    */

    if ($action === 'kirim') {

        $idRekomendasi = filter_var(
            $input['id_rekomendasi'] ?? null,
            FILTER_VALIDATE_INT
        );

        if (!$idRekomendasi || $idRekomendasi <= 0) {

            responsJSON(
                false,
                'ID rekomendasi tidak valid.',
                422
            );
        }

        $pdo->beginTransaction();

        /*
        Kunci rekomendasi.
        */

        $stmt = $pdo->prepare("

            SELECT *

            FROM rekomendasi

            WHERE id_rekomendasi = :id

              AND id_user_laboran = :laboran

            LIMIT 1

            FOR UPDATE

        ");

        $stmt->execute([
            ':id' => $idRekomendasi,
            ':laboran' => $idLaboran
        ]);

        $rekomendasi = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$rekomendasi) {

            throw new RuntimeException(
                'Rekomendasi tidak ditemukan.'
            );
        }

        if (statusNorm($rekomendasi['status']) !== 'menunggu') {

            throw new RuntimeException(
                'Rekomendasi tidak berada dalam status Menunggu.'
            );
        }


        /*
        Pastikan memiliki 1 sampai 2 alternatif
        dan seluruh jadwal masih valid.
        */

        $stmt = $pdo->prepare("
    SELECT *
    FROM alternatif_rekomendasi
    WHERE id_rekomendasi = :id
    ORDER BY waktu_mulai ASC
");

        $stmt->execute([
            ':id' => $idRekomendasi
        ]);

        $alternatifKirim = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (
            count($alternatifKirim) === 0 ||
            count($alternatifKirim) > 2
        ) {
            throw new RuntimeException(
                'Rekomendasi harus memiliki 1 sampai 2 alternatif jadwal.'
            );
        }

        $alternatifValid = [];

        foreach ($alternatifKirim as $index => $item) {

            $mulai = $item['waktu_mulai'];
            $selesai = $item['waktu_selesai'];

            if (
                $mulai <= date('Y-m-d H:i:s') ||
                $mulai >= $selesai
            ) {
                throw new RuntimeException(
                    'Alternatif ke-' . ($index + 1) .
                    ' memiliki waktu yang tidak valid atau sudah berlalu.'
                );
            }

            validasiBentrokanAlternatif(
                $alternatifValid,
                $mulai,
                $selesai
            );

            if (
                periksaBentrokanBooking(
                    $pdo,
                    $mulai,
                    $selesai
                )
            ) {
                throw new RuntimeException(
                    'Alternatif ke-' . ($index + 1) .
                    ' berbenturan dengan booking aktif.'
                );
            }

            if (
                periksaBentrokanRekomendasi(
                    $pdo,
                    $mulai,
                    $selesai
                )
            ) {
                throw new RuntimeException(
                    'Alternatif ke-' . ($index + 1) .
                    ' berbenturan dengan rekomendasi lain yang sudah dikirim.'
                );
            }

            $alternatifValid[] = [
                'waktu_mulai' => $mulai,
                'waktu_selesai' => $selesai
            ];
        }


        /*
        Tetapkan waktu pengiriman dan batas konfirmasi di server.
        Masa berlaku selalu tepat 24 jam.
        */

        $waktuDikirimObj = new DateTimeImmutable(
            'now',
            new DateTimeZone('Asia/Jayapura')
        );

        $waktuDikirim = $waktuDikirimObj->format('Y-m-d H:i:s');

        $batasWaktu = $waktuDikirimObj
            ->modify('+24 hours')
            ->format('Y-m-d H:i:s');

        /*
        Perbarui status rekomendasi.
        */

        $stmt = $pdo->prepare("

        UPDATE rekomendasi

        SET

            status = 'Dikirim',

            waktu_dikirim = :dikirim,

            batas_waktu = :batas

        WHERE id_rekomendasi = :id

        AND id_user_laboran = :laboran

        ");

        $stmt->execute([

            ':dikirim' => $waktuDikirim,

            ':batas' => $batasWaktu,

            ':id' => $idRekomendasi,

            ':laboran' => $idLaboran

        ]);


        $pdo->commit();

        responsJSON(
            true,
            'Rekomendasi berhasil dikirim.',
            200,
            [

                'id_rekomendasi' => (int) $idRekomendasi,

                'status' => 'Dikirim',

                'waktu_dikirim' => date('Y-m-d H:i:s'),

                'batas_waktu' => $batasWaktu

            ]
        );
    }

    /*
    ==============================================
    ACTION TIDAK DIKENAL
    ==============================================
    */

    responsJSON(
        false,
        'Action API tidak dikenal.',
        400
    );

} catch (Throwable $e) {

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log(
        'SILAB API REKOMENDASI: ' .
        $e->getMessage()
    );

    $code = $e instanceof InvalidArgumentException
        || $e instanceof RuntimeException
        ? 422
        : 500;

    responsJSON(
        false,
        $code === 422
        ? $e->getMessage()
        : 'Terjadi kesalahan saat memproses rekomendasi.',
        $code
    );
}
