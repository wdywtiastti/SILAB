<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=UTF-8');

function responsJSON(bool $success, string $message, int $httpCode = 200, array $data = []): never
{
    http_response_code($httpCode);
    echo json_encode([
        'success' => $success,
        'message' => $message,
        'data' => $data
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

require_once __DIR__ . '/../../auth/sesi.php';
require_once __DIR__ . '/../../../config/database.php';

if (!sudahLogin()) {
    responsJSON(false, 'Session telah berakhir. Silakan login kembali.', 401);
}
if (($_SESSION['role'] ?? '') !== 'laboran') {
    responsJSON(false, 'Anda tidak memiliki kewenangan melakukan tindakan ini.', 403);
}
$idLaboran = (int) ($_SESSION['id_user'] ?? 0);
if ($idLaboran <= 0) {
    responsJSON(false, 'Identitas Laboran tidak valid.', 401);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    responsJSON(false, 'Metode request harus POST.', 405);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    responsJSON(false, 'Format request tidak valid.', 400);
}
$aksi = trim((string) ($input['aksi'] ?? ''));
$idPengajuan = filter_var($input['idPengajuan'] ?? null, FILTER_VALIDATE_INT);
if (!$idPengajuan || $idPengajuan <= 0) {
    responsJSON(false, 'ID pengajuan tidak valid.', 400);
}

try {
    $pdo->beginTransaction();

    $stmt = $pdo->prepare("SELECT id_pengajuan, waktu_mulai, waktu_selesai, status FROM pengajuan WHERE id_pengajuan = :id FOR UPDATE");
    $stmt->execute([':id' => $idPengajuan]);
    $pengajuan = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$pengajuan) {
        throw new RuntimeException('Data pengajuan tidak ditemukan.');
    }

    $status = strtolower(trim((string) $pengajuan['status']));
    $pendingStatuses = ['menunggu', 'verifikasi', 'menunggu_verifikasi'];
    $activeBookingStatuses = ['terjadwal', 'disetujui', 'berlangsung', 'digunakan'];

    if ($aksi === 'setujui') {
        if (!in_array($status, $pendingStatuses, true)) {
            throw new RuntimeException('Pengajuan tidak berada dalam antrean verifikasi.');
        }

        // Validasi ulang di server: pengajuan tidak boleh mengambil waktu
        // yang sudah dipakai booking aktif. Bentrok dengan pengajuan pending
        // lain tidak otomatis memblokir; yang menjadi pengunci adalah booking aktif.
        $placeholders = implode(',', array_fill(0, count($activeBookingStatuses), '?'));
        $sqlConflict = "
            SELECT p.id_pengajuan, p.nama_kegiatan
            FROM booking b
            INNER JOIN pengajuan p ON p.id_pengajuan = b.id_pengajuan
            WHERE b.status IN ($placeholders)
              AND p.id_pengajuan <> ?
              AND p.waktu_mulai < ?
              AND p.waktu_selesai > ?
            LIMIT 1 FOR UPDATE
        ";
        $params = array_merge(
            $activeBookingStatuses,
            [(int) $idPengajuan, $pengajuan['waktu_selesai'], $pengajuan['waktu_mulai']]
        );
        $stmtConflict = $pdo->prepare($sqlConflict);
        $stmtConflict->execute($params);
        $conflict = $stmtConflict->fetch(PDO::FETCH_ASSOC);
        if ($conflict) {
            throw new RuntimeException('Tidak dapat disetujui karena bertabrakan dengan booking aktif #' . $conflict['id_pengajuan'] . ' (' . $conflict['nama_kegiatan'] . ').');
        }

        $stmt = $pdo->prepare("UPDATE pengajuan SET status = 'disetujui' WHERE id_pengajuan = :id");
        $stmt->execute([':id' => $idPengajuan]);

        $stmt = $pdo->prepare('SELECT id_booking FROM booking WHERE id_pengajuan = :id FOR UPDATE');
        $stmt->execute([':id' => $idPengajuan]);
        $booking = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($booking) {
            $idBooking = (int) $booking['id_booking'];
            $stmt = $pdo->prepare("UPDATE booking SET status = 'terjadwal' WHERE id_booking = :id");
            $stmt->execute([':id' => $idBooking]);
        } else {
            $stmt = $pdo->prepare("INSERT INTO booking (id_pengajuan, status, waktu_dibuat) VALUES (:id, 'terjadwal', NOW())");
            $stmt->execute([':id' => $idPengajuan]);
            $idBooking = (int) $pdo->lastInsertId();
        }

        $stmt = $pdo->prepare("INSERT INTO validasi_booking (id_booking, id_user_laboran, status, waktu_divalidasi, waktu_dibuat) VALUES (:booking, :laboran, 'disetujui', NOW(), NOW()) ON DUPLICATE KEY UPDATE id_user_laboran = VALUES(id_user_laboran), status = 'disetujui', waktu_divalidasi = NOW()");
        $stmt->execute([':booking' => $idBooking, ':laboran' => $idLaboran]);

        $pdo->commit();
        responsJSON(true, 'Pengajuan berhasil disetujui dan booking berhasil dibuat.', 200, [
            'idPengajuan' => (int) $idPengajuan,
            'idBooking' => $idBooking,
            'status' => 'disetujui'
        ]);
    }

    if ($aksi === 'tolak') {
        if (!in_array($status, $pendingStatuses, true)) {
            throw new RuntimeException('Pengajuan tidak berada dalam antrean verifikasi.');
        }

        $stmt = $pdo->prepare('SELECT id_booking, status FROM booking WHERE id_pengajuan = :id FOR UPDATE');
        $stmt->execute([':id' => $idPengajuan]);
        $booking = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($booking && in_array(strtolower((string) $booking['status']), $activeBookingStatuses, true)) {
            throw new RuntimeException('Pengajuan sudah memiliki booking aktif dan tidak dapat ditolak dari antrean ini.');
        }

        $stmt = $pdo->prepare("UPDATE pengajuan SET status = 'ditolak' WHERE id_pengajuan = :id");
        $stmt->execute([':id' => $idPengajuan]);

        $pdo->commit();
        responsJSON(true, 'Pengajuan berhasil ditolak.', 200, [
            'idPengajuan' => (int) $idPengajuan,
            'status' => 'ditolak'
        ]);
    }

    if ($aksi === 'batalkan_persetujuan') {
        if ($status !== 'disetujui') {
            throw new RuntimeException('Pengajuan tidak berstatus disetujui.');
        }

        $stmt = $pdo->prepare('SELECT id_booking, status FROM booking WHERE id_pengajuan = :id FOR UPDATE');
        $stmt->execute([':id' => $idPengajuan]);
        $booking = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$booking) {
            throw new RuntimeException('Data booking tidak ditemukan.');
        }
        if (strtolower((string) $booking['status']) !== 'terjadwal') {
            throw new RuntimeException('Booking tidak lagi berada dalam status terjadwal.');
        }

        $stmt = $pdo->prepare('SELECT status FROM validasi_booking WHERE id_booking = :id FOR UPDATE');
        $stmt->execute([':id' => $booking['id_booking']]);
        $validasi = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($validasi && in_array(strtolower((string) $validasi['status']), ['digunakan', 'hadir', 'presensi', 'berlangsung', 'selesai'], true)) {
            throw new RuntimeException('Booking sudah digunakan atau presensi telah tercatat.');
        }

        $zona = new DateTimeZone('Asia/Jayapura');
        $mulai = new DateTimeImmutable((string) $pengajuan['waktu_mulai'], $zona);
        $sekarang = new DateTimeImmutable('now', $zona);
        if ($sekarang >= $mulai->modify('+15 minutes')) {
            throw new RuntimeException('Batas waktu presensi 15 menit sudah habis. Pembatalan tidak dapat dilakukan.');
        }

        $stmt = $pdo->prepare("UPDATE booking SET status = 'dibatalkan' WHERE id_booking = :id");
        $stmt->execute([':id' => $booking['id_booking']]);
        $stmt = $pdo->prepare("UPDATE pengajuan SET status = 'menunggu' WHERE id_pengajuan = :id");
        $stmt->execute([':id' => $idPengajuan]);
        $stmt = $pdo->prepare("UPDATE validasi_booking SET status = 'dibatalkan', waktu_divalidasi = NOW() WHERE id_booking = :id");
        $stmt->execute([':id' => $booking['id_booking']]);

        $pdo->commit();
        responsJSON(true, 'Persetujuan berhasil dibatalkan. Pengajuan dikembalikan ke antrean verifikasi.', 200, [
            'idPengajuan' => (int) $idPengajuan,
            'idBooking' => (int) $booking['id_booking'],
            'status' => 'menunggu',
            'statusBooking' => 'dibatalkan'
        ]);
    }

    throw new RuntimeException('Jenis tindakan tidak dikenali.');
} catch (RuntimeException $e) {
    if ($pdo->inTransaction())
        $pdo->rollBack();
    responsJSON(false, $e->getMessage(), 400);
} catch (Throwable $e) {
    if ($pdo->inTransaction())
        $pdo->rollBack();
    error_log('SILAB tindakan antrean: ' . $e->getMessage());
    responsJSON(false, 'Terjadi kesalahan server saat memproses tindakan.', 500);
}
