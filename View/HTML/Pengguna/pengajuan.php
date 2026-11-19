<?php

declare(strict_types=1);

// =========================================
// SILAB - HALAMAN PENGAJUAN PENGGUNA
// =========================================

require_once __DIR__ . "/../auth/sesi.php";

wajibRole(
    ["pengguna"],
    "../auth/login.php"
);

// Identitas pengguna dari PHP Session
$namaPengguna = htmlspecialchars(
    $_SESSION["nama"] ?? "Pengguna",
    ENT_QUOTES,
    "UTF-8"
);

?>

<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <title>Pengajuan Peminjaman | SILAB</title>

    <!-- FONT -->
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

    <!-- CSS BERSAMA -->
    <link rel="stylesheet" href="../../CSS/pengguna/navbar.css" />

    <!-- CSS PENGAJUAN -->
    <link rel="stylesheet" href="../../CSS/pengguna/pengajuan.css" />
  </head>

  <body>
    <!-- ======================================
         NAVBAR PENGGUNA
    ======================================= -->

    <header class="navbar">
      <!-- LOGO DAN IDENTITAS -->

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

      <!-- MENU -->

      <nav class="navbar-menu">
        <a href="dashboard.html" class="nav-link active">
          Dashboard Pengguna
        </a>

        <a href="riwayat.html" class="nav-link"> Riwayat </a>

        <a href="rekomendasi.html" class="nav-link"> Rekomendasi </a>
      </nav>

      <!-- PROFIL -->

      <div class="navbar-profile">
        <span class="user-navbar-name" id="userNavbarName">
          Memuat akun...
        </span>
        <details class="profile-dropdown">
          <summary class="profile-trigger">
            <i class="bi bi-person"></i>
          </summary>

          <div class="profile-menu">
            <div class="profile-info">
              <p id="profileUserName">Memuat akun...</p>
              <span>Akun Pengguna SILAB</span>
            </div>

            <div class="profile-divider"></div>

            <a href="../auth/login.html" class="logout-link">
              <i class="bi bi-box-arrow-right"></i>
              Keluar / Logout
            </a>
          </div>
        </details>
      </div>
    </header>

    <!-- ======================================
         KONTEN PENGAJUAN
    ======================================= -->

    <main class="user-application-container">
      <!-- JUDUL HALAMAN -->

      <section class="application-heading">
        <div class="application-label">
          <i class="bi bi-circle-fill"></i>
          FORMULIR PEMINJAMAN
        </div>

        <h2>Ajukan Peminjaman Laboratorium RPL</h2>

        <p>
          Isi data formulir di bawah ini untuk mengajukan permohonan penggunaan
          Lab RPL dengan proses verifikasi terpadu.
        </p>
      </section>

      <!-- LAYOUT FORM DAN KATEGORI -->

      <section class="application-layout">
        <!-- FORMULIR PEMINJAMAN -->

        <form class="application-form" id="peminjamanForm" novalidate>
          <!-- WAKTU PEMINJAMAN -->

          <div class="application-time-row">
            <div class="application-group">
              <label for="waktuMulai"> Waktu Mulai <span>*</span> </label>

              <input
                type="datetime-local"
                id="waktuMulai"
                name="waktuMulai"
                required
              />
              <small class="field-error" id="waktuMulaiError"></small>
            </div>

            <div class="application-group">
              <label for="waktuSelesai"> Waktu Selesai <span>*</span> </label>

              <input
                type="datetime-local"
                id="waktuSelesai"
                name="waktuSelesai"
                required
              />
              <small class="field-error" id="waktuSelesaiError"></small>
            </div>
          </div>

          <!-- ATURAN DINAMIS DARI KEPALA LAB -->

          <div id="dynamicRuleFields"></div>
          <!-- FASILITAS DINAMIS DARI KEPALA LAB -->

          <div class="application-group">
            <label> Fasilitas Laboratorium <span>*</span> </label>

            <div id="facilityFields"></div>

            <small id="facilityFieldsError" class="field-error"> </small>
          </div>

          <!-- NAMA KEGIATAN -->

          <div class="application-group">
            <label for="namaKegiatan">
              Nama Kegiatan / Mata Kuliah <span>*</span>
            </label>

            <div class="application-input-icon">
              <i class="bi bi-book"></i>

              <input
                type="text"
                id="namaKegiatan"
                name="namaKegiatan"
                placeholder="Nama kegiatan atau mata kuliah"
                required
              />
            </div>
            <small class="field-error" id="namaKegiatanError"></small>
          </div>

          <!-- TOMBOL FORM -->
          <div class="application-actions">
            <a href="dashboard.html" class="application-cancel"> Batal </a>

            <button type="submit" class="application-submit">
              Kirim Pengajuan Peminjaman
              <i class="bi bi-send"></i>
            </button>
          </div>

          <!-- PESAN VALIDASI -->

          <p
            id="applicationFeedback"
            class="application-feedback"
            role="status"
            aria-live="polite"
          ></p>
        </form>

        <!-- PANEL KATEGORI -->

        <aside class="application-category">
          <div class="application-category-heading">
            <i class="bi bi-sliders"></i>

            <h3>Kategori</h3>
          </div>

          <div class="application-category-list" id="dynamicRuleSummary"></div>
        </aside>
      </section>
    </main>

    <!-- JAVASCRIPT -->
    <script src="../../JS/Pengguna/pengajuan.js" defer></script>
  </body>
</html>
