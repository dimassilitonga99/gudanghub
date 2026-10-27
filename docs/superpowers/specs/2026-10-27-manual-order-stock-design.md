# Desain: Stok Barang Manual di Order

- **Tujuan:** Barang baru yang belum tercatat di katalog bisa ditambahkan ke keranjang tanpa mengisi stok gudang/toko; nilai kosong dianggap `0`.
- **Cakupan:** Form tambah/edit barang manual dan validasi submit order. Nama barang, jumlah order, dan satuan order wajib diisi. Kode barang opsional; bila kosong ditampilkan dan dikirim sebagai `-`. Barang katalog tetap wajib memiliki stok gudang dan toko sebelum order dikirim.
- **Bukan tujuan:** Mengubah format payload order, aturan stok untuk katalog, atau flow barang manual hasil scan.
- **Pendekatan:** (1) Khusus item manual: stok kosong dinormalisasi menjadi `0`, dikecualikan dari validasi stok saat submit; (2) hapus validasi stok untuk semua item. Pilihan: pendekatan 1, menjaga validasi katalog seperti sekarang.
- **Keputusan teknis:** Pertahankan stok kosong sebagai input yang sah; pada submit manual kirim `0` untuk stok kosong. Cart menandai manual lewat `isManual`; gunakan penanda itu agar hanya item manual bebas dari validasi stok. Form menandai nama, jumlah, dan satuan sebagai wajib; kode diberi keterangan opsional. Pesan validasi menegaskan stok katalog masih wajib.
