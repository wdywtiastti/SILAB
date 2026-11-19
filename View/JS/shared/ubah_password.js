
(() => {
    "use strict";

    const modal = document.getElementById("passwordModal");
    const form = document.getElementById("passwordForm");
    const password = document.getElementById("passwordBaru");
    const toggle = document.getElementById("togglePassword");
    const button = document.getElementById("btnSavePassword");
    const feedback = document.getElementById("passwordFeedback");

    if (!modal || !form) return;

    // Buka popup dari tombol navbar.
    document.querySelectorAll("[data-open-password]").forEach((element) => {
        element.addEventListener("click", (event) => {
            event.preventDefault();

            modal.classList.add("show");
            password.focus();
        });
    });

    // Tutup popup.
    function closeModal() {
        modal.classList.remove("show");
    }

    document.getElementById("closePasswordModal")
        .addEventListener("click", closeModal);

    document.getElementById("passwordBackdrop")
        .addEventListener("click", closeModal);

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeModal();
    });

    // Tampilkan / sembunyikan password.
    toggle.addEventListener("click", () => {
        const visible = password.type === "text";

        password.type = visible ? "password" : "text";

        toggle.innerHTML = visible
            ? '<i class="bi bi-eye"></i>'
            : '<i class="bi bi-eye-slash"></i>';
    });

    function showFeedback(message, error = false) {
        feedback.textContent = message;
        feedback.className = "password-feedback show";

        if (error) {
            feedback.classList.add("error");
        }
    }

    // Simpan password.
    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const value = password.value;

        if (value.length < 8) {
            showFeedback("Password minimal 8 karakter.", true);
            return;
        }

        if (new TextEncoder().encode(value).length > 72) {
            showFeedback("Password terlalu panjang.", true);
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

            showFeedback("Password berhasil diperbarui.");

        } catch (error) {
            showFeedback(error.message, true);

        } finally {
            button.disabled = false;
            button.textContent = "Simpan Password Baru";
        }
    });

})();
