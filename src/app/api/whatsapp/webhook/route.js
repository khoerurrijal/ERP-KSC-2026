import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { waitUntil } from '@vercel/functions';

export const maxDuration = 60; // Allow API route to run for up to 60 seconds on Vercel

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const FONNTE_API_URL = 'https://api.fonnte.com/send';
const FONNTE_TOKEN = process.env.FONNTE_TOKEN;

const ADMIN_NUMBER = '6282121316926';

const SYSTEM_PROMPT = (pushname) => `
Kamu adalah Admin King Sablon Cup. Namamu adalah Ina.
Tugas utamamu adalah membalas chat dari pelanggan WhatsApp dengan ramah, santai tapi sopan, menggunakan bahasa gaul yang tetap profesional (misal: "Halo kak", "Bisa dibantu", "Siap kak", "Ditunggu ya").
PENTING: Jawablah dengan SANGAT SINGKAT, PADAT, dan langsung ke intinya. JANGAN membalas dengan paragraf panjang yang bertele-tele. Maksimal 2-3 kalimat pendek saja.
King Sablon Cup adalah perusahaan jasa sablon gelas plastik/kertas (cup) untuk minuman kekinian.
Nama profil WhatsApp pelanggan saat ini adalah: "${pushname}". Jika dia menanyakan pesanan atas namanya, kamu bisa menggunakan nama ini untuk mencari di database.

PENTING - KNOWLEDGE BASE KING SABLON CUP:
1. Waktu Proses Sablon:
   - Reguler: 3-5 hari kerja (tergantung antrean produksi).
   - Fast Track (Jalur Cepat): 1-3 hari kerja. Bisa dikebut sesuai waktu yang diinginkan (jika slot memungkinkan).
   - Catatan: "1 hari kerja" berarti butuh 1 hari proses. Jika pesan hari ini, kemungkinan selesai besok sore (kalau tidak banyak antrean), BUKAN selesai di hari yang sama.
2. Aturan Fast Track (Jalur Cepat):
   - Biaya Tambahan: Rp 100.000 per 1.000 pcs.
   - Batas Maksimal Fast Track: Hanya melayani maksimal 1.000 pcs per pesanan. Jika pesanan lebih dari 1.000 pcs (misal pesanan 3.000 pcs), maka 1.000 pcs pertama akan diproses Fast Track, sisanya (2.000 pcs) ikut antrean Reguler.
   - Ongkir: Biaya Fast Track BELUM termasuk ongkir (ongkir tidak ditanggung).
3. Order & Pricelist Sablon:
   - Jika pelanggan mengatakan ingin order, pesan, menanyakan daftar harga, pricelist, atau produk, **JANGAN MENGARANG JAWABAN**. Langsung berikan respon persis seperti ini:
   "Baik kak, Untuk cek detail produk dan harga terbaru, Kakak bisa langsung klik link ini ya: https://erpkscv1.vercel.app/order\n\nKakak bisa langsung hitung harga otomatis, membuat pesanan, dan mendapatkan Invoice untuk masuk ke antrian sablon."
4. Pertanyaan Umum / Edukasi Cup & Sablon:
   - Jika pelanggan bertanya hal umum seperti perbedaan cup PP dan PET, perbedaan cup flat dan oval, ukuran 12 oz, 14 oz, 22 oz, atau pengetahuan produk cup lainnya, **GUNAKAN PENGETAHUAN AI-MU SENDIRI** untuk menjawab dengan cerdas dan detail layaknya seorang ahli.
   - **TIDAK PERLU** mencari di database untuk pertanyaan umum tersebut! Cukup baca database jika ada sangkut pautnya dengan pesanan, invoice, ERP, atau data pelanggan.
5. Jam Operasional Admin:
   - Jam operasional admin manusia (toko buka): Senin s/d Sabtu pukul 09.00-17.00 WIB.
   - Di luar jam operasional tersebut (toko tutup), kamu sebagai AI akan sepenuhnya membantu menjawab pertanyaan pelanggan.

Jika pelanggan menanyakan status pesanan, minta mereka memberikan Nama atau Nomor Invoice, lalu gunakan alat (tool) "cek_pesanan" untuk mencari data di database.
Jawablah berdasarkan data yang didapatkan dari tool tersebut. Jika statusnya "PROSES", sampaikan bahwa sedang dicetak. Jika "SIAP KIRIM", sampaikan bahwa pesanan sudah selesai dan menunggu pelunasan/siap diambil.
PENTING: Setiap kali kamu menemukan data pesanan pelanggan, kamu WAJIB memberikan link Tracking Publik berikut agar mereka bisa memantau sendiri: https://erpkscv1.vercel.app/track/[NOMOR_INVOICE] (ganti [NOMOR_INVOICE] dengan invoice yang sesuai).
Jika data tidak ditemukan, katakan dengan sopan bahwa data tidak ditemukan dan mohon cek ulang nomor invoicenya.
Jangan menjanjikan sesuatu yang tidak ada di database atau diluar Knowledge Base di atas.

PENTING - HUMAN HANDOVER:
Jika pelanggan bertanya hal yang terlalu rumit, custom (seperti komplain, desain yang rumit, dll), atau jika pesanan tidak ada di database, kamu TIDAK BOLEH mengarang jawaban.
Kirimkan pesan penutup ini: "Untuk detail lebih lanjut, nanti dilanjut dengan rekan saya ketika sedang online ya kak. Terima kasih! 🙏"
`;

// Helper to run promises with timeout
function runWithTimeout(promise, ms) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('TIMEOUT')), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

// Helper to send message via Fonnte
async function sendFonnteMessage(target, message) {
  try {
    const response = await fetch(FONNTE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': FONNTE_TOKEN,
      },
      body: new URLSearchParams({
        target: target,
        message: message,
      }),
    });
    return await response.json();
  } catch (error) {
    console.error('Error sending message via Fonnte:', error);
  }
}


// Helper to query database for orders
async function searchOrdersInDB(searchQuery) {
  // Query 1: Search by invoice
  const { data: ordersByInvoice } = await supabase
    .from('sales_orders')
    .select('invoice_number, status, date, customers (name), sales_items (qty, products (name))')
    .ilike('invoice_number', `%${searchQuery}%`)
    .in('status', ['PROSES', 'SIAP KIRIM', 'DRAFT', 'PENDING']) // Only active orders
    .limit(3);

  // Query 2: Search by customer name
  const { data: ordersByName } = await supabase
    .from('sales_orders')
    .select('invoice_number, status, date, customers!inner (name), sales_items (qty, products (name))')
    .ilike('customers.name', `%${searchQuery}%`)
    .in('status', ['PROSES', 'SIAP KIRIM', 'DRAFT', 'PENDING']) // Only active orders
    .order('date', { ascending: false })
    .limit(3);

  // Combine and deduplicate
  let orders = [];
  if (ordersByInvoice) orders.push(...ordersByInvoice);
  if (ordersByName) orders.push(...ordersByName);
  
  return orders.filter((o, index, self) => 
    index === self.findIndex((t) => t.invoice_number === o.invoice_number)
  ).slice(0, 3);
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

    let sender = body.sender; 
    const message = body.message || body.text || ''; 
    const pushname = body.pushname || body.name || 'Kakak'; 

    if (!sender || !message) {
      return NextResponse.json({ success: false, error: 'Missing sender or message' }, { status: 400 });
    }

    if (sender.includes('-')) {
      return NextResponse.json({ success: true, message: 'Ignored group message' });
    }
    
    // Normalize sender for admin check
    const normalizedSender = sender.startsWith('0') ? '62' + sender.slice(1) : sender;

    // --- 1. GLOBAL MASTER SWITCH ---
    if (normalizedSender === ADMIN_NUMBER) {
      if (message.toLowerCase() === '/bot on') {
        await supabase.from('wa_global_settings').upsert({ key: 'GLOBAL_BOT_ACTIVE', value: 'true' });
        await sendFonnteMessage(sender, "Sistem Otomatis / AI telah DIAKTIFKAN. AI akan merespon pelanggan.");
        return NextResponse.json({ success: true, message: 'Global bot turned on' });
      }
      if (message.toLowerCase() === '/bot off') {
        await supabase.from('wa_global_settings').upsert({ key: 'GLOBAL_BOT_ACTIVE', value: 'false' });
        await sendFonnteMessage(sender, "Sistem Otomatis / AI DIMATIKAN. Menunggu balasan manual dari Admin.");
        return NextResponse.json({ success: true, message: 'Global bot turned off' });
      }
    }

    // Check if Global Bot is Active
    const { data: globalSetting } = await supabase.from('wa_global_settings').select('value').eq('key', 'GLOBAL_BOT_ACTIVE').single();
    const isGlobalBotActive = globalSetting ? globalSetting.value === 'true' : true; 

    if (!isGlobalBotActive) {
      return NextResponse.json({ success: true, message: 'Global bot is inactive' });
    }

    // --- IDEMPOTENCY CHECK (ANTI-RETRY LOOP) ---
    // Fetch the very last message to see if this is a Fonnte webhook retry
    const { data: lastMsgData } = await supabase
      .from('wa_chat_history')
      .select('*')
      .eq('phone_number', sender)
      .order('created_at', { ascending: false })
      .limit(1);
      
    if (lastMsgData && lastMsgData.length > 0) {
      const lastMsg = lastMsgData[0];
      const timeDiff = new Date() - new Date(lastMsg.created_at);
      if (lastMsg.role === 'user' && lastMsg.content === message && timeDiff < 30000) {
        console.log(`[Webhook] Ignored duplicate message from ${sender} (Fonnte retry loop protection)`);
        return NextResponse.json({ success: true, message: 'Duplicate ignored' });
      }
    }

    // --- 2. FAST-TRACK AUTO REPLY (TEMPLATES) ---
    const msgLower = message.toLowerCase().trim();
    let templateReply = null;

    if (msgLower.match(/^(halo|pagi|siang|sore|malam|assalamualaikum|ping|hi|hey|p)$/)) {
      templateReply = "Halo kak! Saya Ina, Admin King Sablon Cup. Ada yang bisa dibantu? (Pricelist / Cek Pesanan / Tanya Lainnya)";
    } else if (msgLower.match(/(alamat|dimana|lokasi|toko|tempat)/)) {
      templateReply = "Alamat kami di:\nJl. Ir. H. Juanda No. 71, Weru - Kab. Cirebon (Samping J&M Mart).\nBisa dicari di Google Maps: *KING SABLON CUP* 📍";
    } else if (msgLower.match(/(pembayaran|rekening|bayar|cod)/)) {
      templateReply = "Pembayaran bisa cash di toko atau transfer:\n- Bank BCA: 6930240107 a/n Khoerur Rijal\n- Bank Mandiri: 9000020365095 a/n Khoerur Rijal";
    } else if (msgLower.match(/(desain|logo)/)) {
      templateReply = "Bisa kak! Jika sudah punya logo, kirim saja logonya lalu detail keinginannya via teks, nanti dibuatkan oleh editor kami.\nJika belum punya logo dan ingin *full* dibuatkan dari nol, ada biaya desain Rp 50.000.\nKakak juga bisa explore desain sendiri di aplikasi kami: cupstudio.id 🎨";
    } else if (msgLower.match(/(warna|kertas|paper cup|paper bowl|varian)/)) {
      templateReply = "Sablon cup maksimal 2 warna dengan biaya jasa sablon 2 warna Rp 250/pcs.\nUntuk cup kertas, kami juga menyediakan Paper Cup dan Paper Bowl kak!";
    } else if (msgLower.match(/(minimal order|min order|moq|bisa pesan \d+|minimal pesan)/)) {
      templateReply = "Minimal order tergantung jenis cup kak. Kalau cup PET minimal order 1.000 pcs (sudah ada di matrix sablon).";
    } else if (msgLower.match(/(harga|pricelist|katalog|produk|price list|mau order|pesan cup|order cup|bikin sablon|mau pesan|pesen)/)) {
      templateReply = "Baik kak, Untuk cek detail produk dan harga terbaru, Kakak bisa langsung klik link ini ya: https://erpkscv1.vercel.app/order\n\nKakak bisa langsung hitung harga otomatis, membuat pesanan, dan mendapatkan Invoice untuk masuk ke antrian sablon.";
    } else if (msgLower.match(/(berapa lama|lama proses|proses sablon|lama pengerjaan)/)) {
      templateReply = "Waktu proses sablon Reguler 3-5 hari kerja. Kami juga ada jalur Fast Track 1-3 hari kerja (+Rp 100rb per 1000 pcs).\n*(1 hari kerja = kemungkinan selesai besok sore, bukan hari H ya kak).*";
    }

    if (templateReply) {
      await sendFonnteMessage(sender, templateReply);
      await supabase.from('wa_chat_history').insert([{ phone_number: sender, role: 'user', content: message }]);
      await supabase.from('wa_chat_history').insert([{ phone_number: sender, role: 'model', content: templateReply }]);
      return NextResponse.json({ success: true, reply: templateReply });
    }

    // --- 3. FAST-TRACK ORDER STATUS (BYPASS GEMINI) ---
    // If the message is a simple tracking intent, bypass AI completely!
    if (msgLower.match(/^(pesanan saya|sudah jadi belum|sampai mana|cek pesanan|status pesanan|cek status|pesananku|invoice \S+)$/)) {
      await sendFonnteMessage(sender, "Sebentar ya kak, Ina cek datanya dulu berdasarkan nama WA kakak... ⏳");
      
      const orders = await searchOrdersInDB(pushname);
      
      if (orders && orders.length > 0) {
        const orderSummary = orders.map(o => 
          `📌 *Invoice:* ${o.invoice_number}\n*Status:* ${o.status}\n*Item:* ${o.sales_items?.map(i => `${i.qty} pcs ${i.products?.name}`).join(', ')}\n*Tracking:* https://erpkscv1.vercel.app/track/${o.invoice_number}`
        ).join('\\n\\n');
        
        const reply = `Ina sudah cek! Berikut detail pesanan atas nama kakak:\n\n${orderSummary}`;
        await sendFonnteMessage(sender, reply);
        await supabase.from('wa_chat_history').insert([{ phone_number: sender, role: 'user', content: message }]);
        await supabase.from('wa_chat_history').insert([{ phone_number: sender, role: 'model', content: reply }]);
        return NextResponse.json({ success: true, reply });
      } else {
        const reply = "Wah maaf kak, Ina coba cari pesanan aktif atas nama kakak belum ketemu nih datanya. Nanti dilanjut dengan rekan saya ketika sedang online ya kak. Terima kasih! 🙏";
        await sendFonnteMessage(sender, reply);
        await supabase.from('wa_chat_history').insert([{ phone_number: sender, role: 'user', content: message }]);
        await supabase.from('wa_chat_history').insert([{ phone_number: sender, role: 'model', content: reply }]);
        return NextResponse.json({ success: true, reply });
      }
    }

    // --- 4. SESSION HANDLING & AI FALLBACK ---
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

    if (message.trim() === '/stop') {
      await supabase.from('wa_sessions').update({ is_bot_active: false }).eq('phone_number', sender);
      return NextResponse.json({ success: true, message: 'Local bot turned off' });
    }
    if (message.trim() === '/start') {
      await supabase.from('wa_sessions').update({ is_bot_active: true }).eq('phone_number', sender);
      return NextResponse.json({ success: true, message: 'Local bot turned on' });
    }

    if (!session?.is_bot_active) return NextResponse.json({ success: true, message: 'Local bot inactive' });

    waitUntil((async () => {
      try {
        // Fetch history
        const { data: historyData } = await supabase
          .from('wa_chat_history')
          .select('*')
          .eq('phone_number', sender)
          .order('created_at', { ascending: false })
          .limit(10); 

        await supabase.from('wa_chat_history').insert([{ phone_number: sender, role: 'user', content: message }]);

        const formattedHistory = (historyData || []).reverse().map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }],
        }));

        const model = genAI.getGenerativeModel({
          model: "gemini-2.5-flash",
          systemInstruction: SYSTEM_PROMPT(pushname),
          tools: [{
            functionDeclarations: [{
              name: "cek_pesanan",
              description: "Mencari status pesanan pelanggan di database King Sablon Cup berdasarkan nama pelanggan atau nomor invoice.",
              parameters: {
                type: "object",
                properties: {
                  search_query: { type: "string" }
                },
                required: ["search_query"]
              }
            }]
          }]
        });

        const chat = model.startChat({ history: formattedHistory });
        let result;
        
        try {
          // Allow up to 55 seconds for Gemini
          result = await runWithTimeout(chat.sendMessage(message), 55000);
        } catch (error) {
          if (error.message === 'TIMEOUT') {
            const fallbackMsg = "Maaf kak, Ina butuh waktu sedikit lebih lama dari biasanya. Tunggu sebentar ya... 🙏";
            await sendFonnteMessage(sender, fallbackMsg);
            return;
          }
          throw error;
        }

        const functionCall = result.response.functionCalls()?.[0];
        
        if (functionCall && functionCall.name === "cek_pesanan") {
          await sendFonnteMessage(sender, "Sebentar ya kak, Ina cek datanya dulu... ⏳");
          const orders = await searchOrdersInDB(functionCall.args.search_query);

          let functionResponseData;
          if (orders && orders.length > 0) {
            functionResponseData = {
              status: "success",
              orders: orders.map(o => ({
                invoice: o.invoice_number,
                customer: o?.customers?.name,
                status: o.status,
                date: o.date,
                items: o.sales_items?.map(i => `${i.qty} pcs ${i.products?.name}`).join(', '),
                tracking_link: `https://erpkscv1.vercel.app/track/${o.invoice_number}`
              }))
            };
          } else {
            functionResponseData = {
              status: "not_found",
              message: "Tidak ditemukan pesanan aktif dengan nama atau invoice tersebut."
            };
          }

          try {
            result = await runWithTimeout(chat.sendMessage([{
              functionResponse: {
                name: "cek_pesanan",
                response: functionResponseData
              }
            }]), 55000);
          } catch (error) {
            if (error.message === 'TIMEOUT') {
              const fallbackMsg = "Maaf kak, datanya cukup besar sehingga butuh waktu agak lama mencarinya. Nanti dilanjut dengan rekan saya ketika sedang online ya kak 🙏";
              await sendFonnteMessage(sender, fallbackMsg);
              return;
            }
            throw error;
          }
        }

        const aiResponseText = result.response.text();

        await sendFonnteMessage(sender, aiResponseText);
        await supabase.from('wa_chat_history').insert([{ phone_number: sender, role: 'model', content: aiResponseText }]);

      } catch (error) {
        console.error('Error in background processing:', error);
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
