<?php

declare(strict_types=1);

// =========================================
// SILAB - DASHBOARD PENGGUNA
// =========================================

// Memanggil pengelolaan session
require_once __DIR__ . "/../auth/sesi.php";

// Memastikan pengguna sudah login dan memiliki role pengguna
wajibRole(
  ["pengguna"],
  "../auth/login.php"
);

// Mengambil identitas pengguna dari session
$namaPengguna = htmlspecialchars(
  (string) ($_SESSION["nama"] ?? "Pengguna"),
  ENT_QUOTES,
  "UTF-8"
);

?>

<!doctype html>
<html lang="id">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <title>Dashboard Pengguna | SILAB</title>

  <!-- FONT -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />

  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
    rel="stylesheet" />

  <!-- BOOTSTRAP ICON -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" />

   <link rel="stylesheet" href="../../CSS/edit_profile/profile.css">
  <!-- CSS BERSAMA -->
  <link rel="stylesheet" href="../../CSS/pengguna/navbar.css" />

  <!-- CSS DASHBOARD -->
  <link rel="stylesheet" href="../../CSS/pengguna/dashboard.css" />
</head>

<body>
  <!-- ======================================
         NAVBAR PENGGUNA
    ======================================= -->

  <header class="navbar">
    <!-- LOGO DAN IDENTITAS -->

    <div class="navbar-brand">
      <img src="../../Assets/Logo_RPL.svg" alt="Logo SILAB" class="navbar-logo" />

      <div class="brand-info">
        <h1>SILAB</h1>
        <p>Teknik Informatika - Universitas Khairun</p>
      </div>
    </div>

    <!-- MENU -->

    <nav class="navbar-menu">
      <a href="dashboard.php" class="nav-link active">
        Dashboard Pengguna
      </a>

      <a href="riwayat.php" class="nav-link">
    Riwayat
</a>

      <a href="rekomendasi.php" class="nav-link"> Rekomendasi </a>
    </nav>

    <!-- PROFIL -->

    <div class="navbar-profile">
      <span class="user-navbar-name" id="userNavbarName">
        <?= $namaPengguna ?>
      </span>

      <details class="profile-dropdown">
        <summary class="profile-trigger">
          <i class="bi bi-person"></i>
        </summary>

        <div class="profile-menu">
          <div class="profile-info">
            <p id="profileUserName"><?= $namaPengguna ?></p>
            <span>Akun Pengguna SILAB</span>
          </div>

          <div class="profile-divider"></div>

          <a href="../auth/logout.php" class="logout-link">
            <i class="bi bi-box-arrow-right"></i>
            Keluar / Logout
          </a>
        </div>
      </details>
    </div>
  </header>

  <!-- ======================================
         KONTEN DASHBOARD
    ======================================= -->

  <main class="user-dashboard-container">
    <!-- HEADER DASHBOARD -->

    <section class="user-welcome-card">
      <div class="user-welcome-content">
        <div class="user-portal-label">
          <i class="bi bi-circle-fill"></i>
          PORTAL PEMINJAMAN PENGGUNA
        </div>

        <h2>Dashboard Pengguna</h2>

        <p>
          Cek ketersediaan slot waktu lab sebelum mengajukan peminjaman.
          Sistem otomatis mengalokasikan prioritas sesuai regulasi prodi.
        </p>
      </div>

      <a href="pengajuan.php" class="user-apply-button">
        <i class="bi bi-plus-circle"></i>
        Buat Pengajuan Peminjaman
      </a>
    </section>

 
<!-- PANEL JADWAL -->
<section class="user-schedule-panel">

    <div class="user-schedule-header">

        <div>
            <h3>Jadwal Peminjaman Hari Ini</h3>
            <p>Daftar reservasi laboratorium hari ini.</p>
        </div>

        <div class="user-jumlah-badge">
            <i class="bi bi-calendar-check-fill"></i>
            <span id="user-jumlah-jadwal">0 Sesi Terjadwal</span>
        </div>

    </div>

    <div class="user-schedule-table">

<div class="user-jadwal-header">

    <span>JAM / SESI</span>
    <span>PEMOHON</span>
    <span>KEGIATAN / MATA KULIAH</span>

</div>

        <div id="user-slot-list"></div>

    </div>

    <div class="user-pagination-container">

        <p id="user-info-pagination">
            Memuat jadwal...
        </p>

        <div id="user-pagination"></div>

    </div>

</section>

  </main>
  <script src="../../JS/Pengguna/dashboard_pengguna.js"></script>
  <script src="/SILAB/View/JS/auth/session_timeout.js"></script>
  <script src="../../JS/edit_profile/profile.js"></script>
</body>

</html>