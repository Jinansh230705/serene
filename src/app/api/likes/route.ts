import { NextResponse, NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

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

interface GridItem {
  id: string;
  mediaIndex: number;
  tweet: Tweet;
  uniqueKey: string;
}

// FNV-1a hash function to get a 32-bit unsigned integer from a seed string
function fnv1a(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// Mulberry32 generator for robust 32-bit seeded random number generation
function mulberry32(a: number) {
  return function() {
    let t = (a += 0x6d2b79f5) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic array shuffle using Mulberry32 and FNV-1a hash of the seed
function shuffleWithSeed<T>(array: T[], seed: string): T[] {
  const seedNum = fnv1a(seed);
  const rand = mulberry32(seedNum);
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '24', 10);
    const category = searchParams.get('category') || 'All';
    const search = searchParams.get('search') || '';
    const seed = searchParams.get('seed') || '';

    // Load likes.json dynamically from disk to bypass ESM caching and match updates
    const filePath = path.join(process.cwd(), 'src', 'data', 'likes.json');
    let tweets: Tweet[] = [];
    try {
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        tweets = JSON.parse(fileContent);
      }
    } catch (e) {
      console.error('Error reading likes.json dynamically:', e);
    }
    let filtered = tweets;

    // Apply category filter
    if (category !== 'All') {
      const catLower = category.toLowerCase();
      filtered = filtered.filter(t => t.category.toLowerCase() === catLower);
    }

    // Apply search filter
    if (search) {
      const query = search.toLowerCase().trim();
      filtered = filtered.filter(t => 
        t.authorName.toLowerCase().includes(query) ||
        t.authorHandle.toLowerCase().includes(query) ||
        t.text.toLowerCase().includes(query) ||
        (t.hashtags && t.hashtags.some(tag => tag.toLowerCase().includes(query)))
      );
    }

    // Flatten multi-image tweets into separate GridItem objects
    let items: GridItem[] = [];
    filtered.forEach((t) => {
      t.media.forEach((m, mediaIndex) => {
        if (!m.url) return;
        items.push({
          id: t.id,
          mediaIndex,
          tweet: t,
          uniqueKey: `${t.id}-${mediaIndex}`
        });
      });
    });

    // Apply deterministic seed shuffling if requested
    if (seed) {
      items = shuffleWithSeed(items, seed);
    }

    const total = items.length;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedItems = items.slice(startIndex, endIndex);

    return NextResponse.json({
      items: paginatedItems,
      total
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      }
    });

  } catch (err) {
    console.error('Error fetching paginated likes:', err);
    return NextResponse.json(
      { error: 'Internal server error occurred' },
      { status: 500 }
    );
  }
}
