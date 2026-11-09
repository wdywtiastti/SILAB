
/**
 * UTILITAS WAKTU SILAB
 * Menyediakan fungsi waktu dan tanggal untuk seluruh modul Laboran.
 * Zona waktu operasional: WIT (Asia/Jayapura).
 */

(function (window) {
    "use strict";

    const TIME_ZONE = "Asia/Jayapura";
    const OFFSET = "+09:00";

    // Formatter untuk mengambil komponen waktu berdasarkan WIT.
    const formatterWIT = new Intl.DateTimeFormat("en-GB", {
        timeZone: TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23"
    });

    // Mengambil komponen tanggal dan waktu dalam zona WIT.
    function getWITParts(date = new Date()) {
        return Object.fromEntries(
            formatterWIT.formatToParts(date)
                .filter(part => part.type !== "literal")
                .map(part => [part.type, Number(part.value)])
        );
    }

    // Menghasilkan tanggal hari ini dalam format YYYY-MM-DD.
    function tanggalHariIni(date = new Date()) {
        const p = getWITParts(date);

        return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
    }

    // Menghasilkan jam sekarang dalam format HH:mm.
    function jamSekarang(date = new Date()) {
        const p = getWITParts(date);

        return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
    }

    // Mengubah tanggal dan jam WIT menjadi objek Date.
    function parseWaktu(tanggal, jam) {
        if (
            !/^\d{4}-\d{2}-\d{2}$/.test(tanggal) ||
            !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(jam)
        ) {
            return null;
        }

        const [tahun, bulan, hari] = tanggal.split("-").map(Number);
        const pemeriksaan = new Date(Date.UTC(tahun, bulan - 1, hari));

        // Memastikan tanggal benar dan tidak mengalami rollover.
        if (
            pemeriksaan.getUTCFullYear() !== tahun ||
            pemeriksaan.getUTCMonth() !== bulan - 1 ||
            pemeriksaan.getUTCDate() !== hari
        ) {
            return null;
        }

        const hasil = new Date(`${tanggal}T${jam}:00${OFFSET}`);

        return Number.isNaN(hasil.getTime()) ? null : hasil;
    }

    // Memformat tanggal menjadi format Indonesia.
    function formatTanggal(tanggal) {
        const date = /^\d{4}-\d{2}-\d{2}$/.test(tanggal)
            ? parseWaktu(tanggal, "00:00")
            : new Date(tanggal);

        if (!date || Number.isNaN(date.getTime())) {
            return "-";
        }

        return new Intl.DateTimeFormat("id-ID", {
            timeZone: TIME_ZONE,
            day: "2-digit",
            month: "long",
            year: "numeric"
        }).format(date);
    }

    // Mengubah format jam HH:mm menjadi HH.mm.
    function formatJam(jam) {
        if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(jam)) {
            return "-";
        }

        return jam.replace(":", ".");
    }

    // Membentuk rentang waktu peminjaman.
    function formatRentangJam(mulai, selesai) {
        return `${formatJam(mulai)} - ${formatJam(selesai)} WIT`;
    }

    // Menghitung selisih waktu dalam menit.
    function selisihMenit(waktuAwal, waktuAkhir = new Date()) {
        const awal = new Date(waktuAwal);
        const akhir = new Date(waktuAkhir);

        if (
            Number.isNaN(awal.getTime()) ||
            Number.isNaN(akhir.getTime())
        ) {
            return null;
        }

        return Math.floor((akhir - awal) / 60000);
    }

    // Memeriksa validitas rentang waktu peminjaman.
    function validasiRentang(tanggal, mulai, selesai) {
        const waktuMulai = parseWaktu(tanggal, mulai);
        const waktuSelesai = parseWaktu(tanggal, selesai);

        if (!waktuMulai || !waktuSelesai) {
            return {
                valid: false,
                pesan: "Tanggal atau format waktu tidak valid."
            };
        }

        if (waktuSelesai <= waktuMulai) {
            return {
                valid: false,
                pesan: "Waktu selesai harus setelah waktu mulai."
            };
        }

        return {
            valid: true,
            mulai: waktuMulai,
            selesai: waktuSelesai
        };
    }

    // Memeriksa apakah sesi sedang berlangsung.
    function sesiBerlangsung(tanggal, mulai, selesai, sekarang = new Date()) {
        const rentang = validasiRentang(tanggal, mulai, selesai);

        if (!rentang.valid) {
            return false;
        }

        return sekarang >= rentang.mulai &&
            sekarang < rentang.selesai;
    }

    // Menyediakan seluruh fungsi waktu untuk modul lain.
    window.SILABWaktu = Object.freeze({
        TIME_ZONE,
        tanggalHariIni,
        jamSekarang,
        getWITParts,
        parseWaktu,
        formatTanggal,
        formatJam,
        formatRentangJam,
        selisihMenit,
        validasiRentang,
        sesiBerlangsung
    });

})(window);
