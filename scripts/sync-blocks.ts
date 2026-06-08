import fs from 'fs';
import path from 'path';
import { MongoClient } from 'mongodb';
import 'dotenv/config';

const RAW_DIR = path.join(process.cwd(), 'likes-raw');
const BLACKLIST_FILE = path.join(RAW_DIR, 'blacklist.json');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set in .env");
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('sereine');
  const blocksCol = db.collection('blocks');

  try {
    const dbBlocks = await blocksCol.find({}).toArray();
    const blacklist = dbBlocks.map(b => b.value).filter(Boolean);

    // Merge with any existing local blocks just in case
    if (fs.existsSync(BLACKLIST_FILE)) {
      try {
        const localContent = fs.readFileSync(BLACKLIST_FILE, 'utf-8');
        const localBlocks = JSON.parse(localContent);
        for (const block of localBlocks) {
          if (!blacklist.includes(block)) {
            blacklist.push(block);
            // Optionally, we could insert it back into MongoDB here, but for now just merging locally
          }
        }
      } catch (err) {
        console.error("Error reading local blacklist", err);
      }
    }

    if (!fs.existsSync(RAW_DIR)) {
      fs.mkdirSync(RAW_DIR, { recursive: true });
    }

    fs.writeFileSync(BLACKLIST_FILE, JSON.stringify(blacklist, null, 2), 'utf-8');
    console.log(`Synced ${blacklist.length} blocks to ${BLACKLIST_FILE}`);
  } catch (err) {
    console.error("Error syncing blocks:", err);
  } finally {
    await client.close();
  }
}

main();
