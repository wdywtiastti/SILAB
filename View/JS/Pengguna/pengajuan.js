//Mengambil elemen HTML
const peminjamanForm = document.getElementById("peminjamanForm");
const waktuMulaiInput = document.getElementById("waktuMulai");
const waktuSelesaiInput = document.getElementById("waktuSelesai");

const namaKegiatanInput = document.getElementById("namaKegiatan");

const feedbackElement = document.getElementById("applicationFeedback");

// =========================================
// KONFIGURASI KEPALA LAB
// =========================================

function getAlgorithmConfig() {
  const config = SILABStorage.get(SILABStorage.KEYS.ALGORITHM_CONFIG, null);

  return {
    rules: Array.isArray(config?.rules) ? config.rules : [],

    facilities: Array.isArray(config?.facilities) ? config.facilities : [],
  };
}
// =========================================
// DROPDOWN ATURAN DINAMIS
// =========================================

function renderDynamicRules() {
  const container = document.getElementById("dynamicRuleFields");

  const summary = document.getElementById("dynamicRuleSummary");

  if (!container) return;

  container.innerHTML = "";

  if (summary) {
    summary.innerHTML = "";
  }

  const config = getAlgorithmConfig();

  // Hanya aturan yang mempunyai kriteria
  // yang ditampilkan sebagai dropdown.
  const rules = config.rules.filter((rule) => {
    return (
      Array.isArray(rule.criteria) &&
      rule.criteria.length > 0 &&
      !String(rule.name).toLowerCase().includes("waktu pengajuan")
    );
  });
  const activeRules = rules
    .map((rule) => ({
      ...rule,
      criteria: rule.criteria.filter((item) => item.active !== false),
    }))
    .filter((rule) => rule.criteria.length > 0);

  if (rules.length === 0) {
    container.innerHTML = `
      <p class="field-error">
        Belum ada aturan pilihan yang dibuat Kepala Lab.
      </p>
    `;
    return;
  }

  activeRules.forEach((rule) => {
    const group = document.createElement("div");

    group.className = "application-group";

    const label = document.createElement("label");

    const fieldId = `rule_${rule.id}`;

    label.htmlFor = fieldId;
    label.innerHTML = `${escapeHTML(rule.name)} <span>*</span>`;

    const wrapper = document.createElement("div");

    wrapper.className = "application-select";

    const select = document.createElement("select");

    select.id = fieldId;
    select.name = "ruleSelections";
    select.className = "application-dynamic-select";

    select.dataset.ruleId = rule.id;

    select.required = true;

    const placeholder = document.createElement("option");

    placeholder.value = "";
    placeholder.textContent = `Pilih ${rule.name}`;

    select.appendChild(placeholder);

    const criteria = [...rule.criteria]
      .filter((item) => item.active !== false)
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

    criteria.forEach((item) => {
      const option = document.createElement("option");

      option.value = item.id;
      option.textContent = item.name;

      select.appendChild(option);
    });

    wrapper.appendChild(select);

    const error = document.createElement("small");

    error.className = "field-error";
    error.id = `${fieldId}Error`;

    group.append(label, wrapper, error);

    container.appendChild(group);

    // Panel Kategori hanya menampilkan kriteria Jenis Kegiatan.
    if (summary && /jenis\s*kegiatan/i.test(rule.name)) {
      criteria.forEach((criteriaItem) => {
        const item = document.createElement("div");

        const description = document.createElement("p");
        description.textContent = criteriaItem.name;

        item.appendChild(description);
        summary.appendChild(item);
      });
    }
  });
}

// Mencegah HTML dari nama aturan menjadi kode.
function escapeHTML(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character],
  );
}

// =========================================
// DROPDOWN FASILITAS DINAMIS
// =========================================

function renderDynamicFacilities() {
  const container = document.getElementById("facilityFields");

  if (!container) return;

  container.innerHTML = "";

  const config = getAlgorithmConfig();

  const facilities = config.facilities.filter(
    (facility) => facility.active !== false,
  );

  if (facilities.length === 0) {
    container.innerHTML = `
      <p class="field-error show">
        Belum ada fasilitas yang tersedia.
      </p>
    `;
    return;
  }

  facilities.forEach((facility) => {
    const group = document.createElement("div");

    group.className = "application-group";

    const label = document.createElement("label");

    const inputId = `facility_${facility.id}`;

    label.htmlFor = inputId;
    label.textContent = facility.name;

    const input = document.createElement("input");

    input.type = "number";
    input.id = inputId;
    input.name = "facilityQuantities";
    input.className = "application-input";

    input.min = "0";
    input.max = String(Number(facility.capacity) || 0);
    input.step = "1";
    input.value = "0";

    input.dataset.facilityId = facility.id;
    input.dataset.facilityName = facility.name;
    input.dataset.facilityCapacity = facility.capacity;

    input.placeholder = "Masukkan jumlah yang diperlukan";

    const error = document.createElement("small");

    error.className = "field-error";
    error.id = `${inputId}Error`;

    group.append(label, input, error);

    container.appendChild(group);
  });
}

let isSubmitting = false;

//Menampilkan pesan kepada pengguna
function showFeedback(message, type = "error") {
  feedbackElement.textContent = message;
  feedbackElement.className = `application-feedback ${type}`;
}

// Menampilkan pesan kesalahan di bawah input
function showFieldError(fieldId, message) {
  const input = document.getElementById(fieldId);
  const error = document.getElementById(fieldId + "Error");

  if (!input || !error) return;

  error.textContent = message;
  input.classList.add("input-error");
}

// Menghapus pesan kesalahan
function clearFieldError(fieldId) {
  const input = document.getElementById(fieldId);
  const error = document.getElementById(fieldId + "Error");

  if (!input || !error) return;

  error.textContent = "";
  input.classList.remove("input-error");
}

// Menghapus seluruh pesan kesalahan
function clearAllFieldErrors() {
  const fields = [
    "jumlahPC",
    "jumlahKursi",
    "waktuMulai",
    "waktuSelesai",
    "namaKegiatan",
  ];

  // Bersihkan error fasilitas dinamis.
  document.querySelectorAll("#facilityFields .field-error").forEach((error) => {
    error.textContent = "";
    error.classList.remove("show");
  });

  // Hapus border merah seluruh input fasilitas.
  document
    .querySelectorAll("#facilityFields input[data-facility-id]")
    .forEach((input) => {
      input.classList.remove("input-error");
    });

  const facilityError = document.getElementById("facilityFieldsError");

  if (facilityError) {
    facilityError.textContent = "";
    facilityError.classList.remove("show");
  }

  // Bersihkan error seluruh dropdown aturan.
  document
    .querySelectorAll("#dynamicRuleFields select[data-rule-id]")
    .forEach((select) => clearFieldError(select.id));
}

// 3. Mengambil data dari formulir
function getFormData() {
  const ruleSelections = {};

  document
    .querySelectorAll("#dynamicRuleFields select[data-rule-id]")
    .forEach((select) => {
      const ruleId = select.dataset.ruleId;

      const rule = getAlgorithmConfig().rules.find(
        (item) => item.id === ruleId,
      );

      const criteria = rule?.criteria.find((item) => item.id === select.value);

      ruleSelections[ruleId] = {
        ruleId,
        ruleName: rule?.name || "",
        criteriaId: criteria?.id || "",
        criteriaName: criteria?.name || "",
      };
    });

  return {
    waktuMulai: waktuMulaiInput.value,
    waktuSelesai: waktuSelesaiInput.value,

    tanggal: waktuMulaiInput.value ? waktuMulaiInput.value.split("T")[0] : "",

    ruleSelections,

    facilityRequests: [
      ...document.querySelectorAll("#facilityFields input[data-facility-id]"),
    ].map((input) => ({
      facilityId: input.dataset.facilityId,
      facilityName: input.dataset.facilityName,
      quantity: input.value === "" ? 0 : Number(input.value),
    })),

    namaKegiatan: namaKegiatanInput.value.trim(),
  };
}

// =========================================
// MENGAMBIL IDENTITAS PENGGUNA LOGIN
// =========================================

function getIdentitasPemohon(sesi) {
  if (!sesi || !sesi.identifier || sesi.role !== "pengguna") {
    return null;
  }

  const users = SILABStorage.get(SILABStorage.KEYS.USERS, []);

  if (!Array.isArray(users)) return null;

  const user = users.find(
    (item) => String(item.nipNpm).trim() === String(sesi.identifier).trim(),
  );

  if (!user || user.status !== "aktif" || !user.id) {
    return null;
  }

  return {
    userId: user.id,
    userIdentifier: user.nipNpm,
    namaPemohon: user.nama,
    nipNpm: user.nipNpm,
  };
}

document
  .getElementById("dynamicRuleFields")
  ?.addEventListener("change", (event) => {
    if (event.target.matches("select[data-rule-id]")) {
      clearFieldError(event.target.id);
    }
  });

function validateForm(data) {
  let isValid = true;

  // Validasi waktu mulai
  if (!SILABValidation.isRequired(data.waktuMulai)) {
    showFieldError("waktuMulai", "Waktu mulai wajib diisi.");
    isValid = false;
  }

  // Validasi waktu selesai
  if (!SILABValidation.isRequired(data.waktuSelesai)) {
    showFieldError("waktuSelesai", "Waktu selesai wajib diisi.");
    isValid = false;
  }

  // Validasi seluruh aturan dinamis.
  Object.values(data.ruleSelections).forEach((selection) => {
    if (!selection.criteriaId) {
      showFieldError(
        `rule_${selection.ruleId}`,
        `Silakan pilih ${selection.ruleName}.`,
      );

      isValid = false;
    }
  });

  // =====================================
  // VALIDASI FASILITAS DINAMIS
  // =====================================

  const facilityInputs = document.querySelectorAll(
    "#facilityFields input[data-facility-id]",
  );

  let totalFasilitasDiminta = 0;

  facilityInputs.forEach((input) => {
    const quantity = Number(input.value);

    const error = document.getElementById(input.id + "Error");

    input.classList.remove("input-error");

    if (error) {
      error.textContent = "";
      error.classList.remove("show");
    }

    // Jumlah harus bilangan bulat dan tidak negatif.
    if (!Number.isInteger(quantity) || quantity < 0) {
      if (error) {
        error.textContent = "Jumlah harus berupa bilangan bulat minimal 0.";

        error.classList.add("show");
      }

      input.classList.add("input-error");

      isValid = false;
      return;
    }
    // Validasi batas maksimum fasilitas.
    const maxCapacity = Number(input.dataset.facilityCapacity);

    if (quantity > maxCapacity) {
      if (error) {
        error.textContent = `Jumlah melebihi batas maksimum. Maksimal ${maxCapacity} unit.`;

        error.classList.add("show");
      }

      input.classList.add("input-error");

      isValid = false;
      return;
    }

    if (quantity > 0) {
      totalFasilitasDiminta += quantity;
    }
  });

  // Minimal satu fasilitas harus diminta.
  if (totalFasilitasDiminta === 0) {
    const error = document.getElementById("facilityFieldsError");

    if (error) {
      error.textContent = "Pilih minimal satu fasilitas yang diperlukan.";

      error.classList.add("show");
    }

    isValid = false;
  }
  // Validasi nama kegiatan
  if (!SILABValidation.isRequired(data.namaKegiatan)) {
    showFieldError("namaKegiatan", "Nama kegiatan wajib diisi.");
    isValid = false;
  }

  return isValid;
}

document
  .getElementById("facilityFields")
  ?.addEventListener("input", (event) => {
    if (!event.target.matches("[data-facility-id]")) return;

    const error = document.getElementById("facilityFieldsError");

    if (error) {
      error.textContent = "";
      error.classList.remove("show");
    }

    const fieldError = document.getElementById(event.target.id + "Error");

    if (fieldError) {
      fieldError.textContent = "";
      fieldError.classList.remove("show");
    }
  });

//validasi tanggal dan waktu
function validateBookingTime(data) {
  // Bersihkan pesan sebelumnya
  clearFieldError("waktuMulai");
  clearFieldError("waktuSelesai");

  const mulai = new Date(data.waktuMulai);
  const selesai = new Date(data.waktuSelesai);
  const sekarang = new Date();

  //validasi format
  if (Number.isNaN(mulai.getTime())) {
    showFieldError("waktuMulai", "Tanggal dan waktu mulai tidak valid.");
    return false;
  }
  if (Number.isNaN(selesai.getTime())) {
    showFieldError("waktuSelesai", "Tanggal dan waktu selesai tidak valid.");
    return false;
  }

  let isValid = true;

  //validasi waktu mulai
  if (mulai <= sekarang) {
    showFieldError(
      "waktuMulai",
      "Waktu mulai tidak boleh berada di masa lalu.",
    );
    isValid = false;
  } else {
    const jamMulai = mulai.getHours() + mulai.getMinutes() / 60;

    if (jamMulai < 6 || jamMulai >= 22) {
      showFieldError(
        "waktuMulai",
        "Waktu mulai harus berada antara pukul 06.00–22.00 WIT.",
      );
      isValid = false;
    }
  }

  //pergantian tangal
  const tanggalSama =
    mulai.getFullYear() === selesai.getFullYear() &&
    mulai.getMonth() === selesai.getMonth() &&
    mulai.getDate() === selesai.getDate();

  if (!tanggalSama) {
    showFieldError(
      "waktuSelesai",
      "Peminjaman tidak boleh melewati pergantian tanggal.",
    );
    return false;
  }

  if (selesai <= mulai) {
    showFieldError(
      "waktuSelesai",
      "Waktu selesai harus lebih besar dari waktu mulai.",
    );
    return false;
  }

  const jamSelesai = selesai.getHours() + selesai.getMinutes() / 60;
  if (jamSelesai > 22) {
    showFieldError(
      "waktuSelesai",
      "Waktu selesai tidak boleh melewati pukul 22.00 WIT.",
    );
    isValid = false;
  }

  return isValid;
}

//Membuat ID pengguna otomatis
function generateSubmissionId(submissions) {
  const sekarang = new Date();

  const tahun = sekarang.getFullYear();
  const bulan = String(sekarang.getMonth() + 1).padStart(2, "0");
  const tanggal = String(sekarang.getDate()).padStart(2, "0");

  const tanggalID = `${tahun}${bulan}${tanggal}`;

  const prefix = `REQ-${tanggalID}-`;

  let nomorTerakhir = 0;

  submissions.forEach((submission) => {
    if (
      typeof submission.id !== "string" ||
      !submission.id.startsWith(prefix)
    ) {
      return;
    }

    const nomor = Number(submission.id.substring(prefix.length));

    if (Number.isInteger(nomor) && nomor > nomorTerakhir) {
      nomorTerakhir = nomor;
    }
  });

  const nomorBaru = String(nomorTerakhir + 1).padStart(3, "0");

  return `${prefix}${nomorBaru}`;
}

//validasi input waktu
[waktuMulaiInput, waktuSelesaiInput].forEach((input) => {
  input.addEventListener("change", function () {
    const data = getFormData();

    clearFieldError(input.id);

    if (data.waktuMulai && data.waktuSelesai) {
      validateBookingTime(data);
    }
  });
});

// Menghapus error kategori ketika dipilih
document.querySelectorAll('input[name="kategori"]').forEach((radio) => {
  radio.addEventListener("change", function () {
    clearFieldError("kategori");
  });
});

// Menghapus error nama kegiatan ketika mulai diketik
namaKegiatanInput.addEventListener("input", function () {
  if (SILABValidation.isRequired(this.value)) {
    clearFieldError("namaKegiatan");
  }
});

// Memasang event submit
if (peminjamanForm) {
  peminjamanForm.addEventListener("submit", handleSubmit);
} else {
  console.error("Form peminjaman tidak ditemukan.");
}

//submit pengajuan
function handleSubmit(event) {
  event.preventDefault();

  if (isSubmitting) return;

  // Bersihkan pesan sebelumnya
  clearAllFieldErrors();
  feedbackElement.textContent = "";

  // Mengambil data formulir
  const data = getFormData();

  //VALIDASI INPUT WAJIB
  if (!validateForm(data)) {
    return;
  }

  //VALIDASI TANGGAL DAN WAKTU
  if (!validateBookingTime(data)) {
    return;
  }

  //MEMERIKSA SESI PENGGUNA
  const sesi = sesiSILAB.ambil();
  if (!sesi || !sesi.identifier || sesi.role !== "pengguna") {
    showFeedback(
      "Sesi pengguna tidak ditemukan. Silakan login kembali.",
      "error",
    );
    return;
  }
  // =====================================
  // MENGAMBIL IDENTITAS AKUN
  // =====================================

  const identitas = getIdentitasPemohon(sesi);

  if (!identitas) {
    showFeedback(
      "Identitas akun tidak ditemukan atau akun tidak aktif. Silakan login kembali.",
      "error",
    );

    return;
  }

  //MEMERIKSA LOCAL STORAGE
  if (!SILABStorage.isAvailable()) {
    showFeedback("Penyimpanan tidak tersedia. Silakan coba kembali.", "error");
    return;
  }

  // Mengambil data pengajuan sebelumnya
  const submissions = SILABStorage.get(SILABStorage.KEYS.SUBMISSIONS, []);
  if (!Array.isArray(submissions)) {
    showFeedback("Data pengajuan sebelumnya tidak valid.", "error");
    return;
  }

  //MEMBUAT DATA PENGAJUAN

  const pengajuanBaru = {
    // Identitas pengajuan
    id: generateSubmissionId(submissions),

    // Identitas pengguna
    // IDENTITAS PEMOHON
    userId: identitas.userId,
    userIdentifier: identitas.userIdentifier,
    namaPemohon: identitas.namaPemohon,
    nipNpm: identitas.nipNpm,
    role: "pengguna",

    // Tanggal peminjaman
    tanggal: data.tanggal,

    // Waktu
    waktuMulai: data.waktuMulai,
    waktuSelesai: data.waktuSelesai,

    // Kegiatan
    // Aturan dan pilihan dari Kepala Lab.
    ruleSelections: data.ruleSelections,

    // Kompatibilitas dengan riwayat lama.
    kategori:
      Object.values(data.ruleSelections).find((item) =>
        /kategori|jenis kegiatan/i.test(item.ruleName),
      )?.criteriaName || "",

    // Daftar fasilitas dan jumlah yang diminta.
    // Daftar seluruh fasilitas yang diminta.
    facilityRequests: data.facilityRequests.filter((item) => item.quantity > 0),

    // Kompatibilitas dengan sistem lama.
    facilityId:
      data.facilityRequests.find((item) => item.quantity > 0)?.facilityId || "",

    facilityName:
      data.facilityRequests.find((item) => item.quantity > 0)?.facilityName ||
      "",

    // Nama kegiatan.
    namaKegiatan: data.namaKegiatan,

    // Status awal
    status: "menunggu_verifikasi",

    createdAt: new Date().toISOString(),
  };

  // Mencegah pengiriman berulang
  isSubmitting = true;

  const submitButton = peminjamanForm.querySelector('button[type="submit"]');

  submitButton.disabled = true;
  submitButton.innerHTML = `
    <span>Mengirim Pengajuan...</span>
  `;

  // Tambahkan pengajuan baru
  submissions.push(pengajuanBaru);

  // Simpan ke LocalStorage
  const berhasil = SILABStorage.set(SILABStorage.KEYS.SUBMISSIONS, submissions);

  // Jika penyimpanan gagal
  if (!berhasil) {
    isSubmitting = false;

    submitButton.disabled = false;
    submitButton.innerHTML = `
      Kirim Pengajuan Peminjaman
      <i class="bi bi-send"></i>
    `;

    showFeedback("Gagal menyimpan pengajuan. Silakan coba kembali.", "error");

    return;
  }

  // Jika penyimpanan berhasil
  showFeedback(
    `Pengajuan berhasil dikirim. ID: ${pengajuanBaru.id}`,
    "success",
  );

  console.log("Pengajuan berhasil disimpan:", pengajuanBaru);
}

/* =========================================
   IDENTITAS NAVBAR PENGGUNA
========================================= */

function tampilkanIdentitasNavbar() {
  const sesi = sesiSILAB.ambil();

  if (!sesi || sesi.role !== "pengguna") {
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

  if (navbarName) {
    navbarName.textContent = akun.nama;
  }

  if (profileName) {
    profileName.textContent = akun.nama;
  }

  return akun;
}

// Memuat konfigurasi Kepala Lab.
renderDynamicRules();

renderDynamicFacilities();

// Jalankan identitas navbar
const akunLogin = tampilkanIdentitasNavbar();

const config = getAlgorithmConfig();

console.log("DATA ATURAN:", config.rules);
console.log("DATA FASILITAS:", config.facilities);

console.log(
  "JUMLAH DROPDOWN ATURAN:",
  document.querySelectorAll("#dynamicRuleFields select").length,
);

console.log(
  "JUMLAH INPUT FASILITAS:",
  document.querySelectorAll("#facilityFields input[data-facility-id]").length,
);

console.log("DATA INPUT FASILITAS:", getFormData().facilityRequests);
