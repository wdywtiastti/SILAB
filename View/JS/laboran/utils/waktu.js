(function (window) {
    "use strict";

    // Konfigurasi zona waktu operasional SILAB
    const TIME_ZONE = "Asia/Jayapura";
    const OFFSET = "+09:00";

    const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
    const POLA_JAM = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

    // Formatter dibuat sekali agar tidak berulang setiap pemanggilan
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

    const formatterTanggal = new Intl.DateTimeFormat("id-ID", {
        timeZone: TIME_ZONE,
        day: "2-digit",
        month: "long",
        year: "numeric"
    });

    // Mengubah nilai menjadi objek Date yang valid
    function keTanggal(nilai) {
        if (
            nilai === null ||
            nilai === undefined ||
            nilai === ""
        ) {
            return null;
        }

        try {
            const tanggal = nilai instanceof Date
                ? new Date(nilai.getTime())
                : new Date(nilai);

            return Number.isNaN(tanggal.getTime())
                ? null
                : tanggal;

        } catch {
            return null;
        }
    }

    // Menyeragamkan angka menjadi dua digit
    function duaDigit(nilai) {
        return String(nilai).padStart(2, "0");
    }

    // Mengambil komponen tanggal dan waktu berdasarkan WIT
    function getWITParts(date = new Date()) {
        const tanggal = keTanggal(date);

        if (!tanggal) return null;

        return Object.fromEntries(
            formatterWIT.formatToParts(tanggal)
                .filter(part => part.type !== "literal")
                .map(part => [part.type, Number(part.value)])
        );
    }

    // Menghasilkan tanggal hari ini dalam format YYYY-MM-DD
    function tanggalHariIni(date = new Date()) {
        const p = getWITParts(date);

        if (!p) return "-";

        return `${p.year}-${duaDigit(p.month)}-${duaDigit(p.day)}`;
    }

    // Menghasilkan jam sekarang dalam format HH:mm
    function jamSekarang(date = new Date()) {
        const p = getWITParts(date);

        if (!p) return "-";

        return `${duaDigit(p.hour)}:${duaDigit(p.minute)}`;
    }

    // Mengubah tanggal dan jam WIT menjadi objek Date
    function parseWaktu(tanggal, jam) {
        if (
            typeof tanggal !== "string" ||
            typeof jam !== "string" ||
            !POLA_TANGGAL.test(tanggal) ||
            !POLA_JAM.test(jam)
        ) {
            return null;
        }

        const [tahun, bulan, hari] = tanggal.split("-").map(Number);

        // Memastikan tanggal benar dan tidak mengalami rollover
        const pemeriksaan = new Date(0);

        pemeriksaan.setUTCHours(0, 0, 0, 0);
        pemeriksaan.setUTCFullYear(tahun, bulan - 1, hari);

        if (
            pemeriksaan.getUTCFullYear() !== tahun ||
            pemeriksaan.getUTCMonth() !== bulan - 1 ||
            pemeriksaan.getUTCDate() !== hari
        ) {
            return null;
        }

        return keTanggal(`${tanggal}T${jam}:00${OFFSET}`);
    }

    // Memformat tanggal menjadi format Indonesia
    function formatTanggal(tanggal) {
        const hasil = (
            typeof tanggal === "string" &&
            POLA_TANGGAL.test(tanggal)
        )
            ? parseWaktu(tanggal, "00:00")
            : keTanggal(tanggal);

        if (!hasil) return "-";

        return formatterTanggal.format(hasil);
    }

    // Mengubah format jam HH:mm menjadi HH.mm
    function formatJam(jam) {
        if (
            typeof jam !== "string" ||
            !POLA_JAM.test(jam)
        ) {
            return "-";
        }

        return jam.replace(":", ".");
    }

    // Membentuk rentang waktu peminjaman
    function formatRentangJam(mulai, selesai) {
        return `${formatJam(mulai)} - ${formatJam(selesai)} WIT`;
    }

    // Menghitung selisih dua waktu dalam menit
    function selisihMenit(waktuAwal, waktuAkhir = new Date()) {
        const awal = keTanggal(waktuAwal);
        const akhir = keTanggal(waktuAkhir);

        if (!awal || !akhir) return null;

        return Math.floor(
            (akhir.getTime() - awal.getTime()) / 60000
        );
    }

    // Memeriksa validitas rentang waktu peminjaman
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

    // Memeriksa apakah sesi sedang berlangsung
    function sesiBerlangsung(
        tanggal,
        mulai,
        selesai,
        sekarang = new Date()
    ) {
        const rentang = validasiRentang(tanggal, mulai, selesai);
        const waktuSekarang = keTanggal(sekarang);

        if (!rentang.valid || !waktuSekarang) return false;

        const timestamp = waktuSekarang.getTime();

        return timestamp >= rentang.mulai.getTime() &&
            timestamp < rentang.selesai.getTime();
    }

    // Menyediakan fungsi waktu untuk seluruh modul SILAB
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
