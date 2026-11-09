(function (window) {
    "use strict";

    //Standar key penyimpanan SILAB
    const KEYS = Object.freeze({
        USERS: "silab_users",
        SESSIONS: "silab_sessions",
        SUBMISSIONS: "silab_submissions",
        RECOMMENDATIONS: "silab_recommendations",
        FACILITIES: "silab_facilities",
        CONFLICTS: "silab_conflicts",
        ALGORITHM_CONFIG: "silab_algorithm_config",
        ATTENDANCE: "silab_attendance"
    });

    //Memeriksa apakah key diizinkan
    function validateKey(key) {
        const allowedKeys = Object.values(KEYS);

        if (!allowedKeys.includes(key)) {
            throw new Error(`Key LocalStorage tidak dikenal: ${key}`);
        }
    }

    //Mengambil data
    function get(key, fallback = null) {
        validateKey(key);

        try {
            const data = localStorage.getItem(key);

            if (data === null) {
                return fallback;
            }

            return JSON.parse(data);

        } catch (error) {
            console.error("Gagal mengambil data:", error);
            return fallback;
        }
    }

    //Menyimpan data
    function set(key, value) {
        validateKey(key);

        try {
            const data = JSON.stringify(value);

            if (data === undefined) {
                throw new Error("Data tidak dapat dikonversi ke JSON.");
            }

            localStorage.setItem(key, data);
            return true;

        } catch (error) {
            console.error("Gagal menyimpan data:", error);
            return false;
        }
    }

    //Memperbarui data
    function update(key, callback, fallback = null) {
        validateKey(key);

        if (typeof callback !== "function") {
            throw new Error("Callback harus berupa function.");
        }

        const currentData = get(key, fallback);

        const updatedData = callback(currentData);

        if (updatedData === undefined) {
            throw new Error("Callback harus mengembalikan data.");
        }

        return set(key, updatedData);
    }

    //Menghapus data berdasarkan key
    function remove(key) {
        validateKey(key);

        try {
            localStorage.removeItem(key);
            return true;

        } catch (error) {
            console.error("Gagal menghapus data:", error);
            return false;
        }
    }

    //Memeriksa keberadaan data
    function exists(key) {
        validateKey(key);

        return localStorage.getItem(key) !== null;
    }

    //Memeriksa ketersediaan LocalStorage
    function isAvailable() {
        try {
            const testKey = "__silab_storage_test__";

            localStorage.setItem(testKey, "test");
            localStorage.removeItem(testKey);

            return true;

        } catch (error) {
            console.error("LocalStorage tidak tersedia:", error);
            return false;
        }
    }

    //enyediakan fungsi untuk seluruh halaman SILAB
    window.SILABStorage = Object.freeze({
        KEYS,
        get,
        set,
        update,
        remove,
        exists,
        isAvailable
    });

})(window);
