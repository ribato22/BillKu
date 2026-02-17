# Deletion and Retention Policy (Draft)

**Disclaimer**
- Draft ini adalah baseline produk dan perlu review legal sebelum digunakan sebagai kebijakan resmi.

**Objectives**
- Memenuhi kebutuhan data minimization dan hak penghapusan.
- Menjaga data finansial yang dibutuhkan untuk audit internal atau kebutuhan bisnis.

**Data Classes**
- Identitas pengguna: email, password hash.
- Data bisnis: profil, rekening.
- Data pelanggan: nama, kontak, alamat.
- Data transaksi: invoice, items, payments.
- Data operasional: logs, audit, export artifacts.

**Default Retention (Proposed)**
- Invoice dan payment: 5 tahun sejak tanggal invoice.
- Customer: 30 hari setelah soft delete sebelum hard delete atau anonymize.
- Export file: 7 hari setelah dibuat.
- Audit log: 2 tahun.
- Auth log dan rate limit: 90 hari.

**Deletion Workflow**
- Soft delete untuk customer melalui endpoint delete.
- Soft delete menyembunyikan customer dari UI dan API list default.
- Request penghapusan masuk ke queue dan dicatat di tabel `delete_requests`.
- Hard delete atau anonymize berjalan oleh background job setiap hari.
- Data transaksi tidak dihapus otomatis jika terikat invoice.

**Anonymization Rules**
- Saat customer memiliki invoice, lakukan anonymize, bukan delete.
- Field yang dianonimkan: `name`, `phone`, `email`, `address`.
- Nilai anonymize berupa placeholder konsisten, contoh `DELETED-<id>`.
- Foreign key tetap dipertahankan untuk menjaga integritas transaksi.

**Retention Override**
- Admin dapat memperpanjang retensi jika ada legal hold.
- Legal hold dicatat di tabel `legal_holds` dengan alasan dan tanggal.

**Export and Access Requests**
- Export data harus tersedia sebelum hard delete.
- Export tidak memuat password hash.

**Audit Requirements**
- Semua request delete dicatat dengan `requested_by`, `requested_at`, dan `status`.
- Semua job hard delete/anonymize dicatat dengan `performed_by` dan `performed_at`.
