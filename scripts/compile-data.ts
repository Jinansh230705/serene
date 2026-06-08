import fs from 'fs';
import path from 'path';
import sizeOf from 'image-size';

// Input and output paths
const RAW_DIR = path.join(process.cwd(), 'likes-raw');
const OUTPUT_DIR = path.join(process.cwd(), 'src', 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'likes.json');

interface RawMedia {
  imageUrl: string;
  sourceType: string;
}

interface RawQuotedTweet {
  tweetId: string;
  authorName?: string;
  authorHandle: string;
  tweetUrl: string;
  tweetText: string;
  images: string[];
}

interface RawTweet {
  tweetId: string;
  authorName: string;
  authorHandle: string;
  tweetUrl: string;
  tweetText: string;
  hashtags: string[];
  media: RawMedia[];
  quotedTweet: RawQuotedTweet | null;
  collectedAt: string;
}

interface CompiledMedia {
  url: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
}

interface CompiledTweet {
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

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Load existing dimensions cache
const dimensionsCache = new Map<string, { width: number; height: number }>();
if (fs.existsSync(OUTPUT_FILE)) {
  try {
    const existingData: CompiledTweet[] = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
    for (const item of existingData) {
      for (const m of item.media) {
        if (m.url && m.width && m.height) {
          dimensionsCache.set(m.url, { width: m.width, height: m.height });
        }
      }
    }
    console.log(`Loaded ${dimensionsCache.size} image dimensions from cache.`);
  } catch (err) {
    console.warn('Could not load existing cache:', err);
  }
}

interface Attribution {
  title: string | null;
  artist: string | null;
  year: string | null;
}

// Function to extract structured attribution details from text
function parseAttribution(text: string): Attribution {
  const t = text.split('\n')[0].trim();
  
  let year: string | null = null;
  let yearMatch = t.match(/\b(1[4-9]\d{2}|20[0-2]\d)\b/);
  if (yearMatch) {
    year = yearMatch[1];
  }

  // Remove parentheses blocks and years to isolate the title and artist
  let clean = t.replace(/\([^)]*\)/g, '').trim();
  clean = clean.replace(/,?\s*(?:ca\.\s*)?\b(1[4-9]\d{2}|20[0-2]\d)\b/ig, '').replace(/\.$/, '').trim();

  // Helper to validate if a string looks like a name
  const isValidName = (str: string) => {
    const words = str.split(/\s+/);
    if (words.length < 2 || words.length > 5) return false;
    return words.every(w => {
      if (/^(van|von|de|da|di|le|la|du|del|the)$/i.test(w)) return true;
      return /^[A-Z\p{Lu}]/u.test(w) || /^['"‘“]/.test(w);
    });
  };

  let title: string | null = null;
  let artist: string | null = null;

  // 1. [Artist]'s [Title]
  let m = clean.match(/^([A-Z\p{Lu}].*?)'s\s+(.+)$/u);
  if (m && isValidName(m[1].trim())) {
    return { title: m[2].trim(), artist: m[1].trim(), year };
  }

  // 2. [Title] by|of [Artist]
  m = clean.match(/^(.*)\s+(?:by|of)\s+([A-Z\p{Lu}].*)$/u);
  if (m && isValidName(m[2].trim())) {
    title = m[1].trim();
    artist = m[2].trim();
    // Neutralize generic descriptor titles like "Paintings" or "The Seascapes"
    if (/^(works|paintings|art|seascapes|landscapes|masterpieces?|the\s+.*?(?:paintings|works|art|seascapes|landscapes))$/i.test(title)) {
      title = null;
    }
    return { title, artist, year };
  }

  // 3. [Title] - [Artist]
  m = clean.match(/^(.*?)\s*[-–—]\s*([A-Z\p{Lu}].*)$/u);
  if (m && isValidName(m[2].trim())) {
    title = m[1].trim();
    artist = m[2].trim();
    return { title, artist, year };
  }

  // 4. [Artist] - [Title]
  if (m && isValidName(m[1].trim())) {
    artist = m[1].trim();
    title = m[2].trim();
    return { title, artist, year };
  }

  // 5. [Title]. [Artist]
  m = clean.match(/^(.*?)\s*\.\s*([A-Z\p{Lu}].*)$/u);
  if (m && isValidName(m[2].trim())) {
    title = m[1].trim();
    artist = m[2].trim();
    return { title, artist, year };
  }

  // 6. [Title], [Artist]
  m = clean.match(/^(.*?)\s*,\s*([A-Z\p{Lu}].*)$/u);
  if (m && isValidName(m[2].trim())) {
    title = m[1].trim();
    artist = m[2].trim();
    return { title, artist, year };
  }

  // 7. Just Artist
  if (isValidName(clean)) {
    artist = clean;
    return { title, artist, year };
  }

  return { title: null, artist: null, year };
}

function formatAttributionDisplay(attr: Attribution, fallbackName: string): string {
  let display = attr.artist || fallbackName;
  if (attr.artist && attr.title) {
    display = `${attr.title} by ${attr.artist}`;
  }
  if (attr.artist && attr.year) {
    display += ` (${attr.year})`;
  }
  return display;
}

// Function to classify tweet based on content
function classifyTweet(text: string, hashtags: string[]): string {
  const content = (text + ' ' + hashtags.join(' ')).toLowerCase();
  
  // Sketches & Drawings
  if (
    content.includes('sketch') ||
    content.includes('pencil') ||
    content.includes('ink') ||
    content.includes('draw') ||
    content.includes('drawing') ||
    content.includes('charcoal') ||
    content.includes('doodle') ||
    content.includes('lineart') ||
    content.includes('line art')
  ) {
    return 'Sketches & Drawings';
  }

  // Oil Painting / Traditional Art style
  if (
    content.includes('oil') ||
    content.includes('painting') ||
    content.includes('canvas') ||
    content.includes('acrylic') ||
    content.includes('gouache') ||
    content.includes('watercolor') ||
    content.includes('watercolour') ||
    content.includes('tempera') ||
    content.includes('impressionism') ||
    content.includes('claudemonet') ||
    content.includes('monet') ||
    content.includes('van gogh') ||
    content.includes('rembrandt') ||
    content.includes('da vinci') ||
    content.includes('sargent') ||
    content.includes('museum')
  ) {
    return 'Oil & Traditional Painting';
  }

  // Natural Scenery
  if (
    content.includes('scenery') ||
    content.includes('landscape') ||
    content.includes('nature') ||
    content.includes('mountain') ||
    content.includes('river') ||
    content.includes('sea') ||
    content.includes('ocean') ||
    content.includes('lake') ||
    content.includes('forest') ||
    content.includes('woods') ||
    content.includes('sunset') ||
    content.includes('sunrise') ||
    content.includes('clouds') ||
    content.includes('field') ||
    content.includes('beach') ||
    content.includes('snow') ||
    content.includes('stream') ||
    content.includes('valley') ||
    content.includes('pastoral') ||
    content.includes('hills')
  ) {
    return 'Natural Scenery';
  }

  // Concept Art / Environmental Studies
  if (
    content.includes('concept') ||
    content.includes('concept art') ||
    content.includes('study') ||
    content.includes('studies') ||
    content.includes('environment study') ||
    content.includes('bg study') ||
    content.includes('background study') ||
    content.includes('composition') ||
    content.includes('illustration')
  ) {
    return 'Concept Art & Studies';
  }

  // Digital Art
  if (
    content.includes('digital') ||
    content.includes('procreate') ||
    content.includes('photoshop') ||
    content.includes('blender') ||
    content.includes('render') ||
    content.includes('c4d') ||
    content.includes('3d') ||
    content.includes('digital painting') ||
    content.includes('digitaloil') ||
    content.includes('speedpaint') ||
    content.includes('ciele') ||
    content.includes('anime') ||
    content.includes('manga') ||
    content.includes('fanart')
  ) {
    return 'Digital Art';
  }

  return 'Other';
}

// Function to fetch image size (streaming headers if possible)
async function fetchImageSize(url: string): Promise<{ width: number; height: number } | null> {
  // Check cache first
  if (dimensionsCache.has(url)) {
    return dimensionsCache.get(url)!;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Failed to fetch image: HTTP ${response.status}`);
    }

    // Read the stream chunk by chunk until image-size can parse it
    const reader = response.body?.getReader();
    if (!reader) {
      // Fallback to full buffer if reader is not available
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const dimensions = sizeOf(buffer);
      if (dimensions.width && dimensions.height) {
        return { width: dimensions.width, height: dimensions.height };
      }
      return null;
    }

    let chunks: Uint8Array[] = [];
    let totalLength = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (value) {
        chunks.push(value);
        totalLength += value.length;
        
        // Combine chunks
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          combined.set(chunk, offset);
          offset += chunk.length;
        }

        try {
          const buffer = Buffer.from(combined.buffer);
          const dimensions = sizeOf(buffer);
          if (dimensions.width && dimensions.height) {
            // Found it! Abort the rest of the stream
            controller.abort();
            return { width: dimensions.width, height: dimensions.height };
          }
        } catch (err) {
          // If it needs more bytes, continue reading
        }
      }

      if (done) {
        break;
      }
    }

    return null;
  } catch (err) {
    // Console error only for non-abort failures
    if (err instanceof Error && err.name !== 'AbortError') {
      console.warn(`Error resolving dimensions for ${url}:`, err.message);
    }
    return null;
  }
}

// Concurrent worker queue to fetch dimensions in parallel
async function processMediaListInParallel(
  urls: string[],
  concurrencyLimit = 25
): Promise<Map<string, { width: number; height: number }>> {
  const results = new Map<string, { width: number; height: number }>();
  let index = 0;
  let activeCount = 0;

  const total = urls.length;
  console.log(`Fetching dimensions for ${total} unique images with concurrency ${concurrencyLimit}...`);

  return new Promise((resolve) => {
    const runNext = async () => {
      if (index >= total && activeCount === 0) {
        resolve(results);
        return;
      }

      while (index < total && activeCount < concurrencyLimit) {
        const url = urls[index++];
        activeCount++;

        // Process this url
        (async (currentUrl) => {
          const dims = await fetchImageSize(currentUrl);
          if (dims) {
            results.set(currentUrl, dims);
            dimensionsCache.set(currentUrl, dims); // save in memory cache
          }
          activeCount--;
          runNext();
        })(url);
      }
    };

    runNext();
  });
}

// Main execution function
async function main() {
  console.log('Starting Twitter liked artworks compilation...');

  if (!fs.existsSync(RAW_DIR)) {
    if (fs.existsSync(OUTPUT_FILE)) {
      console.log('likes-raw/ not found but likes.json already exists — skipping compilation.');
      return;
    }
    console.error(`Error: likes-raw directory does not exist at ${RAW_DIR} and no existing likes.json found.`);
    process.exit(1);
  }

  // Load blacklist
  const blacklist = new Set<string>();
  const BLACKLIST_FILE = path.join(RAW_DIR, 'blacklist.json');
  if (fs.existsSync(BLACKLIST_FILE)) {
    try {
      const blacklistContent = fs.readFileSync(BLACKLIST_FILE, 'utf-8');
      const blacklistIds: string[] = JSON.parse(blacklistContent);
      for (const id of blacklistIds) {
        blacklist.add(id);
      }
      console.log(`Loaded ${blacklist.size} blacklisted tweets from blacklist.json.`);
    } catch (err) {
      console.warn('Could not load blacklist.json:', err);
    }
  }

  // Read all json files
  const files = fs.readdirSync(RAW_DIR).filter(f => f.endsWith('.json'));
  console.log(`Found ${files.length} raw JSON files to merge.`);

  const tweetsMap = new Map<string, RawTweet>();

  for (const file of files) {
    const filePath = path.join(RAW_DIR, file);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const rawTweets: RawTweet[] = JSON.parse(content);
      
      for (const tweet of rawTweets) {
        if (!tweet.tweetId) continue;
        if (blacklist.has(tweet.tweetId)) continue; // Skip blacklisted (removed) items
        tweetsMap.set(tweet.tweetId, tweet);
      }
    } catch (err) {
      console.error(`Error reading ${file}:`, err);
    }
  }

  const rawList = [...tweetsMap.values()];
  console.log(`Deduplicated into ${rawList.length} total unique tweets.`);

  // Get all unique image URLs to fetch their dimensions
  const uniqueUrls = new Set<string>();
  for (const tweet of rawList) {
    if (tweet.media) {
      for (const m of tweet.media) {
        if (m.imageUrl) {
          uniqueUrls.add(m.imageUrl);
        }
      }
    }
  }

  const urlList = [...uniqueUrls];
  const uncachedUrls = urlList.filter(url => !dimensionsCache.has(url));
  console.log(`Total unique images: ${urlList.length} (${uncachedUrls.length} need size lookup).`);

  // Fetch dimensions for all images (using concurrency)
  const sizes = await processMediaListInParallel(uncachedUrls, 30);

  // Compile final array
  const compiledData: CompiledTweet[] = [];

  for (const tweet of rawList) {
    const text = tweet.tweetText || '';
    const category = classifyTweet(text, tweet.hashtags || []);

    const compiledMedia: CompiledMedia[] = (tweet.media || [])
      .map(m => {
        const url = m.imageUrl;
        const dims = dimensionsCache.get(url);
        if (dims) {
          return {
            url,
            width: dims.width,
            height: dims.height,
            aspectRatio: parseFloat((dims.width / dims.height).toFixed(3))
          };
        }
        return { url };
      })
      .filter(m => !!m.url && !blacklist.has(`img:${m.url}`));

    const attr = parseAttribution(text);
    const finalAuthorName = formatAttributionDisplay(attr, tweet.authorName || `@${tweet.authorHandle}`);

    // Add main tweet if it has media left
    if (compiledMedia.length > 0) {
      compiledData.push({
        id: tweet.tweetId,
        authorName: finalAuthorName,
        authorHandle: tweet.authorHandle,
        tweetUrl: tweet.tweetUrl,
        text,
        hashtags: tweet.hashtags || [],
        media: compiledMedia,
        category,
        collectedAt: tweet.collectedAt || new Date().toISOString()
      });
    }

    // Process quoted tweet as a separate entry
    if (tweet.quotedTweet && tweet.quotedTweet.images && tweet.quotedTweet.images.length > 0) {
      const qt = tweet.quotedTweet;
      if (!blacklist.has(qt.tweetId)) {
        const qText = qt.tweetText || '';
        const qCategory = classifyTweet(qText, tweet.hashtags || []); // use parent hashtags for categorization context
        const qAttr = parseAttribution(qText);
        const qFinalAuthorName = formatAttributionDisplay(qAttr, qt.authorName || `@${qt.authorHandle}`);
        
        const qCompiledMedia = qt.images.map(url => {
          const dims = dimensionsCache.get(url);
          if (dims) {
            return { url, width: dims.width, height: dims.height, aspectRatio: parseFloat((dims.width / dims.height).toFixed(3)) };
          }
          return { url };
        }).filter(m => !!m.url && !blacklist.has(`img:${m.url}`));

        if (qCompiledMedia.length > 0) {
          // Check if we already have this quote (some quoted tweets might be repeated)
          if (!compiledData.find(c => c.id === qt.tweetId)) {
            compiledData.push({
              id: qt.tweetId,
              // @ts-ignore
              authorName: qFinalAuthorName,
              authorHandle: qt.authorHandle,
              tweetUrl: qt.tweetUrl,
              text: qText,
              hashtags: [],
              media: qCompiledMedia,
              category: qCategory,
              collectedAt: tweet.collectedAt || new Date().toISOString()
            });
          }
        }
      }
    }
  }

  // Deduplicate by ID (a tweet could be added as a quoted tweet and also as a main tweet)
  const uniqueCompiled = new Map<string, CompiledTweet>();
  for (const c of compiledData) {
    // Prefer the main tweet over the quoted tweet representation if duplicates exist 
    // (main tweet usually has better categorization data)
    if (!uniqueCompiled.has(c.id) || c.hashtags.length > 0) {
      uniqueCompiled.set(c.id, c);
    }
  }

  const finalData = Array.from(uniqueCompiled.values());

  // Sort by collectedAt (newest first)
  finalData.sort((a, b) => new Date(b.collectedAt).getTime() - new Date(a.collectedAt).getTime());

  // Write output file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalData, null, 2), 'utf-8');
  console.log(`Compilation complete! Wrote ${finalData.length} entries to ${OUTPUT_FILE}`);
}

main();
