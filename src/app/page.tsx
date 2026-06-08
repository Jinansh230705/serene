import React from 'react';
import fs from 'fs';
import path from 'path';
import ClientGallery from '@/components/ClientGallery';

export const dynamic = 'force-dynamic';

// Types (mirrored from API)
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

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const sharedKey = typeof params?.image === 'string' ? params.image : undefined;

  // Generate a random seed on the server to pass to the client
  const initialSeed = Math.random().toString(36).substring(2, 15);
  
  let tweets: Tweet[] = [];
  try {
    // Due to Turbopack workspace inference issues, process.cwd() might point to the user root.
    // We provide a fallback path just in case.
    const possiblePaths = [
      path.join(process.cwd(), 'src', 'data', 'likes.json'),
      path.join(process.cwd(), 'Downloads', 'tweeter-likes', 'src', 'data', 'likes.json')
    ];

    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        tweets = JSON.parse(fileContent);
        break;
      }
    }
  } catch (e) {
    console.error('Error reading likes.json statically:', e);
  }

  // Flatten multi-image tweets into separate GridItem objects
  let items: GridItem[] = [];
  tweets.forEach((t) => {
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

  // Apply deterministic seed shuffling
  items = shuffleWithSeed(items, initialSeed);

  let targetIndex = -1;
  if (sharedKey) {
    targetIndex = items.findIndex(i => i.uniqueKey === sharedKey);
  }

  let loadCount = 40;
  if (targetIndex !== -1 && targetIndex >= loadCount) {
    // Load enough pages so that the target item is included in the initialItems
    loadCount = Math.ceil((targetIndex + 1) / 40) * 40;
  }

  const total = items.length;
  const initialItems = items.slice(0, loadCount);

  return (
    <ClientGallery 
      initialItems={initialItems} 
      initialTotal={total} 
      initialSeed={initialSeed} 
      sharedKey={sharedKey}
    />
  );
}
