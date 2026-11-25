<?php
declare(strict_types=1);

// =========================================
// SILAB - PENYELESAIAN KONFLIK
// KEPALA LABORATORIUM
// =========================================

require_once __DIR__ . "/../auth/sesi.php";

// Proteksi khusus Kepala Lab
wajibRole(["kepala_lab"], "../auth/login.php");

// Mengambil identitas Kepala Lab
$user = penggunaLogin();

$namaKepalaLab = $user["nama"] ?? "Kepala Laboratorium";
$nipKepalaLab = $user["nip_npm"] ?? "-";
?>

<!doctype html>
<html lang="id">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <title>Penyelesaian Konflik | SILAB</title>

  <!-- GOOGLE FONT -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
    rel="stylesheet" />

  <!-- BOOTSTRAP ICONS -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" />

  <!-- CSS -->
  <link rel="stylesheet" href="../../CSS/edit_profile/profile.css">
  <link rel="stylesheet" href="../../CSS/kepalaLab/navbar.css" />
  <link rel="stylesheet" href="../../CSS/kepalaLab/konflik.css" />
</head>

<body>
  <!-- NAVBAR -->

  <header class="navbar">
    <!-- IDENTITAS SILAB -->
    <div class="navbar-brand">
      <img src="../../Assets/Logo_RPL.svg" alt="Logo SILAB" class="navbar-logo" />

      <div class="brand-info">
        <h1>SILAB</h1>
        <p>Teknik Informatika - Universitas Khairun</p>
      </div>
    </div>

    <!-- MENU NAVIGASI -->

    <nav class="navbar-menu">
      <a href="Dashboard.php" class="nav-link">
        Dashboard Kepala Lab
      </a>

      <a href="penyelesaian_konflik.php" class="nav-link active">
        Penyelesaian Konflik
      </a>

      <a href="manajemen_algoritma.php" class="nav-link">
        Manajemen Algoritma
      </a>

      <a href="manajemen_user.php" class="nav-link">
        Manajemen User
      </a>
    </nav>


    <!-- PROFIL KEPALA LAB -->

<!-- PROFIL KEPALA LAB -->
<div class="navbar-profile">

    <div class="profile-info">
        <h3><?= htmlspecialchars($namaKepalaLab, ENT_QUOTES, 'UTF-8') ?></h3>
        <p>Kepala Laboratorium</p>
    </div>

    <details class="profile-dropdown">

        <summary class="profile-trigger">
            <i class="bi bi-person"></i>
        </summary>

        <div class="profile-menu">

            <div class="profile-info-dropdown">

                <p><?= htmlspecialchars($namaKepalaLab, ENT_QUOTES, 'UTF-8') ?></p>

                <span>
                    NIP : <?= htmlspecialchars((string)$nipKepalaLab, ENT_QUOTES, 'UTF-8') ?>
                </span>

                <div class="profile-role">
                    <i class="bi bi-check-circle-fill"></i>
                    Kepala Lab
                </div>

            </div>

            <div class="profile-divider"></div>

            <button
                type="button"
                class="logout-link profile-link"
                data-open-profile
            >
                <i class="bi bi-person-gear"></i>
                Edit Profile
            </button>

            <div class="profile-divider"></div>

            <a href="../auth/logout.php" class="logout-link">
                <i class="bi bi-box-arrow-right"></i>
                Keluar/Logout
            </a>

        </div>

    </details>

</div>


  </header>

  <!-- KONTEN UTAMA -->
  <main class="conflict-container">
    <!-- HEADER PENYELESAIAN KONFLIK -->
    <section class="conflict-hero">
      <div class="hero-decoration">
        <span></span>
        <span></span>
        <span></span>
      </div>

      <div class="hero-content">
        <div class="hero-left">
          <div class="hero-badges">
            <span class="badge-conflict">
              <i class="bi bi-circle-fill"></i>
              <span id="pending-conflict-count">0</span>
              KASUS BUTUH OTORITAS KEPALA LAB
            </span>

            <span class="badge-info">
              <i class="bi bi-building"></i>
              Fasilitas: 1 Ruangan Laboratorium Terpadu RPL
            </span>
          </div>

          <h2>Penyelesaian Konflik Jadwal Lab RPL</h2>

          <p>
            Pilih keputusan otoritas untuk jadwal bentrok hari ini berdasarkan
            Standar Operasional Prosedur (SOP) dan regulasi prioritas
            pemakaian laboratorium.
          </p>
        </div>

        <div class="operational-info">
          <div class="operational-icon">
            <i class="bi bi-clock"></i>
          </div>

          <div>
            <span>JADWAL OPERASIONAL</span>
            <strong>Hari Ini, WIT (Zona Maluku Utara)</strong>
          </div>
        </div>
      </div>
    </section>

    <!-- RINGKASAN KONFLIK -->
    <section class="conflict-stats">
      <!-- TOTAL PENGAJUAN BENTROK -->
      <article class="stat-card stat-total">
        <div class="stat-content">
          <span class="stat-label"> TOTAL PENGAJUAN BENTROK </span>

          <h3 id="total-conflict-submissions">0</h3>

          <p>Pengajuan yang terlibat konflik</p>
        </div>

        <div class="stat-icon">
          <i class="bi bi-exclamation-triangle"></i>
        </div>
      </article>

      <!-- KONFLIK SELESAI -->
      <article class="stat-card stat-sop">
        <div class="stat-content">
          <span class="stat-label"> KONFLIK SELESAI </span>

          <h3 id="resolved-conflict-count">0</h3>

          <p>Kelompok yang sudah diputuskan</p>
        </div>

        <div class="stat-icon">
          <i class="bi bi-check-circle"></i>
        </div>
      </article>

      <!-- MENUNGGU KEPUTUSAN -->
      <article class="stat-card stat-collision">
        <div class="stat-content">
          <span class="stat-label"> MENUNGGU KEPUTUSAN </span>

          <h3 id="waiting-conflict-count">0</h3>

          <p>Kelompok konflik belum diputuskan</p>
        </div>

        <div class="stat-icon">
          <i class="bi bi-shuffle"></i>
        </div>
      </article>
    </section>

    <!-- DAFTAR BENTROKAN -->
    <section class="conflict-section">
      <div class="conflict-section-header">
        <h3>
          <span></span>
          Daftar Bentrokan Jadwal yang Memerlukan Otorisasi
        </h3>

        <span class="sop-label"> Simulasi Penyelesaian Konflik SILAB </span>
      </div>

      <!-- INFORMASI JUMLAH KELOMPOK -->
      <div class="conflict-summary-line">
        <span>
          Total Kelompok Konflik:
          <strong id="total-conflict-groups">0</strong>
        </span>
      </div>

      <!-- TEMPAT MENAMPILKAN SESI KONFLIK -->
      <div id="conflict-list" class="conflict-list">
        <div class="dynamic-conflict-empty">
          <h3>Memuat Data Konflik...</h3>

          <p>
            Data kelompok konflik sedang diambil dari database.
          </p>
        </div>
      </div>

      <div class="conflict-accordion-toolbar">
        <button type="button" id="toggle-all-conflicts" class="toggle-all-conflicts">
          <i class="bi bi-arrows-collapse"></i>
          <span>Tutup Semua</span>
        </button>
      </div>
    </section>
  </main>

  <!-- =========================================
        POP UP KONFIRMASI KIRIM REKOMENDASI
    ========================================= -->

  <div class="recommendation-modal" id="modal-kirim-rekomendasi">
    <!-- BACKGROUND BLUR -->
    <a href="#" class="recommendation-backdrop" aria-label="Tutup pop up"></a>

    <!-- KONTEN POP UP -->
    <div class="recommendation-modal-content">
      <!-- LABEL -->
      <div class="recommendation-label">
        <i class="bi bi-circle-fill"></i>
        KONFIRMASI PENGIRIMAN
      </div>

      <!-- IKON -->
      <div class="recommendation-icon">
        <i class="bi bi-envelope-paper"></i>
      </div>

      <p>
        Apakah kamu yakin ingin menetapkan keputusan penyelesaian konflik ini?
      </p>

      <p class="recommendation-description">
        Pengajuan yang tidak terpilih dan mengalami bentrokan
        akan diteruskan ke Laboran untuk mendapatkan
        alternatif jadwal pengganti.
      </p>

      <!-- TOMBOL AKSI -->
      <div class="recommendation-modal-footer">
        <a href="#" class="btn-recommendation-cancel"> Batal </a>

        <a href="#" class="btn-recommendation-confirm">
          <i class="bi bi-send"></i>
          Ya, Kirim Rekomendasi
        </a>
      </div>
    </div>
  </div>

  <!-- =========================================
        POP UP KONFIRMASI KEPUTUSAN
    ========================================= -->

  <div class="recommendation-modal" id="modal-konfirmasi">
    <a href="#" class="recommendation-backdrop" aria-label="Tutup pop up"></a>

    <div class="recommendation-modal-content">
      <!-- LABEL -->
      <div class="recommendation-label">
        <i class="bi bi-circle-fill"></i>
        KONFIRMASI KEPUTUSAN
      </div>

      <!-- IKON -->
      <div class="recommendation-icon">
        <i class="bi bi-check2-circle"></i>
      </div>

      <!-- DESKRIPSI -->
      <p>
        Apakah kamu yakin ingin mengonfirmasi keputusan terhadap pengajuan
        jadwal yang telah dipilih?
      </p>

      <p class="recommendation-description">
        Keputusan ini akan menjadi hasil akhir penyelesaian konflik jadwal
        laboratorium.
      </p>

      <!-- TOMBOL -->
      <div class="recommendation-modal-footer">
        <a href="#" class="btn-recommendation-cancel"> Batal </a>

        <a href="#" class="btn-recommendation-confirm">
          <i class="bi bi-check2-circle"></i>
          Ya, Konfirmasi
        </a>
      </div>
    </div>
  </div>

  <!-- =====================================
     POPUP DETAIL PEMINJAMAN
===================================== -->


<div id="submission-detail-modal"
     class="submission-detail-modal"
     hidden>
  <div class="submission-detail-dialog"
       role="dialog"
       aria-modal="true"
       aria-labelledby="detail-modal-title">

    <div class="submission-detail-header">
      <div>
        <span id="detail-id-pengajuan"
              class="detail-id-label">
          ID PENGAJUAN
        </span>

        <h3 id="detail-modal-title">
          Detail Peminjaman
        </h3>

        <p>Informasi lengkap pengajuan penggunaan laboratorium.</p>
      </div>

      <button type="button"
              id="close-submission-detail"
              class="close-detail-modal">
        &times;
      </button>
    </div>

    <div class="submission-detail-body">

      <div class="detail-borrower">
        <span>PEMINJAM</span>
        <h4 id="detail-peminjam">-</h4>
        <p id="detail-kegiatan">-</p>
      </div>

      <div class="detail-section">
        <h4>Informasi Penggunaan</h4>

        <div class="detail-grid">

          <div class="detail-item">
            <span>NIP/NPM</span>
            <strong id="detail-nip-npm">-</strong>
          </div>

          <div class="detail-item">
            <span>Waktu Penggunaan</span>
            <strong id="detail-waktu">-</strong>
          </div>

          <div class="detail-item">
            <span>Status Pengajuan</span>
            <strong id="detail-status">-</strong>
          </div>

          <div class="detail-item">
            <span>Klasifikasi Prioritas</span>
            <strong id="detail-prioritas">-</strong>
          </div>

        </div>
      </div>

      <div class="detail-section">
        <h4>Rincian Jenis Kegiatan dan Fasilitas</h4>

        <div class="detail-grid" id="detail-dinamis">
          <div class="detail-item">
            <span>Detail Pengajuan</span>
            <strong>Memuat detail...</strong>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <h4>Hasil Penilaian Sistem</h4>

        <div class="detail-grid detail-score-grid">

          <div class="detail-item">
            <span>Skor Jenis Kegiatan</span>
            <strong id="detail-skor-jenis">-</strong>
          </div>

          <div class="detail-item">
            <span>Skor Fasilitas</span>
            <strong id="detail-skor-fasilitas">-</strong>
          </div>

        </div>
      </div>

      <div class="detail-score">
        <span>TOTAL SKOR PRIORITAS</span>
        <strong id="detail-skor">Belum dihitung</strong>
        <p>Nilai berdasarkan hasil perhitungan Rule Base SILAB.</p>
      </div>

    </div>
  </div>
</div>


  <!-- =====================================
     MODAL KONFIRMASI KEPUTUSAN
===================================== -->

  <div id="decision-confirm-modal" class="decision-confirm-modal" hidden>
    <div class="decision-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="decision-modal-title">
      <!-- HEADER -->
      <div class="decision-modal-header">
        <div class="decision-modal-icon">
          <i class="bi bi-check2-circle"></i>
        </div>

        <div class="decision-modal-heading">
          <h3 id="decision-modal-title">Konfirmasi Keputusan</h3>

          <p>Periksa kembali keputusan sebelum ditetapkan.</p>
        </div>

        <button type="button" id="close-decision-modal" class="decision-modal-close" aria-label="Tutup modal">
          &times;
        </button>
      </div>

      <!-- BODY -->
      <div class="decision-modal-body">
        <div class="decision-selected-info">
          <span>PENGAJUAN YANG DIPERTAHANKAN</span>

          <h4 id="decision-selected-name">-</h4>

          <p id="decision-selected-activity">-</p>

          <p id="decision-selected-time">-</p>
        </div>

        <div class="decision-impact">
          <h4>Dampak Keputusan</h4>

          <div class="decision-impact-row">
            <span>Pengajuan disetujui</span>
            <strong id="decision-approved-count">1</strong>
          </div>

          <div class="decision-impact-row">
            <span>Pengajuan lain yang diperiksa</span>
            <strong id="decision-shifted-count">0</strong>
          </div>
        </div>

        <div class="decision-warning">
          <i class="bi bi-info-circle"></i>

          <p>
            Setelah keputusan ditetapkan, sesi konflik ini akan ditandai
            selesai. Hasil keputusan akan tersimpan dalam database dan
            tetap dapat dilihat pada daftar riwayat konflik.
          </p>
        </div>
      </div>

      <!-- FOOTER -->
      <div class="decision-modal-footer">
        <button type="button" id="cancel-decision" class="btn-cancel-decision">
          Batalkan
        </button>

        <button type="button" id="confirm-decision" class="btn-confirm-decision">
          <i class="bi bi-check2"></i>
          Tetapkan Keputusan
        </button>
      </div>
    </div>
  </div>

  <!-- MODUL PENYELESAIAN KONFLIK -->
     <?php
require_once __DIR__ . "/../edit_profile/modal.php";
?>
<script src="../../JS/edit_profile/profile.js"></script>
  <script src="../../JS/kepalaLab/penyelesaian_konflik.js"></script>
  <script src="/SILAB/View/JS/auth/session_timeout.js"></script>
</body>

</html>