import { NextResponse, NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDb } from '@/lib/mongodb';

// Output paths
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

    const db = await getDb();
    const likesCol = db.collection('likes');
    const blocksCol = db.collection('blocks');

    // 2. Update MongoDB likes collection
    if (imageUrl) {
      // Find document and pull image
      const doc = await likesCol.findOne({ id });
      if (doc && doc.media) {
        const updatedMedia = doc.media.filter((m: any) => m.url !== imageUrl);
        if (updatedMedia.length === 0) {
          await likesCol.deleteOne({ id });
        } else {
          await likesCol.updateOne({ id }, { $set: { media: updatedMedia } });
        }
      }
    } else {
      // Remove the entire tweet document
      await likesCol.deleteOne({ id });
    }

    // 3. Update MongoDB blocks collection
    const blacklistItem = imageUrl ? `img:${imageUrl}` : id;
    await blocksCol.updateOne(
      { value: blacklistItem },
      { $set: { value: blacklistItem, addedAt: new Date().toISOString() } },
      { upsert: true }
    );

    // 4. Load, update, and write local blacklist.json to prevent recompiling
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
