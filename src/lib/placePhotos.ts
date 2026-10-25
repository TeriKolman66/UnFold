import type { EmbeddedAttachment } from '../types';
import { now } from './workspace';

export interface PlacePhoto {
  title: string;
  thumbnailUrl: string;
  sourceUrl: string;
  attribution: string;
  license: string;
  mimeType: string;
}

interface CommonsImageInfo {
  thumburl?: string;
  descriptionurl?: string;
  user?: string;
  mime?: string;
  extmetadata?: Record<string, { value?: string }>;
}

const photoMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

function plainText(html: string | undefined): string {
  if (!html) return '';
  return new DOMParser().parseFromString(html, 'text/html').body.textContent?.trim().slice(0, 180) ?? '';
}

export function commonsPhotoSearchUrl(name: string, coordinates?: { latitude: number; longitude: number }): string {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|mime|user|extmetadata');
  url.searchParams.set('iiurlwidth', '640');
  if (coordinates) {
    url.searchParams.set('generator', 'geosearch');
    url.searchParams.set('ggscoord', `${coordinates.latitude}|${coordinates.longitude}`);
    url.searchParams.set('ggsradius', '10000');
    url.searchParams.set('ggsnamespace', '6');
    url.searchParams.set('ggslimit', '24');
  } else {
    url.searchParams.set('generator', 'search');
    url.searchParams.set('gsrsearch', name);
    url.searchParams.set('gsrnamespace', '6');
    url.searchParams.set('gsrlimit', '24');
  }
  return url.href;
}

export async function searchPlacePhotos(name: string, coordinates?: { latitude: number; longitude: number }): Promise<PlacePhoto[]> {
  const response = await fetch(commonsPhotoSearchUrl(name, coordinates));
  if (!response.ok) throw new Error(`Photo search failed (${response.status})`);
  const data = await response.json() as { query?: { pages?: Record<string, { title: string; index?: number; imageinfo?: CommonsImageInfo[] }> } };
  const photos = Object.values(data.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).flatMap((page) => {
    const info = page.imageinfo?.[0];
    if (!info?.thumburl || !info.descriptionurl || !photoMimeTypes.has(info.mime ?? '')) return [];
    const photoUrl = new URL(info.thumburl);
    const sourceUrl = new URL(info.descriptionurl);
    if (photoUrl.protocol !== 'https:' || !['thumb.wikimedia.org', 'upload.wikimedia.org'].includes(photoUrl.hostname) || sourceUrl.protocol !== 'https:' || sourceUrl.hostname !== 'commons.wikimedia.org') return [];
    const meta = info.extmetadata ?? {};
    const artist = plainText(meta.Attribution?.value || meta.Artist?.value) || info.user || 'Unknown author';
    return [{
      title: page.title.replace(/^File:/, ''),
      thumbnailUrl: photoUrl.href,
      sourceUrl: sourceUrl.href,
      attribution: artist,
      license: plainText(meta.LicenseShortName?.value) || 'See source for license',
      mimeType: info.mime!,
    }];
  });
  return photos.length === 0 && coordinates ? searchPlacePhotos(name) : photos;
}

export async function embedPlacePhoto(photo: PlacePhoto): Promise<EmbeddedAttachment> {
  const response = await fetch(photo.thumbnailUrl);
  if (!response.ok) throw new Error(`Photo download failed (${response.status})`);
  const blob = await response.blob();
  if (!photoMimeTypes.has(blob.type) || blob.size > 5 * 1024 * 1024) throw new Error('Photo is too large or unsupported');
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  return { name: photo.title, mimeType: blob.type, size: blob.size, dataUrl, sourceUrl: photo.sourceUrl, attribution: photo.attribution, license: photo.license, createdAt: now() };
}
