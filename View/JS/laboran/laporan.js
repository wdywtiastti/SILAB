
/**
 * MODUL LAPORAN SILAB
 * Mengelola rekapitulasi peminjaman Laboratorium RPL.
 * Mendukung ekspor laporan harian ke PDF dan Excel.
 * Data diambil dari SILABService agar siap dialihkan ke API PHP.
 */

(function (window, document) {
    "use strict";

    const waktu = window.SILABWaktu;
    const layanan = window.SILABService;
    const wadahNotifikasi = document.getElementById("wadahNotifikasi");

    const DURASI_NOTIFIKASI = 3500;
    const ZONA_WAKTU = waktu?.TIME_ZONE || "Asia/Jayapura";

    // Memastikan modul yang dibutuhkan tersedia.
    if (
        !waktu ||
        !layanan ||
        typeof waktu.tanggalHariIni !== "function" ||
        typeof waktu.formatTanggal !== "function" ||
        typeof waktu.formatJam !== "function" ||
        typeof layanan.getAll !== "function"
    ) {
        console.error("SILAB: Modul laporan gagal dimuat.");
        return;
    }

    // Susunan kolom yang digunakan bersama oleh PDF dan Excel.
    const HEADER_LAPORAN = [
        "No.",
        "Pemohon",
        "NIP/NPM",
        "Nama Kegiatan",
        "Jenis Kegiatan",
        "Kategori",
        "Waktu",
        "PC",
        "Kursi",
        "Status Presensi",
        "Waktu Validasi"
    ];

    // Memeriksa validitas tanggal kalender.
    function tanggalValid(nilai) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(nilai)) {
            return false;
        }

        const [tahun, bulan, hari] = nilai.split("-").map(Number);

        const tanggal = new Date(
            Date.UTC(tahun, bulan - 1, hari)
        );

        return (
            tanggal.getUTCFullYear() === tahun &&
            tanggal.getUTCMonth() === bulan - 1 &&
            tanggal.getUTCDate() === hari
        );
    }

    // Mengambil status akhir presensi peminjaman.
    function kodeStatusPresensi(booking) {
        const status = booking.presensi?.status || booking.status;

        if (status === "digunakan") {
            return "digunakan";
        }

        if (status === "tidak_digunakan") {
            return "tidak_digunakan";
        }

        return "menunggu";
    }

    // Mengubah kode status menjadi keterangan laporan.
    function formatStatusPresensi(booking) {
        const status = kodeStatusPresensi(booking);

        const keterangan = {
            digunakan: "Digunakan",
            tidak_digunakan: "Tidak Digunakan",
            menunggu: "Menunggu Presensi"
        };

        return keterangan[status];
    }

    // Memformat waktu validasi berdasarkan zona waktu WIT.
    function formatWaktuValidasi(booking) {
        const nilai = booking.presensi?.waktuValidasi;

        if (!nilai) {
            return "-";
        }

        const tanggal = new Date(nilai);

        if (Number.isNaN(tanggal.getTime())) {
            return "-";
        }

        return new Intl.DateTimeFormat("id-ID", {
            timeZone: ZONA_WAKTU,
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23"
        }).format(tanggal) + " WIT";
    }

    // Mengambil seluruh peminjaman berdasarkan tanggal.
    function ambilDataTanggal(tanggal) {
        return layanan.getAll("bookings")
            .filter(booking => booking.tanggal === tanggal)
            .sort((a, b) =>
                (a.waktuMulai || "").localeCompare(
                    b.waktuMulai || ""
                )
            );
    }

    // Menghitung ringkasan seluruh peminjaman.
    function hitungRingkasan(data) {
        const ringkasan = {
            total: data.length,
            digunakan: 0,
            tidakDigunakan: 0,
            menunggu: 0,
            totalPC: 0,
            totalKursi: 0
        };

        data.forEach(booking => {
            const status = kodeStatusPresensi(booking);

            if (status === "digunakan") {
                ringkasan.digunakan++;

            } else if (status === "tidak_digunakan") {
                ringkasan.tidakDigunakan++;

            } else {
                ringkasan.menunggu++;
            }

            ringkasan.totalPC +=
                Number(booking.kebutuhanPC) || 0;

            ringkasan.totalKursi +=
                Number(booking.kebutuhanKursi) || 0;
        });

        return ringkasan;
    }

    // Menyiapkan data laporan tanpa mengekspos ID internal.
    function susunDataLaporan(data) {
        return data.map((booking, index) => ({
            nomor: index + 1,
            pemohon: booking.namaPemohon || "-",
            identifier: booking.nipNpm || "-",
            kegiatan: booking.namaKegiatan || "-",
            jenisKegiatan: booking.jenisKegiatan || "-",
            kategori: booking.kategori || "-",

            waktu: `${waktu.formatJam(booking.waktuMulai)} - ${waktu.formatJam(booking.waktuSelesai)}`,

            pc: Number(booking.kebutuhanPC) || 0,
            kursi: Number(booking.kebutuhanKursi) || 0,

            status: formatStatusPresensi(booking),
            validasi: formatWaktuValidasi(booking)
        }));
    }

    // Menyeragamkan susunan baris untuk PDF dan Excel.
    function susunBarisLaporan(item) {
        return [
            item.nomor,
            item.pemohon,
            item.identifier,
            item.kegiatan,
            item.jenisKegiatan,
            item.kategori,
            item.waktu,
            item.pc,
            item.kursi,
            item.status,
            item.validasi
        ];
    }

    // Menampilkan notifikasi hasil ekspor.
    function tampilkanNotifikasi(
        judul,
        pesan,
        jenis = "sukses"
    ) {
        if (!wadahNotifikasi) {
            console.warn(
                "SILAB: Wadah notifikasi tidak ditemukan."
            );
            return;
        }

        const ikonNotifikasi = {
            sukses: "bi-check-circle-fill",
            peringatan: "bi-exclamation-circle-fill",
            error: "bi-x-circle-fill"
        };

        const jenisTampilan = {
            sukses: "sukses",
            peringatan: "kedaluwarsa",
            error: "tidak-hadir"
        };

        const toast = document.createElement("div");
        const ikon = document.createElement("span");
        const gambarIkon = document.createElement("i");
        const konten = document.createElement("div");
        const teksJudul = document.createElement("span");
        const teksPesan = document.createElement("span");

        toast.className = "notifikasi-toast";
        toast.dataset.jenis = jenisTampilan[jenis];

        toast.setAttribute("role", "status");
        toast.setAttribute("aria-live", "polite");

        ikon.className = "notifikasi-ikon";
        gambarIkon.className =
            `bi ${ikonNotifikasi[jenis]}`;

        ikon.append(gambarIkon);

        konten.className = "notifikasi-konten";

        teksJudul.className = "notifikasi-judul";
        teksJudul.textContent = judul;

        teksPesan.className = "notifikasi-pesan";
        teksPesan.textContent = pesan;

        konten.append(teksJudul, teksPesan);
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

    // Memastikan tanggal laporan valid sebelum ekspor.
    function validasiTanggal(input) {
        if (!input || !input.value) {
            input?.reportValidity();

            tampilkanNotifikasi(
                "Tanggal Belum Dipilih",
                "Silakan pilih tanggal laporan terlebih dahulu.",
                "peringatan"
            );

            return null;
        }

        if (!tanggalValid(input.value)) {
            tampilkanNotifikasi(
                "Tanggal Tidak Valid",
                "Tanggal laporan yang dipilih tidak valid.",
                "error"
            );

            return null;
        }

        return input.value;
    }

    // Membuat file Excel dari data laporan.
    function eksporExcel(data, ringkasan, tanggal) {
        if (!window.XLSX) {
            throw new Error(
                "Library Excel belum berhasil dimuat."
            );
        }

        const barisData = data.map(susunBarisLaporan);

        const isiLaporan = [
            ["LAPORAN REKAPITULASI PEMINJAMAN LABORATORIUM"],
            ["Laboratorium", "Rekayasa Perangkat Lunak"],
            ["Tanggal", waktu.formatTanggal(tanggal)],
            [],
            HEADER_LAPORAN,
            ...barisData,
            [],
            ["RINGKASAN LAPORAN"],
            ["Total Peminjaman", ringkasan.total],
            ["Digunakan", ringkasan.digunakan],
            ["Tidak Digunakan", ringkasan.tidakDigunakan],
            ["Menunggu Presensi", ringkasan.menunggu],
            ["Total Kebutuhan PC", ringkasan.totalPC],
            ["Total Kebutuhan Kursi", ringkasan.totalKursi]
        ];

        const lembar = window.XLSX.utils.aoa_to_sheet(
            isiLaporan
        );

        // Mengatur lebar setiap kolom.
        lembar["!cols"] = [
            { wch: 6 },
            { wch: 24 },
            { wch: 18 },
            { wch: 35 },
            { wch: 22 },
            { wch: 12 },
            { wch: 22 },
            { wch: 10 },
            { wch: 10 },
            { wch: 22 },
            { wch: 25 }
        ];

        // Menggabungkan judul laporan.
        lembar["!merges"] = [
            {
                s: { r: 0, c: 0 },
                e: { r: 0, c: 10 }
            }
        ];

        // Mengaktifkan filter pada tabel laporan.
        lembar["!autofilter"] = {
            ref: `A5:K${5 + data.length}`
        };

        const buku = window.XLSX.utils.book_new();

        window.XLSX.utils.book_append_sheet(
            buku,
            lembar,
            "Rekap Harian"
        );

        // Mengunduh file Excel.
        window.XLSX.writeFile(
            buku,
            `rekapan_silab_${tanggal}.xlsx`
        );
    }

    // Membuat file PDF dari data laporan.
    function eksporPDF(data, ringkasan, tanggal) {
        const jsPDF = window.jspdf?.jsPDF;

        if (typeof jsPDF !== "function") {
            throw new Error(
                "Library PDF belum berhasil dimuat."
            );
        }

        const dokumen = new jsPDF({
            orientation: "landscape",
            unit: "mm",
            format: "a4"
        });

        if (typeof dokumen.autoTable !== "function") {
            throw new Error(
                "Plugin tabel PDF belum berhasil dimuat."
            );
        }

        const margin = {
            top: 10,
            left: 8,
            right: 8,
            bottom: 12
        };

        const lebarTabel = 275;

        dokumen.setProperties({
            title: "Rekap Harian SILAB",
            subject: "Laporan Peminjaman Laboratorium RPL",
            author: "SILAB - Laboratorium RPL"
        });

        // Menampilkan identitas laporan.
        dokumen.setFont("helvetica", "bold");
        dokumen.setFontSize(15);

        dokumen.text(
            "LAPORAN REKAPITULASI PEMINJAMAN",
            margin.left,
            15
        );

        dokumen.setFont("helvetica", "normal");
        dokumen.setFontSize(9);

        dokumen.text(
            "Laboratorium Rekayasa Perangkat Lunak",
            margin.left,
            22
        );

        dokumen.text(
            `Tanggal: ${waktu.formatTanggal(tanggal)} WIT`,
            margin.left,
            28
        );

        const isiTabel = data.map(susunBarisLaporan);

        // Menampilkan tabel utama laporan.
        dokumen.autoTable({
            startY: 34,
            tableWidth: lebarTabel,
            head: [HEADER_LAPORAN],
            body: isiTabel,
            theme: "grid",
            margin,

            styles: {
                font: "helvetica",
                fontSize: 6,
                cellPadding: 1.3,
                overflow: "linebreak",
                valign: "middle",
                lineWidth: 0.1
            },

            headStyles: {
                fillColor: [51, 38, 106],
                textColor: 255,
                fontStyle: "bold",
                halign: "center",
                fontSize: 6
            },

            alternateRowStyles: {
                fillColor: [245, 245, 248]
            },

            columnStyles: {
                0: { cellWidth: 8, halign: "center" },
                1: { cellWidth: 29 },
                2: { cellWidth: 25 },
                3: { cellWidth: 48 },
                4: { cellWidth: 32 },
                5: { cellWidth: 15, halign: "center" },
                6: { cellWidth: 28, halign: "center" },
                7: { cellWidth: 10, halign: "center" },
                8: { cellWidth: 10, halign: "center" },
                9: { cellWidth: 32 },
                10: { cellWidth: 38 }
            }
        });

        // Menampilkan ringkasan setelah tabel peminjaman.
        dokumen.autoTable({
            startY: dokumen.lastAutoTable.finalY + 7,
            tableWidth: lebarTabel,
            margin,

            head: [
                ["RINGKASAN LAPORAN", "JUMLAH"]
            ],

            body: [
                ["Total Peminjaman", ringkasan.total],
                ["Digunakan", ringkasan.digunakan],
                ["Tidak Digunakan", ringkasan.tidakDigunakan],
                ["Menunggu Presensi", ringkasan.menunggu],
                ["Total Kebutuhan PC", ringkasan.totalPC],
                ["Total Kebutuhan Kursi", ringkasan.totalKursi]
            ],

            theme: "grid",

            styles: {
                font: "helvetica",
                fontSize: 8,
                cellPadding: 2,
                overflow: "linebreak"
            },

            headStyles: {
                fillColor: [51, 38, 106],
                textColor: 255,
                fontStyle: "bold"
            },

            columnStyles: {
                0: { cellWidth: 220 },
                1: { cellWidth: 55, halign: "center" }
            }
        });

        // Menambahkan nomor halaman pada seluruh halaman.
        const jumlahHalaman =
            dokumen.internal.getNumberOfPages();

        for (
            let halaman = 1;
            halaman <= jumlahHalaman;
            halaman++
        ) {
            dokumen.setPage(halaman);

            dokumen.setFont("helvetica", "normal");
            dokumen.setFontSize(7);

            dokumen.text(
                `SILAB | Laboratorium RPL | Halaman ${halaman}`,
                dokumen.internal.pageSize.getWidth() - 8,
                dokumen.internal.pageSize.getHeight() - 5,
                { align: "right" }
            );
        }

        // Mengunduh file PDF.
        dokumen.save(
            `rekapan_silab_${tanggal}.pdf`
        );
    }

    // Menutup modal setelah laporan berhasil dibuat.
    function tutupModal(modal) {
        if (
            modal &&
            window.location.hash === `#${modal.id}`
        ) {
            window.location.hash = "";
        }
    }

    // Mengatur kondisi tombol selama proses ekspor.
    function aturTombol(tombol, nonaktif) {
        if ("disabled" in tombol) {
            tombol.disabled = nonaktif;
        }

        tombol.setAttribute(
            "aria-disabled",
            String(nonaktif)
        );
    }

    // Menjalankan proses unduhan berdasarkan format.
    function prosesUnduhan(tombol) {
        const format = tombol.dataset.unduhLaporan;

        if (!["pdf", "excel"].includes(format)) {
            return;
        }

        const idInput = format === "pdf"
            ? "tanggalPdf"
            : "tanggalExcel";

        const input = document.getElementById(idInput);
        const tanggal = validasiTanggal(input);

        if (!tanggal) {
            return;
        }

        // Mencegah proses ekspor ganda.
        if (
            tombol.disabled ||
            tombol.getAttribute("aria-disabled") === "true"
        ) {
            return;
        }

        aturTombol(tombol, true);

        try {
            // Mengambil data sesuai tanggal pilihan.
            const dataMentah = ambilDataTanggal(tanggal);

            if (!dataMentah.length) {
                tampilkanNotifikasi(
                    "Data Tidak Ditemukan",
                    "Tidak ada peminjaman pada tanggal yang dipilih.",
                    "peringatan"
                );

                return;
            }

            // Menyiapkan data dan ringkasan laporan.
            const data = susunDataLaporan(dataMentah);
            const ringkasan = hitungRingkasan(dataMentah);

            if (format === "excel") {
                eksporExcel(data, ringkasan, tanggal);

                tampilkanNotifikasi(
                    "Ekspor Excel Berhasil",
                    "Rekapan peminjaman berhasil diunduh."
                );

            } else {
                eksporPDF(data, ringkasan, tanggal);

                tampilkanNotifikasi(
                    "Ekspor PDF Berhasil",
                    "Rekapan peminjaman berhasil diunduh."
                );
            }

            // Menutup modal setelah proses berhasil.
            tutupModal(
                tombol.closest(".modal-overlay")
            );

        } catch (error) {
            tampilkanNotifikasi(
                "Ekspor Gagal",
                error.message ||
                    "Terjadi kesalahan saat membuat laporan.",
                "error"
            );

            console.error("SILAB Laporan:", error);

        } finally {
            aturTombol(tombol, false);
        }
    }

    // Mengatur tanggal awal dan menghubungkan tombol ekspor.
    function inisialisasiLaporan() {
        const tanggalHariIni = waktu.tanggalHariIni();

        const inputPDF =
            document.getElementById("tanggalPdf");

        const inputExcel =
            document.getElementById("tanggalExcel");

        // Mengisi tanggal hari ini secara otomatis.
        if (inputPDF && !inputPDF.value) {
            inputPDF.value = tanggalHariIni;
        }

        if (inputExcel && !inputExcel.value) {
            inputExcel.value = tanggalHariIni;
        }

        // Menangani klik tombol PDF dan Excel.
        document.addEventListener("click", function (event) {
            const tombol = event.target.closest(
                "[data-unduh-laporan]"
            );

            if (!tombol) {
                return;
            }

            event.preventDefault();

            prosesUnduhan(tombol);
        });
    }

    // Menjalankan inisialisasi modul laporan.
    inisialisasiLaporan();

    console.log("SILAB: Modul laporan berhasil dimuat.");

})(window, document);