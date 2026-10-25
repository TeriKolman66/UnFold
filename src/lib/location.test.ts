import { describe, expect, it } from 'vitest';
import { embeddedMapUrl, googleMapsUrl, parseLocationInput } from './location';

describe('location imports', () => {
  it('keeps manual coordinates as a precise local point', () => {
    expect(parseLocationInput('48.8584, 2.2945')).toMatchObject({ latitude: 48.8584, longitude: 2.2945 });
  });

  it('extracts coordinates and name from a Google Maps place URL', () => {
    expect(parseLocationInput('https://www.google.com/maps/place/El+Pianista/@8.8,-82.4,13z')).toMatchObject({ query: 'El Pianista', latitude: 8.8, longitude: -82.4 });
  });

  it('preserves a short share link without inventing coordinates', () => {
    const parsed = parseLocationInput('https://maps.app.goo.gl/example');
    expect(parsed.sourceUrl).toBe('https://maps.app.goo.gl/example');
    expect(parsed.latitude).toBeUndefined();
    expect(embeddedMapUrl({ ...parsed, photos: [] })).toBeNull();
  });

  it('does not open an untrusted URL as a Google Maps link', () => {
    expect(googleMapsUrl({ query: 'Paris', sourceUrl: 'https://example.com/', photos: [] })).toBe('https://www.google.com/maps/search/?api=1&query=Paris');
  });

  it('opens a legacy short Google Maps query directly', () => {
    expect(googleMapsUrl({ query: 'https://maps.app.goo.gl/example', photos: [] })).toBe('https://maps.app.goo.gl/example');
  });

  it('accepts only an official Google Maps embed URL from copied iframe HTML', () => {
    const parsed = parseLocationInput('<iframe src="https://www.google.com/maps/embed?pb=!1m18&amp;foo=bar" width="600"></iframe>');
    expect(parsed.embedUrl).toBe('https://www.google.com/maps/embed?pb=!1m18&foo=bar');
    expect(embeddedMapUrl({ ...parsed, photos: [] })).toBe(parsed.embedUrl);
    expect(parseLocationInput('<iframe src="https://evil.example/maps/embed?pb=123"></iframe>').embedUrl).toBeUndefined();
  });
});
