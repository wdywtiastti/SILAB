<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=UTF-8');
error_log(
    'SILAB REQUEST METHOD: ' .
    ($_SERVER['REQUEST_METHOD'] ?? 'UNKNOWN')
);

/*
==================================================
1. FUNGSI RESPONSE JSON
==================================================
*/

function responsJSON(
    bool $success,
    string $message,
    int $httpCode = 200,
    array $data = []
): never {

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
3. VALIDASI LOGIN DAN ROLE
==================================================
*/

if (!sudahLogin()) {
    responsJSON(
        false,
        'Session telah berakhir. Silakan login kembali.',
        401
    );
}

if (($_SESSION['role'] ?? '') !== 'laboran') {
    responsJSON(
        false,
        'Anda tidak memiliki kewenangan melakukan tindakan ini.',
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
4. VALIDASI REQUEST
==================================================
*/

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {

    header('Allow: POST');

    responsJSON(
        false,
        'Metode request harus POST.',
        405
    );
}

$input = json_decode(
    file_get_contents('php://input'),
    true
);

if (!is_array($input)) {
    responsJSON(
        false,
        'Format request tidak valid.',
        400
    );
}

$aksi = strtolower(trim((string) (
    $input['aksi']
    ?? $input['action']
    ?? $input['tindakan']
    ?? ''
)));

$aksi = str_replace('-', '_', $aksi);

$idPengajuan = filter_var(
    $input['idPengajuan']
    ?? $input['id_pengajuan']
    ?? $input['id']
    ?? null,
    FILTER_VALIDATE_INT
);

/*
--------------------------------------------------
ALIAS NAMA AKSI
--------------------------------------------------
*/

$aliasAksi = [
    'kirim_konflik' => 'kirim_konflik',
    'eskalasi_konflik' => 'kirim_konflik',
    'kirim_ke_kepala_lab' => 'kirim_konflik',
    'teruskan_konflik' => 'kirim_konflik',

    'setujui' => 'setujui',
    'tolak' => 'tolak',
    'batalkan_persetujuan' => 'batalkan_persetujuan'
];

$aksi = $aliasAksi[$aksi] ?? $aksi;

if ($aksi === '') {
    responsJSON(
        false,
        'Aksi tidak dikirim oleh JavaScript.',
        400
    );
}

if (!$idPengajuan || $idPengajuan <= 0) {
    responsJSON(
        false,
        'ID pengajuan tidak valid.',
        400
    );
}

/*
==================================================
5. KONFIGURASI STATUS
==================================================
*/

$pendingStatuses = [
    'menunggu',
    'verifikasi',
    'menunggu_verifikasi',
    'pending',
    'bentrok',
    'konflik'
];

$activeBookingStatuses = [
    'terjadwal',
    'disetujui',
    'berlangsung',
    'digunakan'
];

$usedStatuses = [
    'hadir',
    'presensi',
    'sudah_presensi',
    'tercatat',
    'digunakan',
    'berlangsung',
    'selesai',
    'checked_in',
    'check_in'
];

$zonaWaktu = new DateTimeZone('Asia/Jayapura');

/*
==================================================
6. FUNGSI NORMALISASI STATUS
==================================================
*/

function normalisasiStatus(?string $status): string
{
    return strtolower(trim((string) $status));
}

/*
==================================================
7. FUNGSI MENCARI KELOMPOK KONFLIK
==================================================

Menggunakan konsep konflik berantai.

Contoh:

A beririsan dengan B.
B beririsan dengan C.

Maka A, B, dan C menjadi satu kelompok konflik.
==================================================
*/

function ambilKelompokKonflik(
    PDO $pdo,
    int $idTarget,
    array $pendingStatuses,
    array $activeBookingStatuses
): array {

    $sql = "
        SELECT
            p.id_pengajuan,
            p.nama_kegiatan,
            p.waktu_mulai,
            p.waktu_selesai,
            p.status AS status_pengajuan,
            b.status AS status_booking

        FROM pengajuan p

        LEFT JOIN booking b
            ON b.id_pengajuan = p.id_pengajuan

        ORDER BY
            p.waktu_mulai ASC,
            p.id_pengajuan ASC

        FOR UPDATE
    ";

    $stmt = $pdo->query($sql);

    $semuaData = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $kandidat = [];

    foreach ($semuaData as $row) {

        $statusP = normalisasiStatus(
            $row['status_pengajuan']
        );

        $statusB = normalisasiStatus(
            $row['status_booking'] ?? null
        );

        $pending = in_array(
            $statusP,
            $pendingStatuses,
            true
        );

        $approved = in_array(
            $statusB,
            $activeBookingStatuses,
            true
        );

        if ($pending || $approved) {

            $kandidat[(int) $row['id_pengajuan']] = $row;
        }
    }

    if (!isset($kandidat[$idTarget])) {
        return [];
    }

    $kelompok = [
        $idTarget => $kandidat[$idTarget]
    ];

    $diperiksa = [];

    $berubah = true;

    while ($berubah) {

        $berubah = false;

        foreach ($kelompok as $anggota) {

            $idAnggota = (int) $anggota['id_pengajuan'];

            if (isset($diperiksa[$idAnggota])) {
                continue;
            }

            $diperiksa[$idAnggota] = true;

            foreach ($kandidat as $idLain => $lain) {

                if (isset($kelompok[$idLain])) {
                    continue;
                }

                $beririsan =
                    $anggota['waktu_mulai'] < $lain['waktu_selesai']
                    &&
                    $anggota['waktu_selesai'] > $lain['waktu_mulai'];

                if ($beririsan) {

                    $kelompok[$idLain] = $lain;

                    $berubah = true;
                }
            }
        }
    }

    return $kelompok;
}

/*
==================================================
8. PROSES TRANSAKSI
==================================================
*/

try {

    $pdo->beginTransaction();

    /*
    ----------------------------------------------
    A. AMBIL DATA PENGAJUAN
    ----------------------------------------------
    */

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
        ':id' => $idPengajuan
    ]);

    $pengajuan = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$pengajuan) {

        throw new RuntimeException(
            'Data pengajuan tidak ditemukan.'
        );
    }

    $statusPengajuan = normalisasiStatus(
        $pengajuan['status']
    );

    $mulai = new DateTimeImmutable(
        (string) $pengajuan['waktu_mulai'],
        $zonaWaktu
    );

    $selesai = new DateTimeImmutable(
        (string) $pengajuan['waktu_selesai'],
        $zonaWaktu
    );

    if ($mulai >= $selesai) {

        throw new RuntimeException(
            'Rentang waktu pengajuan tidak valid.'
        );
    }

    /*
    ----------------------------------------------
    B. AMBIL DATA BOOKING
    ----------------------------------------------
    */

    $stmt = $pdo->prepare("
        SELECT
            id_booking,
            id_pengajuan,
            status,
            waktu_dibuat

        FROM booking

        WHERE id_pengajuan = :id

        FOR UPDATE
    ");

    $stmt->execute([
        ':id' => $idPengajuan
    ]);

    $booking = $stmt->fetch(PDO::FETCH_ASSOC);

    $statusBooking = normalisasiStatus(
        $booking['status'] ?? null
    );

    /*
    ==================================================
    TINDAKAN 1: KIRIM KONFLIK KE KEPALA LAB
    ==================================================
    */

    if ($aksi === 'kirim_konflik') {

        /*
        1. CARI KELOMPOK KONFLIK
        */

        $kelompok = ambilKelompokKonflik(
            $pdo,
            (int) $idPengajuan,
            $pendingStatuses,
            $activeBookingStatuses
        );

        if (count($kelompok) < 2) {

            throw new RuntimeException(
                'Tidak ditemukan kelompok konflik dengan pengajuan tersebut.'
            );
        }

        /*
        2. AMBIL ID SELURUH ANGGOTA KONFLIK
        */

        $idAnggota = array_map(
            'intval',
            array_keys($kelompok)
        );

        /*
        3. PERIKSA KASUS KONFLIK YANG MASIH TERBUKA
        */

        $placeholders = implode(
            ',',
            array_fill(0, count($idAnggota), '?')
        );

        $sqlExisting = "
            SELECT DISTINCT
                k.id_konflik,
                k.status

            FROM konflik k

            INNER JOIN pengajuan_konflik pk
                ON pk.id_konflik = k.id_konflik

            WHERE pk.id_pengajuan IN ($placeholders)

              AND k.status NOT IN (
                  'selesai',
                  'ditutup',
                  'dibatalkan'
              )

            LIMIT 1

            FOR UPDATE
        ";

        $stmt = $pdo->prepare($sqlExisting);

        $stmt->execute($idAnggota);

        $existing = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($existing) {

            throw new RuntimeException(
                'Pengajuan sudah tercatat dalam kasus konflik #'
                . $existing['id_konflik']
                . '. Kasus tersebut masih dalam proses.'
            );
        }

        /*
        4. BUAT KASUS KONFLIK BARU

        Keputusan Kepala Lab belum ditetapkan.

        id_pengajuan_terpilih = NULL
        id_user_kepala_lab = NULL
        waktu_ditetapkan = NULL
        */

        $stmt = $pdo->prepare("
            INSERT INTO konflik (
                id_user,
                id_pengajuan_terpilih,
                status,
                waktu_dibuat,
                waktu_dikirim,
                id_user_kepala_lab,
                waktu_ditetapkan
            )

            VALUES (
                :laboran,
                NULL,
                'menunggu_keputusan',
                NOW(),
                NOW(),
                NULL,
                NULL
            )
        ");

        $stmt->execute([
            ':laboran' => $idLaboran
        ]);

        $idKonflik = (int) $pdo->lastInsertId();

        if ($idKonflik <= 0) {

            throw new RuntimeException(
                'Gagal membuat data kasus konflik.'
            );
        }

        /*
        5. HUBUNGKAN PENGAJUAN DENGAN KASUS KONFLIK
        */

        $stmtRelasi = $pdo->prepare("
            INSERT INTO pengajuan_konflik (
                id_konflik,
                id_pengajuan
            )

            VALUES (
                :konflik,
                :pengajuan
            )
        ");

        foreach ($idAnggota as $idAnggotaPengajuan) {

            $stmtRelasi->execute([
                ':konflik' => $idKonflik,
                ':pengajuan' => $idAnggotaPengajuan
            ]);
        }

        /*
        6. COMMIT
        */

        $pdo->commit();

        responsJSON(
            true,
            'Kasus konflik berhasil dikirim kepada Kepala Lab.',
            200,
            [
                'idKonflik' => $idKonflik,
                'jumlahPengajuan' => count($kelompok),
                'daftarPengajuan' => $idAnggota,
                'status' => 'menunggu_keputusan'
            ]
        );
    }

    /*
    ==================================================
    TINDAKAN 2: SETUJUI PENGAJUAN
    ==================================================
    */

    if ($aksi === 'setujui') {

        /*
        1. VALIDASI STATUS
        */

        if (
            !in_array(
                $statusPengajuan,
                $pendingStatuses,
                true
            )
        ) {

            throw new RuntimeException(
                'Pengajuan tidak berada dalam antrean verifikasi.'
            );
        }

        /*
        2. PERIKSA KONFLIK

        Laboran tidak berwenang menentukan pengajuan
        mana yang menang dalam kelompok konflik.
        */

        $kelompok = ambilKelompokKonflik(
            $pdo,
            (int) $idPengajuan,
            $pendingStatuses,
            $activeBookingStatuses
        );

        if (count($kelompok) > 1) {

            throw new RuntimeException(
                'Pengajuan mengalami konflik jadwal. '
                . 'Kirim terlebih dahulu kepada Kepala Lab '
                . 'untuk mendapatkan keputusan.'
            );
        }

        /*
        3. PERIKSA BOOKING LAMA
        */

        if (
            $booking &&
            in_array(
                $statusBooking,
                $activeBookingStatuses,
                true
            )
        ) {

            throw new RuntimeException(
                'Pengajuan ini sudah memiliki booking aktif.'
            );
        }

        /*
        4. UPDATE STATUS PENGAJUAN
        */

        $stmt = $pdo->prepare("
            UPDATE pengajuan

            SET status = 'disetujui'

            WHERE id_pengajuan = :id
        ");

        $stmt->execute([
            ':id' => $idPengajuan
        ]);

        /*
        5. BUAT ATAU AKTIFKAN BOOKING
        */

        if ($booking) {

            $idBooking = (int) $booking['id_booking'];

            $stmt = $pdo->prepare("
                UPDATE booking

                SET status = 'terjadwal'

                WHERE id_booking = :id
            ");

            $stmt->execute([
                ':id' => $idBooking
            ]);

        } else {

            $stmt = $pdo->prepare("
                INSERT INTO booking (
                    id_pengajuan,
                    status,
                    waktu_dibuat
                )

                VALUES (
                    :id,
                    'terjadwal',
                    NOW()
                )
            ");

            $stmt->execute([
                ':id' => $idPengajuan
            ]);

            $idBooking = (int) $pdo->lastInsertId();
        }

        /*
        6. CATAT VALIDASI LABORAN
        */

        $stmt = $pdo->prepare("
            INSERT INTO validasi_booking (
                id_booking,
                id_user_laboran,
                status,
                waktu_divalidasi,
                waktu_dibuat
            )

            VALUES (
                :booking,
                :laboran,
                'disetujui',
                NOW(),
                NOW()
            )

            ON DUPLICATE KEY UPDATE

                id_user_laboran = VALUES(id_user_laboran),
                status = 'disetujui',
                waktu_divalidasi = NOW()
        ");

        $stmt->execute([
            ':booking' => $idBooking,
            ':laboran' => $idLaboran
        ]);

        /*
        7. COMMIT
        */

        $pdo->commit();

        responsJSON(
            true,
            'Pengajuan berhasil disetujui dan booking berhasil dibuat.',
            200,
            [
                'idPengajuan' => (int) $idPengajuan,
                'idBooking' => $idBooking,
                'status' => 'disetujui',
                'statusBooking' => 'terjadwal'
            ]
        );
    }

    /*
    ==================================================
    TINDAKAN 3: TOLAK PENGAJUAN
    ==================================================
    */

    if ($aksi === 'tolak') {

        /*
        1. VALIDASI STATUS
        */

        if (
            !in_array(
                $statusPengajuan,
                $pendingStatuses,
                true
            )
        ) {

            throw new RuntimeException(
                'Pengajuan tidak berada dalam antrean verifikasi.'
            );
        }

        /*
        2. PERIKSA KONFLIK
        */

        $kelompok = ambilKelompokKonflik(
            $pdo,
            (int) $idPengajuan,
            $pendingStatuses,
            $activeBookingStatuses
        );

        if (count($kelompok) > 1) {

            throw new RuntimeException(
                'Pengajuan mengalami konflik jadwal. '
                . 'Keputusan penolakan harus ditentukan oleh Kepala Lab.'
            );
        }

        /*
        3. PERIKSA BOOKING AKTIF
        */

        if (
            $booking &&
            in_array(
                $statusBooking,
                $activeBookingStatuses,
                true
            )
        ) {

            throw new RuntimeException(
                'Pengajuan sudah memiliki booking aktif dan tidak dapat ditolak.'
            );
        }

        /*
        4. UPDATE STATUS
        */

        $stmt = $pdo->prepare("
            UPDATE pengajuan

            SET status = 'ditolak'

            WHERE id_pengajuan = :id
        ");

        $stmt->execute([
            ':id' => $idPengajuan
        ]);

        /*
        5. COMMIT
        */

        $pdo->commit();

        responsJSON(
            true,
            'Pengajuan berhasil ditolak.',
            200,
            [
                'idPengajuan' => (int) $idPengajuan,
                'status' => 'ditolak'
            ]
        );
    }

    /*
    ==================================================
    TINDAKAN 4: BATALKAN PERSETUJUAN
    ==================================================
    */

    if ($aksi === 'batalkan_persetujuan') {

        /*
        1. VALIDASI STATUS PENGAJUAN
        */

        if ($statusPengajuan !== 'disetujui') {

            throw new RuntimeException(
                'Pengajuan tidak berstatus disetujui.'
            );
        }

        /*
        2. VALIDASI BOOKING
        */

        if (!$booking) {

            throw new RuntimeException(
                'Data booking tidak ditemukan.'
            );
        }

        if ($statusBooking !== 'terjadwal') {

            throw new RuntimeException(
                'Booking tidak lagi berada dalam status terjadwal.'
            );
        }

        /*
        3. AMBIL DATA VALIDASI BOOKING
        */

        $stmt = $pdo->prepare("
            SELECT
                id_validasi_booking,
                status

            FROM validasi_booking

            WHERE id_booking = :id

            FOR UPDATE
        ");

        $stmt->execute([
            ':id' => $booking['id_booking']
        ]);

        $validasi = $stmt->fetch(PDO::FETCH_ASSOC);

        /*
        4. PERIKSA PRESENSI
        */

        if (
            $validasi &&
            in_array(
                normalisasiStatus($validasi['status']),
                $usedStatuses,
                true
            )
        ) {

            throw new RuntimeException(
                'Booking sudah digunakan atau presensi telah tercatat.'
            );
        }

        /*
        5. PERIKSA BATAS WAKTU PRESENSI
        */

        $sekarang = new DateTimeImmutable(
            'now',
            $zonaWaktu
        );

        $batasPresensi = $mulai->modify('+15 minutes');

        if ($sekarang >= $batasPresensi) {

            throw new RuntimeException(
                'Batas waktu presensi 15 menit sudah habis. '
                . 'Pembatalan tidak dapat dilakukan.'
            );
        }

        /*
        6. BATALKAN BOOKING
        */

        $stmt = $pdo->prepare("
            UPDATE booking

            SET status = 'dibatalkan'

            WHERE id_booking = :id
        ");

        $stmt->execute([
            ':id' => $booking['id_booking']
        ]);

        /*
        7. KEMBALIKAN PENGAJUAN KE ANTREAN
        */

        $stmt = $pdo->prepare("
            UPDATE pengajuan

            SET status = 'menunggu'

            WHERE id_pengajuan = :id
        ");

        $stmt->execute([
            ':id' => $idPengajuan
        ]);

        /*
        8. UPDATE VALIDASI BOOKING
        */

        $stmt = $pdo->prepare("
            UPDATE validasi_booking

            SET
                status = 'dibatalkan',
                waktu_divalidasi = NOW()

            WHERE id_booking = :id
        ");

        $stmt->execute([
            ':id' => $booking['id_booking']
        ]);

        /*
        9. COMMIT
        */

        $pdo->commit();

        responsJSON(
            true,
            'Persetujuan berhasil dibatalkan. '
            . 'Pengajuan dikembalikan ke antrean verifikasi.',
            200,
            [
                'idPengajuan' => (int) $idPengajuan,
                'idBooking' => (int) $booking['id_booking'],
                'status' => 'menunggu',
                'statusBooking' => 'dibatalkan'
            ]
        );
    }

    /*
    ==================================================
    AKSI TIDAK DIKENALI
    ==================================================
    */

    throw new RuntimeException(
        'Jenis tindakan tidak dikenali: ' . $aksi
    );

}

/*
==================================================
9. PENANGANAN ERROR
==================================================
*/ catch (RuntimeException $e) {

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
        'SILAB tindakan_antrean.php: '
        . $e->getMessage()
    );

    responsJSON(
        false,
        'Terjadi kesalahan server saat memproses tindakan. '
        . 'Periksa log server.',
        500
    );

}