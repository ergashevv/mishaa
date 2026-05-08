import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'iComics.wiki — manga, manhwa & comics';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(145deg, #090a0f 0%, #151828 45%, #1f1520 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            letterSpacing: '-0.04em',
            color: '#fafafa',
          }}
        >
          iComics.wiki
        </div>
        <div
          style={{
            marginTop: 20,
            fontSize: 28,
            fontWeight: 600,
            color: '#ff5a1f',
            letterSpacing: '0.02em',
          }}
        >
          Manga · Manhwa · Comics
        </div>
        <div style={{ marginTop: 12, fontSize: 22, color: 'rgba(250,250,250,0.55)' }}>
          Read online — reader-first library
        </div>
      </div>
    ),
    { ...size },
  );
}
