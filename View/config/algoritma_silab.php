<?php

/**
 * =====================================================
 * SILAB - MESIN PERHITUNGAN PEMBOBOTAN DAN PRIORITAS
 * =====================================================
 */

function hitungSkorPengajuan(PDO $pdo, int $idPengajuan): array
{
    // =================================================
    // 1. AMBIL KELOMPOK ATURAN
    // =================================================

    $stmt = $pdo->query("
        SELECT id_aturan, nama_kelompok, bobot
        FROM aturan
        ORDER BY id_aturan ASC
    ");

    $aturan = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Kelompok yang bukan parameter penilaian dropdown
    // tidak dimasukkan ke perhitungan.
    $aturan = array_values(array_filter($aturan, function ($item) {
        return stripos($item['nama_kelompok'], 'waktu pengajuan') === false;
    }));

    if (count($aturan) === 0) {
        throw new Exception("Belum ada kelompok aturan penilaian.");
    }

    // =================================================
    // 2. AMBIL FASILITAS
    // =================================================

    $stmt = $pdo->query("
        SELECT
            id_fasilitas,
            nama_fasilitas,
            kapasitas_maksimum,
            bobot,
            bobot_utama
        FROM fasilitas
        ORDER BY id_fasilitas ASC
    ");

    $fasilitas = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (count($fasilitas) === 0) {
        throw new Exception("Belum ada fasilitas yang tersedia.");
    }

    // =================================================
    // 3. VALIDASI BOBOT UTAMA
    // =================================================

    $bobotUtamaFasilitas = (float) $fasilitas[0]['bobot_utama'];

    foreach ($fasilitas as $item) {
        if (abs((float)$item['bobot_utama'] - $bobotUtamaFasilitas) > 0.01) {
            throw new Exception(
                "Bobot utama fasilitas belum seragam."
            );
        }
    }

    $totalBobotUtama = $bobotUtamaFasilitas;

    foreach ($aturan as $item) {
        $totalBobotUtama += (float) $item['bobot'];
    }

    if (abs($totalBobotUtama - 100) > 0.01) {
        throw new Exception(
            "Total bobot utama aturan dan fasilitas harus 100%. Total saat ini: "
            . number_format($totalBobotUtama, 2) . "%."
        );
    }

    // =================================================
    // 4. AMBIL KRITERIA
    // =================================================

    $stmt = $pdo->query("
        SELECT
            id_aturan_kriteria,
            id_aturan,
            nama_kriteria,
            bobot
        FROM aturan_kriteria
        ORDER BY id_aturan_kriteria ASC
    ");

    $kriteria = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $kriteriaPerAturan = [];

    foreach ($kriteria as $item) {
        $idAturan = (int) $item['id_aturan'];

        $kriteriaPerAturan[$idAturan][] = $item;
    }

    // Validasi bobot kriteria masing-masing kelompok.
    foreach ($aturan as $item) {

        $idAturan = (int) $item['id_aturan'];
        $namaKelompok = $item['nama_kelompok'];

        $daftarKriteria = $kriteriaPerAturan[$idAturan] ?? [];

        if (count($daftarKriteria) === 0) {
            throw new Exception(
                "Kelompok {$namaKelompok} belum memiliki kriteria."
            );
        }

        $total = 0;

        foreach ($daftarKriteria as $k) {
            $total += (float) $k['bobot'];
        }

        if (abs($total - 100) > 0.01) {
            throw new Exception(
                "Total bobot kriteria {$namaKelompok} harus 100%."
            );
        }
    }

    // =================================================
    // 5. VALIDASI BOBOT INTERNAL FASILITAS
    // =================================================

    $totalBobotFasilitas = 0;

    foreach ($fasilitas as $item) {
        $totalBobotFasilitas += (float) $item['bobot'];
    }

    if (abs($totalBobotFasilitas - 100) > 0.01) {
        throw new Exception(
            "Total bobot seluruh fasilitas harus 100%."
        );
    }

    // =================================================
    // 6. AMBIL PILIHAN KRITERIA PENGGUNA
    // =================================================

    $stmt = $pdo->prepare("
        SELECT id_aturan_kriteria
        FROM pengajuan_aturan
        WHERE id_pengajuan = :id
    ");

    $stmt->execute([
        ':id' => $idPengajuan
    ]);

    $pilihan = array_map(
        'intval',
        $stmt->fetchAll(PDO::FETCH_COLUMN)
    );

    $pilihanPerAturan = [];

    foreach ($kriteria as $item) {

        $idKriteria = (int) $item['id_aturan_kriteria'];

        if (in_array($idKriteria, $pilihan, true)) {

            $pilihanPerAturan[(int)$item['id_aturan']] = $item;
        }
    }

    // =================================================
    // 7. HITUNG SKOR KELOMPOK ATURAN
    // =================================================

    $skorAturan = 0;

    foreach ($aturan as $item) {

        $idAturan = (int) $item['id_aturan'];

        if (!isset($pilihanPerAturan[$idAturan])) {
            throw new Exception(
                "Pilihan kelompok {$item['nama_kelompok']} belum ditemukan."
            );
        }

        $kriteriaTerpilih = $pilihanPerAturan[$idAturan];

        $bobotKriteria = (float) $kriteriaTerpilih['bobot'];
        $bobotKelompok = (float) $item['bobot'];

        $skor = (
            $bobotKriteria / 100
        ) * (
            $bobotKelompok / 100
        ) * 100;

        $skorAturan += $skor;
    }

    // =================================================
    // 8. AMBIL JUMLAH FASILITAS YANG DIMINTA
    // =================================================

    $stmt = $pdo->prepare("
        SELECT id_fasilitas, jumlah
        FROM pengajuan_fasilitas
        WHERE id_pengajuan = :id
    ");

    $stmt->execute([
        ':id' => $idPengajuan
    ]);

    $permintaan = [];

    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $item) {

        $permintaan[(int)$item['id_fasilitas']] =
            (int)$item['jumlah'];
    }

    // =================================================
    // 9. HITUNG SKOR FASILITAS
    // =================================================

    $skorFasilitas = 0;

    foreach ($fasilitas as $item) {

        $idFasilitas = (int) $item['id_fasilitas'];

        $jumlahDiminta = $permintaan[$idFasilitas] ?? 0;

        $kapasitas = (int) $item['kapasitas_maksimum'];

        if ($kapasitas <= 0) {
            throw new Exception(
                "Kapasitas fasilitas {$item['nama_fasilitas']} tidak valid."
            );
        }

        $bobotFasilitas = (float) $item['bobot'];

        $bobotUtama = (float) $item['bobot_utama'];

        // Normalisasi jumlah permintaan terhadap kapasitas.
        $rasio = min(1, $jumlahDiminta / $kapasitas);

        $skor = $rasio
            * ($bobotFasilitas / 100)
            * ($bobotUtama / 100)
            * 100;

        $skorFasilitas += $skor;
    }

    // =================================================
    // 10. HITUNG SKOR AKHIR
    // =================================================

    $skorAkhir = $skorAturan + $skorFasilitas;

    $skorAkhir = max(0, min(100, $skorAkhir));

    // =================================================
    // 11. KLASIFIKASI DECISION TREE
    // =================================================

    if ($skorAkhir <= 38.94) {

        $prioritas = 4;

    } elseif ($skorAkhir <= 59.76) {

        $prioritas = 3;

    } elseif ($skorAkhir <= 80.06) {

        $prioritas = 2;

    } else {

        $prioritas = 1;
    }

    // =================================================
    // 12. SIMPAN HASIL KE DATABASE
    // =================================================

    $stmt = $pdo->prepare("
        INSERT INTO skor_pengajuan (
            id_pengajuan,
            skor_jenis_kegiatan,
            skor_fasilitas,
            skor_akhir,
            prioritas,
            waktu_perhitungan_dilakukan
        )
        VALUES (
            :id_pengajuan,
            :skor_aturan,
            :skor_fasilitas,
            :skor_akhir,
            :prioritas,
            NOW()
        )
        ON DUPLICATE KEY UPDATE

            skor_jenis_kegiatan = VALUES(skor_jenis_kegiatan),
            skor_fasilitas = VALUES(skor_fasilitas),
            skor_akhir = VALUES(skor_akhir),
            prioritas = VALUES(prioritas),
            waktu_perhitungan_dilakukan = NOW()
    ");

    $stmt->execute([
        ':id_pengajuan' => $idPengajuan,
        ':skor_aturan' => round($skorAturan, 2),
        ':skor_fasilitas' => round($skorFasilitas, 2),
        ':skor_akhir' => round($skorAkhir, 2),
        ':prioritas' => $prioritas
    ]);

    return [
        'skor_aturan' => round($skorAturan, 2),
        'skor_fasilitas' => round($skorFasilitas, 2),
        'skor_akhir' => round($skorAkhir, 2),
        'prioritas' => $prioritas
    ];
}
