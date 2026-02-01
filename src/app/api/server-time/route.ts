import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    serverTime: new Date().toISOString(),
    timestamp: Date.now(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
}
