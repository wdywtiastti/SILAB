
(function (window, document) {
    "use strict";

    const waktu = window.SILABWaktu;
    const layanan = window.SILABService;
    const wadahPresensi = document.getElementById("wadahPresensi");
    const wadahNotifikasi = document.getElementById("wadahNotifikasi");

    const BATAS_VALIDASI = 15;
    const DURASI_NOTIFIKASI = 3500;

    // Pengaturan pesan notifikasi.
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

    if (!waktu || !layanan || !wadahPresensi) {
        console.error("SILAB: Modul presensi gagal dimuat.");
        return;
    }

    if (!wadahNotifikasi) {
        console.warn("SILAB: Wadah notifikasi tidak ditemukan.");
    }

    let sedangMemeriksa = false;

    // Menampilkan notifikasi hasil presensi.
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

    // Mengambil status akhir presensi.
    function statusAkhir(booking) {
        const status = booking.presensi?.status;

        if (["digunakan", "tidak_digunakan"].includes(status)) {
            return status;
        }

        return ["digunakan", "tidak_digunakan"].includes(booking.status)
            ? booking.status
            : null;
    }

    // Menampilkan pesan kesalahan validasi.
    function tampilkanPesan(kartu, pesan, jenis) {
        const feedback = kartu.querySelector(
            "[data-presensi-feedback]"
        );

        if (!feedback) return;

        feedback.textContent = pesan;
        feedback.dataset.jenis = jenis;
    }

    // Mengatur kondisi tombol presensi.
    function aturTombol(kartu, nonaktif) {
        kartu.querySelectorAll("[data-aksi-presensi]").forEach(
            tombol => {
                tombol.disabled = nonaktif;
            }
        );
    }

    // Memeriksa kelayakan validasi presensi.
    function periksaKelayakan(booking) {
        if (!booking) {
            return {
                boleh: false,
                pesan: "Data peminjaman tidak ditemukan."
            };
        }

        if (statusAkhir(booking)) {
            return {
                boleh: false,
                pesan: "Presensi sesi ini sudah dicatat."
            };
        }

        const rentang = waktu.validasiRentang(
            booking.tanggal,
            booking.waktuMulai,
            booking.waktuSelesai
        );

        if (!rentang.valid) {
            return {
                boleh: false,
                pesan: rentang.pesan
            };
        }

        const sekarang = new Date();

        if (sekarang < rentang.mulai) {
            return {
                boleh: false,
                pesan: "Sesi belum dimulai."
            };
        }

        if (sekarang >= rentang.selesai) {
            return {
                boleh: false,
                pesan: "Sesi sudah berakhir."
            };
        }

        const batasWaktu = rentang.mulai.getTime() +
            BATAS_VALIDASI * 60000;

        if (sekarang.getTime() >= batasWaktu) {
            return {
                boleh: false,
                kedaluwarsa: true,
                pesan: "Batas validasi 15 menit telah berakhir."
            };
        }

        return {
            boleh: true,
            pesan: "Presensi dapat dicatat."
        };
    }

    // Menutup slot otomatis jika 15 menit berlalu tanpa validasi.
    function periksaPresensiKedaluwarsa() {
        if (sedangMemeriksa) return;

        sedangMemeriksa = true;

        try {
            const sekarang = new Date();
            const data = layanan.getAll("bookings");

            data.forEach(booking => {
                if (statusAkhir(booking)) return;

                const rentang = waktu.validasiRentang(
                    booking.tanggal,
                    booking.waktuMulai,
                    booking.waktuSelesai
                );

                if (!rentang.valid) return;

                const batasWaktu = rentang.mulai.getTime() +
                    BATAS_VALIDASI * 60000;

                if (sekarang.getTime() < batasWaktu) return;

                try {
                    layanan.updatePresensi(
                        booking.id,
                        "tidak_digunakan"
                    );

                    tampilkanNotifikasi("kedaluwarsa");

                } catch (error) {
                    console.error(
                        `SILAB: Gagal memperbarui presensi ${booking.id}.`,
                        error
                    );
                }
            });

        } catch (error) {
            console.error("SILAB: Pemeriksaan presensi gagal.", error);

        } finally {
            sedangMemeriksa = false;
        }
    }

    // Menangani klik tombol presensi.
    wadahPresensi.addEventListener("click", function (event) {
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

        const booking = layanan.getById("bookings", bookingId);
        const hasil = periksaKelayakan(booking);

        if (!hasil.boleh) {
            if (hasil.kedaluwarsa && booking) {
                periksaPresensiKedaluwarsa();
                return;
            }

            tampilkanPesan(kartu, hasil.pesan, "error");
            aturTombol(kartu, true);

            return;
        }

        // Mencegah tombol diproses lebih dari satu kali.
        aturTombol(kartu, true);

        try {
            layanan.updatePresensi(bookingId, status);

            tampilkanNotifikasi(status);

        } catch (error) {
            tampilkanPesan(
                kartu,
                error.message || "Presensi gagal disimpan.",
                "error"
            );

            aturTombol(kartu, false);

            console.error("SILAB Presensi:", error);
        }
    });

    // Memeriksa presensi ketika data berubah.
    window.addEventListener(
        "silab:data-changed",
        periksaPresensiKedaluwarsa
    );

    // Memeriksa ulang ketika halaman dibuka kembali.
    document.addEventListener("visibilitychange", function () {
        if (!document.hidden) {
            periksaPresensiKedaluwarsa();
        }
    });

    // Memeriksa batas presensi setiap satu detik.
    window.setInterval(periksaPresensiKedaluwarsa, 1000);

    // Menjalankan pemeriksaan pertama.
    periksaPresensiKedaluwarsa();

    console.log("SILAB: Modul presensi berhasil dimuat.");

})(window, document);
