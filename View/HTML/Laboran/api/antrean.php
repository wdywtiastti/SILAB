<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=UTF-8');

function jsonResponse(int $code, bool $success, string $message, array $data = []): never
{
    http_response_code($code);
    echo json_encode([
        'success' => $success,
        'message' => $message,
        'data' => $data
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

require_once __DIR__ . '/../../auth/sesi.php';

if (!sudahLogin()) {
    jsonResponse(401, false, 'Silakan login terlebih dahulu.');
}
if (($_SESSION['role'] ?? '') !== 'laboran') {
    jsonResponse(403, false, 'Anda tidak memiliki akses.');
}
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET');
    jsonResponse(405, false, 'Metode request tidak diizinkan.');
}

require_once __DIR__ . '/../../../config/database.php';

function overlap(array $a, array $b): bool
{
    // Interval setengah terbuka: jadwal 09.00-10.00 tidak bentrok
    // dengan jadwal 10.00-11.00.
    return $a['waktu_mulai'] < $b['waktu_selesai']
        && $a['waktu_selesai'] > $b['waktu_mulai'];
}

function statusNorm(?string $value): string
{
    return strtolower(trim((string) $value));
}

try {
    $sql = "
        SELECT
            p.id_pengajuan,
            p.id_user,
            p.nama_kegiatan,
            p.waktu_mulai,
            p.waktu_selesai,
            p.status AS status_pengajuan,
            p.waktu_dibuat,
            u.nama AS nama_pemohon,
            u.nip_npm AS identifier,
            b.id_booking,
            b.status AS status_booking,
            vb.status AS status_presensi
        FROM pengajuan p
        INNER JOIN users u ON u.id_user = p.id_user
        LEFT JOIN booking b ON b.id_pengajuan = p.id_pengajuan
        LEFT JOIN validasi_booking vb ON vb.id_booking = b.id_booking
        ORDER BY p.waktu_mulai ASC, p.id_pengajuan ASC
    ";
    $stmt = $pdo->query($sql);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $activeBookingStatuses = ['terjadwal', 'disetujui', 'berlangsung', 'digunakan'];
    $pendingStatuses = ['menunggu', 'verifikasi', 'menunggu_verifikasi', 'pending', 'bentrok', 'konflik'];

    $activeBookings = [];
    $pending = [];

    foreach ($rows as $row) {
        $bookingStatus = statusNorm($row['status_booking'] ?? null);
        $submissionStatus = statusNorm($row['status_pengajuan'] ?? null);

        if (in_array($bookingStatus, $activeBookingStatuses, true)) {
            $activeBookings[] = $row;
        } elseif (in_array($submissionStatus, $pendingStatuses, true)) {
            $pending[] = $row;
        }
    }

    $result = [];
    foreach ($rows as $row) {
        $id = (int) $row['id_pengajuan'];
        $submissionStatus = statusNorm($row['status_pengajuan'] ?? null);
        $bookingStatus = statusNorm($row['status_booking'] ?? null);
        $isApproved = in_array($bookingStatus, $activeBookingStatuses, true);
        $isPending = !$isApproved && in_array($submissionStatus, $pendingStatuses, true);

        $conflicts = [];
        $conflictTypes = [];

        if ($isPending) {
            // 1. Pengajuan menunggu dibandingkan dengan booking aktif.
            foreach ($activeBookings as $other) {
                if ((int) $other['id_pengajuan'] === $id)
                    continue;
                if (overlap($row, $other)) {
                    $conflicts[(int) $other['id_pengajuan']] = $other;
                    $conflictTypes['booking_aktif'] = true;
                }
            }

            // 2. Pengajuan menunggu dibandingkan satu sama lain.
            // Hanya jadwal yang benar-benar beririsan yang dimasukkan.
            foreach ($pending as $other) {
                if ((int) $other['id_pengajuan'] === $id)
                    continue;
                if (overlap($row, $other)) {
                    $conflicts[(int) $other['id_pengajuan']] = $other;
                    $conflictTypes['antar_pengajuan'] = true;
                }
            }
        } elseif ($isApproved) {
            // Booking yang telah disetujui tidak diubah statusnya.
            // Hanya diberi peringatan jika ada pengajuan menunggu yang masuk.
            foreach ($pending as $other) {
                if (overlap($row, $other)) {
                    $conflicts[(int) $other['id_pengajuan']] = $other;
                    $conflictTypes['pengajuan_baru'] = true;
                }
            }
        }

        $mulai = new DateTimeImmutable((string) $row['waktu_mulai']);
        $selesai = new DateTimeImmutable((string) $row['waktu_selesai']);

        if ($isApproved) {
            $displayStatus = 'disetujui';
        } elseif ($isPending && count($conflicts) > 0) {
            $displayStatus = 'bentrok';
        } else {
            $displayStatus = $submissionStatus ?: 'menunggu';
        }

        $conflictList = [];
        foreach ($conflicts as $other) {
            $otherStart = new DateTimeImmutable((string) $other['waktu_mulai']);
            $otherEnd = new DateTimeImmutable((string) $other['waktu_selesai']);
            $conflictList[] = [
                'idPengajuan' => (int) $other['id_pengajuan'],
                'namaKegiatan' => $other['nama_kegiatan'],
                'namaPemohon' => $other['nama_pemohon'],
                'waktuMulai' => $otherStart->format('H:i'),
                'waktuSelesai' => $otherEnd->format('H:i')
            ];
        }

        $result[] = [
            'id' => $id,
            'idPengajuan' => $id,
            'idUser' => (int) $row['id_user'],
            'idBooking' => $row['id_booking'] !== null ? (int) $row['id_booking'] : null,
            'namaKegiatan' => $row['nama_kegiatan'],
            'namaPemohon' => $row['nama_pemohon'],
            'identifier' => $row['identifier'],
            'tanggal' => $mulai->format('Y-m-d'),
            'waktuMulai' => $mulai->format('H:i'),
            'waktuSelesai' => $selesai->format('H:i'),
            'kebutuhanPC' => null,
            'kebutuhanKursi' => null,
            'kategori' => null,
            'skor' => null,
            'prioritas' => null,
            'status' => $displayStatus,
            'statusPengajuan' => $submissionStatus,
            'statusBooking' => $row['status_booking'],
            'statusPresensi' => $row['status_presensi'],
            'mengalamiKonflik' => count($conflicts) > 0,
            'jenisKonflik' => array_keys($conflictTypes),
            'daftarKonflik' => $conflictList,
            'pesanKonflik' => count($conflicts) > 0
                ? 'Jadwal beririsan dengan ' . count($conflicts) . ' pengajuan/booking lain.'
                : null,
            'waktuDibuat' => $row['waktu_dibuat']
        ];
    }

    jsonResponse(200, true, 'Data antrean berhasil diambil.', $result);
} catch (Throwable $e) {
    error_log('SILAB API antrean: ' . $e->getMessage());
    jsonResponse(500, false, 'Gagal mengambil data antrean. Periksa log server.');
}
