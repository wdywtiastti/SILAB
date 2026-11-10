(function (window) {
    "use strict";

    const STORAGE_KEY = "silab_laboran_v1";
    const DATA_SEED = window.SILAB_DATA_SEED;

    if (!DATA_SEED) {
        console.error("SILAB: data_uji.js belum dimuat.");
        return;
    }

    const KOLEKSI = Object.keys(DATA_SEED);

    let dataAktif = null;
    let gunakanMemori = false;
    let dataMemori = null;

    // Membuat salinan agar data asli tidak berubah.
    function clone(data) {
        return JSON.parse(JSON.stringify(data));
    }

    // Memastikan koleksi tersedia.
    function validasiKoleksi(koleksi) {
        if (!Object.prototype.hasOwnProperty.call(DATA_SEED, koleksi)) {
            throw new Error(`Koleksi "${koleksi}" tidak ditemukan.`);
        }
    }

    // Memeriksa struktur data penyimpanan.
    function strukturValid(data) {
        return data &&
            typeof data === "object" &&
            !Array.isArray(data) &&
            KOLEKSI.every(koleksi => Array.isArray(data[koleksi]));
    }

    // Membaca data dari localStorage.
    function bacaPenyimpanan() {
        try {
            const tersimpan = window.localStorage.getItem(STORAGE_KEY);
            return tersimpan ? JSON.parse(tersimpan) : null;

        } catch (error) {
            gunakanMemori = true;

            console.warn(
                "SILAB: menggunakan penyimpanan memori.",
                error
            );

            return dataMemori;
        }
    }

    // Memberitahu modul lain ketika data berubah.
    function beritahuPerubahan(detail) {
        window.dispatchEvent(
            new CustomEvent("silab:data-changed", { detail })
        );
    }

    // Menyimpan data dengan fallback ke memori.
    function simpanPenyimpanan(data) {
        const salinan = clone(data);
        dataAktif = salinan;

        if (gunakanMemori) {
            dataMemori = clone(salinan);
        } else {
            try {
                window.localStorage.setItem(
                    STORAGE_KEY,
                    JSON.stringify(salinan)
                );

            } catch (error) {
                gunakanMemori = true;
                dataMemori = clone(salinan);

                console.warn(
                    "SILAB: perubahan disimpan sementara di memori.",
                    error
                );
            }
        }

        beritahuPerubahan({
            data: clone(salinan)
        });
    }

    // Memuat data tersimpan atau menggunakan data awal.
    function inisialisasi() {
        const tersimpan = bacaPenyimpanan();

        if (strukturValid(tersimpan)) {
            dataAktif = clone(tersimpan);

            if (gunakanMemori) {
                dataMemori = clone(dataAktif);
            }
        } else {
            simpanPenyimpanan(DATA_SEED);
        }
    }

    // Mengambil seluruh data.
    function getData() {
        return clone(dataAktif);
    }

    // Mengambil seluruh isi koleksi.
    function getAll(koleksi) {
        validasiKoleksi(koleksi);
        return clone(dataAktif[koleksi]);
    }

    // Mengambil satu data berdasarkan ID.
    function getById(koleksi, id) {
        validasiKoleksi(koleksi);

        const item = dataAktif[koleksi].find(
            item => String(item.id) === String(id)
        );

        return item ? clone(item) : null;
    }

    // Menambahkan data baru.
    function tambah(koleksi, item) {
        validasiKoleksi(koleksi);

        if (
            !item ||
            typeof item !== "object" ||
            Array.isArray(item) ||
            item.id === undefined ||
            item.id === null ||
            String(item.id).trim() === ""
        ) {
            throw new Error("Data wajib memiliki ID yang valid.");
        }

        const data = clone(dataAktif);

        const duplikat = data[koleksi].some(
            existing => String(existing.id) === String(item.id)
        );

        if (duplikat) {
            throw new Error(`ID "${item.id}" sudah digunakan.`);
        }

        data[koleksi].push(clone(item));
        simpanPenyimpanan(data);

        return clone(item);
    }

    // Memperbarui data tanpa mengubah ID.
    function update(koleksi, id, perubahan) {
        validasiKoleksi(koleksi);

        if (
            !perubahan ||
            typeof perubahan !== "object" ||
            Array.isArray(perubahan)
        ) {
            throw new Error("Perubahan data tidak valid.");
        }

        const data = clone(dataAktif);

        const index = data[koleksi].findIndex(
            item => String(item.id) === String(id)
        );

        if (index === -1) {
            throw new Error(`Data dengan ID "${id}" tidak ditemukan.`);
        }

        data[koleksi][index] = {
            ...data[koleksi][index],
            ...clone(perubahan),
            id: data[koleksi][index].id
        };

        simpanPenyimpanan(data);

        return clone(data[koleksi][index]);
    }

    // Menghapus data berdasarkan ID.
    function hapus(koleksi, id) {
        validasiKoleksi(koleksi);

        const data = clone(dataAktif);
        const jumlahAwal = data[koleksi].length;

        data[koleksi] = data[koleksi].filter(
            item => String(item.id) !== String(id)
        );

        if (data[koleksi].length === jumlahAwal) {
            return false;
        }

        simpanPenyimpanan(data);
        return true;
    }

    // Mengembalikan data ke kondisi awal.
    function reset() {
        const data = clone(DATA_SEED);
        simpanPenyimpanan(data);

        return clone(data);
    }

    // Menyimpan hasil validasi tanpa mengubah status peminjaman.
    function updatePresensi(bookingId, status) {
        const statusValid = [
            "digunakan",
            "tidak_digunakan"
        ];

        if (!statusValid.includes(status)) {
            throw new Error("Status presensi tidak valid.");
        }

        return update("bookings", bookingId, {
            presensi: {
                status,
                waktuValidasi: new Date().toISOString()
            }
        });
    }

    // Memperbarui data ketika localStorage berubah di tab lain.
    window.addEventListener("storage", function (event) {
        if (event.key !== STORAGE_KEY || gunakanMemori) {
            return;
        }

        if (event.newValue === null) {
            dataAktif = clone(DATA_SEED);

            beritahuPerubahan({
                data: clone(dataAktif),
                external: true
            });

            return;
        }

        try {
            const dataBaru = JSON.parse(event.newValue);

            if (!strukturValid(dataBaru)) {
                return;
            }

            dataAktif = clone(dataBaru);

            beritahuPerubahan({
                data: clone(dataAktif),
                external: true
            });

        } catch (error) {
            console.warn(
                "SILAB: gagal membaca perubahan dari tab lain.",
                error
            );
        }
    });

    inisialisasi();

    // Menyediakan layanan data untuk seluruh modul Laboran.
    window.SILABService = Object.freeze({
        getData,
        getAll,
        getById,
        tambah,
        update,
        hapus,
        reset,
        updatePresensi
    });

})(window);
