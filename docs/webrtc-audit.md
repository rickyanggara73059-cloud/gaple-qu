# Audit WebRTC Gaplek — 26 September 2026

## A. File dan batas cakupan

- `app/components/VoiceChat.tsx`: RTCPeerConnection, STUN, audio, offer/answer, trickle ICE, Broadcast voice, cleanup.
- `app/components/DominoGame.tsx`: integrasi komponen voice. Baseline hanya mengimpor VoiceChat tanpa merendernya.
- `app/page.tsx`: identitas room/player dan subscription Postgres untuk rooms/players.
- `lib/supabase.ts`: singleton Supabase dari environment publik.
- Gameplay menggunakan RPC dan Postgres Realtime di DominoGame; bukan WebRTC.
- Tidak ada createDataChannel, ondatachannel, atau lifecycle DataChannel dalam source aktif. Tidak ditambahkan transport gameplay baru.

## B. Alur baseline

Alur yang dimaksud: klik mic -> getUserMedia -> addTrack -> negotiationneeded -> createOffer -> setLocalDescription -> Broadcast description -> setRemoteDescription -> createAnswer -> setLocalDescription -> Broadcast description -> setRemoteDescription di pengirim.

ICE dari kedua sisi dikirim lewat event signal pada channel domino-voice-${roomId}, dengan from/to berupa player.id. Candidate sebelum remoteDescription sudah diantrekan. Peer polite ditentukan dari perbandingan ID.

Namun komponen tidak dirender, sehingga alur tersebut tidak pernah dimulai melalui UI aktif. Masuk room saja juga bukan pemicu koneksi audio; voice memerlukan komponen aktif dan paling sedikit satu pemain mengaktifkan mic.

Signaling voice tidak menggunakan INSERT/UPDATE database. Postgres events untuk room/player terpisah dan snapshot pemain digunakan untuk memfilter pengirim. Keberhasilan event server produksi, publication, dan kebijakan RLS belum diverifikasi langsung.

## C. Temuan baseline

1. VoiceChat tidak dipasang di render tree (terbukti dari pencarian source aktif).
2. sendSignal membuang pesan ketika channelRef kosong; hasil send diabaikan.
3. Snapshot pemain dapat terlambat; pesan pengirim yang belum dikenal dibuang tanpa discovery berkala.
4. Handler async dapat tumpang tindih. Rollback eksplisit saat makingOffer belum selesai bisa tidak sesuai signalingState.
5. Antrean ICE awal ada, tetapi tidak ada deduplikasi; candidate offer yang diabaikan masih dapat diantrekan.
6. Tidak ada log state ICE/signaling/connection atau subscription dan pengiriman/penerimaan pesan.
7. Cleanup menutup peer/channel, tetapi tidak menghentikan track microphone lokal; closure remoteStreams untuk cleanup juga dapat usang.
8. Kegagalan autoplay audio disembunyikan.
9. Dua URL STUN Google dikonfigurasi dengan format benar. Ketersediaan jaringan STUN belum diuji langsung; TURN belum ada.

## D. Root cause

Penyebab utama yang terkonfirmasi adalah komponen voice tidak dirender. Masalah readiness dan negosiasi merupakan race yang dapat dilihat dari kode dan diuji dengan simulasi; belum merupakan bukti penyebab gangguan pada jaringan perangkat pengguna. NAT tidak boleh dianggap akar masalah sebelum signaling dan ICE diamati pada kedua browser.

## E. Patch yang diterapkan

- Render komponen VoiceChat yang sudah ada di kontrol header game; key room/player memastikan lifecycle terpisah. Kontrol diberi wrap untuk ruang layar kecil.
- Hello menyertakan readyFor (snapshot ID pemain yang dikenal); track ditambahkan setelah subscription lokal dan kesiapan peer diketahui.
- Ulangi hello setiap 3 detik untuk mengatasi subscription/roster yang terlambat; balas hello pertama tanpa loop balasan tanpa batas.
- Aktifkan Broadcast ack dan log hasil send. Ack adalah penerimaan server, bukan konfirmasi peer.
- Serialkan operasi offer dan penanganan description/ICE per peer; gunakan implicit rollback untuk peer polite.
- Pertahankan antrean candidate awal, deduplikasi, dan abaikan candidate ketika offer collision ditolak.
- Log roomId, playerId, peerId, offer/answer, remote description, candidate generated/received/queued/added, gathering/ICE/signaling/connection state, error, serta autoplay. SDP dan alamat candidate tidak dicetak.
- Cleanup channel/timer/peer/microphone, abaikan callback subscription lama, dan hentikan stream jika izin mic selesai setelah unmount.
- Periksa secure context/mediaDevices sebelum getUserMedia.

## F. Risiko dan batasan

- Gameplay/RPC/schema Supabase/STUN tetap memakai baseline. Tidak ada layanan TURN berbayar atau dependency baru.
- Kedua browser harus memuat versi baru (reload), karena handshake readyFor mengharuskan peer memahami kesiapan roster.
- Hello berkala menambah sedikit trafik Broadcast; logging bersifat diagnostik sementara.
- Tidak ada retry/ack end-to-end untuk setiap SDP/candidate atau ICE restart otomatis. Putus jaringan setelah negosiasi dimulai, refresh peer dengan ID sama, dan reconnect panjang masih perlu pengujian; discovery berkala bukan jaminan pemulihan semua kasus tersebut.
- Kandidat duplikat difilter dalam lifecycle peer; tidak dilakukan redesign protokol sesi/ICE generation.
- Browser dapat memblokir autoplay walaupun ICE connected. Log audio playback blocked membedakannya dari kegagalan transport; interaksi pengguna/izin audio dapat diperlukan.
- STUN tidak merelay trafik. NAT/firewall/operator tertentu memerlukan TURN, misalnya coturn milik sendiri. Patch ini tidak menjamin koneksi pada semua jaringan.
- Pengujian otomatis memakai mock RTC dan Supabase, bukan Chrome/Android atau server Realtime sebenarnya.

## Validasi

Perintah: `node --test scripts/webrtc-signaling.test.cjs`, `npm run build`, dan `node node_modules/typescript/bin/tsc --noEmit --incremental false`.

Tujuh tes mencakup mounting, readiness, offer/answer, ICE terlalu awal/duplikat, handler bersamaan, glare polite/impolite, cleanup/callback terlambat, dan subscription tidak tersedia.

## Pengujian PC Chrome ↔ HP Chrome Android

1. Gunakan deployment HTTPS versi patch pada kedua perangkat. Reload keduanya. Buat/join room yang sama dengan dua identitas pemain berbeda, lalu masuk layar game sesuai flow yang sudah ada; VoiceChat dipasang di layar game, bukan lobby.
2. Awali dengan Wi-Fi yang sama. Gunakan headset untuk menghindari feedback. Buka DevTools PC; untuk HP gunakan remote debugging Chrome bila tersedia. Filter console `[WebRTC]`.
3. Pastikan roomId sama, playerId berbeda, dan kedua sisi memiliki subscription SUBSCRIBED serta signal received untuk hello. Tidak ada peer connection saat semua mic mati adalah perilaku normal.
4. Klik MIC ON di PC dan izinkan mic. Pastikan offer created -> signal received description di HP -> remote description set offer -> answer created -> remote description set answer di PC.
5. Pastikan candidate generated pada pengirim dan received/added pada lawan; candidate queued harus akhirnya added (queued). Tunggu signalingState stable, iceConnectionState connected/completed, connectionState connected, dan audio PC terdengar di HP.
6. Aktifkan mic HP, pastikan audio dua arah. Uji mic bersamaan, urutan HP dulu, peer terlambat masuk, mute/unmute, dan keluar room. Saat keluar, indikator penggunaan mic harus berhenti.
7. Ulangi PC Wi-Fi ↔ HP data seluler. Jika description selesai tetapi ICE failed, periksa candidate pair lewat chrome://webrtc-internals di PC dan kemungkinan kebutuhan TURN. STUN error tunggal bukan bukti final kegagalan semua jalur.
8. Jika send result ok tetapi tidak ada signal received di lawan, periksa room/player ID, subscription, dan kesiapan roster. Jika connected tetapi sunyi, periksa autoplay, izin/output audio, mic mute, serta statistik RTP.

Kriteria lulus nyata: kedua perangkat connected, audio dua arah, mute/unmute bekerja, serta cleanup mic berhasil. Belum ada klaim bahwa kriteria ini sudah diuji pada perangkat fisik.

Referensi: https://supabase.com/docs/guides/realtime/broadcast ; https://w3c.github.io/webrtc-pc/#perfect-negotiation-example ; https://webrtc.org/getting-started/turn-server
