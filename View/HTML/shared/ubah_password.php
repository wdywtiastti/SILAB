<?php

declare(strict_types=1);

require_once __DIR__ . "/../auth/sesi.php";

wajibRole(
    ["pengguna", "laboran", "kepala_lab"],
    "../auth/login.php"
);

$csrfToken = bin2hex(random_bytes(32));
$_SESSION["csrf_password"] = $csrfToken;

?>

<!doctype html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>Ubah Password | SILAB</title>

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">

    <link rel="stylesheet"
          href="../../CSS/shared/ubah_password.css">
</head>

<body>

    <main class="password-container">

        <section class="password-card">

            <div class="password-icon">
                <i>🔐</i>
            </div>

            <div class="password-heading">
                <h2>Ubah Password</h2>

                <p>
                    Buat password baru untuk menjaga
                    keamanan akun SILAB Anda.
                </p>
            </div>

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

                <div class="form-group">

                    <label for="passwordBaru">
                        Password Baru
                    </label>

                    <div class="password-input-wrapper">

                        <input
                            type="password"
                            id="passwordBaru"
                            name="password_baru"
                            placeholder="Masukkan password baru"
                            autocomplete="new-password"
                            minlength="8"
                            maxlength="72"
                            required
                        >

                        <button
                            type="button"
                            class="toggle-password"
                            id="togglePassword"
                            aria-label="Tampilkan password"
                        >
                            Lihat
                        </button>

                    </div>

                    <small>
                        Gunakan minimal 8 karakter.
                    </small>

                </div>

                <div
                    class="password-feedback"
                    id="passwordFeedback"
                    role="status"
                    aria-live="polite"
                ></div>

                <button
                    type="submit"
                    class="btn-save-password"
                    id="btnSavePassword"
                >
                    Simpan Password Baru
                </button>

            </form>

        </section>

    </main>

    <script>
    (() => {

        "use strict";

        const form = document.getElementById("passwordForm");
        const password = document.getElementById("passwordBaru");
        const toggle = document.getElementById("togglePassword");
        const button = document.getElementById("btnSavePassword");
        const feedback = document.getElementById("passwordFeedback");

        function showFeedback(message, error = false) {

            feedback.textContent = message;

            feedback.className = "password-feedback show";

            feedback.classList.toggle("error", error);
        }

        toggle.addEventListener("click", () => {

            const visible = password.type === "text";

            password.type = visible ? "password" : "text";

            toggle.textContent = visible ? "Lihat" : "Sembunyikan";

        });

        form.addEventListener("submit", async (event) => {

            event.preventDefault();

            const value = password.value;

            if (value.length < 8) {
                showFeedback(
                    "Password minimal 8 karakter.",
                    true
                );
                return;
            }

            if (new TextEncoder().encode(value).length > 72) {
                showFeedback(
                    "Password terlalu panjang.",
                    true
                );
                return;
            }

            button.disabled = true;
            button.textContent = "Menyimpan...";

            try {

                const response = await fetch("API_password.php", {

                    method: "POST",

                    credentials: "same-origin",

                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },

                    body: JSON.stringify({
                        password_baru: value,
                        csrf_token:
                            document.getElementById("csrfToken").value
                    })

                });

                const result = await response.json();

                if (!response.ok || !result.success) {
                    throw new Error(
                        result.message || "Gagal mengubah password."
                    );
                }

                form.reset();

                showFeedback(
                    "Password berhasil diperbarui."
                );

            } catch (error) {

                showFeedback(error.message, true);

            } finally {

                button.disabled = false;
                button.textContent = "Simpan Password Baru";

            }

        });

    })();
    </script>

</body>
</html>
