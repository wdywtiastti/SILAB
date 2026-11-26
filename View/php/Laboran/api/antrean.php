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
    return strtolower(
        preg_replace(
            '/[\s-]+/',
            '_',
            trim((string) $value)
        )
    );
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
==================================================
AMBIL DETAIL PENGAJUAN DINAMIS
==================================================
*/

    $detailAturanMap = [];
    $detailFasilitasMap = [];
    $skorMap = [];

    $idsPengajuan = array_values(array_unique(
        array_map(
            fn($row) => (int) $row['id_pengajuan'],
            $rows
        )
    ));

    if (!empty($idsPengajuan)) {

        $placeholders = implode(
            ',',
            array_fill(0, count($idsPengajuan), '?')
        );

        /*
        ==============================================
        A. DETAIL ATURAN DAN JENIS KEGIATAN
        ==============================================
        */

        $sqlAturan = "
        SELECT
            pa.id_pengajuan,
            a.nama_kelompok,
            ak.nama_kriteria

        FROM pengajuan_aturan pa

        INNER JOIN aturan_kriteria ak
            ON ak.id_aturan_kriteria = pa.id_aturan_kriteria

        INNER JOIN aturan a
            ON a.id_aturan = ak.id_aturan

        WHERE pa.id_pengajuan IN ($placeholders)

        ORDER BY pa.id_pengajuan
    ";

        $stmtAturan = $pdo->prepare($sqlAturan);
        $stmtAturan->execute($idsPengajuan);

        while ($detail = $stmtAturan->fetch(PDO::FETCH_ASSOC)) {

            $id = (int) $detail['id_pengajuan'];

            $detailAturanMap[$id][] = [
                'kelompok' => $detail['nama_kelompok'],
                'nama' => $detail['nama_kriteria']
            ];
        }


        /*
        ==============================================
        B. DETAIL FASILITAS
        ==============================================
        */

        $sqlFasilitas = "
        SELECT
            pf.id_pengajuan,
            f.id_fasilitas,
            f.nama_fasilitas,
            pf.jumlah

        FROM pengajuan_fasilitas pf

        INNER JOIN fasilitas f
            ON f.id_fasilitas = pf.id_fasilitas

        WHERE pf.id_pengajuan IN ($placeholders)

        ORDER BY pf.id_pengajuan, f.nama_fasilitas
    ";

        $stmtFasilitas = $pdo->prepare($sqlFasilitas);
        $stmtFasilitas->execute($idsPengajuan);

        while ($detail = $stmtFasilitas->fetch(PDO::FETCH_ASSOC)) {

            $id = (int) $detail['id_pengajuan'];

            $detailFasilitasMap[$id][] = [
                'idFasilitas' => (int) $detail['id_fasilitas'],
                'nama' => $detail['nama_fasilitas'],
                'jumlah' => (int) $detail['jumlah']
            ];
        }


        /*
        ==============================================
        C. SKOR DAN PRIORITAS DECISION TREE
        ==============================================
        */

        $sqlSkor = "
        SELECT
            id_pengajuan,
            skor_jenis_kegiatan,
            skor_fasilitas,
            skor_akhir,
            prioritas,
            waktu_perhitungan_dilakukan

        FROM skor_pengajuan

        WHERE id_pengajuan IN ($placeholders)

        ORDER BY
            waktu_perhitungan_dilakukan DESC,
            id_score_pengajuan DESC
    ";

        $stmtSkor = $pdo->prepare($sqlSkor);
        $stmtSkor->execute($idsPengajuan);

        while ($detail = $stmtSkor->fetch(PDO::FETCH_ASSOC)) {

            $id = (int) $detail['id_pengajuan'];

            // Ambil hasil perhitungan terbaru.
            if (!isset($skorMap[$id])) {
                $skorMap[$id] = $detail;
            }
        }
    }

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
==================================================
C. KELOMPOKKAN DATA
==================================================
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
            !$isDisplaced &&
            (
                $submissionStatus === 'disetujui' ||
                in_array(
                    $bookingStatus,
                    $activeBookingStatuses,
                    true
                )
            );

        // Pengajuan tergeser tidak ikut pemeriksaan konflik.
        if ($isDisplaced) {
            continue;
        }

        /*
        ----------------------------------------------
        BOOKING AKTIF
        ----------------------------------------------

        Booking aktif tetap diperhitungkan meskipun
        terlibat dalam kasus konflik yang dieskalasikan.
        */

        if ($isApproved) {

            $activeBookings[] = $row;

            continue;
        }

        /*
        ----------------------------------------------
        PENGAJUAN PENDING
        ----------------------------------------------

        Pengajuan pending yang sudah dieskalasikan
        tidak dimasukkan kembali ke antrean pemeriksaan.
        */

        if ($sedangEskalasi) {
            continue;
        }

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

        // Ambil detail milik pengajuan ini.

        $detailAturan = $detailAturanMap[$id] ?? [];

        $detailFasilitas = $detailFasilitasMap[$id] ?? [];

        $detailSkor = $skorMap[$id] ?? null;


        // Ambil kategori dari kelompok Jenis Kegiatan.

        $kategori = null;

        foreach ($detailAturan as $aturanDetail) {
            if (
                stripos(
                    $aturanDetail['kelompok'],
                    'jenis kegiatan'
                ) !== false
            ) {
                $kategori = $aturanDetail['nama'];
                break;
            }
        }


        // Ambil kebutuhan PC dan kursi untuk kompatibilitas
        // dengan bagian frontend yang lama.

        $kebutuhanPC = null;
        $kebutuhanKursi = null;

        foreach ($detailFasilitas as $fasilitasDetail) {
            $namaFasilitas = strtolower(
                $fasilitasDetail['nama']
            );

            if (
                $kebutuhanPC === null &&
                preg_match('/\bpc\b/', $namaFasilitas)
            ) {
                $kebutuhanPC = $fasilitasDetail['jumlah'];
            }

            if (
                $kebutuhanKursi === null &&
                strpos($namaFasilitas, 'kursi') !== false
            ) {
                $kebutuhanKursi = $fasilitasDetail['jumlah'];
            }
        }


        // Ambil skor dan prioritas dari algoritma.

        $skorAkhir = $detailSkor['skor_akhir'] ?? null;

        $prioritasAngka = $detailSkor['prioritas'] ?? null;

        $prioritasLabel = $prioritasAngka !== null
            ? 'P' . (int) $prioritasAngka
            : null;


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

            // DETAIL DINAMIS PENGAJUAN

            'detailAturan' => $detailAturan,

            'detailFasilitas' => $detailFasilitas,

            'kategori' => $kategori,

            'kebutuhanPC' => $kebutuhanPC,

            'kebutuhanKursi' => $kebutuhanKursi,


            // HASIL PENILAIAN

            'skorJenisKegiatan' =>
                $detailSkor['skor_jenis_kegiatan'] ?? null,

            'skorFasilitas' =>
                $detailSkor['skor_fasilitas'] ?? null,

            'skor' =>
                $skorAkhir,

            'prioritas' =>
                $prioritasLabel,

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

                ? 'Pengajuan ini sudah menjadi bagian dari kasus konflik dan sedang menunggu keputusan Kepala Lab.'

                : (

                    count($conflicts) > 0

                    ? 'Jadwal beririsan dengan '
                    . count($conflicts)
                    . ' pengajuan atau booking lainnya. '
                    . 'Pengajuan perlu diteruskan kepada Kepala Lab.'

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
