<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=UTF-8');

date_default_timezone_set('Asia/Jayapura');

// =============================================
// SILAB - API ANTREAN PENGAJUAN LABORAN
// VERSI REVISI
// Sumber data: DATABASE
// =============================================

/*
==================================================
1. FUNGSI RESPONSE JSON
==================================================
*/

function jsonResponse(
    int $code,
    bool $success,
    string $message,
    array $data = []
): never {

    http_response_code($code);

    echo json_encode([
        'success' => $success,
        'message' => $message,
        'data' => $data
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);

    exit;
}


/*
==================================================
2. AUTENTIKASI
==================================================
*/

require_once __DIR__ . '/../../auth/sesi.php';

if (!sudahLogin()) {
    jsonResponse(
        401,
        false,
        'Silakan login terlebih dahulu.'
    );
}

if (($_SESSION['role'] ?? '') !== 'laboran') {
    jsonResponse(
        403,
        false,
        'Anda tidak memiliki akses.'
    );
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {

    header('Allow: GET');

    jsonResponse(
        405,
        false,
        'Metode request tidak diizinkan.'
    );
}


/*
==================================================
3. KONEKSI DATABASE
==================================================
*/

require_once __DIR__ . '/../../../config/database.php';


/*
==================================================
4. FUNGSI BANTU
==================================================
*/

function statusNorm(?string $value): string
{
    return strtolower(trim((string) $value));
}


/*
----------------------------------------------
PEMERIKSAAN IRISAN JADWAL
----------------------------------------------

Jadwal 09.00-10.00 tidak bentrok
dengan jadwal 10.00-11.00.
*/

function overlap(array $a, array $b): bool
{
    return
        $a['waktu_mulai'] < $b['waktu_selesai']
        &&
        $a['waktu_selesai'] > $b['waktu_mulai'];
}


/*
----------------------------------------------
FORMAT TANGGAL DAN WAKTU
----------------------------------------------
*/

function formatTanggalWaktu(string $value): DateTimeImmutable
{
    return new DateTimeImmutable(
        $value,
        new DateTimeZone('Asia/Jayapura')
    );
}


/*
==================================================
5. PROSES PENGAMBILAN DATA
==================================================
*/

try {

    /*
    ==============================================
    A. AMBIL DATA PENGAJUAN
    ==============================================

    Mengambil data pengajuan, pengguna, booking,
    presensi, dan kasus konflik aktif.

    Konflik aktif adalah konflik yang belum
    selesai, ditutup, atau dibatalkan.
    */

    $sql = "

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

            vb.status AS status_presensi,

            k_aktif.id_konflik AS id_konflik_aktif

        FROM pengajuan p

        LEFT JOIN users u
            ON u.id_user = p.id_user

        LEFT JOIN booking b
            ON b.id_pengajuan = p.id_pengajuan

        LEFT JOIN validasi_booking vb
            ON vb.id_booking = b.id_booking

        LEFT JOIN (

            SELECT

                pk.id_pengajuan,

                MAX(k.id_konflik) AS id_konflik

            FROM pengajuan_konflik pk

            INNER JOIN konflik k
                ON k.id_konflik = pk.id_konflik

            WHERE k.status NOT IN (
                'selesai',
                'ditutup',
                'dibatalkan'
            )

            GROUP BY pk.id_pengajuan

        ) k_aktif

            ON k_aktif.id_pengajuan = p.id_pengajuan

        ORDER BY
            p.waktu_mulai ASC,
            p.id_pengajuan ASC

    ";

    $stmt = $pdo->query($sql);

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);


    /*
    ==============================================
    B. KONFIGURASI STATUS
    ==============================================
    */

    // Pengajuan yang masih memerlukan tindakan Laboran.

    $pendingStatuses = [
        'menunggu',
        'verifikasi',
        'menunggu_verifikasi',
        'pending',
        'bentrok',
        'konflik'
    ];


    // Booking yang masih aktif.

    $activeBookingStatuses = [
        'terjadwal',
        'disetujui',
        'berlangsung',
        'digunakan'
    ];


    // Pengajuan yang tergeser akibat keputusan Kepala Lab.

    $displacedStatuses = [
        'tergeser',
        'displaced'
    ];


    // Status konflik yang sudah tidak aktif.

    $closedConflictStatuses = [
        'selesai',
        'ditutup',
        'dibatalkan'
    ];


    /*
    ==============================================
    C. KELOMPOKKAN DATA
    ==============================================

    PENTING:

    Pengajuan yang sedang dieskalasikan tidak boleh
    masuk kelompok pending maupun booking aktif
    untuk pemeriksaan konflik antrean.

    Pengajuan tergeser juga tidak boleh dianggap
    sebagai pengajuan pending.
    */

    $activeBookings = [];

    $pending = [];

    foreach ($rows as $row) {

        $bookingStatus = statusNorm(
            $row['status_booking'] ?? null
        );

        $submissionStatus = statusNorm(
            $row['status_pengajuan'] ?? null
        );

        $sedangEskalasi =
            $row['id_konflik_aktif'] !== null;

        $isDisplaced = in_array(
            $submissionStatus,
            $displacedStatuses,
            true
        );

        $isApproved =
            $submissionStatus === 'disetujui'
            ||
            in_array(
                $bookingStatus,
                $activeBookingStatuses,
                true
            );


        // Abaikan pengajuan yang sudah dieskalasikan.

        if ($sedangEskalasi) {
            continue;
        }


        // Pengajuan tergeser tidak masuk pending.

        if ($isDisplaced) {
            continue;
        }


        // Booking aktif untuk pemeriksaan bentrok.

        if ($isApproved) {

            $activeBookings[] = $row;

            continue;
        }


        // Pengajuan yang masih menunggu pemeriksaan.

        if (
            in_array(
                $submissionStatus,
                $pendingStatuses,
                true
            )
        ) {

            $pending[] = $row;
        }
    }


    /*
    ==============================================
    6. PEMERIKSAAN SETIAP PENGAJUAN
    ==============================================
    */

    $result = [];

    foreach ($rows as $row) {

        $id = (int) $row['id_pengajuan'];

        $submissionStatus = statusNorm(
            $row['status_pengajuan'] ?? null
        );

        $bookingStatus = statusNorm(
            $row['status_booking'] ?? null
        );


        /*
        ----------------------------------------------
        A. IDENTIFIKASI STATUS
        ----------------------------------------------
        */

        $sedangEskalasi =
            $row['id_konflik_aktif'] !== null;

        $idKonflikAktif = $sedangEskalasi
            ? (int) $row['id_konflik_aktif']
            : null;


        $isDisplaced = in_array(
            $submissionStatus,
            $displacedStatuses,
            true
        );


        $isActiveBooking = in_array(
            $bookingStatus,
            $activeBookingStatuses,
            true
        );


        // Pengajuan tergeser harus diprioritaskan
        // agar tidak salah dianggap disetujui
        // akibat status booking lama.

        $isApproved =
            !$isDisplaced
            &&
            (
                $submissionStatus === 'disetujui'
                ||
                $isActiveBooking
            );


        $isPending =
            !$sedangEskalasi
            &&
            !$isApproved
            &&
            !$isDisplaced
            &&
            in_array(
                $submissionStatus,
                $pendingStatuses,
                true
            );


        /*
        ----------------------------------------------
        B. PEMERIKSAAN KONFLIK
        ----------------------------------------------
        */

        $conflicts = [];

        $conflictTypes = [];


        /*
        PENGAJUAN YANG SUDAH DIEKSKALASI
        TIDAK DIPERIKSA ULANG OLEH ANTREAN LABORAN.
        */

        if (!$sedangEskalasi && $isPending) {

            // Periksa terhadap booking aktif.

            foreach ($activeBookings as $other) {

                if (
                    (int) $other['id_pengajuan'] === $id
                ) {
                    continue;
                }

                if (overlap($row, $other)) {

                    $conflicts[
                        (int) $other['id_pengajuan']
                    ] = $other;

                    $conflictTypes['booking_aktif'] = true;
                }
            }


            // Periksa terhadap pengajuan pending lainnya.

            foreach ($pending as $other) {

                if (
                    (int) $other['id_pengajuan'] === $id
                ) {
                    continue;
                }

                if (overlap($row, $other)) {

                    $conflicts[
                        (int) $other['id_pengajuan']
                    ] = $other;

                    $conflictTypes['antar_pengajuan'] = true;
                }
            }
        }


        /*
        BOOKING YANG SUDAH DISETUJUI

        Konflik tetap ditampilkan sebagai informasi
        apabila ada pengajuan baru yang beririsan.
        */ elseif (!$sedangEskalasi && $isApproved) {

            // Periksa terhadap pengajuan pending.

            foreach ($pending as $other) {

                if (
                    (int) $other['id_pengajuan'] === $id
                ) {
                    continue;
                }

                if (overlap($row, $other)) {

                    $conflicts[
                        (int) $other['id_pengajuan']
                    ] = $other;

                    $conflictTypes['pengajuan_baru'] = true;
                }
            }


            // Periksa terhadap booking aktif lainnya.

            foreach ($activeBookings as $other) {

                if (
                    (int) $other['id_pengajuan'] === $id
                ) {
                    continue;
                }

                if (overlap($row, $other)) {

                    $conflicts[
                        (int) $other['id_pengajuan']
                    ] = $other;

                    $conflictTypes['antar_booking_aktif'] = true;
                }
            }
        }


        /*
        ==============================================
        7. PENENTUAN STATUS TAMPILAN
        ==============================================

        Urutan prioritas:

        1. Eskalasi aktif
        2. Tergeser
        3. Disetujui
        4. Bentrok
        5. Status asli pengajuan
        ==============================================
        */

        if ($sedangEskalasi) {

            $displayStatus = 'eskalasi';

            $kategoriAntrean = 'eskalasi';

        } elseif ($isDisplaced) {

            $displayStatus = 'tergeser';

            $kategoriAntrean = 'rekomendasi';

        } elseif ($isApproved) {

            $displayStatus = 'disetujui';

            $kategoriAntrean = 'disetujui';

        } elseif ($isPending) {

            if (count($conflicts) > 0) {

                $displayStatus = 'bentrok';

            } else {

                $displayStatus = $submissionStatus;
            }


            if ($submissionStatus === 'menunggu_verifikasi') {

                $kategoriAntrean = 'belum_disetujui_lagi';

            } else {

                $kategoriAntrean = 'belum_disetujui';
            }

        } elseif ($submissionStatus === 'ditolak') {

            $displayStatus = 'ditolak';

            $kategoriAntrean = 'riwayat_ditolak';

        } else {

            $displayStatus = $submissionStatus ?: 'menunggu';

            $kategoriAntrean = 'lainnya';
        }


        /*
        ==============================================
        8. SUSUN DAFTAR KONFLIK
        ==============================================
        */

        $conflictList = [];

        foreach ($conflicts as $other) {

            $otherStart = formatTanggalWaktu(
                (string) $other['waktu_mulai']
            );

            $otherEnd = formatTanggalWaktu(
                (string) $other['waktu_selesai']
            );


            $conflictList[] = [

                'idPengajuan' =>
                    (int) $other['id_pengajuan'],

                'namaKegiatan' =>
                    $other['nama_kegiatan'],

                'namaPemohon' =>
                    $other['nama_pemohon'] ?? '-',

                'tanggal' =>
                    $otherStart->format('Y-m-d'),

                'waktuMulai' =>
                    $otherStart->format('H:i'),

                'waktuSelesai' =>
                    $otherEnd->format('H:i'),

                'statusPengajuan' =>
                    $other['status_pengajuan'],

                'statusBooking' =>
                    $other['status_booking']

            ];
        }


        /*
        ==============================================
        9. FORMAT TANGGAL PENGAJUAN
        ==============================================
        */

        $mulai = formatTanggalWaktu(
            (string) $row['waktu_mulai']
        );

        $selesai = formatTanggalWaktu(
            (string) $row['waktu_selesai']
        );


        /*
        ==============================================
        10. SUSUN DATA UNTUK JAVASCRIPT
        ==============================================
        */

        $result[] = [

            // IDENTITAS

            'id' =>
                $id,

            'idPengajuan' =>
                $id,

            'idUser' =>
                (int) $row['id_user'],

            'idBooking' =>
                $row['id_booking'] !== null
                ? (int) $row['id_booking']
                : null,


            // INFORMASI PENGAJUAN

            'namaKegiatan' =>
                $row['nama_kegiatan'],

            'namaPemohon' =>
                $row['nama_pemohon'] ?? '-',

            'identifier' =>
                $row['identifier'] ?? '-',

            'tanggal' =>
                $mulai->format('Y-m-d'),

            'waktuMulai' =>
                $mulai->format('H:i'),

            'waktuSelesai' =>
                $selesai->format('H:i'),


            // INFORMASI FASILITAS

            'kebutuhanPC' =>
                null,

            'kebutuhanKursi' =>
                null,

            'kategori' =>
                null,

            'skor' =>
                null,

            'prioritas' =>
                null,


            // STATUS

            'status' =>
                $displayStatus,

            'kategoriAntrean' =>
                $kategoriAntrean,

            'statusPengajuan' =>
                $submissionStatus,

            'statusBooking' =>
                $bookingStatus ?: null,

            'statusPresensi' =>
                $row['status_presensi'],


            // INFORMASI ESKALASI

            'sedangEskalasi' =>
                $sedangEskalasi,

            'idKonflikAktif' =>
                $idKonflikAktif,


            // INFORMASI KONFLIK

            'mengalamiKonflik' =>
                $sedangEskalasi || count($conflicts) > 0,

            'jenisKonflik' =>
                array_keys($conflictTypes),

            'daftarKonflik' =>
                array_values($conflictList),

            'pesanKonflik' =>

                $sedangEskalasi

                ? 'Pengajuan sudah dikirim kepada Kepala Lab dan sedang menunggu keputusan.'

                : (

                    count($conflicts) > 0

                    ? 'Jadwal beririsan dengan '
                    . count($conflicts)
                    . ' pengajuan atau booking lainnya.'

                    : null
                ),


            // WAKTU

            'waktuDibuat' =>
                $row['waktu_dibuat']

        ];
    }


    /*
    ==============================================
    11. KIRIM RESPONSE JSON
    ==============================================
    */

    jsonResponse(
        200,
        true,
        'Data antrean berhasil diambil.',
        $result
    );


    /*
    ==================================================
    12. PENANGANAN ERROR
    ==================================================
    */

} catch (Throwable $e) {

    error_log(
        'SILAB API antrean: ' . $e->getMessage()
    );

    jsonResponse(
        500,
        false,
        'Gagal mengambil data antrean. Periksa log server.'
    );
}
