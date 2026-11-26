<?php
declare(strict_types=1);

// =========================================
// SILAB - DASHBOARD KEPALA LAB
// =========================================

require_once __DIR__ . "/../auth/sesi.php";

// Hanya Kepala Lab yang boleh membuka halaman ini
wajibRole(["kepala_lab"], "../auth/login.php");

// Mengambil identitas dari session
$user = penggunaLogin();

$namaKepalaLab = $user["nama"] ?? "Kepala Laboratorium";
$nipKepalaLab = $user["nip_npm"] ?? "-";
?>


<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <title>Dashboard Kepala Lab | SILAB</title>

    <!-- GOOGLE FONT -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />

    <link
      href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
      rel="stylesheet"
    />

    <!-- BOOTSTRAP ICONS -->
    <link
      rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css"
    />

    <!-- CSS UTAMA KEPALA LAB -->
    <link rel="stylesheet" href="../../CSS/KepalaLab/navbar.css" />

    <!-- CSS KHUSUS DASHBOARD -->
    <link rel="stylesheet" href="../../CSS/KepalaLab/dashboard.css" />
    <link rel="stylesheet" href="../../CSS/edit_profile/profile.css">
  </head>

  <body>

    <!-- =====================================
        1. NAVBAR
    ====================================== -->

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

      <!-- MENU NAVIGASI -->
      <nav class="navbar-menu">

        <a href="Dashboard.php" class="nav-link active">
          Dashboard Kepala Lab
        </a>

        <a href="penyelesaian_konflik.php" class="nav-link">
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

    <!-- =====================================
        2. KONTEN UTAMA
    ====================================== -->

    <main class="dashboard-container">

      <section class="dashboard-header">

        <div class="header-decoration">
          <span></span>
          <span></span>
          <span></span>
        </div>

        <!-- INFORMASI FASILITAS -->
        <div class="facility-info">

          <span class="info-tag">
            <i class="bi bi-circle-fill"></i>
            MONITORING TERPUSAT
          </span>

          <span class="info-tag">
            <i class="bi bi-building"></i>
            Fasilitas: 1 Ruangan Laboratorium Terpadu RPL
          </span>

        </div>

        <!-- JUDUL DASHBOARD -->
        <div class="header-content">

          <h2>Dashboard Kepala Lab</h2>

          <p>
            Ringkasan operasional harian, verifikasi izin peminjaman, dan
            penanganan bentrokan jadwal satu pintu.
          </p>

        </div>

        <!-- OTORITAS KEPALA LAB -->
        <div class="authority-button">
          <i class="bi bi-shield-check"></i>
          Otoritas Kepala Lab
        </div>

      </section>

      <!-- =====================================
             3. KARTU RINGKASAN
      ====================================== -->
  <section class="dashboard-content">

    <div class="dashboard-left">

      <section class="summary-cards">

        <!-- JADWAL -->
        <article class="summary-card schedule-card">

          <div class="card-top">
            <div>
              <h3>RINGKASAN JADWAL</h3>
              <p>Jadwal Aktif Hari Ini</p>
            </div>

            <div class="card-icon purple-icon">
              <i class="bi bi-clock-history"></i>
            </div>
          </div>

          <div class="card-value">
            <strong>5 Sesi</strong>
            <span>08.00 – 18.00 WIT</span>
          </div>

          <p class="card-description">
            <i class="bi bi-circle-fill"></i>
            1 Sesi sedang berlangsung di Lab RPL
          </p>

        </article>

        <!-- KONFLIK -->
        <article class="summary-card conflict-card">

          <div class="card-top">
            <div>
              <h3>EVALUASI BENTROKAN</h3>
              <p>Konflik Penggunaan</p>
            </div>

            <div class="card-icon red-icon">
              <i class="bi bi-exclamation-triangle"></i>
            </div>
          </div>

          <div class="card-value conflict-value">
            <strong>3 Kasus</strong>
            <span>Perlu Otorisasi</span>
          </div>

          <p class="card-description">
            3 Kasus butuh persetujuan
          </p>

        </article>

      </section>

      <!-- =====================================
          4. AREA JADWAL DAN PANEL KANAN
      ====================================== -->

        <!-- PANEL JADWAL -->
        <article class="schedule-panel">

          <div class="panel-header">

            <div class="panel-title">

              <div class="panel-icon">
                <i class="bi bi-calendar-event"></i>
              </div>

              <div>
                <h3>Jadwal & Penggunaan Hari Ini</h3>
                <p>Ruang Laboratorium Rekayasa Perangkat Lunak (36 PC)</p>
              </div>

            </div>

            <div class="live-status">
              <span class="live-dot"></span>
              <span>Live Hari Ini</span>
            </div>

          </div>

          <!-- TABEL JADWAL -->
          <div class="table-wrapper">

            <table class="schedule-table">

            <thead>
                <tr>
                    <th>JAM / SESI</th>
                    <th>KEGIATAN & PEMOHON</th>
                    <th>PRIORITAS</th>
                    <th>STATUS</th>
                </tr>
            </thead>

              <tbody id="jadwalKepalaLab">
                <tr>
                  <td colspan="4">Memuat jadwal hari ini...</td>
                </tr>
              </tbody>

            </table>

          </div>

          <div class="schedule-pagination"></div>

    </article>

    </div>
    <!-- AKHIR KOLOM KIRI -->

    <!-- PANEL KANAN -->
    <aside class="right-panel">

          <!-- ATURAN PRIORITAS -->
          <article class="priority-panel">

            <div class="right-panel-header">

              <h3>
                <i class="bi bi-list"></i>
                Aturan Prioritas (P1 – P4)
              </h3>

              <span class="automatic-label">Otomatis</span>

            </div>

            <div class="priority-list">

              <div class="priority-item">
                <span class="priority-badge p2">P1</span>
                <strong>Kelas Pengganti</strong>
                <small>Tingkat 1</small>
              </div>

              <div class="priority-item">
                <span class="priority-badge p3">P2</span>
                <strong>Asistensi & Responsi</strong>
                <small>Tingkat 2</small>
              </div>

              <div class="priority-item">
                <span class="priority-badge p4">P3</span>
                <strong>Kegiatan Asistensi & HMTI</strong>
                <small>Tingkat 3</small>
              </div>

              <div class="priority-item">
                <span class="priority-badge p5">P4</span>
                <strong>Belajar Mandiri</strong>
                <small>Tingkat 4</small>
              </div>

            </div>

          </article>

          <!-- UNDUH LAPORAN -->
          <article class="report-panel">

            <div class="report-header">
              <h3>Unduh Laporan Lab RPL</h3>
              <i class="bi bi-download"></i>
            </div>

            <p>Rekap kehadiran & penggunaan 36 PC/Kursi.</p>

            <div class="report-buttons">

              <a href="#modal-pdf" class="report-btn">
                <i class="bi bi-file-earmark-pdf"></i>
                PDF
              </a>

              <a href="#modal-excel" class="report-btn">
                <i class="bi bi-file-earmark-excel"></i>
                Excel
              </a>

            </div>

          </article>

        </aside>

      </section>

    </main>

    <!-- =====================================
        MODAL UNDUH PDF
    ====================================== -->

    <div id="modal-pdf" class="report-modal">

      <a href="#" class="modal-backdrop" aria-label="Tutup modal"></a>

      <div class="modal-content">

        <div class="modal-color-line">
          <span></span>
          <span></span>
          <span></span>
        </div>

        <div class="modal-body">

          <div class="modal-label">
            <i class="bi bi-file-earmark-text"></i>
            Modul Rekapitulasi Data Aktivitas
          </div>

          <h2>Unduh Rekapan Laporan Laboratorium PDF</h2>

          <form class="report-form">

            <div class="date-group">

              <label for="tanggal-pdf">
                <i class="bi bi-calendar"></i>
                Tanggal
              </label>

              <input
                type="date"
                id="tanggalPdf"
                name="tanggal"
                required
              />

            </div>

            <div class="modal-divider"></div>

            <div class="modal-actions">

              <a href="#" class="btn-cancel">Batal</a>

              <button
                    type="button"
                    class="btn-download pdf-button"
                    data-unduh-laporan="pdf"
                >
                <i class="bi bi-download"></i>
                Unduh Berkas Rekapan (PDF)
              </button>

            </div>

          </form>

        </div>
      </div>
    </div>

    <!-- =====================================
        MODAL UNDUH EXCEL
    ====================================== -->

    <div id="modal-excel" class="report-modal">

      <a href="#" class="modal-backdrop" aria-label="Tutup modal"></a>

      <div class="modal-content">

        <div class="modal-color-line">
          <span></span>
          <span></span>
          <span></span>
        </div>

        <div class="modal-body">

          <div class="modal-label">
            <i class="bi bi-file-earmark-text"></i>
            Modul Rekapitulasi Data Aktivitas
          </div>

          <h2>Unduh Rekapan Laporan Laboratorium Excel</h2>

          <form class="report-form">

            <div class="date-group">

              <label for="tanggal-excel">
                <i class="bi bi-calendar"></i>
                Tanggal
              </label>

              <input
                type="date"
                id="tanggalExcel"
                name="tanggal"
                required
              />

            </div>

            <div class="modal-divider"></div>

            <div class="modal-actions">

              <a href="#" class="btn-cancel">Batal</a>

              <button
    type="button"
    class="btn-download excel-button"
    data-unduh-laporan="excel"
>
                <i class="bi bi-download"></i>
                Unduh Berkas Rekapan (Excel)
              </button>

            </div>

          </form>

        </div>
      </div>
    </div>

    <!-- JAVASCRIPT -->
    <script src="../../JS/shared/storage.js"></script>

    <script src="../../JS/laboran/utils/waktu.js"></script>

    <script src="../../JS/laboran/layanan.js"></script>

    <script src="../../JS/KepalaLab/dashboard.js"></script>
    <!-- LIBRARY EXCEL -->
<script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"></script>
  <?php
require_once __DIR__ . "/../edit_profile/modal.php";
?>
<script src="../../JS/edit_profile/profile.js"></script>

<!-- LIBRARY PDF -->
<script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js"></script>

<script src="https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js"></script>


<!-- MODUL LAPORAN DATABASE -->
 <script src="/SILAB/View/JS/auth/session_timeout.js"></script>
<script src="../../JS/laboran/laporan.js"></script>
  </body>

</html>
