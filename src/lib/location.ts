import type { LocationDetails } from '../types';

const coordinatePair = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,;]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;
const geocodeCacheKey = 'unfold:place-coordinates:v1:';
let lastLookupAt = 0;
let lookupQueue: Promise<unknown> = Promise.resolve();

function validCoordinates(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}

export function parseCoordinates(input: string): { latitude: number; longitude: number } | null {
  const match = input.match(coordinatePair);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  return validCoordinates(latitude, longitude) ? { latitude, longitude } : null;
}

function googleEmbedUrl(input: string): string | null {
  const htmlSource = input.match(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
  const candidate = (htmlSource || input).trim().replace(/&amp;/g, '&');
  try {
    const url = new URL(candidate);
    const host = url.hostname.toLowerCase();
    if (url.protocol === 'https:' && (host === 'www.google.com' || host === 'google.com' || host === 'maps.google.com') && url.pathname.startsWith('/maps/embed')) return url.href;
  } catch { /* A regular place name or shared link is not an embed URL. */ }
  return null;
}

export function parseLocationInput(input: string): Pick<LocationDetails, 'query' | 'sourceUrl' | 'embedUrl' | 'latitude' | 'longitude'> {
  const value = input.trim();
  const embedUrl = googleEmbedUrl(value);
  if (embedUrl) return { query: '', embedUrl };
  const direct = parseCoordinates(value);
  if (direct) return { query: value, ...direct };
  let url: URL;
  try { url = new URL(value); } catch { return { query: value }; }
  const host = url.hostname.toLowerCase();
  const isGoogle = host === 'google.com' || host.endsWith('.google.com') || host === 'maps.app.goo.gl' || host === 'goo.gl';
  if (url.protocol !== 'https:' || !isGoogle) return { query: value };
  const fromQuery = url.searchParams.get('query') || url.searchParams.get('q') || url.searchParams.get('ll');
  const fromPlace = url.pathname.match(/\/place\/([^/]+)/)?.[1];
  let placeName = '';
  if (fromPlace) {
    try { placeName = decodeURIComponent(fromPlace.replace(/\+/g, ' ')); }
    catch { placeName = fromPlace; }
  }
  const query = fromQuery || placeName || value;
  const at = url.href.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  const geo = url.href.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  const coordinates = parseCoordinates(fromQuery || '') || (at && parseCoordinates(`${at[1]},${at[2]}`)) || (geo && parseCoordinates(`${geo[1]},${geo[2]}`));
  return { query, sourceUrl: url.href, ...(coordinates || {}) };
}

export function googleMapsUrl(location: LocationDetails): string {
  if (location.sourceUrl && parseLocationInput(location.sourceUrl).sourceUrl) return location.sourceUrl;
  const linkedQuery = parseLocationInput(location.query).sourceUrl;
  if (linkedQuery) return linkedQuery;
  const query = location.latitude !== undefined && location.longitude !== undefined
    ? `${location.latitude},${location.longitude}` : location.query;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function embeddedMapUrl(location: LocationDetails): string | null {
  const googleMap = location.embedUrl && googleEmbedUrl(location.embedUrl);
  if (googleMap) return googleMap;
  const { latitude, longitude } = location;
  if (latitude === undefined || longitude === undefined || !validCoordinates(latitude, longitude)) return null;
  const width = 0.012;
  const height = 0.008;
  const bbox = [longitude - width, latitude - height, longitude + width, latitude + height].join(',');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${latitude},${longitude}`)}`;
}

/** One explicit place search, never autocomplete or background bulk lookup. */
export function findPlaceCoordinates(query: string): Promise<{ latitude: number; longitude: number } | null> {
  const place = query.trim();
  if (!place || /^https?:\/\//i.test(place)) return Promise.resolve(null);
  const cached = localStorage.getItem(`${geocodeCacheKey}${place.toLocaleLowerCase()}`);
  if (cached) {
    try {
      const coordinates = JSON.parse(cached) as { latitude: number; longitude: number };
      if (validCoordinates(coordinates.latitude, coordinates.longitude)) return Promise.resolve(coordinates);
    } catch { /* Ignore a damaged cache entry. */ }
  }

  const request = lookupQueue.then(async () => {
    const pause = Math.max(0, 1100 - (Date.now() - lastLookupAt));
    if (pause) await new Promise((resolve) => window.setTimeout(resolve, pause));
    lastLookupAt = Date.now();
    // A configurable endpoint lets an installation switch providers without a software update.
    const endpoint = localStorage.getItem('unfold:geocoder-url') || 'https://nominatim.openstreetmap.org/search';
    const url = new URL(endpoint);
    url.searchParams.set('q', place);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`Place search failed (${response.status})`);
      const results = await response.json() as Array<{ lat?: string; lon?: string }>;
      const latitude = Number(results[0]?.lat);
      const longitude = Number(results[0]?.lon);
      if (!results.length || !validCoordinates(latitude, longitude)) return null;
      const coordinates = { latitude, longitude };
      localStorage.setItem(`${geocodeCacheKey}${place.toLocaleLowerCase()}`, JSON.stringify(coordinates));
      return coordinates;
    } finally { window.clearTimeout(timeout); }
  });
  lookupQueue = request.catch(() => undefined);
  return request;
}
