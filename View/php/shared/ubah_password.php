<?php

declare(strict_types=1);

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

$csrfToken = bin2hex(random_bytes(32));
$_SESSION["csrf_password"] = $csrfToken;

?>

<div class="password-modal" id="passwordModal">

    <div class="password-modal-backdrop"
         id="passwordBackdrop"></div>

    <section class="password-modal-content"
             role="dialog"
             aria-modal="true"
             aria-labelledby="passwordTitle">

        <button type="button"
                class="password-close"
                id="closePasswordModal"
                aria-label="Tutup">
            <i class="bi bi-x-lg"></i>
        </button>

        <div class="password-icon">
            <i class="bi bi-lock-fill"></i>
        </div>

        <h2 id="passwordTitle">Ubah Password</h2>

        <p class="password-description">
            Masukkan password baru untuk akun SILAB Anda.
        </p>

        <form id="passwordForm">

            <input
                type="hidden"
                id="csrfToken"
                value="<?= htmlspecialchars(
                    $csrfToken,
                    ENT_QUOTES,
                    "UTF-8"
                ) ?>"
            >

            <div class="password-form-group">

                <label for="passwordBaru">
                    Password Baru
                </label>

                <div class="password-input-wrapper">

                    <input
                        type="password"
                        id="passwordBaru"
                        placeholder="Masukkan password baru"
                        minlength="8"
                        maxlength="72"
                        autocomplete="new-password"
                        required
                    >

                    <button type="button"
                            id="togglePassword"
                            aria-label="Tampilkan password">
                        <i class="bi bi-eye"></i>
                    </button>

                </div>

                <small>Minimal 8 karakter.</small>

            </div>

            <div id="passwordFeedback"
                 class="password-feedback"
                 role="status"
                 aria-live="polite"></div>

            <button type="submit"
                    class="btn-save-password"
                    id="btnSavePassword">
                Simpan Password Baru
            </button>

        </form>

    </section>
</div>

<script src="../../JS/shared/ubah_password.js" defer></script>
