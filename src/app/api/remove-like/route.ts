import { NextResponse, NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

// Output paths
const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const LIKES_FILE = path.join(DATA_DIR, 'likes.json');
const RAW_DIR = path.join(process.cwd(), 'likes-raw');
const BLACKLIST_FILE = path.join(RAW_DIR, 'blacklist.json');

export async function POST(request: NextRequest) {
  // 1. Enforce development-mode only
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Forbidden. This action is only allowed in development mode.' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { id, imageUrl } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing tweet id parameter.' },
        { status: 400 }
      );
    }

    console.log(`[Dev Admin] Requested removal of tweet: ${id} ${imageUrl ? `image: ${imageUrl}` : ''}`);

    // 2. Load and update likes.json
    if (!fs.existsSync(LIKES_FILE)) {
      return NextResponse.json(
        { error: 'likes.json database file not found.' },
        { status: 404 }
      );
    }

    const likesContent = fs.readFileSync(LIKES_FILE, 'utf-8');
    const likesData = JSON.parse(likesContent);
    
    let updatedLikes = likesData;
    if (imageUrl) {
      // Remove specific image
      updatedLikes = likesData.map((item: any) => {
        if (item.id === id && item.media) {
          return {
            ...item,
            media: item.media.filter((m: any) => m.url !== imageUrl)
          };
        }
        return item;
      }).filter((item: any) => item.media && item.media.length > 0);
    } else {
      // Filter out the entire deleted item
      updatedLikes = likesData.filter((item: any) => item.id !== id);
    }

    // Save updated likes.json back to disk
    fs.writeFileSync(LIKES_FILE, JSON.stringify(updatedLikes, null, 2), 'utf-8');

    // 3. Load, update, and write blacklist.json
    let blacklist: string[] = [];
    if (fs.existsSync(BLACKLIST_FILE)) {
      try {
        const blacklistContent = fs.readFileSync(BLACKLIST_FILE, 'utf-8');
        blacklist = JSON.parse(blacklistContent);
      } catch (e) {
        console.warn('Could not parse blacklist.json, resetting.', e);
      }
    }

    // Add to blacklist if not already there
    const blacklistItem = imageUrl ? `img:${imageUrl}` : id;
    if (!blacklist.includes(blacklistItem)) {
      blacklist.push(blacklistItem);
      // Ensure likes-raw directory exists
      if (!fs.existsSync(RAW_DIR)) {
        fs.mkdirSync(RAW_DIR, { recursive: true });
      }
      fs.writeFileSync(BLACKLIST_FILE, JSON.stringify(blacklist, null, 2), 'utf-8');
    }

    console.log(`[Dev Admin] Successfully removed and blacklisted tweet: ${id}`);

    return NextResponse.json({ success: true, id });

  } catch (err) {
    console.error('Error removing tweet from gallery:', err);
    return NextResponse.json(
      { error: 'Internal server error occurred while removing like.' },
      { status: 500 }
    );
  }
}
