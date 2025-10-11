import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Get client IP and headers
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';
    
    const userAgent = request.headers.get('user-agent') || '';
    
    // Basic location data - can be enhanced with IP geolocation services
    const locationData = {
      clientIP: clientIP.split(',')[0].trim(), // First IP if multiple
      userAgent: userAgent,
      source: 'ip_geolocation',
      provider: 'basic',
      timestamp: Date.now(),
      accuracy: 'network_level',
      networkHints: {
        hasXForwardedFor: !!request.headers.get('x-forwarded-for'),
        hasXRealIP: !!request.headers.get('x-real-ip'),
      }
    };

    return NextResponse.json(locationData);
  } catch (error) {
    console.error('Location API error:', error);
    return NextResponse.json(
      { error: 'Failed to get location data' },
      { status: 500 }
    );
  }
}
