import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createAdminClient } from '@/utils/supabase/admin';
import { waitUntil } from '@vercel/functions';
import { normalizePhone } from '@/utils/phone';
import { getAiModelCandidates, getConfiguredAiModel, isRetryableAiError } from '@/utils/aiAgent';
import {
  NON_TEXT_MESSAGE,
  buildBurstContext,
  claimOutboundAttempt,
  getWebhookDedupeKey,
  normalizeFonnteFailure,
  normalizeFonnteResponse,
  normalizeWebhookIdentifier,
  selectBurstMessages,
} from '@/utils/whatsappWebhook.mjs';
const supabase = new Proxy({}, {
  get(_target, property) {
    const client = createAdminClient()
    return typeof client[property] === 'function' ? client[property].bind(client) : client[property]
  }
});

export const maxDuration = 60; // Allow API route to run for up to 60 seconds on Vercel

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const FONNTE_API_URL = 'https://api.fonnte.com/send';
const FONNTE_TOKEN = process.env.FONNTE_TOKEN;

const ADMIN_NUMBER = '6282121316926';

function getMediaKind(body) {
  const extension = normalizeWebhookIdentifier(body.extension);
  const filename = normalizeWebhookIdentifier(body.filename);
  if (extension) return extension.toLowerCase();
  if (filename?.includes('.')) return filename.split('.').pop().toLowerCase();
  const type = normalizeWebhookIdentifier(body.type);
  if (type && !['text', 'chat'].includes(type.toLowerCase())) return type.toLowerCase();
  if (normalizeWebhookIdentifier(body.url) || normalizeWebhookIdentifier(body.file)) return 'lampiran';
  return null;
}

async function claimIncomingMessage(sender, message, dedupeKey) {
  const incomingMessage = { phone_number: sender, role: 'user', content: message };
  if (dedupeKey) incomingMessage.dedupe_key = dedupeKey;
  const { data, error } = await supabase
    .from('wa_chat_history')
    .insert([incomingMessage])
    .select('id, created_at')
    .single();

  if (error?.code === '23505') return { duplicate: true, data: null, error: null };
  if (error) return { duplicate: false, data: null, error };
  return { duplicate: false, data, error: null };
}

const SYSTEM_PROMPT = (pushname) => `
  Kamu adalah Admin King Sablon Cup. Namamu adalah Ina.
  Tugas utamamu adalah membalas chat dari pelanggan WhatsApp dengan ramah, santai tapi sopan, menggunakan bahasa gaul yang tetap profesional (misal: "Halo kak", "Bisa dibantu", "Siap kak", "Ditunggu ya").
  
  PENTING - ATURAN GAYA BAHASA:
  Jawablah dengan SANGAT SINGKAT, PADAT, dan langsung ke intinya. JANGAN PERNAH membalas dengan paragraf panjang yang bertele-tele. Maksimal 1-2 kalimat pendek saja. Hindari penjelasan panjang kecuali diminta.
  
  King Sablon Cup adalah perusahaan jasa sablon gelas plastik/kertas (cup) untuk minuman kekinian.
  Nama profil WhatsApp pelanggan saat ini adalah: "${pushname}". Jika dia menanyakan pesanan atas namanya, kamu bisa menggunakan nama ini untuk mencari di database.

PENTING - KNOWLEDGE BASE KING SABLON CUP:
1. Alamat & Jam Buka:
   - Alamat: Jl. Ir. H. Juanda No. 71, Weru - Kab. Cirebon (Samping J&M Mart).
   - Google Maps: https://maps.google.com/?q=King+Sablon+Cup
   - Jam Operasional: Buka Senin s/d Sabtu, pukul 09.00 - 17.00 WIB. (Minggu dan Tanggal Merah TUTUP).
   - Di luar jam operasional, kamu (AI) yang akan menjawab semua pertanyaan secara otomatis.
2. Tinta Sablon & Warna:
   - Sablon cup BUKAN menggunakan sistem warna digital/print/foto (RGB atau CMYK).
   - Sablon menggunakan **Tinta Sablon Solid** (warna blok pasti). Oleh karena itu, desain tidak boleh ada efek gradasi, bayangan, atau efek foto transparan.
   - Pilihan warna: Bebas! Konsumen boleh pilih warna tinta solid apa saja (Merah solid, Hitam, Biru, Hijau, Gold, Silver, dll).
   - Batas Warna: Sablon maksimal adalah **2 Warna** yang posisinya saling terpisah (tidak bisa tumpuk gradasi). Jika 2 warna, biaya jasa bertambah Rp 250/pcs.
3. Sisi Sablon (Full Melingkar):
   - Jika ditanya "bisa berapa sisi?", Jawab: "Bisa sablon 1 sisi, 2 sisi, 3 sisi, hingga full melingkar! Harganya tetap sama."
   - PENTING TENTANG FULL MELINGKAR: Jika desainnya full melingkar keliling cup, beritahu bahwa akan selalu ada **jarak terputus (blank space) sekitar 1-2 cm** di titik ujung pertemuannya. Hal ini wajar karena itu adalah area jepitan layar (screen) pada mesin sablon silinder.
4. Waktu Proses Sablon:
   - Reguler: 3-5 hari kerja (tergantung antrean produksi).
   - Fast Track (Jalur Cepat): 1-3 hari kerja (+Rp 100.000 per 1.000 pcs). Batas maksimal Fast Track adalah 1.000 pcs per pesanan. Sisanya ikut antrean reguler.
   - Catatan: "1 hari kerja" berarti butuh 1 hari proses. Jika pesan hari ini, kemungkinan selesai besok sore, BUKAN di hari H.
5. Order & Pricelist Sablon:
   - Jika ditanya daftar harga, pricelist, atau produk, berikan link ini: https://erpkscv1.vercel.app/order (Bisa hitung harga dan bikin invoice otomatis).
6. Edukasi Produk Umum:
   - Untuk pertanyaan beda PP/PET, ukuran Oz, dsb, gunakan wawasan AI-mu secara cerdas.

Jika pelanggan menanyakan status pesanan, COBA DULU gunakan nama profil WhatsApp mereka ("${pushname}") atau baca dari history chat sebelumnya untuk mencari datanya menggunakan tool "cek_pesanan".
Jika data tidak ditemukan dengan nama profil tersebut, JANGAN meminta nomor invoice atau kode apapun. Tanyakan dengan ramah: "Boleh diinfokan nama brand-nya apa kak?" lalu gunakan alat "cek_pesanan" lagi dengan nama brand tersebut.
Jawablah berdasarkan data yang didapatkan dari tool tersebut. Jika statusnya "PROSES", sampaikan bahwa sedang dicetak. Jika "SIAP KIRIM", sampaikan bahwa pesanan sudah selesai dan menunggu pelunasan/siap diambil.
PENTING: Setiap kali kamu menemukan data pesanan pelanggan, kamu WAJIB memberikan link Tracking Publik berikut agar mereka bisa memantau sendiri: https://erpkscv1.vercel.app/track/[NOMOR_INVOICE] (ganti [NOMOR_INVOICE] dengan invoice yang sesuai).
Jika data masih tidak ditemukan setelah dicari dengan nama brand, katakan dengan sopan bahwa pesanan atas nama brand tersebut belum ditemukan.
Jangan menjanjikan sesuatu yang tidak ada di database atau diluar Knowledge Base di atas.

PENTING - HUMAN HANDOVER:
Jika pelanggan bertanya hal yang terlalu rumit, custom (seperti komplain, desain yang rumit, dll), atau jika pesanan tidak ada di database, kamu TIDAK BOLEH mengarang jawaban.
Kirimkan pesan penutup ini: "Untuk detail lebih lanjut, nanti dilanjut dengan rekan saya ketika sedang online ya kak. Terima kasih! 🙏"
`;

const AI_PROCESSING_TIMEOUT_MS = 35000;
const BURST_WINDOW_MS = 2500;
const GREETING_PATTERN = /^(halo|pagi|siang|sore|malam|assalamualaikum|ping|hi|hey|p)$/i;
const THANKS_PATTERN = /^(terima kasih|makasih|thank you|thx|suwun|hatur nuhun|tq|makasi|thanks)$/i;
const ACKNOWLEDGEMENT_PATTERN = /^(ok|oke|siap|sip|okey|yoi|ready|noted)$/i;
const ORDER_STATUS_PATTERN = /^(pesanan saya|sudah jadi belum|sampai mana|cek pesanan|status pesanan|cek status|pesananku|invoice \S+)$/i;

const TEMPLATE_RULES = [
  {
    pattern: /(alamat|dimana|lokasi|toko|tempat)/i,
    reply: "Alamat kami di:\nJl. Ir. H. Juanda No. 71, Weru - Kab. Cirebon (Samping J&M Mart).\n📍 *Google Maps:* https://maps.google.com/?q=King+Sablon+Cup\n\n🕒 *Jam Buka:*\nSenin - Sabtu: 09.00 - 17.00 WIB\n(Minggu & Tanggal Merah Libur)",
  },
  {
    pattern: /(pembayaran|rekening|bayar|cod)/i,
    reply: "Pembayaran bisa cash di toko atau transfer:\n- Bank BCA: 6930240107 a/n Khoerur Rijal\n- Bank Mandiri: 9000020365095 a/n Khoerur Rijal",
  },
  {
    pattern: /(desain|logo)/i,
    reply: "Bisa kak! Jika sudah punya logo, kirim saja logonya lalu detail keinginannya via teks, nanti dibuatkan oleh editor kami.\nJika belum punya logo dan ingin *full* dibuatkan dari nol, ada biaya desain Rp 50.000.\nKakak juga bisa explore desain sendiri di aplikasi kami: cupstudio.id 🎨",
  },
  {
    pattern: /(warna|rgb|cmyk|gradasi|tinta)/i,
    reply: "Sablon cup kami menggunakan *Tinta Solid*, BUKAN sistem print/foto (RGB/CMYK) sehingga tidak bisa pakai desain gradasi/bayangan ya kak.\n\nNamun kakak bebas pilih warna tinta solid apa saja (Hitam, Merah, Gold, dll). Maksimal sablon adalah 2 warna terpisah.",
  },
  {
    pattern: /(berapa sisi|sisi|full|melingkar|keliling)/i,
    reply: "Bisa sablon 1 sisi, 2 sisi, 3 sisi, hingga *full* melingkar, harga tetap sama kak!\n\n*(Catatan penting: Untuk sablon full melingkar, pasti akan ada jarak terputus/kosong sekitar 1-2 cm di titik pertemuannya karena area jepitan mesin sablon).*",
  },
  {
    pattern: /(kertas|paper cup|paper bowl|varian)/i,
    reply: "Untuk sablon cup kertas, kami menyediakan Paper Cup dan Paper Bowl berbagai ukuran kak!",
  },
  {
    pattern: /(minimal order|min order|moq|bisa pesan \d+|minimal pesan)/i,
    reply: "Minimal order tergantung jenis cup kak. Kalau cup PET minimal order 1.000 pcs (sudah ada di matrix sablon).",
  },
  {
    pattern: /(harga|pricelist|katalog|produk|price list|mau order|pesan cup|order cup|bikin sablon|mau pesan|pesen)/i,
    reply: "Baik kak, Untuk cek detail produk dan harga terbaru, Kakak bisa langsung klik link ini ya: https://erpkscv1.vercel.app/order\n\nKakak bisa langsung hitung harga otomatis, membuat pesanan, dan mendapatkan Invoice untuk masuk ke antrian sablon.",
  },
  {
    pattern: /(berapa lama|lama proses|proses sablon|lama pengerjaan)/i,
    reply: "Waktu proses sablon Reguler 3-5 hari kerja. Kami juga ada jalur Fast Track 1-3 hari kerja (+Rp 100rb per 1000 pcs).\n*(1 hari kerja = kemungkinan selesai besok sore, bukan hari H ya kak).*",
  },
];

function getTemplateReplies(messages) {
  const normalizedMessages = messages.map(message => String(message || '').trim()).filter(Boolean);
  if (normalizedMessages.length === 1 && GREETING_PATTERN.test(normalizedMessages[0])) {
    return ["Halo kak! Saya Ina, Admin King Sablon Cup. Ada yang bisa dibantu? (Pricelist / Cek Pesanan / Tanya Lainnya)"];
  }

  const replies = [];
  for (const message of normalizedMessages) {
    for (const rule of TEMPLATE_RULES) {
      if (rule.pattern.test(message) && !replies.includes(rule.reply)) replies.push(rule.reply);
    }
  }
  return replies;
}

function logFonnteOutcome(eventKey, result) {
  const details = {
    event: eventKey ? eventKey.slice(-12) : 'manual-review',
    accepted: Boolean(result?.accepted),
    certainty: result?.certainty || 'unknown',
    providerStatus: result?.providerStatus ?? null,
    httpStatus: result?.httpStatus ?? null,
    requestId: result?.requestId ?? null,
    messageIds: result?.messageIds ?? [],
    process: result?.process ?? null,
    reason: result?.reason ?? result?.error ?? null,
  };
  console.info(`[Webhook] Fonnte send ${JSON.stringify(details)}`);
}

// Helper to run promises with timeout
function runWithTimeout(promise, ms) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('TIMEOUT')), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

// Helper to send message via Fonnte. A missing/ambiguous response is not retried:
// the provider may already have queued the message before the connection failed.
async function sendFonnteMessage(target, message, inboxId) {
  try {
    const formData = new URLSearchParams({ target, message });
    if (inboxId) formData.set('inboxid', String(inboxId));

    const response = await fetch(FONNTE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': FONNTE_TOKEN,
      },
      body: formData,
      signal: AbortSignal.timeout(10000),
    });
    let data;
    try {
      data = await response.json();
    } catch {
      return { accepted: false, certainty: 'unknown', httpStatus: response.status };
    }
    return normalizeFonnteResponse(response.ok, response.status, data);
  } catch (error) {
    return normalizeFonnteFailure(error);
  }
}

// Helper to check if current time is outside business hours (Mon-Sat 09:00 - 17:00 WIB)
function isOutsideBusinessHours() {
  const now = new Date();
  // Convert to Asia/Jakarta (WIB = UTC+7)
  const jakartaTimeStr = now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" });
  const jakartaTime = new Date(jakartaTimeStr);
  const day = jakartaTime.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const hour = jakartaTime.getHours(); // 0-23
  
  // Sunday is always outside business hours (Sunday = closed)
  if (day === 0) return true;
  // Monday to Saturday: business hours are 09:00 - 17:00 WIB
  if (hour < 9 || hour >= 17) return true;
  
  return false;
}

// Helper to query database for orders with phone matching & safe phone linking
async function searchOrdersWithPhoneLinking(senderPhone, searchQuery) {
  const normalizedSender = normalizePhone(senderPhone);

  // 1. PHONE MATCH: Cari customers.phone yang cocok
  const { data: matchedCustomers } = await supabase
    .from('customers')
    .select('customer_code, phone, name')
    .or(`phone.eq.${normalizedSender},phone.eq.${senderPhone}`);

  const resolvedCustomer = matchedCustomers?.find(c => normalizePhone(c.phone) === normalizedSender);

  if (resolvedCustomer) {
    const { data: orders } = await supabase
      .from('sales_orders')
      .select('invoice_number, status, date, customers (name), sales_items (qty, products (name))')
      .eq('customer_code', resolvedCustomer.customer_code)
      .in('status', ['PROSES', 'SIAP KIRIM', 'DRAFT', 'PENDING'])
      .order('date', { ascending: false })
      .limit(3);
    return orders || [];
  }

  // 2. CUSTOMER PHONE BELUM TERHUBUNG: Gunakan exact customer/brand name matching
  const cleanedQuery = searchQuery ? searchQuery.trim() : '';
  if (cleanedQuery.length < 3) {
    return []; // Terlalu pendek, hindari broad search
  }

  const { data: nameMatchedCustomers } = await supabase
    .from('customers')
    .select('customer_code, phone, name')
    .ilike('name', cleanedQuery);

  if (nameMatchedCustomers && nameMatchedCustomers.length === 1) {
    const candidateCustomer = nameMatchedCustomers[0];
    const isCandidatePhoneEmpty = !candidateCustomer.phone || candidateCustomer.phone.trim().length < 5;
    const isSenderAlreadyLinked = matchedCustomers && matchedCustomers.length > 0;

    // SAFE PHONE LINKING: Simpan nomor jika phone kosong dan sender belum terhubung ke customer lain
    if (isCandidatePhoneEmpty && !isSenderAlreadyLinked) {
      await supabase
        .from('customers')
        .update({ phone: normalizedSender })
        .eq('customer_code', candidateCustomer.customer_code);
    }

    const { data: orders } = await supabase
      .from('sales_orders')
      .select('invoice_number, status, date, customers (name), sales_items (qty, products (name))')
      .eq('customer_code', candidateCustomer.customer_code)
      .in('status', ['PROSES', 'SIAP KIRIM', 'DRAFT', 'PENDING'])
      .order('date', { ascending: false })
      .limit(3);
    return orders || [];
  }

  return []; // Ambigu atau tidak ditemukan
}

export async function POST(req) {
  try {
    let body;
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      body = await req.json();
    } else {
      const formData = await req.formData();
      body = Object.fromEntries(formData.entries());
    }
    if (!body || typeof body !== 'object') body = {};

    const sender = normalizeWebhookIdentifier(body.sender);
    const rawMessage = typeof body.message === 'string'
      ? body.message
      : typeof body.text === 'string' ? body.text : '';
    const pushname = normalizeWebhookIdentifier(body.pushname || body.name) || 'Kakak';
    const mediaKind = getMediaKind(body)
      || (rawMessage.trim().toLowerCase() === NON_TEXT_MESSAGE ? 'lampiran' : null);
    const textMessage = rawMessage.trim().toLowerCase() === NON_TEXT_MESSAGE ? '' : rawMessage.trim();
    const inboundContent = textMessage
      ? mediaKind ? `${textMessage}\n[[Lampiran:${mediaKind}]]` : textMessage
      : mediaKind ? NON_TEXT_MESSAGE : '';

    if (!sender || !inboundContent) {
      return NextResponse.json({ success: false, error: 'Missing sender or message' }, { status: 400 });
    }

    if (sender.includes('-')) {
      return NextResponse.json({ success: true, message: 'Ignored group message' });
    }

    const normalizedSender = normalizePhone(sender) || (sender.startsWith('0') ? `62${sender.slice(1)}` : sender);
    const dedupeKey = getWebhookDedupeKey({
      body,
      sender,
      normalizedSender,
      message: inboundContent,
      mediaKind: mediaKind || 'text',
    });

    // Claim before any reply path. The DB unique index makes provider retries
    // atomic across concurrent webhook invocations.
    const { data: insertedMsg, duplicate, error: claimError } = await claimIncomingMessage(sender, inboundContent, dedupeKey);
    if (claimError) {
      console.error('[Webhook] Could not claim incoming event:', claimError);
      return NextResponse.json({ success: false, error: 'Webhook dedupe unavailable' }, { status: 503 });
    }
    if (duplicate) {
      console.info('[Webhook] Duplicate inbound event ignored.');
      return NextResponse.json({ success: true, message: 'Duplicate ignored' });
    }

    if (!dedupeKey) {
      console.warn('[Webhook] Inbound event saved for manual handling; provider supplied no stable event identity.');
      return NextResponse.json({ success: true, message: 'Saved for manual handling' });
    }

    const inboxId = normalizeWebhookIdentifier(body.inboxid);
    const outboundState = { attempted: false };
    const sendReply = async (reply) => {
      if (!claimOutboundAttempt(outboundState)) {
        console.warn('[Webhook] Suppressed second outbound attempt for one processing burst.');
        return { accepted: false, certainty: 'known', reason: 'outbound-already-attempted' };
      }
      const outgoingReply = isOutsideBusinessHours()
        ? `Saat ini toko sedang tutup. Jam operasional King Sablon Cup: Senin-Sabtu, pukul 09.00-17.00 WIB.\n\n${reply}`
        : reply;
      const result = await sendFonnteMessage(sender, outgoingReply, inboxId);
      logFonnteOutcome(dedupeKey, result);

      if (result.accepted) {
        const { error: historyError } = await supabase.from('wa_chat_history').insert([{
          phone_number: sender,
          role: 'model',
          content: outgoingReply,
        }]);
        if (historyError) console.error('[Webhook] Fonnte accepted reply but history write failed:', historyError);
      }
      return result;
    };

    // --- 1. GLOBAL MASTER SWITCH ---
    if (normalizedSender === ADMIN_NUMBER) {
      const lowerMsg = textMessage.toLowerCase().trim();
      if (lowerMsg === '/bot on' || lowerMsg === '/bot auto') {
        await supabase.from('system_settings').upsert({ key: 'GLOBAL_BOT_ACTIVE', value: 'auto', updated_at: new Date().toISOString() });
        await sendReply("Sistem Otomatis / AI diatur ke mode AUTO (Aktif di luar jam operasional & hari libur).");
        return NextResponse.json({ success: true, message: 'Global bot set to auto' });
      }
      if (lowerMsg === '/bot off') {
        await supabase.from('system_settings').upsert({ key: 'GLOBAL_BOT_ACTIVE', value: 'false', updated_at: new Date().toISOString() });
        await sendReply("Sistem Otomatis / AI DIMATIKAN. Menunggu balasan manual dari Admin.");
        return NextResponse.json({ success: true, message: 'Global bot turned off' });
      }
      if (lowerMsg === '/bot always') {
        await supabase.from('system_settings').upsert({ key: 'GLOBAL_BOT_ACTIVE', value: 'always', updated_at: new Date().toISOString() });
        await sendReply("Sistem Otomatis / AI diatur ke mode ALWAYS (Aktif 24/7).");
        return NextResponse.json({ success: true, message: 'Global bot set to always on' });
      }
    }

    // Check if Global Bot is Active
    const { data: globalSetting } = await supabase.from('system_settings').select('value').eq('key', 'GLOBAL_BOT_ACTIVE').single();
    const globalBotValue = globalSetting ? globalSetting.value : 'true'; // Default to true (auto)

    if (globalBotValue === 'false') {
      return NextResponse.json({ success: true, message: 'Global bot is inactive' });
    }

    // --- 2. SESSION HANDLING ---
    let { data: session } = await supabase
      .from('wa_sessions')
      .select('*')
      .eq('phone_number', sender)
      .single();

    if (!session) {
      const { data: newSession } = await supabase
        .from('wa_sessions')
        .insert([{ phone_number: sender, is_bot_active: true }])
        .select()
        .single();
      session = newSession;
    } else {
      await supabase.from('wa_sessions').update({ last_interaction: new Date().toISOString() }).eq('phone_number', sender);
    }

    if (textMessage.trim() === '/stop') {
      await supabase.from('wa_sessions').update({ is_bot_active: false }).eq('phone_number', sender);
      return NextResponse.json({ success: true, message: 'Local bot turned off' });
    }
    if (textMessage.trim() === '/start') {
      await supabase.from('wa_sessions').update({ is_bot_active: true }).eq('phone_number', sender);
      return NextResponse.json({ success: true, message: 'Local bot turned on' });
    }

    if (!session?.is_bot_active) return NextResponse.json({ success: true, message: 'Local bot inactive' });

    waitUntil((async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, BURST_WINDOW_MS));

        const eventCreatedAt = new Date(insertedMsg.created_at);
        const quietDeadline = new Date(eventCreatedAt.getTime() + BURST_WINDOW_MS).toISOString();
        const { data: burstOwnerCandidates, error: laterBurstError } = await supabase
          .from('wa_chat_history')
          .select('id, created_at')
          .eq('phone_number', sender)
          .eq('role', 'user')
          .gte('created_at', insertedMsg.created_at)
          .lte('created_at', quietDeadline)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(1);
        if (laterBurstError) throw laterBurstError;
        if (burstOwnerCandidates?.[0]?.id !== insertedMsg.id) {
          console.info('[Webhook] A later event inside the quiet window owns this conversation burst.');
          return;
        }

        const { data: latestModelMessages, error: latestModelError } = await supabase
          .from('wa_chat_history')
          .select('created_at')
          .eq('phone_number', sender)
          .eq('role', 'model')
          .lt('created_at', insertedMsg.created_at)
          .order('created_at', { ascending: false })
          .limit(1);
        if (latestModelError) throw latestModelError;

        const { data: recentUserMessages, error: burstError } = await supabase
          .from('wa_chat_history')
          .select('id, created_at, content')
          .eq('phone_number', sender)
          .eq('role', 'user')
          .gt('created_at', latestModelMessages?.[0]?.created_at || new Date(eventCreatedAt.getTime() - 60 * 60 * 1000).toISOString())
          .lte('created_at', insertedMsg.created_at)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(500);
        if (burstError) throw burstError;

        const burstMessages = selectBurstMessages(recentUserMessages || [], insertedMsg.id, BURST_WINDOW_MS);
        if (!burstMessages.length) {
          console.warn('[Webhook] Claimed inbound event was not found in conversation history.');
          return;
        }
        const conversation = buildBurstContext(burstMessages);
        const burstText = conversation.text;
        const mediaNote = 'Catatan: Ina belum bisa membaca lampiran yang dikirim ya kak.';
        if (!burstText) {
          const mediaOnlyReply = 'Maaf kak, Ina belum bisa membaca foto atau file secara langsung. Boleh jelaskan isi atau pertanyaannya lewat teks ya kak? 🙏';
          await sendReply(mediaOnlyReply);
          return;
        }

        const individualMessages = (burstMessages || [])
          .map(item => buildBurstContext([item]).text)
          .filter(Boolean);
        const templateReplies = getTemplateReplies(individualMessages);
        let staticReply = null;

        if (!conversation.hasMedia && individualMessages.length === 1 && THANKS_PATTERN.test(burstText.trim())) {
          staticReply = 'Sama-sama kak! Senang bisa membantu. Jika ada hal lain yang perlu ditanyakan, silakan chat Ina lagi ya. 😊';
        } else if (!conversation.hasMedia && individualMessages.length === 1 && ACKNOWLEDGEMENT_PATTERN.test(burstText.trim())) {
          staticReply = 'Siap kak! 👍';
        } else if (templateReplies.length) {
          staticReply = templateReplies.join('\n\n');
        }

        if (staticReply) {
          await sendReply(conversation.hasMedia ? `${staticReply}\n\n${mediaNote}` : staticReply);
          return;
        }

        if (ORDER_STATUS_PATTERN.test(burstText.trim())) {
          const orders = await searchOrdersWithPhoneLinking(sender, pushname);
          let reply;
          if (orders?.length) {
            const orderSummary = orders.map(order =>
              `📌 *Invoice:* ${order.invoice_number}\n*Status:* ${order.status}\n*Item:* ${order.sales_items?.map(item => `${item.qty} pcs ${item.products?.name}`).join(', ')}\n*Tracking:* https://erpkscv1.vercel.app/track/${order.invoice_number}`
            ).join('\n\n');
            reply = `Ina sudah cek! Berikut detail pesanan atas nama kakak:\n\n${orderSummary}`;
          } else {
            reply = 'Wah maaf kak, Ina coba cari pesanan aktif atas nama WA kakak belum ketemu nih datanya. Boleh diinfokan nama brand-nya apa kak? Biar Ina bantu cari lagi 🙏';
          }
          await sendReply(conversation.hasMedia ? `${reply}\n\n${mediaNote}` : reply);
          return;
        }

        // Keep the existing policy: templates and order lookups work anytime;
        // free-form AI only answers outside business hours in auto mode.
        if ((globalBotValue === 'true' || globalBotValue === 'auto') && !isOutsideBusinessHours()) {
          console.info('[Webhook] Free-form AI response skipped during business hours.');
          return;
        }

        const { data: priorHistory, error: historyReadError } = await supabase
          .from('wa_chat_history')
          .select('role, content')
          .eq('phone_number', sender)
          .lt('created_at', burstMessages?.[0]?.created_at || insertedMsg.created_at)
          .order('created_at', { ascending: false })
          .limit(6);
        if (historyReadError) throw historyReadError;

        const formattedHistory = [];
        for (const item of (priorHistory || []).reverse()) {
          const role = item.role === 'user' ? 'user' : 'model';
          const content = item.content || ' ';
          if (!formattedHistory.length) {
            if (role === 'user') formattedHistory.push({ role, parts: [{ text: content }] });
            continue;
          }
          const lastMessage = formattedHistory[formattedHistory.length - 1];
          if (lastMessage.role === role) lastMessage.parts[0].text += `\n${content}`;
          else formattedHistory.push({ role, parts: [{ text: content }] });
        }

        let prompt = conversation.hasMedia
          ? `${burstText}\n\n[Pelanggan juga mengirim lampiran yang belum dapat dibaca.]`
          : burstText;
        const trailingHistoryMessage = formattedHistory[formattedHistory.length - 1];
        if (trailingHistoryMessage?.role === 'user') {
          prompt = `${trailingHistoryMessage.parts[0].text}\n${prompt}`;
          formattedHistory.pop();
        }

        const deadline = Date.now() + AI_PROCESSING_TIMEOUT_MS;
        const sendAiMessage = (chat, prompt) => {
          const remainingMs = deadline - Date.now();
          if (remainingMs <= 0) return Promise.reject(new Error('TIMEOUT'));
          return runWithTimeout(chat.sendMessage(prompt), remainingMs);
        };

        const remainingConfigTime = deadline - Date.now();
        if (remainingConfigTime <= 0) throw new Error('TIMEOUT');
        const agentModel = await runWithTimeout(getConfiguredAiModel(supabase), remainingConfigTime);
        const modelCandidates = getAiModelCandidates(agentModel).slice(0, 2);
        let chat;
        let result;
        let lastAiError;

        for (const modelName of modelCandidates) {
          if (Date.now() >= deadline) {
            lastAiError = new Error('TIMEOUT');
            break;
          }
          const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: `${SYSTEM_PROMPT(pushname)}\n\nJika pelanggan mengirim lampiran bersama teks, jawab pertanyaan teksnya dan sampaikan singkat bahwa lampiran belum dapat dibaca.`,
            tools: [{
              functionDeclarations: [{
                name: 'cek_pesanan',
                description: 'Mencari status pesanan pelanggan di database King Sablon Cup berdasarkan nama pelanggan atau nomor invoice.',
                parameters: {
                  type: 'object',
                  properties: { search_query: { type: 'string' } },
                  required: ['search_query'],
                },
              }],
            }],
          });
          const candidateChat = model.startChat({ history: formattedHistory });

          try {
            result = await sendAiMessage(candidateChat, prompt);
            chat = candidateChat;
            console.info(`[Webhook] Gemini response completed with ${modelName}.`);
            break;
          } catch (error) {
            lastAiError = error;
            if (error.message === 'TIMEOUT' || !isRetryableAiError(error)) break;
            console.warn(`[Webhook] Gemini ${modelName} unavailable; trying configured fallback candidate.`);
          }
        }

        if (!result) throw lastAiError || new Error('No Gemini model candidate available');

        const functionCall = result.response.functionCalls()?.[0];
        if (functionCall?.name === 'cek_pesanan') {
          const orders = await searchOrdersWithPhoneLinking(sender, functionCall.args.search_query);
          const functionResponseData = orders?.length
            ? {
                status: 'success',
                orders: orders.map(order => ({
                  invoice: order.invoice_number,
                  customer: order?.customers?.name,
                  status: order.status,
                  date: order.date,
                  items: order.sales_items?.map(item => `${item.qty} pcs ${item.products?.name}`).join(', '),
                  tracking_link: `https://erpkscv1.vercel.app/track/${order.invoice_number}`,
                })),
              }
            : { status: 'not_found', message: 'Tidak ditemukan pesanan aktif dengan nama atau invoice tersebut.' };
          result = await sendAiMessage(
            chat,
            `Hasil alat cek_pesanan (gunakan data ini untuk menjawab pelanggan, jangan panggil alat lagi):\n${JSON.stringify(functionResponseData)}`,
          );
        }

        const aiResponseText = result.response.text()?.trim();
        if (!aiResponseText) throw new Error('Gemini returned an empty response');
        await sendReply(conversation.hasMedia ? `${aiResponseText}\n\n${mediaNote}` : aiResponseText);
      } catch (error) {
        console.error('[Webhook] Background processing failed:', error?.message || error);
        let fallbackMsg = 'Maaf kak, sistem Ina sedang ada sedikit kendala teknis. Pesan kakak sudah tercatat dan akan diteruskan ke rekan kami ya 🙏';
        if (error.status === 503 || error.message?.includes('503')) {
          fallbackMsg = 'Maaf kak, layanan AI sedang sibuk. Pesan kakak sudah tercatat dan akan diteruskan ke rekan kami ya 🙏';
        } else if (error.status === 429 || error.message?.includes('429') || error.message?.includes('Quota exceeded')) {
          fallbackMsg = 'Maaf kak, layanan AI sedang padat. Pesan kakak sudah tercatat dan akan diteruskan ke rekan kami ya 🙏';
        } else if (error.message === 'TIMEOUT') {
          fallbackMsg = 'Maaf kak, Ina belum bisa memproses pesan ini sekarang. Pesan kakak sudah tercatat dan akan dibantu rekan kami ya 🙏';
        }
        if (!outboundState.attempted) await sendReply(fallbackMsg);
      }
    })());

    return NextResponse.json({ success: true, message: 'Processing in background' });

  } catch (error) {
    console.error('Error in WhatsApp Webhook:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req) {
  return NextResponse.json({ success: true, message: "Webhook is active" });
}
