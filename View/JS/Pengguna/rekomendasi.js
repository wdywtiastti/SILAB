/* =========================================
   SILAB - AKSI REKOMENDASI JADWAL
   SIMULASI TANPA DATABASE
========================================= */

(() => {
  "use strict";

  // =====================================
  // IDENTITAS PROFIL PENGGUNA
  // =====================================

  function tampilkanIdentitasNavbar() {
    const sesi = sesiSILAB.ambil();

    if (!sesi || !sesi.identifier || sesi.role !== "pengguna") {
      window.location.href = "../auth/login.html";
      return null;
    }

    const users = SILABStorage.get(SILABStorage.KEYS.USERS, []);

    if (!Array.isArray(users)) return null;

    const akun = users.find(
      (user) => String(user.nipNpm).trim() === String(sesi.identifier).trim(),
    );

    if (!akun || akun.status !== "aktif") {
      window.location.href = "../auth/login.html";
      return null;
    }

    const navbarName = document.getElementById("userNavbarName");
    const profileName = document.getElementById("profileUserName");

    if (navbarName) navbarName.textContent = akun.nama;
    if (profileName) profileName.textContent = akun.nama;

    return akun;
  }

  const akunLogin = tampilkanIdentitasNavbar();

  if (!akunLogin) return;

  // =====================================
  // 1. AMBIL ELEMEN HTML
  // =====================================

  const radioPilihan = document.querySelectorAll(
    'input[name="pilihan-jadwal"]',
  );

  const btnTerima = document.querySelector("#btn-accept-recommendation");

  const namaPilihan = document.querySelector("#selected-schedule-name");

  const waktuPilihan = document.querySelector("#selected-schedule-time");

  const modalTerima = document.querySelector("#accept-modal");

  const namaKonfirmasi = document.querySelector("#confirmation-name");

  const waktuKonfirmasi = document.querySelector("#confirmation-time");

  const feedback = document.querySelector("#recommendation-feedback");

  if (!btnTerima || !modalTerima || radioPilihan.length === 0) {
    console.error("Elemen rekomendasi belum lengkap. Periksa HTML.");
    return;
  }

  // =====================================
  // 2. STATUS SIMULASI
  // =====================================

  const statusRekomendasi = {
    pilihan: null,
    keputusan: "menunggu",
  };

  // =====================================
  // 3. MENGAMBIL DETAIL PILIHAN
  // =====================================

  function getDetailPilihan(radio) {
    const card = radio.closest(".recommendation-option");

    if (!card) return null;

    const nama = card.querySelector(".recommendation-date h3");

    const waktu = card.querySelector(".recommendation-session");

    const jenis = card.querySelector(".recommendation-type");

    return {
      value: radio.value,
      nama: nama?.textContent.trim() || "Jadwal rekomendasi",
      waktu: waktu?.textContent.trim() || "Waktu tidak tersedia",
      jenis: jenis?.textContent.trim() || "Rekomendasi",
    };
  }

  // =====================================
  // 4. NOTIFIKASI
  // =====================================

  function tampilkanFeedback(pesan, error = false) {
    feedback.textContent = pesan;

    feedback.classList.toggle("error", error);
    feedback.classList.add("show");

    window.setTimeout(() => {
      feedback.classList.remove("show");
    }, 3500);
  }

  // =====================================
  // 5. MEMILIH REKOMENDASI
  // =====================================

  function pilihJadwal(radio) {
    if (statusRekomendasi.keputusan !== "menunggu") {
      return;
    }

    const detail = getDetailPilihan(radio);

    if (!detail) return;

    statusRekomendasi.pilihan = detail;

    namaPilihan.textContent = detail.nama;
    waktuPilihan.textContent = detail.waktu;

    btnTerima.disabled = false;

    document.querySelectorAll(".recommendation-option").forEach((option) => {
      option.classList.remove("is-selected");
    });

    radio.closest(".recommendation-option").classList.add("is-selected");
  }

  radioPilihan.forEach((radio) => {
    radio.addEventListener("change", () => {
      pilihJadwal(radio);
    });
  });

  // =====================================
  // 6. BUKA MODAL KONFIRMASI
  // =====================================

  btnTerima.addEventListener("click", () => {
    if (
      !statusRekomendasi.pilihan ||
      statusRekomendasi.keputusan !== "menunggu"
    ) {
      tampilkanFeedback(
        "Silakan pilih rekomendasi jadwal terlebih dahulu.",
        true,
      );
      return;
    }

    namaKonfirmasi.textContent = statusRekomendasi.pilihan.nama;

    waktuKonfirmasi.textContent = statusRekomendasi.pilihan.waktu;

    modalTerima.classList.add("show");
  });

  // =====================================
  // 7. TUTUP MODAL
  // =====================================

  function tutupModal() {
    modalTerima.classList.remove("show");
  }

  document
    .querySelector("#btn-cancel-accept")
    .addEventListener("click", tutupModal);

  document
    .querySelector(".recommendation-modal-backdrop")
    .addEventListener("click", tutupModal);

  // =====================================
  // 8. KONFIRMASI PENERIMAAN
  // =====================================

  document
    .querySelector("#btn-confirm-accept")
    .addEventListener("click", () => {
      if (!statusRekomendasi.pilihan) return;

      statusRekomendasi.keputusan = "diterima";

      tutupModal();

      radioPilihan.forEach((radio) => {
        radio.disabled = true;
      });

      btnTerima.disabled = true;
      btnTerima.textContent = "Pilihan Berhasil Dikirim";

      tampilkanFeedback(
        "Pilihan rekomendasi berhasil dikirim. Menunggu konfirmasi sistem.",
      );

      console.log("Keputusan rekomendasi:", statusRekomendasi);
    });

  // =====================================
  // 9. PENOLAKAN REKOMENDASI
  // =====================================

  const modalTolak = document.querySelector("#reject-modal");

  const btnTolak = document.querySelector(".btn-reject-confirm");

  const linkBatal = document.querySelector(".btn-reject-cancel");

  const backdropTolak = document.querySelector(".reject-modal-backdrop");
  const linkTolak = document.querySelector(".recommendation-reject");

  if (linkTolak && modalTolak) {
    linkTolak.addEventListener("click", (event) => {
      event.preventDefault();

      if (statusRekomendasi.keputusan !== "menunggu") {
        return;
      }

      modalTolak.classList.add("show");
    });
  }

  if (linkBatal) {
    linkBatal.addEventListener("click", (event) => {
      event.preventDefault();
      modalTolak.classList.remove("show");
    });
  }

  // Tutup modal ketika backdrop diklik
  if (backdropTolak) {
    backdropTolak.addEventListener("click", (event) => {
      event.preventDefault();
      modalTolak.classList.remove("show");
    });
  }

  if (btnTolak) {
    btnTolak.addEventListener("click", (event) => {
      event.preventDefault();

      if (statusRekomendasi.keputusan !== "menunggu") {
        return;
      }

      statusRekomendasi.keputusan = "ditolak";

      modalTolak.classList.remove("show");

      radioPilihan.forEach((radio) => {
        radio.disabled = true;
      });

      btnTerima.disabled = true;

      tampilkanFeedback(
        "Rekomendasi ditolak. Silakan lanjutkan pengajuan waktu lain secara manual.",
      );

      console.log("Rekomendasi ditolak:", statusRekomendasi);
    });
  }

  // =====================================
  // 10. API PENGUJIAN CONSOLE
  // =====================================

  window.SILABRekomendasiDemo = {
    lihat: () => structuredClone(statusRekomendasi),

    render: () => {
      const terpilih = document.querySelector(
        'input[name="pilihan-jadwal"]:checked',
      );

      if (terpilih) {
        pilihJadwal(terpilih);
      }
    },
  };

  console.log("Aksi rekomendasi SILAB berhasil diinisialisasi.");
})();
