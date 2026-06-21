import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const FONNTE_API_URL = 'https://api.fonnte.com/send';
const FONNTE_TOKEN = process.env.FONNTE_TOKEN;

const SYSTEM_PROMPT = `
Kamu adalah Customer Service King Sablon Cup. Namamu adalah Ina.
Tugas utamamu adalah membalas chat dari pelanggan WhatsApp dengan ramah, santai tapi sopan, menggunakan bahasa gaul yang tetap profesional (misal: "Halo kak", "Bisa dibantu", "Siap kak", "Ditunggu ya").
King Sablon Cup adalah perusahaan jasa sablon gelas plastik/kertas (cup) untuk minuman kekinian.

PENTING - KNOWLEDGE BASE KING SABLON CUP:
1. Waktu Proses Sablon: Estimasi pengerjaan sablon adalah 3-5 hari kerja (tergantung antrean produksi).
2. Pricelist Sablon:
   - Cup Plastik Datar (12oz, 14oz, 16oz): Rp 300 - Rp 450 per cup (tergantung ketebalan dan jumlah warna).
   - Cup Oval (14oz, 16oz, 22oz): Rp 350 - Rp 500 per cup.
   - Cup Kertas (Paper Cup) Hot/Cold: Rp 500 - Rp 800 per cup.
   - Minimal order adalah 1.000 pcs. Jika order di atas 10.000 pcs, akan ada harga spesial grosir.

Jika pelanggan menanyakan status pesanan, minta mereka memberikan Nama atau Nomor Invoice, lalu gunakan alat (tool) "cek_pesanan" untuk mencari data di database.
Jawablah berdasarkan data yang didapatkan dari tool tersebut. Jika statusnya "PROSES", sampaikan bahwa sedang dicetak. Jika "SIAP KIRIM", sampaikan bahwa pesanan sudah selesai dan menunggu pelunasan/siap diambil.
Jika data tidak ditemukan, katakan dengan sopan bahwa data tidak ditemukan dan mohon cek ulang nomor invoicenya.
Jangan menjanjikan sesuatu yang tidak ada di database atau diluar Knowledge Base di atas.
`;

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

export async function POST(req) {
  try {
    // Fonnte sends data as multipart/form-data or application/json depending on setting
    // We'll parse json or form-data
    let body;
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      body = await req.json();
    } else {
      const formData = await req.formData();
      body = Object.fromEntries(formData.entries());
    }

    const sender = body.sender; // Phone number
    const message = body.message || body.text || ''; // The message content

    if (!sender || !message) {
      return NextResponse.json({ success: false, error: 'Missing sender or message' }, { status: 400 });
    }

    // Ignore group messages (usually sender contains '-')
    if (sender.includes('-')) {
      return NextResponse.json({ success: true, message: 'Ignored group message' });
    }

    // 1. Check/Create Session
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
      await supabase
        .from('wa_sessions')
        .update({ last_interaction: new Date().toISOString() })
        .eq('phone_number', sender);
    }

    // 2. Human Handover Mechanism
    // If admin types /stop, bot turns off
    if (message.trim() === '/stop') {
      await supabase.from('wa_sessions').update({ is_bot_active: false }).eq('phone_number', sender);
      return NextResponse.json({ success: true, message: 'Bot turned off' });
    }
    // If admin types /start, bot turns on
    if (message.trim() === '/start') {
      await supabase.from('wa_sessions').update({ is_bot_active: true }).eq('phone_number', sender);
      return NextResponse.json({ success: true, message: 'Bot turned on' });
    }

    // If bot is inactive, do nothing
    if (!session?.is_bot_active) {
      return NextResponse.json({ success: true, message: 'Bot is inactive for this user' });
    }

    // 3. Prepare Chat History for Gemini (Fetch BEFORE inserting current message to maintain alternating roles)
    const { data: historyData } = await supabase
      .from('wa_chat_history')
      .select('*')
      .eq('phone_number', sender)
      .order('created_at', { ascending: false })
      .limit(10); // get last 10 messages

    // Save user message to history
    await supabase.from('wa_chat_history').insert([{ phone_number: sender, role: 'user', content: message }]);

    // Format for Gemini API (user and model)
    const formattedHistory = (historyData || []).reverse().map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    // 4. Setup Gemini with Tools
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_PROMPT,
      tools: [{
        functionDeclarations: [{
          name: "cek_pesanan",
          description: "Mencari status pesanan pelanggan di database King Sablon Cup berdasarkan nama pelanggan atau nomor invoice.",
          parameters: {
            type: "object",
            properties: {
              search_query: {
                type: "string",
                description: "Nama pelanggan atau nomor invoice (contoh: 'Budi' atau 'INV-1234')"
              }
            },
            required: ["search_query"]
          }
        }]
      }]
    });

    const chat = model.startChat({
      history: formattedHistory,
    });

    // Send message to Gemini
    let result = await chat.sendMessage(message);

    // 5. Handle Function Calling
    const functionCall = result.response.functionCalls()?.[0];
    
    if (functionCall && functionCall.name === "cek_pesanan") {
      const searchQuery = functionCall.args.search_query;
      
      // Query Database
      const { data: orders } = await supabase
        .from('sales_orders')
        .select(`
          invoice_number, 
          status, 
          date,
          customers (name),
          sales_items (qty, products (name))
        `)
        .or(`invoice_number.ilike.%${searchQuery}%,customers.name.ilike.%${searchQuery}%`)
        .limit(3);

      let functionResponseData;
      if (orders && orders.length > 0) {
        functionResponseData = {
          status: "success",
          orders: orders.map(o => ({
            invoice: o.invoice_number,
            customer: o?.customers?.name,
            status: o.status,
            date: o.date,
            items: o.sales_items?.map(i => `${i.qty} pcs ${i.products?.name}`).join(', ')
          }))
        };
      } else {
        functionResponseData = {
          status: "not_found",
          message: "Tidak ditemukan pesanan dengan nama atau invoice tersebut."
        };
      }

      // Send function response back to Gemini to get final answer
      result = await chat.sendMessage([{
        functionResponse: {
          name: "cek_pesanan",
          response: functionResponseData
        }
      }]);
    }

    const aiResponseText = result.response.text();

    // 6. Send Reply via Fonnte
    await sendFonnteMessage(sender, aiResponseText);

    // Save AI response to history
    await supabase.from('wa_chat_history').insert([{ phone_number: sender, role: 'model', content: aiResponseText }]);

    return NextResponse.json({ success: true, reply: aiResponseText });

  } catch (error) {
    console.error('Error in WhatsApp Webhook:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Fonnte requires the webhook to handle GET requests for verification
export async function GET(req) {
  return NextResponse.json({ success: true, message: "Webhook is active" });
}
