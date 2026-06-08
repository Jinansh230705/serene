const { MongoClient } = require('mongodb');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI secret is not set.");
    process.exit(1);
  }

  const issueBody = process.env.ISSUE_BODY || "";
  const issueNumber = process.env.ISSUE_NUMBER;
  const token = process.env.GITHUB_TOKEN;
  const repoOwner = process.env.REPO_OWNER;
  const repoName = process.env.REPO_NAME;

  // Extract Tweet ID
  const tweetIdMatch = issueBody.match(/\*\*Tweet ID:\*\*\s*`(\d+)`/);
  const tweetId = tweetIdMatch ? tweetIdMatch[1] : null;

  // Extract Image URL (optional)
  const imageUrlMatch = issueBody.match(/\*\*Image URL:\*\*\s*(https:\/\/[^\s]+)/);
  const imageUrl = imageUrlMatch ? imageUrlMatch[1] : null;

  if (!tweetId) {
    console.error("Could not find Tweet ID in the issue body.");
    process.exit(1);
  }

  console.log(`Processing deletion for Tweet ID: ${tweetId}, Image: ${imageUrl || 'All'}`);

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('sereine');
    const likesCol = db.collection('likes');
    const blocksCol = db.collection('blocks');

    // 1. Delete/Update in likes
    if (imageUrl) {
      const doc = await likesCol.findOne({ id: tweetId });
      if (doc && doc.media) {
        const updatedMedia = doc.media.filter(m => m.url !== imageUrl);
        if (updatedMedia.length === 0) {
          await likesCol.deleteOne({ id: tweetId });
        } else {
          await likesCol.updateOne({ id: tweetId }, { $set: { media: updatedMedia } });
        }
      }
    } else {
      await likesCol.deleteOne({ id: tweetId });
    }

    // 2. Add to blocks
    const blacklistItem = imageUrl ? `img:${imageUrl}` : tweetId;
    await blocksCol.updateOne(
      { value: blacklistItem },
      { $set: { value: blacklistItem, addedAt: new Date().toISOString() } },
      { upsert: true }
    );

    console.log("Successfully deleted from MongoDB and added to blocks.");

    // 3. Comment and Close the issue
    if (token && issueNumber) {
      // Close the issue
      await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/issues/${issueNumber}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          state: 'closed'
        })
      });

      // Post a confirmation comment
      await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/issues/${issueNumber}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          body: `Successfully deleted from the MongoDB database and added to blocklist. Issue closed.`
        })
      });
      console.log("Closed issue and posted confirmation comment.");
    }

  } catch (err) {
    console.error("Error connecting to MongoDB or updating:", err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
