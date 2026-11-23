<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=UTF-8');
date_default_timezone_set('Asia/Jayapura');

/*
==================================================
1. RESPONSE JSON
==================================================
*/

function responsJSON(
    bool $success,
    string $message,
    int $httpCode = 200,
    array $data = []
): void {

    http_response_code($httpCode);

    echo json_encode([
        'success' => $success,
        'message' => $message,
        'data' => $data
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);

    exit;
}

/*
==================================================
2. SESSION DAN DATABASE
==================================================
*/

require_once __DIR__ . '/../../auth/sesi.php';
require_once __DIR__ . '/../../../config/database.php';

/*
==================================================
3. VALIDASI AKSES KEPALA LAB
==================================================
*/

if (!sudahLogin()) {
    responsJSON(
        false,
        'Silakan login terlebih dahulu.',
        401
    );
}

if (($_SESSION['role'] ?? '') !== 'kepala_lab') {
    responsJSON(
        false,
        'Akses ditolak. API ini hanya untuk Kepala Lab.',
        403
    );
}

$idKepalaLab = (int) ($_SESSION['id_user'] ?? 0);

if ($idKepalaLab <= 0) {
    responsJSON(
        false,
        'Identitas Kepala Lab tidak valid.',
        401
    );
}

/*
==================================================
4. PEMBACAAN REQUEST
==================================================
*/

function ambilInput(): array
{
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';

    if (stripos($contentType, 'application/json') !== false) {

        $input = json_decode(
            file_get_contents('php://input'),
            true
        );

        return is_array($input) ? $input : [];
    }

    return $_POST;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

$input = ambilInput();

$action = $input['action']
    ?? $_GET['action']
    ?? 'list';

/*
==================================================
5. FUNGSI BANTU DATABASE
==================================================
*/

/*
Memeriksa kolom tabel konflik.

Terdapat perbedaan penamaan kolom
antara dump database dan API eskalasi
Laboran yang tersedia.

Kode ini mendukung:
- id_user_laboran
- id_user

Dengan demikian, nama kolom tidak
ditebak secara sembarangan.
*/

function kolomTersedia(
    PDO $pdo,
    string $tabel,
    string $kolom
): bool {

    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = :tabel
          AND COLUMN_NAME = :kolom
    ");

    $stmt->execute([
        ':tabel' => $tabel,
        ':kolom' => $kolom
    ]);

    return (int) $stmt->fetchColumn() > 0;
}

function ambilKolomLaboran(PDO $pdo): string
{
    if (
        kolomTersedia(
            $pdo,
            'konflik',
            'id_user_laboran'
        )
    ) {
        return 'id_user_laboran';
    }

    if (
        kolomTersedia(
            $pdo,
            'konflik',
            'id_user'
        )
    ) {
        return 'id_user';
    }

    throw new RuntimeException(
        'Kolom identitas Laboran tidak ditemukan pada tabel konflik.'
    );
}

function statusNorm(?string $status): string
{
    return strtolower(trim((string) $status));
}

/*
==================================================
6. MENGAMBIL DETAIL ANGGOTA KONFLIK
==================================================
*/


function ambilAnggotaKonflik(
    PDO $pdo,
    int $idKonflik
): array {

    $sql = "
        SELECT
            p.id_pengajuan,
            p.id_user,
            p.nama_kegiatan,
            p.waktu_mulai,
            p.waktu_selesai,
            p.status AS status_pengajuan,
            u.nama AS nama_pemohon,
            u.nip_npm,
            b.id_booking,
            b.status AS status_booking
        FROM pengajuan_konflik pk
        INNER JOIN pengajuan p
            ON p.id_pengajuan = pk.id_pengajuan
        LEFT JOIN users u
            ON u.id_user = p.id_user
        LEFT JOIN booking b
            ON b.id_pengajuan = p.id_pengajuan
        WHERE pk.id_konflik = :id_konflik
        ORDER BY p.waktu_mulai ASC
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':id_konflik' => $idKonflik
    ]);

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (!$rows) {
        return [];
    }

    $ids = array_values(array_unique(array_map(
        fn($row) => (int) $row['id_pengajuan'],
        $rows
    )));

    $placeholder = implode(
        ',',
        array_fill(0, count($ids), '?')
    );

    $aturanMap = [];
    $fasilitasMap = [];
    $skorMap = [];

    // DETAIL JENIS KEGIATAN
    $sqlAturan = "
        SELECT
            pa.id_pengajuan,
            a.nama_kelompok,
            ak.nama_kriteria
        FROM pengajuan_aturan pa
        INNER JOIN aturan_kriteria ak
            ON ak.id_aturan_kriteria = pa.id_aturan_kriteria
        INNER JOIN aturan a
            ON a.id_aturan = ak.id_aturan
        WHERE pa.id_pengajuan IN ($placeholder)
    ";

    $stmt = $pdo->prepare($sqlAturan);
    $stmt->execute($ids);

    while ($item = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $id = (int) $item['id_pengajuan'];

        $aturanMap[$id][] = [
            'kelompok' => $item['nama_kelompok'],
            'nama' => $item['nama_kriteria']
        ];
    }

    // DETAIL FASILITAS
    $sqlFasilitas = "
        SELECT
            pf.id_pengajuan,
            f.id_fasilitas,
            f.nama_fasilitas,
            pf.jumlah
        FROM pengajuan_fasilitas pf
        INNER JOIN fasilitas f
            ON f.id_fasilitas = pf.id_fasilitas
        WHERE pf.id_pengajuan IN ($placeholder)
        ORDER BY f.nama_fasilitas
    ";

    $stmt = $pdo->prepare($sqlFasilitas);
    $stmt->execute($ids);

    while ($item = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $id = (int) $item['id_pengajuan'];

        $fasilitasMap[$id][] = [
            'idFasilitas' => (int) $item['id_fasilitas'],
            'nama' => $item['nama_fasilitas'],
            'jumlah' => (int) $item['jumlah']
        ];
    }

    // HASIL SKOR
    $sqlSkor = "
        SELECT
            id_pengajuan,
            skor_jenis_kegiatan,
            skor_fasilitas,
            skor_akhir,
            prioritas,
            waktu_perhitungan_dilakukan
        FROM skor_pengajuan
        WHERE id_pengajuan IN ($placeholder)
        ORDER BY
            waktu_perhitungan_dilakukan DESC,
            id_score_pengajuan DESC
    ";

    $stmt = $pdo->prepare($sqlSkor);
    $stmt->execute($ids);

    while ($item = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $id = (int) $item['id_pengajuan'];

        if (!isset($skorMap[$id])) {
            $skorMap[$id] = $item;
        }
    }

    $hasil = [];

    foreach ($rows as $row) {

        $id = (int) $row['id_pengajuan'];

        $mulai = new DateTimeImmutable(
            $row['waktu_mulai'],
            new DateTimeZone('Asia/Jayapura')
        );

        $selesai = new DateTimeImmutable(
            $row['waktu_selesai'],
            new DateTimeZone('Asia/Jayapura')
        );

        $aturan = $aturanMap[$id] ?? [];
        $fasilitas = $fasilitasMap[$id] ?? [];
        $skor = $skorMap[$id] ?? null;

        $kategori = null;

        foreach ($aturan as $item) {
            if (
                stripos(
                    $item['kelompok'],
                    'jenis kegiatan'
                ) !== false
            ) {
                $kategori = $item['nama'];
                break;
            }
        }

        $jumlahPC = null;
        $jumlahKursi = null;

        foreach ($fasilitas as $item) {

            $nama = strtolower($item['nama']);

            if (
                $jumlahPC === null &&
                preg_match('/\bpc\b/', $nama)
            ) {
                $jumlahPC = $item['jumlah'];
            }

            if (
                $jumlahKursi === null &&
                strpos($nama, 'kursi') !== false
            ) {
                $jumlahKursi = $item['jumlah'];
            }
        }

        $hasil[] = [
            'id' => $id,
            'id_pengajuan' => $id,
            'id_user' => (int) $row['id_user'],

            'pemohon' => $row['nama_pemohon'] ?? '-',
            'namaPemohon' => $row['nama_pemohon'] ?? '-',
            'nipNpm' => $row['nip_npm'] ?? '-',

            'kegiatan' => $row['nama_kegiatan'],
            'namaKegiatan' => $row['nama_kegiatan'],

            'tanggal' => $mulai->format('Y-m-d'),
            'mulai' => $mulai->format('H:i'),
            'selesai' => $selesai->format('H:i'),

            'waktuMulai' => $row['waktu_mulai'],
            'waktuSelesai' => $row['waktu_selesai'],

            'detailAturan' => $aturan,
            'detailFasilitas' => $fasilitas,

            'kategori' => $kategori,
            'pc' => $jumlahPC,
            'jumlahPC' => $jumlahPC,
            'kursi' => $jumlahKursi,
            'jumlahKursi' => $jumlahKursi,

            'skorJenisKegiatan' =>
                $skor['skor_jenis_kegiatan'] ?? null,

            'skorFasilitas' =>
                $skor['skor_fasilitas'] ?? null,

            'skorAkhir' =>
                $skor['skor_akhir'] ?? null,

            'skor' =>
                $skor['skor_akhir'] ?? null,

            'skorSementara' =>
                $skor['skor_akhir'] ?? null,

            'prioritas' =>
                isset($skor['prioritas'])
                    ? 'P' . (int) $skor['prioritas']
                    : null,

            'status' => $row['status_pengajuan'],
            'statusPengajuan' =>
                statusNorm($row['status_pengajuan']),

            'id_booking' => $row['id_booking']
                ? (int) $row['id_booking']
                : null,

            'status_booking' =>
                $row['status_booking'] ?? null
        ];
    }

    return $hasil;
}

/*
==================================================
7. PEMERIKSAAN BENTROK JADWAL
==================================================
*/

function jadwalBentrok(
    array $pertama,
    array $kedua
): bool {

    $mulaiPertama = new DateTimeImmutable(
        $pertama['waktuMulai']
    );

    $selesaiPertama = new DateTimeImmutable(
        $pertama['waktuSelesai']
    );

    $mulaiKedua = new DateTimeImmutable(
        $kedua['waktuMulai']
    );

    $selesaiKedua = new DateTimeImmutable(
        $kedua['waktuSelesai']
    );

    // Interval [mulai, selesai).
    return (
        $mulaiPertama < $selesaiKedua
        &&
        $selesaiPertama > $mulaiKedua
    );
}

/*
==================================================
8. MENGAMBIL SELURUH KELOMPOK KONFLIK
==================================================
*/

function ambilSemuaKonflik(PDO $pdo): array
{

    $stmt = $pdo->query("

        SELECT

            id_konflik,
            id_pengajuan_terpilih,
            id_user_kepala_lab,
            status,
            waktu_dibuat,
            waktu_dikirim,
            waktu_ditetapkan

        FROM konflik

        ORDER BY
            waktu_dibuat DESC,
            id_konflik DESC

    ");

    $daftarKonflik = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $hasil = [];

    foreach ($daftarKonflik as $group) {

        $idKonflik = (int) $group['id_konflik'];

        $anggota = ambilAnggotaKonflik(
            $pdo,
            $idKonflik
        );

        // Kelompok harus memiliki minimal dua pengajuan.
        if (count($anggota) < 2) {
            continue;
        }

        $tanggal = null;

        if (!empty($anggota[0]['tanggal'])) {
            $tanggal = $anggota[0]['tanggal'];
        }

        $hasil[] = [

            'id' => $idKonflik,

            'id_konflik' => $idKonflik,

            'tanggal' => $tanggal,

            'status' => statusNorm($group['status']),

            'pengajuanTerpilih' =>
                $group['id_pengajuan_terpilih'] !== null
                ? (int) $group['id_pengajuan_terpilih']
                : null,

            'id_user_kepala_lab' =>
                $group['id_user_kepala_lab'] !== null
                ? (int) $group['id_user_kepala_lab']
                : null,

            'waktu_dibuat' => $group['waktu_dibuat'],

            'waktu_dikirim' => $group['waktu_dikirim'],

            'waktu_ditetapkan' => $group['waktu_ditetapkan'],

            'pengajuan' => $anggota

        ];
    }

    return $hasil;
}

/*
==================================================
9. PROSES API
==================================================
*/

try {

    /*
    ==============================================
    ACTION 1: LIST KONFLIK
    GET ?action=list
    ==============================================
    */

    if ($method === 'GET' && $action === 'list') {

        $data = ambilSemuaKonflik($pdo);

        responsJSON(
            true,
            'Data kelompok konflik berhasil diambil.',
            200,
            $data
        );
    }

    /*
    ==============================================
    ACTION 2: DETAIL KONFLIK
    GET ?action=detail&id_konflik=1
    ==============================================
    */

    if ($method === 'GET' && $action === 'detail') {

        $idKonflik = filter_var(
            $_GET['id_konflik'] ?? null,
            FILTER_VALIDATE_INT
        );

        if (!$idKonflik || $idKonflik <= 0) {

            responsJSON(
                false,
                'ID konflik tidak valid.',
                422
            );
        }

        $stmt = $pdo->prepare("

            SELECT *

            FROM konflik

            WHERE id_konflik = :id

            LIMIT 1

        ");

        $stmt->execute([
            ':id' => $idKonflik
        ]);

        $group = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$group) {

            responsJSON(
                false,
                'Kelompok konflik tidak ditemukan.',
                404
            );
        }

        $group['pengajuan'] = ambilAnggotaKonflik(
            $pdo,
            (int) $idKonflik
        );

        responsJSON(
            true,
            'Detail kelompok konflik berhasil diambil.',
            200,
            $group
        );
    }

    /*
    ==============================================
    VALIDASI METODE POST
    ==============================================
    */

    if ($method !== 'POST') {

        header('Allow: GET, POST');

        responsJSON(
            false,
            'Metode request tidak diizinkan.',
            405
        );
    }

    /*
    ==============================================
    ACTION 3: KEPUTUSAN KEPALA LAB
    POST action=putuskan
    ==============================================
    */

    
if ($action === 'putuskan') {

    /*
    ==========================================
    1. VALIDASI INPUT
    ==========================================
    */

    $idKonflik = filter_var(
        $input['id_konflik'] ?? null,
        FILTER_VALIDATE_INT
    );

    $inputTerpilih =
        $input['id_pengajuan']
        ?? $input['selectedIds']
        ?? null;

    if (!$idKonflik || $idKonflik <= 0) {
        responsJSON(
            false,
            'ID konflik tidak valid.',
            422
        );
    }

    if (!is_array($inputTerpilih) || count($inputTerpilih) === 0) {
        responsJSON(
            false,
            'Pilih minimal satu pengajuan.',
            422
        );
    }

    $idTerpilih = [];

    foreach ($inputTerpilih as $id) {

        $validId = filter_var(
            $id,
            FILTER_VALIDATE_INT
        );

        if (!$validId || $validId <= 0) {
            responsJSON(
                false,
                'Terdapat ID pengajuan yang tidak valid.',
                422
            );
        }

        $idTerpilih[] = (int) $validId;
    }

    // Hilangkan ID duplikat.
    $idTerpilih = array_values(
        array_unique($idTerpilih)
    );

    /*
    ==========================================
    2. MULAI TRANSAKSI
    ==========================================
    */

    $pdo->beginTransaction();

    /*
    ==========================================
    3. KUNCI KELOMPOK KONFLIK
    ==========================================
    */

    $stmt = $pdo->prepare("
        SELECT *
        FROM konflik
        WHERE id_konflik = :id
        LIMIT 1
        FOR UPDATE
    ");

    $stmt->execute([
        ':id' => $idKonflik
    ]);

    $group = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$group) {
        throw new RuntimeException(
            'Kelompok konflik tidak ditemukan.'
        );
    }

    $statusKonflik = statusNorm(
        $group['status']
    );

    if (in_array(
        $statusKonflik,
        ['selesai', 'ditutup', 'dibatalkan'],
        true
    )) {
        throw new RuntimeException(
            'Konflik ini sudah memiliki keputusan.'
        );
    }

    /*
    ==========================================
    4. AMBIL SELURUH ANGGOTA KONFLIK
    ==========================================
    */

    $anggota = ambilAnggotaKonflik(
        $pdo,
        (int) $idKonflik
    );

    if (count($anggota) < 2) {
        throw new RuntimeException(
            'Kelompok konflik harus memiliki minimal dua pengajuan.'
        );
    }

    $anggotaById = [];

    foreach ($anggota as $item) {
        $anggotaById[(int) $item['id']] = $item;
    }

    /*
    ==========================================
    5. PASTIKAN SEMUA PILIHAN ANGGOTA KELOMPOK
    ==========================================
    */

    foreach ($idTerpilih as $id) {

        if (!isset($anggotaById[$id])) {
            throw new RuntimeException(
                "Pengajuan {$id} bukan anggota kelompok konflik ini."
            );
        }
    }

    /*
    ==========================================
    6. KUNCI SELURUH DATA PENGAJUAN
    ==========================================
    */

    $stmt = $pdo->prepare("
        SELECT p.id_pengajuan
        FROM pengajuan p
        INNER JOIN pengajuan_konflik pk
            ON pk.id_pengajuan = p.id_pengajuan
        WHERE pk.id_konflik = :id
        FOR UPDATE
    ");

    $stmt->execute([
        ':id' => $idKonflik
    ]);

    $jumlahTerkunci = $stmt->fetchAll(
        PDO::FETCH_COLUMN
    );

    if (count($jumlahTerkunci) !== count($anggota)) {
        throw new RuntimeException(
            'Data anggota konflik berubah. Silakan muat ulang.'
        );
    }

    /*
    ==========================================
    7. VALIDASI BENTROK ANTAR PILIHAN
    ==========================================
    */

    $dataDisetujui = [];

    foreach ($idTerpilih as $id) {
        $dataDisetujui[] = $anggotaById[$id];
    }

    for ($i = 0; $i < count($dataDisetujui); $i++) {

        for (
            $j = $i + 1;
            $j < count($dataDisetujui);
            $j++
        ) {

            if (
                jadwalBentrok(
                    $dataDisetujui[$i],
                    $dataDisetujui[$j]
                )
            ) {
                throw new RuntimeException(
                    'Keputusan tidak dapat diproses. '
                    . 'Terdapat jadwal yang saling berbenturan '
                    . 'di antara pengajuan yang dipilih.'
                );
            }
        }
    }

    /*
    ==========================================
    8. PROSES SELURUH PENGAJUAN
    ==========================================
    */

    $daftarDisetujui = [];
    $daftarTergeser = [];

    foreach ($anggota as $item) {

        $idAnggota = (int) $item['id'];

        /*
        --------------------------------------
        A. PENGAJUAN YANG DIPILIH
        --------------------------------------
        */

        if (in_array($idAnggota, $idTerpilih, true)) {

            // Perbarui status pengajuan.
            $stmt = $pdo->prepare("
                UPDATE pengajuan
                SET status = 'disetujui'
                WHERE id_pengajuan = :id
            ");

            $stmt->execute([
                ':id' => $idAnggota
            ]);

            // Buat booking atau aktifkan kembali
            // booking lama berdasarkan UNIQUE id_pengajuan.
            $stmt = $pdo->prepare("
                INSERT INTO booking (
                    id_pengajuan,
                    status,
                    waktu_dibuat
                )
                VALUES (
                    :id,
                    'terjadwal',
                    NOW()
                )
                ON DUPLICATE KEY UPDATE
                    status = 'terjadwal'
            ");

            $stmt->execute([
                ':id' => $idAnggota
            ]);

            $daftarDisetujui[] = $idAnggota;

        }

        /*
        --------------------------------------
        B. PENGAJUAN YANG TIDAK DIPILIH
        --------------------------------------
        */

        else {

            // Semua pengajuan yang tidak dipilih
            // menjadi tergeser sesuai aturan bisnis.

            $stmt = $pdo->prepare("
                UPDATE pengajuan
                SET status = 'tergeser'
                WHERE id_pengajuan = :id
            ");

            $stmt->execute([
                ':id' => $idAnggota
            ]);

            // Booking lama tidak boleh tetap aktif.
            $stmt = $pdo->prepare("
                UPDATE booking
                SET status = 'tergeser'
                WHERE id_pengajuan = :id
            ");

            $stmt->execute([
                ':id' => $idAnggota
            ]);

            $daftarTergeser[] = $idAnggota;
        }
    }

    /*
    ==========================================
    9. SIMPAN KEPUTUSAN KELOMPOK KONFLIK
    ==========================================
    */

    $set = [
        'status = :status',
        'id_pengajuan_terpilih = :terpilih',
        'waktu_ditetapkan = NOW()'
    ];

    $parameter = [
        ':status' => 'selesai',

        // Kolom ini hanya dapat menyimpan satu ID.
        // Gunakan pilihan pertama sebagai referensi.
        // Seluruh hasil tetap tercatat pada status pengajuan.
        ':terpilih' => $idTerpilih[0],

        ':id' => $idKonflik
    ];

    if (
        kolomTersedia(
            $pdo,
            'konflik',
            'id_user_kepala_lab'
        )
    ) {

        $set[] = 'id_user_kepala_lab = :kepala';

        $parameter[':kepala'] = $idKepalaLab;
    }

    $sqlUpdate = "
        UPDATE konflik
        SET " . implode(', ', $set) . "
        WHERE id_konflik = :id
    ";

    $stmt = $pdo->prepare($sqlUpdate);

    $stmt->execute($parameter);

    /*
    ==========================================
    10. COMMIT TRANSAKSI
    ==========================================
    */

    $pdo->commit();

    /*
    ==========================================
    11. RESPONSE JSON
    ==========================================
    */

    responsJSON(
        true,
        'Keputusan seluruh pengajuan berhasil disimpan.',
        200,
        [
            'id_konflik' => $idKonflik,

            'id_pengajuan_terpilih' => $idTerpilih,

            'status' => 'selesai',

            'jumlah_disetujui' => count($daftarDisetujui),

            'jumlah_tergeser' => count($daftarTergeser),

            'disetujui' => $daftarDisetujui,

            'tergeser' => $daftarTergeser
        ]
    );
}


    /*
    ==============================================
    ACTION TIDAK DIKENAL
    ==============================================
    */

    responsJSON(
        false,
        'Action API tidak dikenal.',
        400
    );

} catch (Throwable $e) {

    /*
    ROLLBACK JIKA TERJADI KESALAHAN
    */

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log(
        'SILAB API PENYELESAIAN KONFLIK: '
        . $e->getMessage()
    );

    $code = $e instanceof RuntimeException ? 422 : 500;

    responsJSON(
        false,
        $code === 422
        ? $e->getMessage()
        : 'Terjadi kesalahan saat memproses penyelesaian konflik.',
        $code
    );
}
