<?php

declare(strict_types=1);

// =========================================
// SILAB - HALAMAN ANTREAN LABORAN
// =========================================

require_once __DIR__ . "/../auth/sesi.php";

// Halaman antrean hanya dapat diakses oleh Laboran.
wajibRole(
    ["laboran"],
    "../auth/login.php"
);

// Identitas Laboran diambil dari session aktif.
$namaLaboran = htmlspecialchars(
    (string) ($_SESSION["nama"] ?? "Laboran"),
    ENT_QUOTES,
    "UTF-8"
);

$nipLaboran = htmlspecialchars(
    (string) ($_SESSION["nip_npm"] ?? "-"),
    ENT_QUOTES,
    "UTF-8"
);

?>


<!doctype html>
<html lang="id">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>Antrean Pengajuan | SILAB</title>

    <!-- GOOGLE FONT -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        rel="stylesheet">

    <!-- BOOTSTRAP ICONS -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">

    <!-- CSS -->
    <link rel="stylesheet" href="../../CSS/laboran/navbar.css">
    <link rel="stylesheet" href="../../CSS/laboran/antrian.css">

</head>

<body>

    <!-- ======================================
         1. NAVIGASI UTAMA
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

            <a href="antrian.php" class="nav-link active">
                Antrean
            </a>

            <a href="rekomendasi_jadwal.php" class="nav-link">
                Rekomendasi Jadwal
            </a>

        </div>

        <div class="navbar-profile">

            <div class="profile-info">
                <h3><?= $namaLaboran ?></h3>
                <p>Laboran Lab RPL</p>
            </div>

            <details class="profile-dropdown">

                <summary class="profile-trigger">
                    <i class="bi bi-person"></i>
                </summary>

                <div class="profile-menu">

                    <div class="profile-info-dropdown">

                        <p><?= $namaLaboran ?></p>

                        <span>
                            NIP: <?= $nipLaboran ?>
                        </span>

                        <div class="profile-role">
                            <i class="bi bi-check-circle-fill"></i>
                            Laboran Lab
                        </div>

                    </div>

                    <div class="profile-divider"></div>

                    <a href="../auth/logout.php" class="logout-link">
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

    <main class="antrian-container">


        <!-- ==================================
             HEADER HALAMAN
        =================================== -->

        <section class="antrian-header card">

            <div class="header-decoration">
                <span></span>
                <span></span>
                <span></span>
            </div>

            <div class="header-tags">

                <span class="header-tag purple-tag">
                    <i class="bi bi-list-ol"></i>
                    PANEL ANTREAN PENGAJUAN
                </span>

                <span class="header-tag yellow-tag">
                    <i class="bi bi-building"></i>
                    Laboratorium RPL
                </span>

            </div>

            <h2>
                Antrean Pengajuan Peminjaman Lab
            </h2>

            <p>
                Daftar pengajuan yang perlu ditangani Laboran berdasarkan
                hasil klasifikasi prioritas, skor sistem, dan pemeriksaan
                bentrokan jadwal.
            </p>

        </section>


        <!-- ==================================
             3. DAFTAR ANTREAN
        =================================== -->

        <section class="antrian-table-card card">


            <!-- JUDUL DAN FILTER TABEL -->

            <div class="table-heading">

                <div class="table-heading-info">

                    <h3>
                        <i class="bi bi-inboxes"></i>
                        Daftar Antrean Pengajuan
                    </h3>

                    <p>
                        Urutan ditampilkan berdasarkan kelas prioritas,
                        kemudian skor tertinggi. Sistem tidak menggunakan FCFS.
                    </p>

                </div>


                <!-- FILTER ANTREAN -->

                <div class="table-heading-actions">

                    <span class="total-antrian">
                        <i class="bi bi-file-earmark-text"></i>
                        <span id="totalAntrian">
                            Memuat pengajuan...
                        </span>
                    </span>

                    <div class="antrian-filter" role="group" aria-label="Filter status pengajuan">

                        <!-- BELUM DISETUJUI -->

                        <button type="button" class="antrian-filter-btn active" data-filter-antrean="belum-disetujui"
                            aria-pressed="true">

                            <span class="filter-label">
                                <i class="bi bi-hourglass-split"></i>
                                Belum Disetujui
                            </span>

                            <span id="jumlahBelumDisetujui">
                                0
                            </span>

                        </button>


                        <!-- SUDAH DISETUJUI -->

                        <button type="button" class="antrian-filter-btn" data-filter-antrean="sudah-disetujui"
                            aria-pressed="false">

                            <span class="filter-label">
                                <i class="bi bi-check-circle"></i>
                                Sudah Disetujui
                            </span>

                            <span id="jumlahSudahDisetujui">
                                0
                            </span>

                        </button>

                    </div>

                </div>

            </div>


            <!-- ==================================
                 4. TABEL ANTREAN
            =================================== -->

            <div class="table-responsive">

                <table class="antrian-table">

                    <thead>

                        <tr>
                            <th>ID Pengajuan</th>
                            <th>Kegiatan dan Pemohon</th>
                            <th>Waktu dan Kebutuhan</th>
                            <th>Skor dan Prioritas</th>
                            <th>Status</th>
                            <th>Aksi Laboran</th>
                        </tr>

                    </thead>

                    <tbody id="antrianBody" aria-live="polite"></tbody>

                </table>

            </div>


            <!-- ==================================
                 5. PAGINATION
            =================================== -->

            <div class="pagination-container">

                <div class="pagination-info" id="paginationInfo">
                    Memuat antrean...
                </div>

                <div class="pagination-controls">

                    <button type="button" class="pagination-btn" id="prevPage" disabled>
                        Sebelumnya
                    </button>

                    <div class="pagination-numbers" id="paginationNumbers"></div>

                    <button type="button" class="pagination-btn" id="nextPage" disabled>
                        Berikutnya
                    </button>

                </div>

            </div>


            <!-- ==================================
                 6. CATATAN KEWENANGAN LABORAN
            =================================== -->

            <div class="table-note">

                <i class="bi bi-info-circle-fill"></i>

                <p>
                    Skor dan klasifikasi ditampilkan dari hasil
                    pemrosesan sistem. Laboran bertugas melakukan
                    verifikasi pengajuan, memeriksa bentrokan jadwal,
                    serta meneruskan konflik kepada Kepala Lab.

                    Pengaturan bobot dan konfigurasi algoritma
                    hanya dapat dilakukan oleh Kepala Lab.
                </p>

            </div>

        </section>

    </main>


    <!-- ======================================
         7. TEMPLATE BARIS ANTREAN
    ======================================= -->

    <template id="templateBarisAntrian">

        <tr>

            <!-- ID PENGAJUAN -->

            <td>
                <span class="request-id" data-field="id"></span>
            </td>


            <!-- KEGIATAN DAN PEMOHON -->

            <td>

                <strong data-field="nama-kegiatan"></strong>

                <small data-field="pemohon"></small>

            </td>


            <!-- WAKTU DAN KEBUTUHAN -->

            <td>

                <strong data-field="rentang-waktu"></strong>

                <small data-field="kebutuhan"></small>

            </td>


            <!-- SKOR DAN PRIORITAS -->

            <td>

                <span class="priority-badge" data-field="prioritas"></span>

                <small class="score-text" data-field="skor"></small>

            </td>


            <!-- STATUS -->

            <td>

                <span class="status-badge" data-field="status"></span>

            </td>


            <!-- AKSI LABORAN -->

            <td>

                <button type="button" class="btn-process" data-aksi-detail data-id="">

                    <i class="bi bi-search"></i>

                    Periksa &amp; Proses

                </button>

            </td>

        </tr>

    </template>

    <!-- ======================================
     8. MODAL DETAIL PENGAJUAN
======================================= -->

    <div class="review-modal" id="modalReview" hidden aria-hidden="true">

        <!-- BACKDROP -->
        <button type="button" class="modal-backdrop" data-tutup-modal aria-label="Tutup detail pengajuan">
        </button>

        <!-- KONTEN MODAL -->
        <div class="review-modal-content" role="dialog" aria-modal="true" aria-labelledby="judulReview" tabindex="-1">

            <!-- HEADER MODAL -->
            <div class="review-modal-header">

                <span class="review-label" data-field="label-id"></span>

                <h3 id="judulReview" data-field="judul-kegiatan"></h3>

            </div>

            <button type="button" class="modal-close" data-tutup-modal aria-label="Tutup">

                <i class="bi bi-x-lg"></i>

            </button>

            <!-- DETAIL DATA PENGAJUAN -->
            <div class="request-detail-box">

                <div class="detail-item">
                    <small>Nama Pemohon</small>
                    <strong data-field="nama-pemohon"></strong>
                </div>

                <div class="detail-item">
                    <small>NIP/NPM</small>
                    <strong data-field="identifier"></strong>
                </div>

                <div class="detail-item">
                    <small>Waktu Penggunaan</small>
                    <strong data-field="waktu"></strong>
                </div>

                <div class="detail-item">
                    <small>Jumlah Peserta</small>
                    <strong data-field="jumlah-peserta"></strong>
                </div>

                <div class="detail-item">
                    <small>Kategori</small>
                    <strong data-field="kategori"></strong>
                </div>

                <div class="detail-item">
                    <small>Kebutuhan PC</small>
                    <strong data-field="kebutuhan-pc"></strong>
                </div>

                <div class="detail-item">
                    <small>Kebutuhan Kursi</small>
                    <strong data-field="kebutuhan-kursi"></strong>
                </div>

                <div class="detail-item">
                    <small>Skor Sistem</small>
                    <strong data-field="skor-detail"></strong>
                </div>

                <div class="detail-item">
                    <small>Klasifikasi Prioritas</small>
                    <strong>
                        <span class="priority-badge" data-field="prioritas-detail"></span>
                    </strong>
                </div>

                <div class="detail-item">
                    <small>Status Pengajuan</small>
                    <strong>
                        <span class="status-badge" data-field="status-detail"></span>
                    </strong>
                </div>

            </div>

            <!-- PANEL 1: VERIFIKASI -->
            <section class="review-information" data-panel="verifikasi" hidden>

                <i class="bi bi-info-circle-fill"></i>

                <span>
                    Periksa data pemohon, waktu penggunaan,
                    kebutuhan perangkat, kapasitas laboratorium,
                    dan hasil pemeriksaan bentrokan sebelum
                    mengambil keputusan.
                </span>

            </section>

            <div class="verification-actions" data-panel="verifikasi" hidden>

                <button type="button" class="btn-reject" data-keputusan="ditolak">
                    <i class="bi bi-x-circle"></i>
                    Tolak Pengajuan
                </button>

                <button type="button" class="btn-approve" data-keputusan="disetujui">
                    <i class="bi bi-check-circle"></i>
                    Setujui Pengajuan
                </button>

            </div>

            <!-- PANEL 2: SUDAH DISETUJUI -->
            <section class="review-information" data-panel="disetujui" hidden>

                <i class="bi bi-check-circle-fill"></i>

                <span>
                    Pengajuan ini sudah disetujui dan tercatat
                    sebagai booking laboratorium.
                    Booking masih dapat dibatalkan oleh Laboran
                    selama pengguna belum melakukan presensi.
                </span>

            </section>

            <div class="verification-actions" data-panel="disetujui" hidden>

                <button type="button" class="btn-reject" data-aksi-batalkan-persetujuan>
                    <i class="bi bi-x-circle"></i>
                    Batalkan Persetujuan
                </button>

            </div>

            <!-- PANEL 3: BENTROK -->
            <section class="collision-box" data-panel="bentrok" hidden>

                <div class="collision-heading">
                    <i class="bi bi-exclamation-triangle-fill"></i>
                    Pengajuan Mengalami Bentrokan
                </div>

                <p data-field="pesan-bentrok"></p>

                <div class="collision-actions" data-area-aksi-konflik></div>

            </section>

            <!-- PANEL 4: BOOKING DISETUJUI YANG BENTROK -->
            <section class="collision-box" data-panel="bentrok-disetujui" hidden>

                <div class="collision-heading">
                    <i class="bi bi-exclamation-triangle-fill"></i>
                    Booking Disetujui Mengalami Bentrokan
                </div>

                <p data-field="pesan-bentrok-disetujui">
                    Booking ini sebelumnya telah disetujui,
                    tetapi terdapat pengajuan baru yang
                    menggunakan waktu laboratorium yang sama.
                </p>

                <div class="review-information">
                    <i class="bi bi-info-circle-fill"></i>

                    <span>
                        Laboran dapat meneruskan konflik ini
                        kepada Kepala Lab. Booking tidak langsung
                        dibatalkan sebelum keputusan Kepala Lab.
                    </span>
                </div>

                <div class="collision-actions">

                    <button type="button" class="btn-reject" data-aksi-kirim-konflik>
                        <i class="bi bi-send"></i>
                        Kirim Konflik ke Kepala Lab
                    </button>

                </div>

            </section>

            <!-- PANEL 5: PENGAJUAN TERGESER -->
            <section class="collision-box displaced-box" data-panel="tergeser" hidden>

                <div class="collision-heading">
                    <i class="bi bi-calendar-x"></i>
                    Informasi Penggeseran Jadwal
                </div>

                <p data-field="pesan-tergeser"></p>

                <div class="collision-actions">

                    <a href="rekomendasi_jadwal.php" class="btn-recommend" data-tautan-rekomendasi>

                        <i class="bi bi-calendar-plus"></i>
                        Buat Rekomendasi Jadwal

                    </a>

                </div>

            </section>

            <!-- PANEL 6: STATUS LAINNYA -->
            <section class="review-information" data-panel="lainnya" hidden>

                <i class="bi bi-info-circle-fill"></i>

                <span>
                    Status pengajuan ini tidak memiliki
                    tindakan lanjutan pada halaman antrean.
                </span>

            </section>

        </div>
    </div>

    <!-- ======================================
         9. WADAH NOTIFIKASI
    ======================================= -->

    <div id="wadahNotifikasi" class="wadah-notifikasi" aria-live="polite" aria-atomic="true"></div>


    <!-- ======================================
         10. JAVASCRIPT
    ======================================= -->

    <script src="../../JS/laboran/antrean.js"></script>
</body>

</html>