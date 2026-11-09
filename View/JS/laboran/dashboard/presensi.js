
/**
 * PRESENSI LABORAN SILAB
 * Mengatur card sesi aktif dan validasi kehadiran pengguna.
 */

(function (window, document) {
    "use strict";

    const service = window.SILABService;
    const waktu = window.SILABWaktu;

    const BATAS_PRESENSI = 15;
    const INTERVAL_PEMERIKSAAN = 5000;

    const card = document.querySelector(".sesi-card");

    if (!service || !waktu || !card) {
        console.error("SILAB: dependensi atau elemen presensi tidak ditemukan.");
        return;
    }

    const elemen = {
        judul: card.querySelector(".sesi-info h3"),
        jam: card.querySelector(".sesi-jam"),
        pemohon: card.querySelector(".sesi-lokasi strong"),
        tombolHadir: card.querySelector(".btn-hadir"),
        tombolTidak: card.querySelector(".btn-tidak"),
        aksi: card.querySelector(".tombol-validasi")
    };

    let sedangMemperbarui = false;

    // Memeriksa apakah elemen utama tersedia.
    if (Object.values(elemen).some(item => !item)) {
        console.error("SILAB: struktur HTML card presensi tidak lengkap.");
        return;
    }

    // Mengambil waktu mulai dan selesai dari data peminjaman.
    function getRentang(booking) {
        return {
            mulai: waktu.parseWaktu(booking.tanggal, booking.waktuMulai),
            selesai: waktu.parseWaktu(booking.tanggal, booking.waktuSelesai)
        };
    }

    // Mengambil sesi yang sedang berlangsung.
    function getSesiAktif(sekarang = new Date()) {
        const tanggal = waktu.tanggalHariIni(sekarang);

        return service.getAll("bookings")
            .filter(item => item.tanggal === tanggal)
            .find(item => {
                const { mulai, selesai } = getRentang(item);

                return mulai &&
                    selesai &&
                    sekarang >= mulai &&
                    sekarang < selesai &&
                    !["tidak_digunakan", "selesai_digunakan"].includes(item.status);
            }) || null;
    }

    // Memperbarui status otomatis setelah batas presensi atau sesi berakhir.
    function perbaruiStatusOtomatis(sekarang) {
        const tanggal = waktu.tanggalHariIni(sekarang);
        const bookings = service.getAll("bookings");

        bookings
            .filter(item => item.tanggal === tanggal)
            .forEach(item => {
                const { mulai, selesai } = getRentang(item);

                if (!mulai || !selesai) return;

                const batasAkhir = new Date(
                    mulai.getTime() + BATAS_PRESENSI * 60000
                );

                if (
                    item.status === "terjadwal" &&
                    sekarang >= batasAkhir
                ) {
                    service.updatePresensi(
                        item.id,
                        "tidak_digunakan"
                    );
                }

                if (
                    item.status === "digunakan" &&
                    sekarang >= selesai
                ) {
                    service.update("bookings", item.id, {
                        status: "selesai_digunakan"
                    });
                }
            });
    }

    // Menampilkan card berdasarkan data sesi aktif.
    function tampilkanCard(booking) {
        if (!booking) {
            card.hidden = true;
            card.style.display = "none";
            return;
        }

        card.hidden = false;
        card.style.display = "";

        elemen.judul.textContent = booking.namaKegiatan;
        elemen.jam.textContent = waktu.formatRentangJam(
            booking.waktuMulai,
            booking.waktuSelesai
        );
        elemen.pemohon.textContent = booking.namaPemohon;

        const sudahHadir = booking.status === "digunakan";

        elemen.aksi.hidden = sudahHadir;

        // Menampilkan status hadir setelah validasi berhasil.
        let badge = card.querySelector(".status-presensi");

        if (sudahHadir && !badge) {
            badge = document.createElement("span");
            badge.className = "badge-status selesai status-presensi";
            badge.textContent = "Presensi Hadir Tercatat";
            elemen.aksi.parentElement.appendChild(badge);
        } else if (!sudahHadir && badge) {
            badge.remove();
        }
    }

    // Memeriksa waktu dan memperbarui tampilan presensi.
    function refresh(sekarang = new Date()) {
        if (sedangMemperbarui) return;

        sedangMemperbarui = true;

        try {
            perbaruiStatusOtomatis(sekarang);

            const booking = getSesiAktif(sekarang);
            tampilkanCard(booking);

            return booking;
        } finally {
            sedangMemperbarui = false;
        }
    }

    // Memvalidasi dan menyimpan tindakan presensi Laboran.
    function validasiPresensi(status) {
        const sekarang = new Date();
        const booking = getSesiAktif(sekarang);

        if (!booking || booking.status !== "terjadwal") {
            alert("Tidak ada sesi yang menunggu validasi presensi.");
            refresh();
            return;
        }

        const { mulai } = getRentang(booking);
        const batasAkhir = new Date(
            mulai.getTime() + BATAS_PRESENSI * 60000
        );

        if (sekarang < mulai || sekarang >= batasAkhir) {
            refresh();
            alert("Waktu validasi presensi telah berakhir.");
            return;
        }

        if (status === "tidak_digunakan") {
            const konfirmasi = confirm(
                "Apakah Anda yakin sesi ini tidak digunakan?"
            );

            if (!konfirmasi) return;
        }

        try {
            service.updatePresensi(booking.id, status);
            refresh();

            alert(
                status === "digunakan"
                    ? "Presensi berhasil dicatat."
                    : "Sesi berhasil ditandai tidak digunakan."
            );
        } catch (error) {
            console.error("Gagal memperbarui presensi:", error);
            alert("Terjadi kesalahan saat menyimpan presensi.");
        }
    }

    // Menghubungkan tombol dengan proses validasi.
    elemen.tombolHadir.addEventListener("click", event => {
        event.preventDefault();
        validasiPresensi("digunakan");
    });

    elemen.tombolTidak.addEventListener("click", event => {
        event.preventDefault();
        validasiPresensi("tidak_digunakan");
    });

    // Memperbarui card ketika data berubah dari modul lain.
    window.addEventListener("silab:data-changed", () => refresh());

    // Menjalankan pemeriksaan waktu secara berkala.
    refresh();
    window.setInterval(() => refresh(), INTERVAL_PEMERIKSAAN);

    // Menyediakan fungsi pemeriksaan untuk pengujian.
    window.SILABPresensi = Object.freeze({
        refresh,
        getSesiAktif
    });

})(window, document);
