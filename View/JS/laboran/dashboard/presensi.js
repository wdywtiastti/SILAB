
(function (window, document) {
    "use strict";

    // =========================================
    // 1. REFERENSI ELEMEN HTML
    // =========================================

    const wadahPresensi = document.getElementById("wadahPresensi");
    const wadahNotifikasi = document.getElementById("wadahNotifikasi");

    const DURASI_NOTIFIKASI = 3500;

    // =========================================
    // 2. KONFIGURASI NOTIFIKASI
    // =========================================

    const PESAN_NOTIFIKASI = {
        digunakan: {
            jenis: "sukses",
            judul: "Presensi Dikonfirmasi",
            pesan: "Pengguna berhasil divalidasi hadir. Laboratorium digunakan.",
            ikon: "bi-check-circle-fill"
        },

        tidak_digunakan: {
            jenis: "tidak-hadir",
            judul: "Pengguna Tidak Hadir",
            pesan: "Presensi dicatat tidak digunakan. Slot laboratorium dibuka.",
            ikon: "bi-x-circle-fill"
        },

        kedaluwarsa: {
            jenis: "kedaluwarsa",
            judul: "Batas Presensi Habis",
            pesan: "Tidak ada validasi dalam 15 menit. Slot laboratorium dibuka otomatis.",
            ikon: "bi-clock-fill"
        }
    };

    // =========================================
    // 3. PEMERIKSAAN ELEMEN
    // =========================================

    if (!wadahPresensi) {
        console.error("SILAB: Modul presensi gagal dimuat.");
        return;
    }

    if (!wadahNotifikasi) {
        console.warn("SILAB: Wadah notifikasi tidak ditemukan.");
    }

    // Mencegah pemeriksaan kedaluwarsa berjalan bersamaan.
    let sedangMemeriksa = false;

    // =========================================
    // 4. MENAMPILKAN NOTIFIKASI
    // =========================================

    function tampilkanNotifikasi(status) {
        const konfigurasi = PESAN_NOTIFIKASI[status];

        if (!konfigurasi || !wadahNotifikasi) return;

        const toast = document.createElement("div");
        const ikon = document.createElement("span");
        const gambarIkon = document.createElement("i");
        const konten = document.createElement("div");
        const judul = document.createElement("span");
        const pesan = document.createElement("span");

        toast.className = "notifikasi-toast";
        toast.dataset.jenis = konfigurasi.jenis;
        toast.setAttribute("role", "status");

        ikon.className = "notifikasi-ikon";

        gambarIkon.className = `bi ${konfigurasi.ikon}`;
        gambarIkon.setAttribute("aria-hidden", "true");

        ikon.append(gambarIkon);

        konten.className = "notifikasi-konten";

        judul.className = "notifikasi-judul";
        judul.textContent = konfigurasi.judul;

        pesan.className = "notifikasi-pesan";
        pesan.textContent = konfigurasi.pesan;

        konten.append(judul, pesan);
        toast.append(ikon, konten);

        wadahNotifikasi.append(toast);

        // Menghilangkan notifikasi secara otomatis.
        window.setTimeout(() => {
            toast.classList.add("is-hilang");

            window.setTimeout(() => {
                toast.remove();
            }, 300);

        }, DURASI_NOTIFIKASI);
    }

    // =========================================
    // 5. MENAMPILKAN PESAN KESALAHAN
    // =========================================

    function tampilkanPesan(kartu, pesan, jenis) {
        const feedback = kartu.querySelector(
            "[data-presensi-feedback]"
        );

        if (!feedback) return;

        feedback.textContent = pesan;
        feedback.dataset.jenis = jenis;
    }

    // =========================================
    // 6. MENGATUR KONDISI TOMBOL
    // =========================================

    function aturTombol(kartu, nonaktif) {
        kartu.querySelectorAll("[data-aksi-presensi]").forEach(
            tombol => {
                tombol.disabled = nonaktif;
            }
        );
    }

    // =========================================
    // 7. PEMERIKSAAN PRESENSI KEDALUWARSA
    // =========================================

    async function periksaPresensiKedaluwarsa() {
        if (sedangMemeriksa) return;

        sedangMemeriksa = true;

        try {
            const response = await fetch("api/kadaluwarsa.php", {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Accept": "application/json"
                }
            });

            const hasil = await response.json();

            if (!response.ok || !hasil.success) {
                throw new Error(
                    hasil.message || "Pemeriksaan kedaluwarsa gagal."
                );
            }

            const jumlah = Number(
                hasil.jumlah_kedaluwarsa ?? 0
            );

            // Notifikasi hanya ditampilkan jika ada
            // booking yang baru diproses kedaluwarsa.
            if (jumlah > 0) {
                tampilkanNotifikasi("kedaluwarsa");

                window.dispatchEvent(
                    new CustomEvent("silab:data-changed")
                );
            }

        } catch (error) {
            console.error(
                "SILAB: Gagal memeriksa presensi kedaluwarsa.",
                error
            );

        } finally {
            sedangMemeriksa = false;
        }
    }

    // =========================================
    // 8. EVENT PERUBAHAN DATA
    // =========================================

    window.addEventListener(
        "silab:data-changed",
        periksaPresensiKedaluwarsa
    );

    // =========================================
    // 9. EVENT KETIKA HALAMAN DIBUKA KEMBALI
    // =========================================

    document.addEventListener("visibilitychange", function () {
        if (!document.hidden) {
            periksaPresensiKedaluwarsa();
        }
    });

    // =========================================
    // 10. MENANGANI KLIK TOMBOL PRESENSI
    // =========================================

    wadahPresensi.addEventListener("click", async function (event) {
        const tombol = event.target.closest("[data-aksi-presensi]");

        if (!tombol || !wadahPresensi.contains(tombol)) return;

        event.preventDefault();

        if (tombol.disabled) return;

        const kartu = tombol.closest(".sesi-card");
        const bookingId = kartu?.dataset.bookingId;
        const status = tombol.dataset.aksiPresensi;

        if (
            !kartu ||
            !bookingId ||
            !["digunakan", "tidak_digunakan"].includes(status)
        ) {
            return;
        }

        // Mencegah pengiriman permintaan berulang.
        aturTombol(kartu, true);

        try {
            const formData = new FormData();

            formData.append("booking_id", bookingId);
            formData.append("status", status);

            const response = await fetch("api/presensi.php", {
                method: "POST",
                body: formData,
                credentials: "same-origin",
                headers: {
                    "Accept": "application/json"
                }
            });

            const hasil = await response.json();

            if (!response.ok || !hasil.success) {
                throw new Error(
                    hasil.message || "Presensi gagal disimpan."
                );
            }

            // Menampilkan notifikasi hasil presensi.
            tampilkanNotifikasi(status);

            // Memperbarui dashboard setelah presensi berhasil.
            window.dispatchEvent(
                new CustomEvent("silab:data-changed")
            );

        } catch (error) {

    // Jika validasi ternyata sudah tercatat,
    // minta dashboard membaca ulang status database.
    if (
        error.message &&
        error.message.toLowerCase().includes("sudah tercatat")
    ) {
        tampilkanPesan(
            kartu,
            "Presensi sudah tercatat. Memperbarui status jadwal...",
            "info"
        );

        window.dispatchEvent(
            new CustomEvent("silab:data-changed")
        );

        return;
    }

    tampilkanPesan(
        kartu,
        error.message || "Terjadi kesalahan saat menyimpan presensi.",
        "error"
    );

    aturTombol(kartu, false);

    console.error("SILAB Presensi:", error);
}
    });

    // =========================================
    // 11. PEMERIKSAAN BERKALA
    // =========================================

    // Memeriksa kedaluwarsa setiap 15 detik.
    window.setInterval(
        periksaPresensiKedaluwarsa,
        15000
    );

    // Pemeriksaan pertama ketika dashboard dibuka.
    periksaPresensiKedaluwarsa();

    console.log("SILAB: Modul presensi berhasil dimuat.");

})(window, document);