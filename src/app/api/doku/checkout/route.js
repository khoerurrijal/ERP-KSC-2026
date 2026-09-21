import { NextResponse } from 'next/server';

export async function POST(req) {
  return NextResponse.json({
    success: false,
    disabled: true,
    error: 'Pembayaran DOKU sedang dinonaktifkan.'
  }, { status: 410 });
}
