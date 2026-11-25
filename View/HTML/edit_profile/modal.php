<?php

if (session_status() !== PHP_SESSION_ACTIVE) {
    require_once __DIR__ . "/../auth/sesi.php";
}

if (!isset($_SESSION["csrf_profile"])) {
    $_SESSION["csrf_profile"] = bin2hex(random_bytes(32));
}

$namaProfil = $_SESSION["nama"] ?? "";
$nipProfil = $_SESSION["nip_npm"] ?? "";
$roleProfil = $_SESSION["role"] ?? "";
?>

<!-- =====================================
     MODAL PROFIL SAYA
===================================== -->

<div id="profileModal" class="profile-modal" hidden>

    <div class="profile-dialog">

        <div class="profile-header">
            <div>
                <span class="profile-label">AKUN SILAB RPL</span>
                <h3>Profil Saya</h3>
                <p>Informasi akun pengguna SILAB.</p>
            </div>

            <button type="button"
                    class="profile-close"
                    data-close-profile>
                &times;
            </button>
        </div>

        <div class="profile-body">

            <div class="profile-avatar">
                <i class="bi bi-person-fill"></i>
            </div>

            <div class="profile-information">

                <div class="profile-info-item">
                    <span>Nama Lengkap</span>
                    <strong id="profileNama">
                        <?= htmlspecialchars($namaProfil) ?>
                    </strong>
                </div>

                <div class="profile-info-item">
                    <span>NIP / NPM</span>
                    <strong id="profileNip">
                        <?= htmlspecialchars($nipProfil) ?>
                    </strong>
                </div>

                <div class="profile-info-item">
                    <span>Level Akun</span>
                    <strong>
                        <?= htmlspecialchars(
                            ucwords(str_replace("_", " ", $roleProfil))
                        ) ?>
                    </strong>
                </div>

            </div>

        </div>

        <div class="profile-footer">
            <button type="button"
                    class="btn-edit-profile"
                    id="btnOpenEditProfile">

                <i class="bi bi-pencil-square"></i>
                Edit Profil

            </button>
        </div>

    </div>
</div>


<!-- =====================================
     MODAL EDIT PROFIL
===================================== -->

<div id="editProfileModal"
     class="profile-modal"
     hidden>

    <div class="profile-dialog">

        <div class="profile-header">

            <div>
                <span class="profile-label">
                    FORM EDIT PROFIL
                </span>

                <h3>Edit Profil Saya</h3>

                <p>
                    Perbarui informasi akun SILAB RPL.
                </p>
            </div>

            <button type="button"
                    class="profile-close"
                    data-close-edit-profile>
                &times;
            </button>

        </div>

        <form id="formEditProfile">

            <div class="profile-form-body">

                <input type="hidden"
                       name="csrf_token"
                       value="<?= htmlspecialchars(
                           $_SESSION["csrf_profile"]
                       ) ?>">

                <div class="profile-form-group">

                    <label>Nama Lengkap</label>

                    <input type="text"
                           name="nama"
                           id="editProfileNama"
                           maxlength="100"
                           required
                           value="<?= htmlspecialchars($namaProfil) ?>">

                </div>

                <div class="profile-form-group">

                    <label>NIP / NPM</label>

                    <input type="text"
                           name="nip_npm"
                           id="editProfileNip"
                           inputmode="numeric"
                           maxlength="30"
                           pattern="[0-9]+"
                           required
                           value="<?= htmlspecialchars($nipProfil) ?>">

                </div>

                <div class="profile-form-group">

                    <label>Kata Sandi Baru</label>

                    <div class="profile-password-wrapper">

                        <input type="password"
                               name="password_baru"
                               id="editProfilePassword"
                               minlength="8"
                               maxlength="72"
                               autocomplete="new-password"
                               placeholder="Kosongkan jika tidak ingin mengubah">

                        <button type="button"
                                id="toggleProfilePassword"
                                aria-label="Tampilkan kata sandi">
                            <i class="bi bi-eye"></i>
                        </button>

                    </div>

                    <small>
                        Kosongkan jika tidak ingin mengubah kata sandi.
                        Minimal 8 karakter jika ingin mengganti.
                    </small>

                </div>

                <div id="profileMessage"
                     class="profile-message"
                     role="alert"
                     hidden>
                </div>

            </div>

            <div class="profile-footer">

                <button type="button"
                        class="btn-profile-cancel"
                        data-close-edit-profile>
                    Batal
                </button>

                <button type="submit"
                        class="btn-edit-profile"
                        id="btnSaveProfile">
                    <i class="bi bi-check-circle"></i>
                    Simpan Perubahan
                </button>

            </div>

        </form>

    </div>

</div>
