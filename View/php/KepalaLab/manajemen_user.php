<?php
declare(strict_types=1);

// =========================================
// SILAB - MANAJEMEN USER KEPALA LAB
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

    <title>Manajemen User | SILAB</title>

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

    <!-- CSS -->
      <link rel="stylesheet" href="../../CSS/edit_profile/profile.css">
    <link rel="stylesheet" href="../../CSS/kepalaLab/navbar.css" />
    <link rel="stylesheet" href="../../CSS/kepalaLab/manajemen_user.css" />
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
    <a href="Dashboard.php" class="nav-link">
        Dashboard Kepala Lab
    </a>

    <a href="penyelesaian_konflik.php" class="nav-link">
        Penyelesaian Konflik
    </a>

    <a href="manajemen_algoritma.php" class="nav-link">
        Manajemen Algoritma
    </a>

    <a href="manajemen_user.php" class="nav-link active">
        Manajemen User
    </a>
</nav>

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

    <!-- MAIN CONTENT -->
    <main class="main-content">
      <!-- HEADER MANAJEMEN USER -->
      <section class="user-page-header">
        <div class="user-header-content">
          <div class="header-decoration">
            <span class="line-maroon"></span>
            <span class="line-yellow"></span>
            <span class="line-purple"></span>
          </div>

          <h2>Manajemen Akun Pengguna</h2>

          <p>
            Kelola akun dosen, asisten praktikum, mahasiswa, dan laboran.
            Perbarui data, peran prioritas peminjaman, atau hapus akun pengguna.
          </p>
        </div>

        <label for="modal-tambah-user" class="btn-tambah-user">
          <i class="bi bi-person-plus"></i>
          Tambah Pengguna Baru
        </label>
      </section>

      <!-- RINGKASAN PENGGUNA -->
      <section class="summary-grid">
        <!-- TOTAL PENGGUNA -->
        <div class="summary-card">
          <div class="summary-card-header">
            <span>TOTAL PENGGUNA TERDAFTAR</span>

            <div class="summary-icon purple-icon">
              <i class="bi bi-people"></i>
            </div>
          </div>

          <h2 id="total-users">0</h2>

          <div class="summary-divider"></div>

          <div class="account-status">
<span class="status-active" id="active-users">
    <i class="bi bi-circle-fill"></i>
    0 Aktif
</span>

<span class="status-inactive" id="inactive-users">
    <i class="bi bi-circle-fill"></i>
    0 Nonaktif
</span>
          </div>
        </div>

        <!-- VERIFIKASI AKUN -->
        <div class="summary-card">
          <div class="summary-card-header">
            <span>VERIFIKASI AKUN BARU</span>

            <div class="summary-icon red-icon">
              <i class="bi bi-file-earmark-text"></i>
            </div>
          </div>

          <h2 class="verification-number" id="waiting-users">0 Akun</h2>

          <div class="summary-divider"></div>

          <div class="verification-footer">
            <span>Menunggu persetujuan</span>

            <a href="verifikasi_akun.php" class="review-link">
              Tinjau Permintaan
              <i class="bi bi-chevron-right"></i>
            </a>
          </div>
        </div>
      </section>

      <!-- DAFTAR PENGGUNA -->
      <section class="user-table-section">
        <!-- TOOLBAR -->
        <div class="table-toolbar">
          <!-- DROPDOWN FILTER STATUS -->
          <details class="status-filter">
            <summary class="filter-button" id="filter-button">
    Semua (0)
</summary>

            <div class="filter-dropdown">
              <span class="filter-heading"> FILTER STATUS AKUN </span>

              <div class="filter-options">
                <a href="?status=semua" class="filter-option selected">
                  Semua Akun
                </a>

                <a href="?status=aktif" class="filter-option"> Aktif </a>

                <a href="?status=nonaktif" class="filter-option"> Nonaktif </a>
              </div>
            </div>
          </details>

          <!-- PENCARIAN -->
          <div class="search-box">
            <i class="bi bi-search"></i>

            <input
              type="text"
              placeholder="Cari nama atau NIDN / NIM..."
              aria-label="Cari pengguna"
            />
          </div>
        </div>

        <!-- TABEL -->
        <div class="table-responsive">
          <table class="user-table">
<thead>
    <tr>
        <th>NAMA PENGGUNA</th>
        <th>NIP / NIM</th>
        <th>ROLE</th>
        <th>STATUS AKUN</th>
        <th>AKSI</th>
    </tr>
</thead>

<tbody id="user-table-body">
</tbody>
          </table>
        </div>

        <!-- FOOTER TABEL -->
<div class="table-footer">
    <p id="table-info">
        Menampilkan 0 dari 0 akun pengguna
    </p>

    <div class="pagination" id="user-pagination">
    </div>
</div>
      </section>
    </main>

    <!-- MODAL TAMBAH PENGGUNA -->
    <input type="checkbox" id="modal-tambah-user" class="modal-toggle" />

    <div class="modal-overlay">
      <div class="modal-container">
        <div class="modal-header">
          <div class="modal-heading">
            <span class="modal-badge">
              <i class="bi bi-circle-fill"></i>
              FORM PENDAFTARAN USER
            </span>

            <h2>Tambah Pengguna Baru</h2>

            <p>Masukkan data akun pengguna baru untuk akses SILAB RPL.</p>
          </div>
        </div>

        <form class="form-tambah-user" novalidate>
          <div class="form-group">
            <label for="nama-user"> Nama Lengkap <span>*</span> </label>

            <input
              type="text"
              id="nama-user"
              name="nama"
              placeholder="Nama Lengkap"
              required
            />

            <small class="field-error" data-error-for="nama"></small>
          </div>

          <div class="form-group">
            <label for="nip-user"> NIP / NPM <span>*</span> </label>

            <input
              type="text"
              id="nip-user"
              name="nip_npm"
              placeholder="Contoh: 07352xxxxx"
              inputmode="numeric"
              pattern="[0-9]+"
              title="NIP/NPM hanya boleh berisi angka."
              required
            />
            <small class="field-error" data-error-for="nip_npm"></small>
          </div>

          <div class="form-group">
            <label for="password-user">
              Kata Sandi Awal / Default <span>*</span>
            </label>

            <input
              type="password"
              id="password-user"
              name="password"
              required
            />
            <small class="field-error" data-error-for="password"></small>
            <small class="form-note">
              <i class="bi bi-info-circle"></i>
              Default sandi dapat diubah oleh pengguna saat login pertama kali.
            </small>
          </div>

          <div class="form-group">
          <label for="add-role">Role Pengguna</label>

          <select name="role" id="add-role" required>
              <option value="pengguna">Pengguna</option>
              <option value="laboran">Laboran</option>
          </select>
      </div>

          <div class="modal-footer">
            <label for="modal-tambah-user" class="btn-batal"> Batal </label>

            <button type="submit" class="btn-simpan-user">
              <i class="bi bi-check2"></i>
              Simpan Pengguna
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL EDIT PENGGUNA -->
    <input type="checkbox" id="modal-edit-user" class="modal-toggle" />

    <div class="modal-overlay">
      <div class="modal-container modal-edit-container">
        <div class="modal-header">
          <div class="edit-modal-badges">
            <span class="modal-badge">
              <i class="bi bi-circle-fill"></i>
              FORM EDIT PENGGUNA
            </span>

            <span class="edit-system-badge">
              <i class="bi bi-circle-fill"></i>
              SILAB RPL
            </span>
          </div>

          <div class="modal-heading">
            <h2>Edit Data Pengguna</h2>
            <p>Perbarui informasi akun civitas akademika SILAB RPL.</p>
          </div>
        </div>

        <form class="form-tambah-user form-edit-user" novalidate>
          <div class="form-group">
            <label for="edit-nama">Nama Lengkap</label>

            <input
              type="text"
              id="edit-nama"
              name="nama"
              value="Widyawati Astuti"
              required
            />
            <small class="field-error" data-error-for="nama"></small>
          </div>

          <div class="form-group">
            <label for="edit-nip">NIP / NPM</label>

            <input
              type="text"
              id="edit-nip"
              name="nip_npm"
              value="0024088902"
              inputmode="numeric"
              pattern="[0-9]+"
              title="NIP/NPM hanya boleh berisi angka."
              required
            />
            <small class="field-error" data-error-for="nip_npm"></small>
          </div>

          <div class="form-group">
    <label for="edit-role">Role Pengguna</label>

    <select name="role" id="edit-role" required>
        <option value="pengguna">Pengguna</option>
        <option value="laboran">Laboran</option>
    </select>
</div>
          <div class="form-group status-group">
            <label>Status Akun</label>

            <div class="status-options">
              <label class="status-option status-choice-active">
                <input type="radio" name="status" value="aktif" checked />

                <span class="status-indicator"></span>

                <span class="status-label">
                  <i class="bi bi-circle-fill"></i>
                  Aktif
                </span>
              </label>

              <label class="status-option status-choice-inactive">
                <input type="radio" name="status" value="nonaktif" />

                <span class="status-indicator"></span>

                <span class="status-label">
                  <i class="bi bi-circle-fill"></i>
                  Nonaktif
                </span>
              </label>
            </div>
          </div>

          <div class="form-group password-edit-group">
            <label for="edit-password">Kata Sandi Baru</label>

            <input
              type="password"
              id="edit-password"
              name="password"
              placeholder="••••••••••••"
            />
            <small class="field-error" data-error-for="password"></small>
            <small class="edit-password-note">
              Biarkan kosong jika tidak ingin mengubah kata sandi pengguna.
            </small>
          </div>

          <div class="modal-footer edit-modal-footer">
            <label for="modal-edit-user" class="btn-batal"> Batal </label>

            <button type="submit" class="btn-simpan-user">
              <i class="bi bi-check-circle"></i>
              Simpan
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL KONFIRMASI HAPUS -->
    <input type="checkbox" id="modal-hapus-user" class="modal-toggle" />

    <div class="modal-overlay">
      <div class="modal-container modal-hapus-container">
        <div class="modal-header">
          <div class="modal-heading">
            <span class="modal-badge hapus-badge">
              <i class="bi bi-circle-fill"></i>
              KONFIRMASI PENGHAPUSAN
            </span>

            <div class="hapus-icon">
              <i class="bi bi-trash3"></i>
            </div>

            <h2>Hapus Akun Pengguna?</h2>
            <p>
              Apakah kamu yakin ingin menghapus akun
              <strong class="delete-user-name"></strong>? Tindakan ini tidak
              dapat dibatalkan.
            </p>
          </div>
        </div>

        <div class="modal-footer">
          <label for="modal-hapus-user" class="btn-batal"> Batal </label>
          <button
            type="button"
            class="btn-konfirmasi-hapus"
            id="confirm-delete-user"
          >
            <i class="bi bi-trash3"></i>
            Ya, Hapus Akun
          </button>
        </div>
      </div>
    </div>

    <!-- JAVASCRIPT MANAJEMEN USER -->
      <?php
      require_once __DIR__ . "/../edit_profile/modal.php";
      ?>
    <script src="../../JS/edit_profile/profile.js"></script>
    <script src="../../JS/kepalaLab/manajemen_user.js" defer></script>
    <script src="/SILAB/View/JS/auth/session_timeout.js"></script>
  </body>
</html>
