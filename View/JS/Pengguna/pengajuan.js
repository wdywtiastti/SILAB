"use strict";

// =============================================
// SILAB - PENGAJUAN PENGGUNA
// Integrasi API dan database MySQL
// =============================================

const API_PENGAJUAN = "API_pengajuan.php";

// Elemen formulir
const peminjamanForm = document.getElementById("peminjamanForm");
const waktuMulaiInput = document.getElementById("waktuMulai");
const waktuSelesaiInput = document.getElementById("waktuSelesai");
const namaKegiatanInput = document.getElementById("namaKegiatan");

// Container dinamis
const dynamicRuleFields = document.getElementById("dynamicRuleFields");
const dynamicRuleSummary = document.getElementById("dynamicRuleSummary");
const facilityFields = document.getElementById("facilityFields");
const facilityFieldsError = document.getElementById("facilityFieldsError");
const feedbackElement = document.getElementById("applicationFeedback");

// Data konfigurasi
let konfigurasiPengajuan = {
  rules: [],
  facilities: [],
};

let isSubmitting = false;

// =============================================
// FUNGSI PESAN
// =============================================

function showFeedback(message, type = "error") {
  if (!feedbackElement) return;

  feedbackElement.textContent = message;
  feedbackElement.className = `application-feedback ${type}`;
}

function showFieldError(fieldId, message) {
  const input = document.getElementById(fieldId);
  const error = document.getElementById(`${fieldId}Error`);

  if (error) {
    error.textContent = message;
    error.classList.add("show");
  }

  if (input) {
    input.classList.add("input-error");
  }
}

function clearFieldError(fieldId) {
  const input = document.getElementById(fieldId);
  const error = document.getElementById(`${fieldId}Error`);

  if (error) {
    error.textContent = "";
    error.classList.remove("show");
  }

  if (input) {
    input.classList.remove("input-error");
  }
}

function clearAllFieldErrors() {
  ["waktuMulai", "waktuSelesai", "namaKegiatan"].forEach(clearFieldError);

  document
    .querySelectorAll("#dynamicRuleFields select[data-rule-id]")
    .forEach((select) => clearFieldError(select.id));

  document
    .querySelectorAll("#facilityFields input[data-facility-id]")
    .forEach((input) => clearFieldError(input.id));

  if (facilityFieldsError) {
    facilityFieldsError.textContent = "";
    facilityFieldsError.classList.remove("show");
  }
}

// =============================================
// 1. AMBIL DATA DARI API
// =============================================

async function muatKonfigurasiPengajuan() {
  if (dynamicRuleFields) {
    dynamicRuleFields.innerHTML = "<p>Memuat kelompok aturan...</p>";
  }

  if (facilityFields) {
    facilityFields.innerHTML = "<p>Memuat fasilitas laboratorium...</p>";
  }

  try {
    const response = await fetch(`${API_PENGAJUAN}?action=config`, {
      method: "GET",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Gagal mengambil konfigurasi.");
    }

    konfigurasiPengajuan = {
      rules: Array.isArray(result.data.rules) ? result.data.rules : [],

      facilities: Array.isArray(result.data.facilities)
        ? result.data.facilities
        : [],
    };

    console.log("Aturan dari database:", konfigurasiPengajuan.rules);

    console.log("Fasilitas dari database:", konfigurasiPengajuan.facilities);

    // Tampilkan data
    renderDynamicRules();
    renderDynamicFacilities();
  } catch (error) {
    console.error("Kesalahan mengambil konfigurasi:", error);

    if (dynamicRuleFields) {
      dynamicRuleFields.innerHTML = `<p class="field-error show">
                    Gagal memuat aturan: ${error.message}
                </p>`;
    }

    if (facilityFields) {
      facilityFields.innerHTML = `<p class="field-error show">
                    Gagal memuat fasilitas.
                </p>`;
    }

    showFeedback("Data aturan dan fasilitas gagal dimuat.", "error");
  }
}

// =============================================
// 2. TAMPILKAN KELOMPOK ATURAN DAN KRITERIA
// =============================================

function renderDynamicRules() {
  if (!dynamicRuleFields) {
    console.error("Container dynamicRuleFields tidak ditemukan.");
    return;
  }

  dynamicRuleFields.innerHTML = "";

  if (dynamicRuleSummary) {
    dynamicRuleSummary.innerHTML = "";
  }

  const rules = konfigurasiPengajuan.rules.filter((rule) => {
    const nama = String(rule.name || rule.nama_kelompok || "");

    return (
      Array.isArray(rule.criteria) &&
      rule.criteria.length > 0 &&
      !nama.toLowerCase().includes("waktu pengajuan")
    );
  });

  if (rules.length === 0) {
    dynamicRuleFields.innerHTML = `<p class="field-error show">
                Belum ada kelompok aturan dan kriteria.
            </p>`;
    return;
  }

  rules.forEach((rule) => {
    const ruleId = String(rule.id || rule.id_aturan);

    const ruleName = String(rule.name || rule.nama_kelompok);

    const criteria = rule.criteria || [];

    if (criteria.length === 0) return;

    const group = document.createElement("div");
    group.className = "application-group";

    // Label kelompok
    const label = document.createElement("label");

    const selectId = `rule_${ruleId}`;

    label.htmlFor = selectId;
    label.innerHTML = `${ruleName} <span>*</span>`;

    // Dropdown
    const wrapper = document.createElement("div");
    wrapper.className = "application-select";

    const select = document.createElement("select");

    select.id = selectId;
    select.name = "ruleSelections";
    select.className = "application-dynamic-select";
    select.dataset.ruleId = ruleId;
    select.required = true;

    const placeholder = document.createElement("option");

    placeholder.value = "";
    placeholder.textContent = `Pilih ${ruleName}`;

    select.appendChild(placeholder);

    // Masukkan kriteria dari database
    criteria.forEach((item) => {
      const option = document.createElement("option");

      option.value = String(item.id || item.id_aturan_kriteria);

      option.textContent = String(item.name || item.nama_kriteria);

      select.appendChild(option);
    });

    wrapper.appendChild(select);

    // Pesan kesalahan
    const error = document.createElement("small");

    error.className = "field-error";
    error.id = `${selectId}Error`;

    group.append(label, wrapper, error);

    dynamicRuleFields.appendChild(group);

    // Tampilkan kategori di panel samping
    if (dynamicRuleSummary && /jenis\s*kegiatan/i.test(ruleName)) {
      criteria.forEach((item) => {
        const category = document.createElement("div");

        category.className = "application-category-item";

        const text = document.createElement("p");

        text.textContent = item.name || item.nama_kriteria;

        category.appendChild(text);

        dynamicRuleSummary.appendChild(category);
      });
    }
  });
}

// =============================================
// 3. TAMPILKAN FASILITAS DARI DATABASE
// =============================================

function renderDynamicFacilities() {
  if (!facilityFields) {
    console.error("Container facilityFields tidak ditemukan.");
    return;
  }

  facilityFields.innerHTML = "";

  const facilities = konfigurasiPengajuan.facilities;

  if (facilities.length === 0) {
    facilityFields.innerHTML = `<p class="field-error show">
                Belum ada fasilitas laboratorium.
            </p>`;

    return;
  }

  facilities.forEach((facility) => {
    const facilityId = String(facility.id || facility.id_fasilitas);

    const facilityName = String(facility.name || facility.nama_fasilitas);

    const capacity = Number(facility.capacity ?? facility.kapasitas_maksimum);

    const group = document.createElement("div");

    group.className = "application-group";

    // Label fasilitas
    const label = document.createElement("label");

    const inputId = `facility_${facilityId}`;

    label.htmlFor = inputId;

    label.textContent = `${facilityName} (Maks. ${capacity})`;

    // Input jumlah fasilitas
    const input = document.createElement("input");

    input.type = "number";
    input.id = inputId;
    input.name = "facilityQuantities";
    input.className = "application-input";

    input.min = "0";
    input.max = String(capacity);
    input.step = "1";
    input.value = "0";

    input.placeholder = "Masukkan jumlah yang diperlukan";

    input.dataset.facilityId = facilityId;
    input.dataset.facilityName = facilityName;
    input.dataset.facilityCapacity = String(capacity);

    // Pesan kesalahan
    const error = document.createElement("small");

    error.className = "field-error";
    error.id = `${inputId}Error`;

    group.append(label, input, error);

    facilityFields.appendChild(group);
  });
}

// =============================================
// 4. AMBIL DATA FORMULIR
// =============================================

function getFormData() {
  const aturanKriteria = [
    ...document.querySelectorAll("#dynamicRuleFields select[data-rule-id]"),
  ]
    .map((select) => select.value)
    .filter((value) => value !== "");

  const fasilitas = [
    ...document.querySelectorAll("#facilityFields input[data-facility-id]"),
  ].map((input) => ({
    id_fasilitas: Number(input.dataset.facilityId),
    jumlah: Number(input.value || 0),
  }));

  return {
    namaKegiatan: namaKegiatanInput?.value.trim() || "",

    waktuMulai: waktuMulaiInput?.value || "",

    waktuSelesai: waktuSelesaiInput?.value || "",

    aturanKriteria,

    fasilitas,
  };
}

// =============================================
// 5. VALIDASI FORMULIR
// =============================================

function validateForm(data) {
  let valid = true;

  if (!data.waktuMulai) {
    showFieldError("waktuMulai", "Waktu mulai wajib diisi.");

    valid = false;
  }

  if (!data.waktuSelesai) {
    showFieldError("waktuSelesai", "Waktu selesai wajib diisi.");

    valid = false;
  }

  // Validasi kelompok aturan
  const ruleSelects = [
    ...document.querySelectorAll("#dynamicRuleFields select[data-rule-id]"),
  ];

  ruleSelects.forEach((select) => {
    if (!select.value) {
      showFieldError(select.id, "Silakan pilih kriteria.");

      valid = false;
    }
  });

  if (ruleSelects.length === 0) {
    showFeedback("Belum ada kelompok aturan yang tersedia.", "error");

    valid = false;
  }

  // Validasi fasilitas
  const facilityInputs = [
    ...document.querySelectorAll("#facilityFields input[data-facility-id]"),
  ];

  let totalFasilitas = 0;

  facilityInputs.forEach((input) => {
    const jumlah = Number(input.value);

    const kapasitas = Number(input.dataset.facilityCapacity);

    if (!Number.isInteger(jumlah) || jumlah < 0) {
      showFieldError(input.id, "Jumlah harus berupa bilangan bulat minimal 0.");

      valid = false;
      return;
    }

    if (jumlah > kapasitas) {
      showFieldError(input.id, `Jumlah melebihi kapasitas ${kapasitas}.`);

      valid = false;
      return;
    }

    totalFasilitas += jumlah;
  });

  if (facilityInputs.length === 0 || totalFasilitas < 1) {
    if (facilityFieldsError) {
      facilityFieldsError.textContent = "Pilih minimal satu fasilitas.";

      facilityFieldsError.classList.add("show");
    }

    valid = false;
  }

  // Validasi nama kegiatan
  if (!data.namaKegiatan) {
    showFieldError("namaKegiatan", "Nama kegiatan wajib diisi.");

    valid = false;
  } else if (data.namaKegiatan.length > 150) {
    showFieldError("namaKegiatan", "Nama kegiatan maksimal 150 karakter.");

    valid = false;
  }

  return valid;
}

// =============================================
// 6. VALIDASI WAKTU
// =============================================

function validateBookingTime(data) {
  const mulai = new Date(data.waktuMulai);
  const selesai = new Date(data.waktuSelesai);
  const sekarang = new Date();

  if (Number.isNaN(mulai.getTime()) || Number.isNaN(selesai.getTime())) {
    showFeedback("Format waktu tidak valid.", "error");
    return false;
  }

  if (mulai <= sekarang) {
    showFieldError(
      "waktuMulai",
      "Waktu mulai tidak boleh berada di masa lalu.",
    );

    return false;
  }

  if (selesai <= mulai) {
    showFieldError("waktuSelesai", "Waktu selesai harus setelah waktu mulai.");

    return false;
  }

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

  const jamMulai = mulai.getHours() + mulai.getMinutes() / 60;

  const jamSelesai = selesai.getHours() + selesai.getMinutes() / 60;

  if (jamMulai < 6 || jamMulai >= 22) {
    showFieldError("waktuMulai", "Waktu mulai harus antara pukul 06.00–22.00.");

    return false;
  }

  if (jamSelesai > 22) {
    showFieldError(
      "waktuSelesai",
      "Waktu selesai tidak boleh melewati pukul 22.00.",
    );

    return false;
  }

  return true;
}

// =============================================
// 7. KIRIM PENGAJUAN KE DATABASE
// =============================================

async function handleSubmit(event) {
  event.preventDefault();

  if (isSubmitting) return;

  clearAllFieldErrors();

  showFeedback("");

  const data = getFormData();

  if (!validateForm(data)) return;

  if (!validateBookingTime(data)) return;

  isSubmitting = true;

  const submitButton = peminjamanForm.querySelector('button[type="submit"]');

  const originalButtonHTML = submitButton?.innerHTML || "";

  if (submitButton) {
    submitButton.disabled = true;

    submitButton.textContent = "Mengirim Pengajuan...";
  }

  try {
    const response = await fetch(`${API_PENGAJUAN}?action=submit`, {
      method: "POST",

      credentials: "same-origin",

      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },

      body: JSON.stringify({
        action: "submit",
        ...data,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Pengajuan gagal disimpan.");
    }

    showFeedback(
      `${result.message} Nomor pengajuan: ${result.data?.id_pengajuan ?? "-"}`,
      "success",
    );

    peminjamanForm.reset();

    console.log("Pengajuan berhasil disimpan:", result.data);
  } catch (error) {
    console.error("Kesalahan pengiriman:", error);

    showFeedback(
      error.message || "Terjadi kesalahan saat mengirim pengajuan.",
      "error",
    );
  } finally {
    isSubmitting = false;

    if (submitButton) {
      submitButton.disabled = false;

      submitButton.innerHTML = originalButtonHTML;
    }
  }
}

// =============================================
// 8. EVENT LISTENER
// =============================================

if (peminjamanForm) {
  peminjamanForm.addEventListener("submit", handleSubmit);
} else {
  console.error("Form peminjaman tidak ditemukan.");
}

// Hapus pesan kesalahan ketika input diubah

[waktuMulaiInput, waktuSelesaiInput].forEach((input) => {
  input?.addEventListener("change", () => {
    clearFieldError(input.id);
  });
});

namaKegiatanInput?.addEventListener("input", () => {
  clearFieldError("namaKegiatan");
});

dynamicRuleFields?.addEventListener("change", (event) => {
  if (event.target.matches("select[data-rule-id]")) {
    clearFieldError(event.target.id);
  }
});

facilityFields?.addEventListener("input", (event) => {
  if (event.target.matches("input[data-facility-id]")) {
    clearFieldError(event.target.id);

    if (facilityFieldsError) {
      facilityFieldsError.textContent = "";

      facilityFieldsError.classList.remove("show");
    }
  }
});

// =============================================
// 9. JALANKAN SAAT HALAMAN DIBUKA
// =============================================

muatKonfigurasiPengajuan();
