import { NextResponse } from 'next/server';

export async function POST(req) {
  // Return success without parsing or writing anything so DOKU retries stop
  // while the integration is parked by the owner.
  return NextResponse.json({ success: false, disabled: true, message: 'DOKU webhook dinonaktifkan.' });
}
