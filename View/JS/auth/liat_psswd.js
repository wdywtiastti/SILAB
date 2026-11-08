// Mengambil semua tombol lihat password pada halaman
const toggleButtons = document.querySelectorAll(".toggle-password");

// Menambahkan fungsi klik pada setiap tombol
toggleButtons.forEach((button) => {

    // Mengambil ID input password dari atribut data-target
    const targetId = button.dataset.target;

    // Mengambil elemen input dan ikon di dalam tombol
    const passwordInput = document.getElementById(targetId);
    const icon = button.querySelector("i");

    // Menghentikan proses jika elemen tidak ditemukan
    if (!passwordInput || !icon) return;

    button.addEventListener("click", () => {

        // Memeriksa apakah password sedang tersembunyi
        const isHidden = passwordInput.type === "password";

        // Mengubah tipe input password
        passwordInput.type = isHidden ? "text" : "password";

        // Mengubah ikon sesuai kondisi password
        icon.classList.toggle("bi-eye", isHidden);
        icon.classList.toggle("bi-eye-slash", !isHidden);

        // Memperbarui keterangan tombol untuk aksesibilitas
        button.setAttribute(
            "aria-label",
            isHidden ? "Sembunyikan password" : "Tampilkan password"
        );

        button.setAttribute("aria-pressed", String(isHidden));

    });

});