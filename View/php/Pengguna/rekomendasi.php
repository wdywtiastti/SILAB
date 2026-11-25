<?php

declare(strict_types=1);

require_once __DIR__ . "/../auth/sesi.php";

wajibRole(
    ["pengguna"],
    "../auth/login.php"
);

$namaPengguna = htmlspecialchars(
    (string) ($_SESSION["nama"] ?? "Pengguna"),
    ENT_QUOTES,
    "UTF-8"
);

$identitasPengguna = htmlspecialchars(
    (string) ($_SESSION["nip_npm"] ?? "-"),
    ENT_QUOTES,
    "UTF-8"
);

?>

<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <title>Rekomendasi Jadwal | SILAB</title>

    <!-- GOOGLE FONT -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
      rel="stylesheet"
    />

    <!-- BOOTSTRAP ICON -->
    <link
      rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css"
    />

    <!-- CSS -->
      <link rel="stylesheet" href="../../CSS/edit_profile/profile.css">
    <link rel="stylesheet" href="../../CSS/pengguna/navbar.css" />
    <link rel="stylesheet" href="../../CSS/pengguna/rekomendasi.css" />
  </head>

  <body>
    <!-- NAVBAR -->
    <header class="navbar">
      <div class="navbar-brand">
        <img
          src="../../Assets/Logo_RPL.svg"
          alt="Logo SILAB"
          class="navbar-logo"
        />

        <div class="brand-info">
          <h1>SILAB</h1>
          <p>Teknik Informatika - Universitas Khairun</p>
        </div>
      </div>

      <nav class="navbar-menu">
        <a href="dashboard.php" class="nav-link">Dashboard Pengguna</a>
        <a href="riwayat.php" class="nav-link">Riwayat</a>
        <a href="rekomendasi.php" class="nav-link active">Rekomendasi</a>
      </nav>


<div class="navbar-profile">

    <div class="profile-info">
        <h3><?= $namaPengguna ?></h3>
        <p>Pengguna SILAB</p>
    </div>

    <details class="profile-dropdown">

        <summary class="profile-trigger">
            <i class="bi bi-person"></i>
        </summary>

        <div class="profile-menu">

            <div class="profile-info-dropdown">

                <p><?= $namaPengguna ?></p>

                <span>NPM/NIP : <?= $identitasPengguna ?></span>

                <div class="profile-role">
                    <i class="bi bi-check-circle-fill"></i>
                    Pengguna
                </div>

            </div>

            <div class="profile-divider"></div>

            <button type="button"
                    class="logout-link profile-link"
                    data-open-profile>
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
    <main class="recommendation-container">
      <!-- HEADER HALAMAN -->
      <section class="recommendation-welcome">
        <div class="recommendation-welcome-content">
          <h2>Rekomendasi Jadwal</h2>

          <p>
            Pantau ketersediaan laboratorium dan tanggapi penawaran slot
            pengganti dari Laboran secara terpusat.
          </p>
        </div>
      </section>

      <!-- PANEL REKOMENDASI -->
      <section class="recommendation-panel">
        <!-- HEADER TAWARAN -->
        <div class="recommendation-header">
          <div class="recommendation-heading-left">
            <div class="recommendation-main-icon">
              <i class="bi bi-arrow-left-right"></i>
            </div>

            <div class="recommendation-heading-info">
              <span class="offer-badge">
                <i class="bi bi-shield-lock"></i>
                Tawaran Pengganti dari Laboran
              </span>

              <h3>Penyesuaian Jadwal: Prioritas Ruang Kuliah Pengganti</h3>
            </div>
          </div>

          <div class="response-deadline">
            <i class="bi bi-clock"></i>
            <span>Batas Respon: 24 Jam ke Depan</span>
          </div>
        </div>

        <!-- KONTEKS PERMOHONAN -->
        <div class="recommendation-context">
          <div class="context-icon">
            <span>i</span>
          </div>

          <div class="context-content">
            <div class="context-heading">
              <strong>Konteks Permohonan Terdahulu:</strong>

              <span> Belajar Mandiri & Skripsi (K5 Mandiri) </span>
            </div>

            <p>
              Jadwal Anda pada 4 hari lalu dibatalkan karena pengalihan
              prioritas untuk
              <strong> Kelas Pengganti Dosen (Dr. Ridwan, M.Kom). </strong>
              Laboran telah menyiapkan 2 rekomendasi slot pengganti bebas
              bentrokan untuk Anda.
            </p>
          </div>
        </div>

        <!-- PILIHAN JADWAL -->
        <!-- PILIHAN JADWAL -->
        <div class="recommendation-options" id="recommendation-options">
          <!-- Kartu rekomendasi dibuat otomatis oleh JavaScript -->
        </div>

        <!-- TOLAK REKOMENDASI -->
        <a href="#reject-modal" class="recommendation-reject">
          <i class="bi bi-x"></i>
          <span>Tolak & Ajukan Waktu Lain Secara Manual</span>
        </a>

        <!-- AKSI PILIHAN REKOMENDASI -->

        <div class="recommendation-action" id="recommendation-action">
          <div class="selected-recommendation-info">
            <span class="selected-label">Pilihan Anda</span>
            <strong id="selected-schedule-name">
              Belum ada jadwal dipilih
            </strong>
            <small id="selected-schedule-time">
              Silakan pilih salah satu rekomendasi.
            </small>
          </div>

          <button
            type="button"
            class="btn-accept-recommendation"
            id="btn-accept-recommendation"
            disabled
          >
            <i class="bi bi-check-circle"></i>
            Terima & Jadwalkan
          </button>
        </div>
      </section>
    </main>

    <!-- =========================================
         POP UP KONFIRMASI PENOLAKAN
    ========================================== -->

    <div class="reject-modal" id="reject-modal">
      <!-- BACKDROP -->
      <a href="#" class="reject-modal-backdrop" aria-label="Tutup pop up"></a>

      <!-- KONTEN POP UP -->
      <div class="reject-modal-content">
        <!-- LABEL -->
        <div class="reject-modal-label">
          <i class="bi bi-circle-fill"></i>
          KONFIRMASI PENOLAKAN
        </div>

        <!-- IKON -->
        <div class="reject-modal-icon">
          <i class="bi bi-calendar-x"></i>
        </div>

        <!-- DESKRIPSI -->
        <p>
          Apakah kamu yakin ingin menolak rekomendasi jadwal yang diberikan oleh
          Laboran?
        </p>

        <p class="reject-modal-description">
          Setelah menolak rekomendasi, kamu dapat mengajukan waktu penggunaan
          laboratorium secara manual.
        </p>

        <!-- FOOTER TOMBOL -->
        <div class="reject-modal-footer">
          <a href="#" class="btn-reject-cancel"> Batal </a>

          <a href="#" class="btn-reject-confirm">
            <i class="bi bi-x-circle"></i>
            Ya, Tolak Rekomendasi
          </a>
        </div>
      </div>
    </div>

    <!-- POP UP KONFIRMASI PENERIMAAN -->
    <div class="recommendation-confirm-modal" id="accept-modal">
      <div class="recommendation-modal-backdrop"></div>

      <div class="recommendation-modal-content">
        <div class="recommendation-modal-icon">
          <i class="bi bi-calendar-check"></i>
        </div>

        <h3>Konfirmasi Pilihan Jadwal</h3>

        <p>Apakah Anda yakin ingin menerima rekomendasi jadwal ini?</p>

        <div class="confirmation-detail">
          <strong id="confirmation-name"></strong>
          <span id="confirmation-time"></span>
        </div>

        <div class="recommendation-modal-actions">
          <button type="button" class="btn-modal-cancel" id="btn-cancel-accept">
            Periksa Kembali
          </button>

          <button
            type="button"
            class="btn-modal-confirm"
            id="btn-confirm-accept"
          >
            Ya, Terima Jadwal
          </button>
        </div>
      </div>
    </div>

    <!-- NOTIFIKASI -->
    <div
      class="recommendation-feedback"
      id="recommendation-feedback"
      role="status"
      aria-live="polite"
    ></div>

    <!-- JAVASCRIPT -->
       <?php
        require_once __DIR__ . "/../edit_profile/modal.php";
        ?>

<script src="../../JS/edit_profile/profile.js"></script>
    <script src="../../JS/Pengguna/rekomendasi.js" defer></script>
    <script src="/SILAB/View/JS/auth/session_timeout.js"></script>
  </body>
</html>
  