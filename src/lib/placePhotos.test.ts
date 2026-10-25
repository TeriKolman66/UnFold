import { describe, expect, it } from 'vitest';
import { commonsPhotoSearchUrl } from './placePhotos';

describe('Commons photo search', () => {
  it('searches geotagged files near a known point', () => {
    const url = new URL(commonsPhotoSearchUrl('Paris', { latitude: 48.8566, longitude: 2.3522 }));
    expect(url.hostname).toBe('commons.wikimedia.org');
    expect(url.searchParams.get('generator')).toBe('geosearch');
    expect(url.searchParams.get('ggscoord')).toBe('48.8566|2.3522');
    expect(url.searchParams.get('ggsnamespace')).toBe('6');
    expect(url.searchParams.get('origin')).toBe('*');
  });

  it('falls back to file-name search without coordinates', () => {
    const url = new URL(commonsPhotoSearchUrl('Paris'));
    expect(url.searchParams.get('generator')).toBe('search');
    expect(url.searchParams.get('gsrsearch')).toBe('Paris');
    expect(url.searchParams.get('gsrnamespace')).toBe('6');
  });
});
