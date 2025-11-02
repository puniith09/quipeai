import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown';
    
    const geoResponse = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`);
    
    if (!geoResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch location data' },
        { status: 500 }
      );
    }
    
    const geoData = await geoResponse.json();
    
    if (geoData.status === 'fail') {
      return NextResponse.json(
        { error: 'Invalid IP or location data unavailable' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      ip: geoData.query || ip,
      country: geoData.country,
      countryCode: geoData.countryCode,
      region: geoData.regionName,
      regionCode: geoData.region,
      city: geoData.city,
      zipCode: geoData.zip,
      latitude: geoData.lat,
      longitude: geoData.lon,
      timezone: geoData.timezone,
      isp: geoData.isp,
      org: geoData.org,
      as: geoData.as,
    });
    
  } catch (error) {
    logger.error('Location API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
