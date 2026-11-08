/* Pengelolaan sesi pengguna SILAB */

const sesiSILAB = {

    // Menyimpan identitas dan role pengguna setelah login berhasil.
    simpan(identifier, role) {
        const dataSesi = {
            identifier: identifier,
            role: role
        };

        sessionStorage.setItem(
            "silabSesi",
            JSON.stringify(dataSesi)
        );
    },

    // Mengambil informasi pengguna yang sedang login.
    ambil() {
        const dataSesi = sessionStorage.getItem("silabSesi");

        if (!dataSesi) {
            return null;
        }

        try {
            return JSON.parse(dataSesi);
        } catch (error) {
            sessionStorage.removeItem("silabSesi");
            return null;
        }
    },

    // Menghapus sesi pengguna ketika logout.
    hapus() {
        sessionStorage.removeItem("silabSesi");
    }

};