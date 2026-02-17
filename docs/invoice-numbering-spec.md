# Invoice Numbering Validation Spec

**Goal**
- Menyediakan aturan validasi yang aman, konsisten, dan dapat diuji.

**Supported Tokens**
- `{YYYY}` tahun 4 digit.
- `{YY}` tahun 2 digit.
- `{MM}` bulan 2 digit.
- `{DD}` hari 2 digit.
- `{SEQ:n}` nomor urut dengan padding `n` digit, `n` dari 2 sampai 8.
- `{BIZ}` slug bisnis yang disanitasi.

**Allowed Characters**
- Huruf A-Z, angka 0-9, tanda `-`, `_`, `/`, `.`.
- Spasi tidak diperbolehkan.
- Panjang total hasil akhir maksimal 32 karakter.

**Validation Rules**
- Pattern wajib mengandung tepat satu token `{SEQ:n}`.
- Token tidak boleh diulang, kecuali `{SEQ:n}` yang memang satu kali.
- `{YYYY}` dan `{YY}` tidak boleh dipakai bersamaan.
- `{MM}` dan `{DD}` hanya valid jika `{YYYY}` atau `{YY}` ada.
- `{BIZ}` opsional, namun slug harus non-kosong.
- `reset_period=monthly` mensyaratkan `{MM}` ada.
- `reset_period=yearly` mensyaratkan `{YYYY}` atau `{YY}` ada.
- `reset_period=none` tidak mensyaratkan tanggal.

**Sanitization**
- `{BIZ}` dihasilkan dari nama bisnis, uppercase, ganti spasi dengan `-`.
- Hanya A-Z dan 0-9 yang dipertahankan, karakter lain dihapus.
- Jika hasil `{BIZ}` kosong, return error `BIZ_SLUG_EMPTY`.

**Sequence Rules**
- `n` minimum 2 dan maksimum 8.
- Sequence disimpan integer, lalu dipad sesuai `n`.
- Jika sequence melebihi padding, gunakan angka penuh tanpa truncate.
- Jika angka melewati batas `99999999`, return error `SEQ_OVERFLOW`.

**Preview Rules**
- Preview tidak mengubah sequence.
- Preview harus menggunakan `issue_date` dari request, fallback ke tanggal sekarang.

**Error Codes**
- `PATTERN_INVALID_CHARS`
- `PATTERN_TOO_LONG`
- `PATTERN_MISSING_SEQ`
- `PATTERN_MULTIPLE_SEQ`
- `PATTERN_CONFLICT_YEAR`
- `PATTERN_DATE_WITHOUT_YEAR`
- `PATTERN_MONTH_REQUIRED`
- `PATTERN_YEAR_REQUIRED`
- `SEQ_PADDING_INVALID`
- `BIZ_SLUG_EMPTY`
- `SEQ_OVERFLOW`

**Edge Cases**
- Pattern: `INV-{YYYY}-{SEQ:4}` dengan `reset_period=monthly` -> error `PATTERN_MONTH_REQUIRED`.
- Pattern: `INV-{YY}{MM}-{SEQ:4}` dengan `reset_period=yearly` -> ok.
- Pattern: `INV-{MM}-{SEQ:4}` -> error `PATTERN_DATE_WITHOUT_YEAR`.
- Pattern: `INV-{YYYY}-{SEQ:1}` -> error `SEQ_PADDING_INVALID`.
- Pattern: `INV-{YYYY}-{SEQ:10}` -> error `SEQ_PADDING_INVALID`.
- Pattern: `INV-{YYYY}-{SEQ:4}-{SEQ:4}` -> error `PATTERN_MULTIPLE_SEQ`.
- Pattern: `INV-{YYYY}-{YY}-{SEQ:4}` -> error `PATTERN_CONFLICT_YEAR`.
- Pattern: `INV-{BIZ}-{SEQ:4}` dan nama bisnis kosong -> error `BIZ_SLUG_EMPTY`.
- Sequence = 10000 dengan `{SEQ:4}` -> hasil `10000` tanpa truncate.
