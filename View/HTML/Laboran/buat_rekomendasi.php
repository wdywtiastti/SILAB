<?php

declare(strict_types=1);

date_default_timezone_set('Asia/Jayapura');

/*
==================================================
1. SESSION DAN DATABASE
==================================================
*/

require_once __DIR__ . '/../auth/sesi.php';
require_once __DIR__ . '/../../../config/database.php';

/*
==================================================
2. VALIDASI LOGIN LABORAN
==================================================
*/

if (!sudahLogin()) {
    header('Location: ../auth/login.php');
    exit;
}

$role = strtolower(trim($_SESSION['role'] ?? ''));

if ($role !== 'laboran') {
    http_response_code(403);
    exit('Akses ditolak. Halaman ini hanya untuk Laboran.');
}

$idLaboran = (int) ($_SESSION['id_user'] ?? 0);

if ($idLaboran <= 0) {
    http_response_code(401);
    exit('Identitas Laboran tidak valid.');
}

/*
==================================================
3. AMBIL ID PENGAJUAN DARI URL
==================================================

Contoh:
buat_rekomendasi.php?id_pengajuan=2

Mendukung:
- id_pengajuan
- id
- kasusId
*/

$idPengajuan = filter_input(
    INPUT_GET,
    'id_pengajuan',
    FILTER_VALIDATE_INT
);

if (!$idPengajuan) {
    $idPengajuan = filter_input(
        INPUT_GET,
        'id',
        FILTER_VALIDATE_INT
    );
}

if (!$idPengajuan) {
    $idPengajuan = filter_input(
        INPUT_GET,
        'kasusId',
        FILTER_VALIDATE_INT
    );
}

if (!$idPengajuan || $idPengajuan <= 0) {
    http_response_code(400);
    exit('ID pengajuan tidak ditemukan atau tidak valid.');
}

/*
==================================================
4. AMBIL DATA PENGAJUAN TERGESER
==================================================
*/

try {

    $sql = "

        SELECT

            p.id_pengajuan,
            p.id_user,
            p.nama_kegiatan,
            p.waktu_mulai,
            p.waktu_selesai,
            p.status,

            u.nama AS nama_pemohon,
            u.nip_npm,

            COALESCE((
                SELECT SUM(
                    CASE
                        WHEN LOWER(f.nama_fasilitas) LIKE '%pc%'
                        THEN pf.jumlah
                        ELSE 0
                    END
                )
                FROM pengajuan_fasilitas pf
                INNER JOIN fasilitas f
                    ON f.id_fasilitas = pf.id_fasilitas
                WHERE pf.id_pengajuan = p.id_pengajuan
            ), 0) AS kebutuhan_pc,

            COALESCE((
                SELECT SUM(
                    CASE
                        WHEN LOWER(f.nama_fasilitas) LIKE '%kursi%'
                        THEN pf.jumlah
                        ELSE 0
                    END
                )
                FROM pengajuan_fasilitas pf
                INNER JOIN fasilitas f
                    ON f.id_fasilitas = pf.id_fasilitas
                WHERE pf.id_pengajuan = p.id_pengajuan
            ), 0) AS kebutuhan_kursi

        FROM pengajuan p

        INNER JOIN users u
            ON u.id_user = p.id_user

        WHERE p.id_pengajuan = :id_pengajuan

        LIMIT 1

    ";

    $stmt = $pdo->prepare($sql);

    $stmt->execute([
        ':id_pengajuan' => $idPengajuan
    ]);

    $pengajuan = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$pengajuan) {
        http_response_code(404);
        exit('Data pengajuan tidak ditemukan.');
    }

    /*
    ==============================================
    5. VALIDASI STATUS PENGAJUAN
    ==============================================
    */

    $statusPengajuan = strtolower(
        trim($pengajuan['status'] ?? '')
    );

    $statusTergeser = [
        'tergeser',
        'pengguna_tergeser',
        'tergeser_prioritas',
        'menunggu_rekomendasi',
        'displaced'
    ];

    if (!in_array($statusPengajuan, $statusTergeser, true)) {
        http_response_code(422);
        exit('Pengajuan ini tidak berada dalam status tergeser.');
    }

    /*
    ==============================================
    6. PERIKSA REKOMENDASI AKTIF
    ==============================================
    */

    $stmt = $pdo->prepare("

        SELECT

            id_rekomendasi,
            id_pengajuan,
            status,
            catatan,
            waktu_dibuat,
            waktu_dikirim,
            batas_waktu

        FROM rekomendasi

        WHERE id_pengajuan = :id_pengajuan

        ORDER BY id_rekomendasi DESC

        LIMIT 1

    ");

    $stmt->execute([
        ':id_pengajuan' => $idPengajuan
    ]);

    $rekomendasiLama = $stmt->fetch(PDO::FETCH_ASSOC);

    $statusRekomendasi = strtolower(
        trim($rekomendasiLama['status'] ?? '')
    );

    $statusAktif = [
        'menunggu',
        'rekomendasi_dikirim',
        'menunggu_persetujuan',
        'menunggu_konfirmasi'
    ];

    if (
        $rekomendasiLama &&
        in_array($statusRekomendasi, $statusAktif, true)
    ) {
        http_response_code(409);
        exit('Pengajuan ini sudah memiliki rekomendasi yang sedang menunggu konfirmasi.');
    }

    /*
    ==============================================
    7. AMBIL INFORMASI PENGAJUAN PENGGESER
    ==============================================
    */

    $stmt = $pdo->prepare("

        SELECT

            k.id_konflik,
            k.id_pengajuan_terpilih,

            p2.nama_kegiatan AS kegiatan_penggeser,

            u2.nama AS nama_penggeser

        FROM pengajuan_konflik pk

        INNER JOIN konflik k
            ON k.id_konflik = pk.id_konflik

        LEFT JOIN pengajuan p2
            ON p2.id_pengajuan = k.id_pengajuan_terpilih

        LEFT JOIN users u2
            ON u2.id_user = p2.id_user

        WHERE pk.id_pengajuan = :id_pengajuan

          AND k.status = 'selesai'

        ORDER BY
            k.waktu_ditetapkan DESC,
            k.id_konflik DESC

        LIMIT 1

    ");

    $stmt->execute([
        ':id_pengajuan' => $idPengajuan
    ]);

    $penggeser = $stmt->fetch(PDO::FETCH_ASSOC);

    /*
    ==============================================
    8. SIAPKAN DATA HALAMAN
    ==============================================
    */

    $zonaWaktu = new DateTimeZone('Asia/Jayapura');

    $waktuMulai = new DateTimeImmutable(
        $pengajuan['waktu_mulai'],
        $zonaWaktu
    );

    $waktuSelesai = new DateTimeImmutable(
        $pengajuan['waktu_selesai'],
        $zonaWaktu
    );

    $dataRekomendasiPage = [

        'idPengajuan' => (int) $pengajuan['id_pengajuan'],

        'namaPemohon' => $pengajuan['nama_pemohon'],

        'nipNpm' => $pengajuan['nip_npm'],

        'namaKegiatan' => $pengajuan['nama_kegiatan'],

        'waktuMulaiAsal' => $pengajuan['waktu_mulai'],

        'waktuSelesaiAsal' => $pengajuan['waktu_selesai'],

        'jadwalAsalTanggal' => $waktuMulai->format('d-m-Y'),

        'jadwalAsalJam' =>
            $waktuMulai->format('H:i')
            . ' - '
            . $waktuSelesai->format('H:i')
            . ' WIT',

        'kebutuhanPC' => (int) $pengajuan['kebutuhan_pc'],

        'kebutuhanKursi' => (int) $pengajuan['kebutuhan_kursi'],

        'status' => $statusPengajuan,

        'idKonflik' => $penggeser
            ? (int) $penggeser['id_konflik']
            : null,

        'namaPenggeser' => $penggeser['nama_penggeser'] ?? '-',

        'kegiatanPenggeser' =>
            $penggeser['kegiatan_penggeser'] ?? '-',

        'idPengajuanTerpilih' =>
            isset($penggeser['id_pengajuan_terpilih'])
            ? (int) $penggeser['id_pengajuan_terpilih']
            : null,

        'rekomendasiLama' => $rekomendasiLama ?: null

    ];

} catch (Throwable $e) {

    error_log(
        'HALAMAN BUAT REKOMENDASI: '
        . $e->getMessage()
    );

    http_response_code(500);

    exit(
        'Terjadi kesalahan saat mengambil data pengajuan. Silakan periksa log server.'
    );
}

?>

<script>
    window.DATA_REKOMENDASI = <?= json_encode(
        $dataRekomendasiPage,
        JSON_UNESCAPED_UNICODE |
        JSON_HEX_TAG |
        JSON_HEX_APOS |
        JSON_HEX_AMP |
        JSON_HEX_QUOT
    ) ?>;
</script>

<!DOCTYPE html>
<html lang="id">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>Buat Rekomendasi Jadwal | SILAB</title>

    <!-- GOOGLE FONT -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        rel="stylesheet">

    <!-- BOOTSTRAP ICONS -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">

    <!-- CSS -->
    <link rel="stylesheet" href="../../CSS/laboran/navbar.css">
    <link rel="stylesheet" href="../../CSS/laboran/rekomendasi.css">

</head>

<body>

    <!-- ======================================
         1. NAVBAR
    ======================================= -->

    <nav class="navbar">

        <div class="navbar-brand">

            <img src="../../Assets/Logo_RPL.svg" alt="Logo SILAB" class="navbar-logo">

            <div class="brand-info">
                <h1>SILAB</h1>
                <p>Teknik Informatika - Universitas Khairun</p>
            </div>

        </div>

        <div class="navbar-menu">

            <a href="dashboard.php" class="nav-link">
                Dashboard Laboran
            </a>

            <a href="antrian.php" class="nav-link">
                Antrean
            </a>

            <a href="rekomendasi_jadwal.php" class="nav-link active">
                Rekomendasi Jadwal
            </a>

        </div>

        <div class="navbar-profile">

            <div class="profile-info">
                <h3>Satria Dwi Pauwah S.T., M.Kom.</h3>
                <p>Laboran Lab RPL</p>
            </div>

            <details class="profile-dropdown">

                <summary class="profile-trigger">
                    <i class="bi bi-person"></i>
                </summary>

                <div class="profile-menu">

                    <div class="profile-info-dropdown">

                        <p>Satria Dwi Pauwah S.T., M.Kom.</p>

                        <span>
                            NIP: 197804122005011003
                        </span>

                        <div class="profile-role">
                            <i class="bi bi-check-circle-fill"></i>
                            Laboran Lab
                        </div>

                    </div>

                    <div class="profile-divider"></div>

                    <a href="../auth/login.php" class="logout-link">
                        <i class="bi bi-box-arrow-right"></i>
                        Keluar/Logout
                    </a>

                </div>

            </details>

        </div>

    </nav>


    <!-- ======================================
         2. KONTEN UTAMA
    ======================================= -->

    <main class="rekomendasi-container">


        <!-- HEADER HALAMAN -->

        <section class="recommendation-header card">

            <div class="header-tags">

                <span class="header-tag purple-tag">
                    <i class="bi bi-shield-check"></i>
                    PANEL OPERASIONAL LABORAN
                </span>

                <span class="header-tag yellow-tag">
                    <i class="bi bi-building"></i>
                    Laboratorium RPL • 36 Workstations
                </span>

            </div>

            <div class="header-content">

                <div>

                    <h2>
                        Buat Rekomendasi Jadwal Pengganti
                    </h2>

                    <p>
                        Berikan alternatif jadwal bagi pengguna yang
                        jadwal peminjamannya tergeser oleh pengajuan
                        dengan prioritas lebih tinggi.
                    </p>

                </div>

                <span class="recommendation-status" id="statusRekomendasi">
                    Menunggu Rekomendasi
                </span>

            </div>

        </section>


        <!-- ==================================
             3. RINCIAN JADWAL TERGESER
        =================================== -->

        <section class="recommendation-detail card">

            <div class="section-heading">

                <div class="section-icon purple-icon">
                    <i class="bi bi-calendar-x"></i>
                </div>

                <h3>Rincian Jadwal Tergeser</h3>

            </div>


            <div class="detail-grid">


                <!-- DATA PEMOHON -->

                <article class="detail-card">

                    <small>Data Pemohon</small>

                    <strong data-detail="namaPemohon">
                        -
                    </strong>

                    <span data-detail="nipNpm">
                        -
                    </span>

                    <span class="priority-badge" data-detail="kategoriPrioritas">
                        -
                    </span>

                    <p data-detail="namaKegiatan">
                        -
                    </p>

                    <span data-detail="kebutuhan">
                        -
                    </span>

                </article>


                <!-- JADWAL ASAL -->

                <article class="detail-card">

                    <small>Jadwal Semula (Tergeser)</small>

                    <strong data-detail="jadwalAsalTanggal">
                        -
                    </strong>

                    <span data-detail="jadwalAsalJam">
                        -
                    </span>

                    <span class="status-badge displaced">
                        <i class="bi bi-x-circle-fill"></i>
                        Tergeser oleh Prioritas Lebih Tinggi
                    </span>

                </article>


                <!-- PENGAJUAN PENGGESER -->

                <article class="detail-card">

                    <small>Pengajuan Prioritas yang Menggeser</small>

                    <strong data-detail="namaPenggeser">
                        -
                    </strong>

                    <p data-detail="alasan">
                        Jadwal tergeser akibat pengajuan
                        dengan prioritas lebih tinggi.
                    </p>

                    <span class="priority-badge yellow-priority">
                        <i class="bi bi-circle-fill"></i>
                        Pengajuan Prioritas Lebih Tinggi
                    </span>

                </article>

            </div>


            <!-- INFORMASI -->

            <div class="recommendation-notice">

                <i class="bi bi-info-circle-fill"></i>

                <p>
                    Jadwal alternatif akan diperiksa terhadap jadwal
                    peminjaman aktif dan rekomendasi lain. Kebutuhan
                    kapasitas perangkat juga harus sesuai dengan
                    fasilitas laboratorium.
                </p>

            </div>

        </section>


        <!-- ==================================
             4. FORM REKOMENDASI
        =================================== -->

        <form id="formRekomendasi" class="recommendation-form" novalidate>


            <!-- CARD ALOKASI JADWAL -->

            <section class="recommendation-allocation card">


                <!-- JUDUL DAN TOMBOL TAMBAH -->

                <div class="section-heading allocation-heading">

                    <div class="heading-title">

                        <div class="section-icon red-icon">
                            <i class="bi bi-calendar-plus"></i>
                        </div>

                        <h3>
                            Alokasi Rekomendasi Jadwal Pengganti
                        </h3>

                    </div>


                    <div class="allocation-actions">

                        <span class="slot-badge">
                            <i class="bi bi-calendar-check"></i>
                            Slot Alternatif
                        </span>

                        <button type="button" id="btnTambahAlternatif" class="btn-tambah-alternatif"
                            aria-label="Tambah alternatif jadwal" title="Tambah alternatif jadwal">
                            <i class="bi bi-plus-lg"></i>
                        </button>

                    </div>

                </div>


                <!-- INFORMASI SLOT -->

                <div class="allocation-notice">

                    <i class="bi bi-info-circle-fill"></i>

                    <p>
                        Tentukan waktu alternatif yang tersedia
                        untuk pemohon. Kamu dapat memberikan satu
                        atau dua pilihan jadwal. Rekomendasi akan
                        menunggu konfirmasi pengguna selama 24 jam.
                    </p>

                </div>


                <!-- ==================================
                     DAFTAR ALTERNATIF
                =================================== -->

                <div class="alternative-list" id="daftarAlternatif">

                    <!-- ALTERNATIF PERTAMA -->

                    <article class="alternatif-card">

                        <div class="alternative-card-heading">

                            <div class="alternative-title">

                                <span class="alternative-number">
                                    1
                                </span>

                                <h4 data-judul-alternatif>
                                    Alternatif Jadwal 1
                                </h4>

                            </div>

                            <span class="alternative-label">
                                Pilihan 1
                            </span>

                        </div>


                        <div class="alternative-input-grid">


                            <!-- WAKTU MULAI -->

                            <div class="form-group">

                                <label data-label="waktuMulai">
                                    Waktu Mulai
                                </label>

                                <input type="datetime-local" data-field="waktuMulai" required>

                                <small class="field-error" data-error="waktuMulai"></small>

                            </div>


                            <!-- WAKTU SELESAI -->

                            <div class="form-group">

                                <label data-label="waktuSelesai">
                                    Waktu Selesai
                                </label>

                                <input type="datetime-local" data-field="waktuSelesai" required>

                                <small class="field-error" data-error="waktuSelesai"></small>

                            </div>

                        </div>

                    </article>

                </div>


                <!-- ==================================
                     TEMPLATE ALTERNATIF KEDUA
                =================================== -->

                <template id="templateAlternatif">

                    <article class="alternatif-card">

                        <div class="alternative-card-heading">

                            <div class="alternative-title">

                                <span class="alternative-number">
                                    2
                                </span>

                                <h4 data-judul-alternatif>
                                    Alternatif Jadwal 2
                                </h4>

                            </div>


                            <div class="alternative-card-actions">

                                <span class="alternative-label">
                                    Pilihan 2
                                </span>

                                <button type="button" class="btn-hapus-alternatif" data-hapus-alternatif
                                    aria-label="Hapus alternatif jadwal" title="Hapus alternatif">
                                    <i class="bi bi-trash3"></i>
                                </button>

                            </div>

                        </div>


                        <div class="alternative-input-grid">


                            <!-- WAKTU MULAI -->

                            <div class="form-group">

                                <label data-label="waktuMulai">
                                    Waktu Mulai
                                </label>

                                <input type="datetime-local" data-field="waktuMulai" required>

                                <small class="field-error" data-error="waktuMulai"></small>

                            </div>


                            <!-- WAKTU SELESAI -->

                            <div class="form-group">

                                <label data-label="waktuSelesai">
                                    Waktu Selesai
                                </label>

                                <input type="datetime-local" data-field="waktuSelesai" required>

                                <small class="field-error" data-error="waktuSelesai"></small>

                            </div>

                        </div>

                    </article>

                </template>


                <!-- ==================================
                     CATATAN PEMOHON
                =================================== -->

                <div class="form-group note-group">

                    <label for="catatan">
                        Catatan Panduan untuk Pemohon
                    </label>

                    <textarea id="catatan" name="catatan" rows="4" maxlength="500"
                        placeholder="Tuliskan informasi atau arahan terkait jadwal alternatif yang ditawarkan."></textarea>

                </div>


                <!-- ==================================
                     FEEDBACK VALIDASI
                =================================== -->

                <div id="feedbackRekomendasi" class="recommendation-feedback" role="status" aria-live="polite"></div>


                <!-- ==================================
                     BATAS KONFIRMASI
                =================================== -->

                <div class="confirmation-notice">

                    <i class="bi bi-clock-history"></i>

                    <div>

                        <strong>
                            Batas Konfirmasi: 24 Jam
                        </strong>

                        <p>
                            Pemohon diberikan waktu untuk menerima
                            atau menolak rekomendasi jadwal.
                        </p>

                    </div>

                </div>


                <!-- ==================================
                     FOOTER FORM
                =================================== -->

                <div class="recommendation-footer">

                    <div class="footer-information">

                        <i class="bi bi-info-circle-fill"></i>

                        <div>

                            <strong>
                                Ketentuan Rekomendasi
                            </strong>

                            <p>
                                Rekomendasi akan dikirim kepada
                                pemohon untuk mendapatkan konfirmasi.
                            </p>

                        </div>

                    </div>


                    <div class="footer-actions">

                        <a href="rekomendasi_jadwal.php" class="btn-batal">
                            <i class="bi bi-arrow-left"></i>
                            Kembali
                        </a>

                        <button type="submit" id="btnKirimRekomendasi" class="btn-kirim-rekomendasi">

                            <i class="bi bi-send"></i>

                            <span data-label-submit>
                                Kirim Rekomendasi
                            </span>

                        </button>

                    </div>

                </div>

            </section>

        </form>

    </main>


    <!-- ======================================
         5. NOTIFIKASI
    ======================================= -->

    <div id="toastRekomendasi" class="toast-rekomendasi" role="status" aria-live="polite"></div>


    <!-- ======================================
         6. JAVASCRIPT
    ======================================= -->

    <script src="../../JS/shared/storage.js"></script>

    <script src="../../JS/laboran/utils/waktu.js"></script>

    <script src="../../JS/laboran/layanan.js"></script>

    <script src="../../JS/laboran/rekomendasi'/buat_rekomendasi.js"></script>

</body>

</html>