//Mengambil elemen HTML
const peminjamanForm = document.getElementById("peminjamanForm");

const jumlahPCInput = document.getElementById("jumlahPC");
const jumlahKursiInput = document.getElementById("jumlahKursi");

const waktuMulaiInput = document.getElementById("waktuMulai");
const waktuSelesaiInput = document.getElementById("waktuSelesai");

const namaKegiatanInput = document.getElementById("namaKegiatan");

const feedbackElement = document.getElementById("applicationFeedback");

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

  //VALIDASI JUMLAH FASILITAS
  if (!validateQuantity(data)) {
    return;
  }

  //VALIDASI KAPASITAS FISIK
  if (!validateCapacity(data)) {
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
    id: generateSubmissionId(submissions),

    userIdentifier: sesi.identifier,

    role: sesi.role,

    jumlahPC: Number(data.jumlahPC),

    jumlahKursi: Number(data.jumlahKursi),

    waktuMulai: data.waktuMulai,

    waktuSelesai: data.waktuSelesai,

    kategori: data.kategori,

    namaKegiatan: data.namaKegiatan,

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
