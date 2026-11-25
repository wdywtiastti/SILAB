<?php

declare(strict_types=1);

// =============================================
// SILAB - API MANAJEMEN FASILITAS
// =============================================

require_once __DIR__ . "/../../auth/sesi.php";
require_once __DIR__ . "/../../../config/database.php";

header("Content-Type: application/json; charset=UTF-8");

function jsonResponse(
    bool $success,
    string $message,
    array $data = [],
    int $httpCode = 200
): void {
    http_response_code($httpCode);

    echo json_encode([
        "success" => $success,
        "message" => $message,
        "data" => $data
    ], JSON_UNESCAPED_UNICODE);

    exit;
}

// =============================================
// VALIDASI AKSES
// =============================================

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

if (
    empty($_SESSION["login"]) ||
    ($_SESSION["role"] ?? "") !== "kepala_lab"
) {
    jsonResponse(
        false,
        "Akses ditolak. Hanya Kepala Lab yang dapat mengelola fasilitas.",
        [],
        403
    );
}

// =============================================
// FUNGSI BANTU
// =============================================

function getInput(): array
{
    $contentType = $_SERVER["CONTENT_TYPE"] ?? "";

    if (stripos($contentType, "application/json") !== false) {
        $input = json_decode(
            file_get_contents("php://input"),
            true
        );

        return is_array($input) ? $input : [];
    }

    return $_POST;
}

function validInteger($value, int $minimum = 0): bool
{
    $number = filter_var($value, FILTER_VALIDATE_INT);

    return $number !== false && $number >= $minimum;
}

// =============================================
// AMBIL ACTION
// =============================================

$method = $_SERVER["REQUEST_METHOD"];

$input = getInput();

$action = $input["action"] ?? $_GET["action"] ?? "";

// =============================================
// PROSES API
// =============================================

try {

    // =========================================
    // 1. MENAMPILKAN SELURUH FASILITAS
    // =========================================

    if ($method === "GET" || $action === "list") {

        $stmt = $pdo->query("
SELECT
    id_fasilitas,
    nama_fasilitas,
    kapasitas_maksimum,
    bobot,
    bobot_utama,
    deskripsi,
    tanggal_dibuat
FROM fasilitas
            ORDER BY id_fasilitas ASC
        ");

        $facilities = $stmt->fetchAll();

        jsonResponse(
            true,
            "Data fasilitas berhasil diambil.",
            $facilities
        );
    }

    if ($method !== "POST") {
        jsonResponse(
            false,
            "Metode permintaan tidak diizinkan.",
            [],
            405
        );
    }

    // =========================================
    // 2. TAMBAH FASILITAS
    // =========================================

    if ($action === "create") {

        $name = trim($input["nama_fasilitas"] ?? "");
        $capacity = $input["kapasitas_maksimum"] ?? "";
        $description = trim($input["deskripsi"] ?? "");

        if ($name === "") {
            jsonResponse(false, "Nama fasilitas wajib diisi.", [], 422);
        }

        if (!validInteger($capacity, 1)) {
            jsonResponse(
                false,
                "Kapasitas minimal 1 unit.",
                [],
                422
            );
        }

        $check = $pdo->prepare("
            SELECT COUNT(*)
            FROM fasilitas
            WHERE LOWER(nama_fasilitas) = LOWER(:nama)
        ");

        $check->execute([
            ":nama" => $name
        ]);

        if ((int) $check->fetchColumn() > 0) {
            jsonResponse(
                false,
                "Nama fasilitas sudah digunakan.",
                [],
                409
            );
        }

        $stmt = $pdo->prepare("
            INSERT INTO fasilitas (
                nama_fasilitas,
                kapasitas_maksimum,
                bobot,
                deskripsi
            ) VALUES (
                :nama,
                :kapasitas,
                0,
                :deskripsi
            )
        ");

        $stmt->execute([
            ":nama" => $name,
            ":kapasitas" => (int) $capacity,
            ":deskripsi" => $description
        ]);

        jsonResponse(
            true,
            "Fasilitas berhasil ditambahkan.",
            [
                "id_fasilitas" => $pdo->lastInsertId()
            ],
            201
        );
    }

    // =========================================
    // 3. EDIT FASILITAS
    // =========================================

    if ($action === "update") {

        $id = $input["id_fasilitas"] ?? "";
        $name = trim($input["nama_fasilitas"] ?? "");
        $capacity = $input["kapasitas_maksimum"] ?? "";
        $description = trim($input["deskripsi"] ?? "");

        if (!validInteger($id, 1)) {
            jsonResponse(false, "ID fasilitas tidak valid.", [], 422);
        }

        if ($name === "") {
            jsonResponse(false, "Nama fasilitas wajib diisi.", [], 422);
        }

        if (!validInteger($capacity, 1)) {
            jsonResponse(false, "Kapasitas minimal 1 unit.", [], 422);
        }

        $check = $pdo->prepare("
            SELECT id_fasilitas
            FROM fasilitas
            WHERE LOWER(nama_fasilitas) = LOWER(:nama)
            AND id_fasilitas != :id
        ");

        $check->execute([
            ":nama" => $name,
            ":id" => (int) $id
        ]);

        if ($check->fetch()) {
            jsonResponse(
                false,
                "Nama fasilitas sudah digunakan.",
                [],
                409
            );
        }

        $stmt = $pdo->prepare("
            UPDATE fasilitas
            SET
                nama_fasilitas = :nama,
                kapasitas_maksimum = :kapasitas,
                deskripsi = :deskripsi
            WHERE id_fasilitas = :id
        ");

        $stmt->execute([
            ":nama" => $name,
            ":kapasitas" => (int) $capacity,
            ":deskripsi" => $description,
            ":id" => (int) $id
        ]);

        if ($stmt->rowCount() === 0) {
            $check = $pdo->prepare("
                SELECT id_fasilitas
                FROM fasilitas
                WHERE id_fasilitas = :id
            ");

            $check->execute([":id" => (int) $id]);

            if (!$check->fetch()) {
                jsonResponse(
                    false,
                    "Fasilitas tidak ditemukan.",
                    [],
                    404
                );
            }
        }

        jsonResponse(true, "Fasilitas berhasil diperbarui.");
    }

    // =========================================
    // 4. HAPUS FASILITAS
    // =========================================

    if ($action === "delete") {

        $id = $input["id_fasilitas"] ?? "";

        if (!validInteger($id, 1)) {
            jsonResponse(false, "ID fasilitas tidak valid.", [], 422);
        }

        $check = $pdo->prepare("
            SELECT id_fasilitas
            FROM fasilitas
            WHERE id_fasilitas = :id
        ");

        $check->execute([
            ":id" => (int) $id
        ]);

        if (!$check->fetch()) {
            jsonResponse(
                false,
                "Fasilitas tidak ditemukan.",
                [],
                404
            );
        }

        $stmt = $pdo->prepare("
            DELETE FROM fasilitas
            WHERE id_fasilitas = :id
        ");

        $stmt->execute([
            ":id" => (int) $id
        ]);

        jsonResponse(true, "Fasilitas berhasil dihapus.");
    }

    // =========================================
    // 5. SIMPAN SELURUH BOBOT FASILITAS
    // =========================================

    if ($action === "save_weights") {

        $weights = $input["weights"] ?? [];

        if (!is_array($weights) || count($weights) === 0) {
            jsonResponse(
                false,
                "Data bobot fasilitas tidak tersedia.",
                [],
                422
            );
        }

        $total = 0;
        $normalized = [];

        foreach ($weights as $item) {

            $id = $item["id_fasilitas"] ?? "";
            $weight = $item["bobot"] ?? "";

            if (
                !validInteger($id, 1) ||
                !validInteger($weight, 0) ||
                (int) $weight > 100
            ) {
                jsonResponse(
                    false,
                    "ID atau bobot fasilitas tidak valid.",
                    [],
                    422
                );
            }

            if (isset($normalized[(int) $id])) {
                jsonResponse(
                    false,
                    "Fasilitas tidak boleh dikirim berulang.",
                    [],
                    422
                );
            }

            $normalized[(int) $id] = (int) $weight;

            $total += (int) $weight;
        }

        if ($total !== 100) {
            jsonResponse(
                false,
                "Total bobot fasilitas harus tepat 100%. Total saat ini: {$total}%.",
                ["total" => $total],
                422
            );
        }

        $stmt = $pdo->query("
            SELECT id_fasilitas
            FROM fasilitas
        ");

        $databaseIds = array_map(
            "intval",
            $stmt->fetchAll(PDO::FETCH_COLUMN)
        );

        $submittedIds = array_keys($normalized);

        sort($databaseIds);
        sort($submittedIds);

        if ($databaseIds !== $submittedIds) {
            jsonResponse(
                false,
                "Daftar fasilitas berubah. Muat ulang data sebelum menyimpan.",
                [],
                409
            );
        }

        $pdo->beginTransaction();

        try {

            $update = $pdo->prepare("
                UPDATE fasilitas
                SET bobot = :bobot
                WHERE id_fasilitas = :id
            ");

            foreach ($normalized as $id => $weight) {

                $update->execute([
                    ":bobot" => $weight,
                    ":id" => $id
                ]);
            }

            $pdo->commit();

        } catch (Throwable $e) {

            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $e;
        }

        jsonResponse(
            true,
            "Bobot seluruh fasilitas berhasil disimpan.",
            ["total" => 100]
        );
    }

    // =========================================
    // ACTION TIDAK DIKENALI
    // =========================================

    jsonResponse(
        false,
        "Aksi API tidak dikenali.",
        [],
        400
    );

} catch (PDOException $e) {

    error_log("API FASILITAS DATABASE ERROR: " . $e->getMessage());

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    if ($e->getCode() === "23000") {
        jsonResponse(
            false,
            "Fasilitas tidak dapat dihapus karena masih digunakan oleh pengajuan.",
            [],
            409
        );
    }

    jsonResponse(
        false,
        "Terjadi kesalahan pada database.",
        [],
        500
    );

} catch (Throwable $e) {

    error_log("API FASILITAS ERROR: " . $e->getMessage());

    jsonResponse(
        false,
        "Terjadi kesalahan pada sistem.",
        [],
        500
    );
}
