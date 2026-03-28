const Database = require('better-sqlite3');

const srcDb = new Database('/Users/willchenhb/claudecode/wechatlinks/dev.db', { readonly: true });
const dstDb = new Database('data/daily.db');

// Read all articles from source
const articles = srcDb.prepare('SELECT * FROM Article').all();
console.log(`Found ${articles.length} articles in wechatlinks`);

const insert = dstDb.prepare(`
  INSERT OR IGNORE INTO CuratedArticle (url, title, author, image, content, summary, keyPoints, tags, category, source, status, createdAt, updatedAt)
  VALUES (@url, @title, @author, @image, @content, @summary, @keyPoints, @tags, @category, @source, @status, @createdAt, @updatedAt)
`);

let imported = 0;
let skipped = 0;

const tx = dstDb.transaction(() => {
  for (const a of articles) {
    // Convert tags from JSON array to comma-separated
    let tags = null;
    if (a.tags) {
      try {
        const arr = JSON.parse(a.tags);
        tags = Array.isArray(arr) ? arr.join(',') : a.tags;
      } catch {
        tags = a.tags;
      }
    }

    const result = insert.run({
      url: a.url,
      title: a.title || '',
      author: a.author || null,
      image: a.coverImage || null,
      content: a.content || null,
      summary: a.summary || null,
      keyPoints: a.keyPoints || null,
      tags,
      category: a.category || 'other',
      source: 'wechat',
      status: a.status === 'completed' ? 'done' : (a.status || 'done'),
      createdAt: a.createdAt || new Date().toISOString(),
      updatedAt: a.updatedAt || new Date().toISOString(),
    });

    if (result.changes > 0) {
      imported++;
    } else {
      skipped++;
    }
  }
});

tx();

console.log(`Imported: ${imported}, Skipped (duplicate): ${skipped}`);
console.log(`Total CuratedArticle count: ${dstDb.prepare('SELECT count(*) as c FROM CuratedArticle').get().c}`);

srcDb.close();
dstDb.close();
