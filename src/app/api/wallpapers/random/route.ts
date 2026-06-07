import { NextResponse, NextRequest } from 'next/server';
import likesData from '@/data/likes.json';

interface CompiledMedia {
  url: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
}

interface Tweet {
  id: string;
  authorName: string;
  authorHandle: string;
  tweetUrl: string;
  text: string;
  hashtags: string[];
  media: CompiledMedia[];
  category: string;
  collectedAt: string;
}

interface Wallpaper {
  id: string;
  imageUrl: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
  artistName: string;
  artistHandle: string;
  tweetUrl: string;
  attribution: string;
  category: string;
  collectedAt: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const widthParam = searchParams.get('width');
    const heightParam = searchParams.get('height');

    const tweets = likesData as Tweet[];
    let wallpapers: Wallpaper[] = [];

    // Flatten tweets with multiple images into separate wallpaper items
    for (const t of tweets) {
      t.media.forEach((m, idx) => {
        if (!m.url) return;
        
        const cleanText = t.text
          .replace(/https:\/\/t\.co\/\w+/g, '')
          .trim();

        wallpapers.push({
          id: t.media.length > 1 ? `${t.id}-${idx}` : t.id,
          imageUrl: m.url,
          width: m.width,
          height: m.height,
          aspectRatio: m.aspectRatio,
          artistName: t.authorName || `@${t.authorHandle}`,
          artistHandle: t.authorHandle,
          tweetUrl: t.tweetUrl,
          attribution: cleanText,
          category: t.category,
          collectedAt: t.collectedAt
        });
      });
    }

    // Apply category filter
    if (category && category !== 'All') {
      const catLower = category.toLowerCase();
      wallpapers = wallpapers.filter(w => w.category.toLowerCase() === catLower);
    }

    // Apply search filter
    if (search) {
      const query = search.toLowerCase().trim();
      wallpapers = wallpapers.filter(w => 
        w.artistName.toLowerCase().includes(query) ||
        w.artistHandle.toLowerCase().includes(query) ||
        w.attribution.toLowerCase().includes(query)
      );
    }

    // Apply screensize orientation filtering
    if (widthParam && heightParam) {
      const width = parseInt(widthParam, 10);
      const height = parseInt(heightParam, 10);

      if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
        const clientRatio = width / height;
        let matchedWallpapers = wallpapers;

        if (clientRatio >= 1.2) {
          // Screen is landscape: Filter for landscape wallpapers (aspectRatio >= 1.2)
          matchedWallpapers = wallpapers.filter(w => w.aspectRatio && w.aspectRatio >= 1.2);
        } else if (clientRatio <= 0.85) {
          // Screen is portrait: Filter for portrait wallpapers (aspectRatio <= 0.85)
          matchedWallpapers = wallpapers.filter(w => w.aspectRatio && w.aspectRatio <= 0.85);
        } else {
          // Screen is square/neutral: Filter for neutral aspect ratios
          matchedWallpapers = wallpapers.filter(w => w.aspectRatio && w.aspectRatio > 0.85 && w.aspectRatio < 1.2);
        }

        // Fallback: If no wallpapers match the orientation-specific filter, keep the unfiltered list
        if (matchedWallpapers.length > 0) {
          wallpapers = matchedWallpapers;
        }
      }
    }

    if (wallpapers.length === 0) {
      return NextResponse.json(
        { error: 'No wallpapers found matching the specified parameters' },
        { status: 404 }
      );
    }

    // Select a single random wallpaper
    const randomIndex = Math.floor(Math.random() * wallpapers.length);
    const selectedWallpaper = wallpapers[randomIndex];

    // Return the JSON response containing the single wallpaper
    return NextResponse.json(selectedWallpaper, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      }
    });

  } catch (err) {
    console.error('Error serving random wallpaper API:', err);
    return NextResponse.json(
      { error: 'Internal server error occurred' },
      { status: 500 }
    );
  }
}

// Allow CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
