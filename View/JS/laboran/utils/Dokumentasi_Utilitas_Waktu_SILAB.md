# Dokumentasi Utilitas Waktu SILAB

## 1. Identitas Modul

  Informasi                 Keterangan
  ------------------------- -----------------
  Nama file                 `waktu.js`
  Nama objek global         `SILABWaktu`
  Zona waktu operasional    `Asia/Jayapura`
  Offset waktu              `+09:00`
  Format tanggal internal   `YYYY-MM-DD`
  Format jam internal       `HH:mm`
  Format tampilan jam       `HH.mm`

## 2. Tujuan

`waktu.js` merupakan modul utilitas bersama untuk menyediakan fungsi
tanggal dan waktu bagi seluruh modul Laboran SILAB.

Modul ini digunakan agar pengolahan waktu pada dashboard, jadwal
peminjaman, dan validasi presensi menggunakan acuan zona waktu yang
sama, yaitu Waktu Indonesia Timur (WIT).

Modul ini tidak mengatur tampilan halaman atau menyimpan data
peminjaman. Tugasnya terbatas pada pengambilan, pengubahan format,
pemeriksaan, dan perhitungan tanggal serta waktu.

## 3. Struktur dan Cara Kerja

Kode dibungkus menggunakan pola IIFE (*Immediately Invoked Function
Expression*):

``` javascript
(function (window) {
    "use strict";

    // Fungsi utilitas waktu

    window.SILABWaktu = Object.freeze({
        // Fungsi yang dapat digunakan modul lain
    });

})(window);
```

Keterangan:

-   IIFE membungkus kode agar variabel dan fungsi internal tidak
    memenuhi ruang lingkup global.
-   Parameter `window` digunakan untuk menyediakan objek utilitas kepada
    halaman.
-   `"use strict"` menerapkan mode JavaScript yang lebih ketat.
-   `window.SILABWaktu` menjadi akses bersama bagi file JavaScript lain.
-   `Object.freeze()` mencegah properti pada objek layanan tersebut
    ditambah, dihapus, atau diganti setelah dibuat.

## 4. Konfigurasi Zona Waktu

``` javascript
const TIME_ZONE = "Asia/Jayapura";
const OFFSET = "+09:00";
```

-   `TIME_ZONE` digunakan oleh `Intl.DateTimeFormat` untuk mengambil dan
    menampilkan waktu berdasarkan zona WIT.
-   `OFFSET` digunakan saat membentuk tanggal-waktu ISO agar objek
    `Date` merepresentasikan waktu WIT dengan offset UTC+09:00.

Zona waktu menjadi acuan penting karena waktu perangkat pengguna belum
tentu diatur ke WIT.

## 5. Daftar Fungsi

### 5.1 `getWITParts(date = new Date())`

Mengambil komponen tanggal dan waktu berdasarkan WIT.

Komponen yang dikembalikan berupa objek dengan properti:

-   `year`
-   `month`
-   `day`
-   `hour`
-   `minute`
-   `second`

Contoh:

``` javascript
const bagianWaktu = SILABWaktu.getWITParts();

console.log(bagianWaktu.hour);
console.log(bagianWaktu.minute);
```

Parameter `date` bersifat opsional. Jika tidak diberikan, fungsi
menggunakan waktu saat ini.

### 5.2 `tanggalHariIni(date = new Date())`

Menghasilkan tanggal berdasarkan WIT dalam format `YYYY-MM-DD`.

Contoh hasil:

``` text
2026-11-10
```

Contoh penggunaan:

``` javascript
const tanggal = SILABWaktu.tanggalHariIni();
```

Fungsi ini dapat digunakan untuk menentukan tanggal operasional hari
ini.

### 5.3 `jamSekarang(date = new Date())`

Menghasilkan jam dan menit berdasarkan WIT dalam format `HH:mm`.

Contoh hasil:

``` text
04:19
```

Contoh penggunaan:

``` javascript
const jam = SILABWaktu.jamSekarang();
```

### 5.4 `parseWaktu(tanggal, jam)`

Menggabungkan tanggal dan jam WIT menjadi objek `Date`.

Parameter:

-   `tanggal`: format `YYYY-MM-DD`.
-   `jam`: format `HH:mm`.

Fungsi memeriksa format dan validitas tanggal sebelum membentuk objek
`Date` dengan offset `+09:00`.

Contoh:

``` javascript
const waktuMulai = SILABWaktu.parseWaktu(
    "2026-11-10",
    "08:00"
);
```

Jika input tidak valid, fungsi mengembalikan `null`.

### 5.5 `formatTanggal(tanggal)`

Mengubah tanggal menjadi format bahasa Indonesia.

Contoh:

``` javascript
SILABWaktu.formatTanggal("2026-11-10");
```

Hasil:

``` text
10 November 2026
```

Input dapat berupa string tanggal `YYYY-MM-DD` atau nilai tanggal yang
dapat diproses oleh objek `Date`.

### 5.6 `formatJam(jam)`

Mengubah format jam dari titik dua menjadi titik.

Contoh:

``` javascript
SILABWaktu.formatJam("08:00");
```

Hasil:

``` text
08.00
```

Jika format jam tidak valid, fungsi mengembalikan `-`.

### 5.7 `formatRentangJam(mulai, selesai)`

Membentuk rentang waktu peminjaman dengan keterangan WIT.

Contoh:

``` javascript
SILABWaktu.formatRentangJam("08:00", "10:30");
```

Hasil:

``` text
08.00 - 10.30 WIT
```

### 5.8 `selisihMenit(waktuAwal, waktuAkhir = new Date())`

Menghitung selisih waktu dalam satuan menit.

Contoh:

``` javascript
const selisih = SILABWaktu.selisihMenit(
    waktuMulai,
    new Date()
);
```

Hasil berupa bilangan menit yang dibulatkan ke bawah menggunakan
`Math.floor()`.

Jika salah satu nilai waktu tidak valid, fungsi mengembalikan `null`.

**Catatan:** Fungsi ini cocok untuk informasi selisih menit. Untuk
keputusan yang memiliki batas waktu ketat, seperti toleransi presensi 15
menit, gunakan perbandingan timestamp dalam milidetik agar tidak
terpengaruh pembulatan.

### 5.9 `validasiRentang(tanggal, mulai, selesai)`

Memeriksa apakah tanggal, waktu mulai, dan waktu selesai valid.

Pemeriksaan meliputi:

1.  Format tanggal dan jam.
2.  Keabsahan tanggal kalender.
3.  Waktu selesai harus lebih besar daripada waktu mulai.

Contoh:

``` javascript
const hasil = SILABWaktu.validasiRentang(
    "2026-11-10",
    "08:00",
    "10:30"
);

console.log(hasil.valid);
```

Jika valid, hasil berisi:

-   `valid: true`
-   `mulai`: objek `Date`.
-   `selesai`: objek `Date`.

Jika tidak valid, hasil berisi:

-   `valid: false`
-   `pesan`: keterangan kesalahan.

### 5.10 `sesiBerlangsung(tanggal, mulai, selesai, sekarang = new Date())`

Memeriksa apakah waktu saat ini berada dalam rentang sesi peminjaman.

Kondisi yang digunakan:

``` javascript
sekarang >= rentang.mulai &&
sekarang < rentang.selesai
```

Artinya:

-   Pada waktu mulai, sesi sudah dianggap berlangsung.
-   Sebelum waktu mulai, sesi belum berlangsung.
-   Tepat pada waktu selesai, sesi tidak lagi dianggap berlangsung.

Contoh:

``` javascript
const sedangBerlangsung = SILABWaktu.sesiBerlangsung(
    "2026-11-10",
    "08:00",
    "10:30"
);
```

## 6. Cara Mengakses dari File JavaScript Lain

Pastikan `waktu.js` dimuat sebelum file yang menggunakannya.

Contoh urutan pada HTML:

``` html
<script src="../../JS/laboran/utils/waktu.js"></script>
<script src="../../JS/laboran/dashboard/presensi.js"></script>
<script src="../../JS/laboran/dashboard/jadwal.js"></script>
<script src="../../JS/laboran/dashboard/dashboard.js"></script>
```

Setelah dimuat, fungsi dapat dipanggil melalui objek global:

``` javascript
const tanggal = SILABWaktu.tanggalHariIni();
const jam = SILABWaktu.jamSekarang();

console.log(tanggal);
console.log(jam);
```

Jangan memuat `waktu.js` setelah file yang membutuhkan fungsi-fungsinya.

## 7. Hubungan dengan Fitur Dashboard Laboran

  -----------------------------------------------------------------------
  Fitur                               Fungsi waktu yang dapat digunakan
  ----------------------------------- -----------------------------------
  Menentukan tanggal operasional      `tanggalHariIni()`

  Menampilkan jam real-time           `jamSekarang()`

  Menampilkan rentang jadwal          `formatRentangJam()`

  Menentukan sesi yang sedang         `sesiBerlangsung()`
  berlangsung                         

  Memeriksa jadwal peminjaman         `validasiRentang()`

  Menghitung selisih waktu            `selisihMenit()`

  Menentukan batas presensi           `parseWaktu()` dan perbandingan
                                      timestamp
  -----------------------------------------------------------------------

### 7.1 Hubungan dengan validasi presensi 15 menit

Pada sistem SILAB, laboran memiliki batas toleransi konfirmasi presensi
selama 15 menit sejak waktu mulai peminjaman.

`waktu.js` sudah menyediakan fungsi untuk membentuk waktu mulai menjadi
objek `Date`. Namun, aturan presensi 15 menit belum diimplementasikan
sebagai fungsi khusus di file ini.

Contoh dasar pemeriksaan batas waktu:

``` javascript
const waktuMulai = SILABWaktu.parseWaktu(
    tanggalPeminjaman,
    jamMulai
);

const batasPresensi = waktuMulai.getTime() + (15 * 60 * 1000);
const sekarang = Date.now();

const masihDalamBatas = sekarang <= batasPresensi;
```

Contoh tersebut hanya memeriksa batas waktu. Keputusan status presensi
dan penyimpanan hasil validasi tetap menjadi tanggung jawab modul
presensi.

Sesuai aturan sistem yang telah ditetapkan, status peminjaman tetap
**Tidak Digunakan** apabila belum ada validasi presensi. Fungsi waktu
tidak boleh mengubah status peminjaman dengan sendirinya.

## 8. Catatan Teknis dan Batasan

1.  Gunakan `Asia/Jayapura` sebagai acuan waktu operasional SILAB.
2.  Gunakan format `YYYY-MM-DD` untuk tanggal internal.
3.  Gunakan format `HH:mm` untuk jam internal.
4.  Gunakan `formatTanggal()` dan `formatRentangJam()` untuk kebutuhan
    tampilan.
5.  Gunakan objek `Date` dari `parseWaktu()` untuk perhitungan waktu.
6.  Hindari string tanggal-waktu tanpa offset zona waktu ketika
    melakukan perhitungan.
7.  `selisihMenit()` membulatkan hasil ke bawah, sehingga tidak ideal
    sebagai satu-satunya pemeriksaan batas waktu presisi.
8.  `sesiBerlangsung()` hanya memeriksa rentang sesi; fungsi ini tidak
    mengelola presensi atau status peminjaman.
9.  Modul ini tidak melakukan penyimpanan data ke `localStorage`,
    `sessionStorage`, atau database.
10. Fungsi-fungsi yang tersedia tidak memperbarui tampilan secara
    otomatis. Modul dashboard harus memanggilnya sesuai kebutuhan.

## 9. Kesimpulan

`waktu.js` merupakan modul utilitas bersama untuk menyeragamkan
pengolahan tanggal dan waktu pada sistem SILAB.

Fungsi yang tersedia sudah mencakup kebutuhan dasar pengambilan waktu
WIT, pemformatan tanggal dan jam, pemeriksaan rentang jadwal, serta
perhitungan selisih waktu.

Untuk tahap pengembangan dashboard laboran, file ini dapat dipertahankan
sebagai fondasi. Aturan bisnis seperti validasi presensi, perubahan
status peminjaman, dan pengaturan tampilan antrean tetap ditempatkan
pada modul masing-masing agar tanggung jawab setiap file tidak
bercampur.
