
/**
 * LAYANAN DATA SILAB
 * Mengelola data simulasi dan penyimpanan sementara.
 * Disiapkan agar sumber data dapat dialihkan ke API PHP.
 */

(function (window) {
    "use strict";

    const STORAGE_KEY = "silab_laboran_v1";
    const DATA_SEED = window.SILAB_DATA_SEED;

    // Memastikan data simulasi sudah dimuat.
    if (!DATA_SEED) {
        console.error("SILAB: data_uji.js belum dimuat.");
        return;
    }

    // Menyediakan salinan data agar objek awal tidak berubah.
    function clone(data) {
        return JSON.parse(JSON.stringify(data));
    }

    // Memeriksa apakah nama koleksi tersedia.
    function validasiKoleksi(koleksi) {
        if (!Object.prototype.hasOwnProperty.call(DATA_SEED, koleksi)) {
            throw new Error(`Koleksi "${koleksi}" tidak ditemukan.`);
        }
    }

    // Menyediakan penyimpanan sementara jika localStorage tidak tersedia.
    let memoryStorage = null;

    function bacaPenyimpanan() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.warn("SILAB: menggunakan penyimpanan sementara.", error);
            return memoryStorage;
        }
    }

    function simpanPenyimpanan(data) {
        memoryStorage = clone(data);

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (error) {
            console.warn("SILAB: perubahan hanya tersimpan di memori.", error);
        }

        // Memberi tahu modul lain bahwa data telah berubah.
        window.dispatchEvent(new CustomEvent("silab:data-changed", {
            detail: { data: clone(data) }
        }));
    }

    // Membuat data awal saat aplikasi pertama kali dijalankan.
    function inisialisasi() {
        let data = bacaPenyimpanan();

        const strukturValid = data &&
            Object.keys(DATA_SEED).every(koleksi =>
                Array.isArray(data[koleksi])
            );

        if (!strukturValid) {
            data = clone(DATA_SEED);
            simpanPenyimpanan(data);
        }

        return data;
    }

    // Mengambil seluruh data tersimpan.
    function getData() {
        return clone(inisialisasi());
    }

    // Mengambil seluruh isi satu koleksi.
    function getAll(koleksi) {
        validasiKoleksi(koleksi);
        return getData()[koleksi];
    }

    // Mengambil satu data berdasarkan ID.
    function getById(koleksi, id) {
        validasiKoleksi(koleksi);

        return getAll(koleksi).find(item =>
            String(item.id) === String(id)
        ) || null;
    }

    // Menambahkan data baru ke koleksi.
    function tambah(koleksi, item) {
        validasiKoleksi(koleksi);

        if (!item || !item.id) {
            throw new Error("Data wajib memiliki ID.");
        }

        const data = getData();

        if (data[koleksi].some(existing =>
            String(existing.id) === String(item.id)
        )) {
            throw new Error(`ID "${item.id}" sudah digunakan.`);
        }

        data[koleksi].push(clone(item));
        simpanPenyimpanan(data);

        return clone(item);
    }

    // Memperbarui data berdasarkan ID.
    function update(koleksi, id, perubahan) {
        validasiKoleksi(koleksi);

        const data = getData();
        const index = data[koleksi].findIndex(item =>
            String(item.id) === String(id)
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

        const data = getData();
        const jumlahAwal = data[koleksi].length;

        data[koleksi] = data[koleksi].filter(item =>
            String(item.id) !== String(id)
        );

        if (data[koleksi].length === jumlahAwal) {
            return false;
        }

        simpanPenyimpanan(data);
        return true;
    }

    // Mengembalikan seluruh data ke kondisi awal.
    function reset() {
        const data = clone(DATA_SEED);
        simpanPenyimpanan(data);
        return clone(data);
    }

    // Mengubah status presensi jadwal peminjaman.
    function updatePresensi(bookingId, status) {
        const statusValid = ["digunakan", "tidak_digunakan"];

        if (!statusValid.includes(status)) {
            throw new Error("Status presensi tidak valid.");
        }

        return update("bookings", bookingId, {
            status,
            presensi: {
                status,
                waktuValidasi: new Date().toISOString()
            }
        });
    }

    // Mendengarkan perubahan data dari tab browser lain.
    window.addEventListener("storage", function (event) {
        if (event.key === STORAGE_KEY) {
            window.dispatchEvent(new CustomEvent("silab:data-changed", {
                detail: { external: true }
            }));
        }
    });

    // Inisialisasi penyimpanan saat file dijalankan.
    inisialisasi();

    // API layanan yang dapat digunakan seluruh modul Laboran.
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
