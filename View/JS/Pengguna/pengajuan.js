//Mengambil elemen HTML
const peminjamanForm = document.getElementById("peminjamanForm");

const jumlahPCInput = document.getElementById("jumlahPC");
const jumlahKursiInput = document.getElementById("jumlahKursi");

const waktuMulaiInput = document.getElementById("waktuMulai");
const waktuSelesaiInput = document.getElementById("waktuSelesai");

const namaKegiatanInput = document.getElementById("namaKegiatan");

const feedbackElement = document.getElementById("applicationFeedback");

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
    "kategori",
    "namaKegiatan",
  ];

  fields.forEach(clearFieldError);
}

// 3. Mengambil data dari formulir
function getFormData() {
  const kategoriTerpilih = document.querySelector(
    'input[name="kategori"]:checked',
  );

  return {
    jumlahPC: jumlahPCInput.value,
    jumlahKursi: jumlahKursiInput.value,
    waktuMulai: waktuMulaiInput.value,
    waktuSelesai: waktuSelesaiInput.value,
    kategori: kategoriTerpilih ? kategoriTerpilih.value : "",
    namaKegiatan: namaKegiatanInput.value.trim(),
  };
}

function validateForm(data) {
  let isValid = true;

  // Validasi jumlah PC
  if (!SILABValidation.isRequired(data.jumlahPC)) {
    showFieldError("jumlahPC", "Jumlah PC wajib diisi.");
    isValid = false;
  }

  // Validasi jumlah kursi
  if (!SILABValidation.isRequired(data.jumlahKursi)) {
    showFieldError("jumlahKursi", "Jumlah kursi wajib diisi.");
    isValid = false;
  }

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

  // Validasi kategori
  if (!SILABValidation.isRequired(data.kategori)) {
    showFieldError("kategori", "Kategori kegiatan wajib dipilih.");
    isValid = false;
  }

  // Validasi nama kegiatan
  if (!SILABValidation.isRequired(data.namaKegiatan)) {
    showFieldError("namaKegiatan", "Nama kegiatan wajib diisi.");
    isValid = false;
  }

  return isValid;
}



//VALIDASI

// Memvalidasi jumlah PC dan kursi
function validateQuantity(data) {
  let isValid = true;

  const jumlahPC = Number(data.jumlahPC);
  const jumlahKursi = Number(data.jumlahKursi);

  // Validasi jumlah PC
  if (!Number.isInteger(jumlahPC) || jumlahPC <= 0) {
    showFieldError(
      "jumlahPC",
      "Jumlah PC harus berupa bilangan bulat positif.",
    );
    isValid = false;
  }

  // Validasi jumlah kursi
  if (!Number.isInteger(jumlahKursi) || jumlahKursi <= 0) {
    showFieldError(
      "jumlahKursi",
      "Jumlah kursi harus berupa bilangan bulat positif.",
    );
    isValid = false;
  }

  return isValid;
}

// Mengambil konfigurasi kapasitas fasilitas
function getFacilityCapacity() {
  const defaultCapacity = {
    kapasitasPC: 30,
    kapasitasKursi: 30,
  };

  const facilities = SILABStorage.get(
    SILABStorage.KEYS.FACILITIES,
    defaultCapacity,
  );

  // Memastikan konfigurasi tersedia dan valid
  if (
    !facilities ||
    !Number.isInteger(facilities.kapasitasPC) ||
    !Number.isInteger(facilities.kapasitasKursi) ||
    facilities.kapasitasPC <= 0 ||
    facilities.kapasitasKursi <= 0
  ) {
    return null;
  }

  return facilities;
}

// Memvalidasi kapasitas fasilitas
function validateCapacity(data) {
  const capacity = getFacilityCapacity();

  if (!capacity) {
    showFeedback("Konfigurasi kapasitas fasilitas tidak valid.", "error");
    return false;
  }

  let isValid = true;

  const jumlahPC = Number(data.jumlahPC);
  const jumlahKursi = Number(data.jumlahKursi);

  if (jumlahPC > capacity.kapasitasPC) {
    showFieldError(
      "jumlahPC",
      `Kapasitas PC hanya ${capacity.kapasitasPC} unit.`,
    );

    isValid = false;
  }

  if (jumlahKursi > capacity.kapasitasKursi) {
    showFieldError(
      "jumlahKursi",
      `Kapasitas kursi hanya ${capacity.kapasitasKursi} unit.`,
    );

    isValid = false;
  }

  return isValid;
}

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

// Menangani submit formulir
function handleSubmit(event) {
  event.preventDefault();

  // Bersihkan pesan sebelumnya
  clearAllFieldErrors();

  feedbackElement.textContent = "";

  const data = getFormData();

  //Validasi input wajib
  const requiredValid = validateForm(data);

  if (!requiredValid) return;

  //Validasi jumlah fasilitas
  const quantityValid = validateQuantity(data);

  if (!quantityValid) return;

  //Validasi kapasitas fisik
  const capacityValid = validateCapacity(data);

  if (!capacityValid) return;

  //Validasi tanggal dan waktu
  const timeValid = validateBookingTime(data);

  if (!timeValid) return;

  // Jika seluruh validasi berhasil
  showFeedback("Data formulir berhasil melewati validasi.", "success");

  console.log("Data formulir valid:", data);
}

//even listeneer untuk validasi input pc dan jumlah kurasi
[jumlahPCInput, jumlahKursiInput].forEach((input) => {
  input.addEventListener("input", function () {
    const fieldId = input.id;
    const value = input.value;

    clearFieldError(fieldId);

    if (value === "") return;
    const number = Number(value);

    if (!Number.isInteger(number) || number <= 0) {
      showFieldError(
        fieldId,
        "Masukkan bilangan bulat positif, tanpa desimal.",
      );
      return;
    }

    // Periksa kapasitas fasilitas
    const capacity = getFacilityCapacity();

    if (!capacity) {
      showFeedback("Konfigurasi kapasitas fasilitas tidak valid.", "error");
      return;
    }

    const maxCapacity =
      fieldId === "jumlahPC" ? capacity.kapasitasPC : capacity.kapasitasKursi;

    if (number > maxCapacity) {
      showFieldError(
        fieldId,
        `Maksimal fasilitas yang tersedia adalah ${maxCapacity} unit.`,
      );
    }
  });
});

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
