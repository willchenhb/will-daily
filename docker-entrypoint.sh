#!/bin/sh
set -e

# Initialize database tables if they don't exist
node -e "
const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.resolve(process.cwd(), 'data', 'daily.db'));

// Enable WAL mode
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

// Create all tables
const tables = [
  \`CREATE TABLE IF NOT EXISTS DiaryEntry (
    id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)\`,
  \`CREATE TABLE IF NOT EXISTS WeeklyPlan (
    id INTEGER PRIMARY KEY AUTOINCREMENT, weekStart TEXT NOT NULL UNIQUE,
    title TEXT, content TEXT, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)\`,
  \`CREATE TABLE IF NOT EXISTS TodoItem (
    id INTEGER PRIMARY KEY AUTOINCREMENT, weeklyPlanId INTEGER NOT NULL,
    text TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0,
    note TEXT, \"order\" INTEGER NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (weeklyPlanId) REFERENCES WeeklyPlan(id) ON DELETE CASCADE)\`,
  \`CREATE TABLE IF NOT EXISTS Note (
    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL,
    content TEXT NOT NULL, category TEXT, summary TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)\`,
  \`CREATE TABLE IF NOT EXISTS Setting (
    id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)\`,
  \`CREATE TABLE IF NOT EXISTS CuratedArticle (
    id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL, author TEXT, image TEXT, content TEXT,
    summary TEXT, keyPoints TEXT, tags TEXT, category TEXT,
    status TEXT DEFAULT 'done', source TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)\`,
  \`CREATE TABLE IF NOT EXISTS ContentNode (
    id INTEGER PRIMARY KEY AUTOINCREMENT, sourceType TEXT NOT NULL,
    sourceId INTEGER NOT NULL, title TEXT NOT NULL, snippet TEXT NOT NULL,
    embedding TEXT, method TEXT NOT NULL DEFAULT 'kimi',
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sourceType, sourceId))\`,
  \`CREATE TABLE IF NOT EXISTS ContentEdge (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nodeAId INTEGER NOT NULL, nodeBId INTEGER NOT NULL, weight REAL NOT NULL,
    FOREIGN KEY (nodeAId) REFERENCES ContentNode(id) ON DELETE CASCADE,
    FOREIGN KEY (nodeBId) REFERENCES ContentNode(id) ON DELETE CASCADE,
    UNIQUE(nodeAId, nodeBId))\`,
  \`CREATE TABLE IF NOT EXISTS User (
    id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user',
    apiToken TEXT NOT NULL UNIQUE, isActive INTEGER NOT NULL DEFAULT 1,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)\`
];

for (const sql of tables) db.exec(sql);

// Create indexes
const indexes = [
  'CREATE INDEX IF NOT EXISTS idx_todo_weekly ON TodoItem(weeklyPlanId)',
  'CREATE INDEX IF NOT EXISTS idx_note_category ON Note(category)',
  'CREATE INDEX IF NOT EXISTS idx_curated_created ON CuratedArticle(createdAt)',
  'CREATE INDEX IF NOT EXISTS idx_curated_category ON CuratedArticle(category)',
  'CREATE INDEX IF NOT EXISTS idx_curated_status ON CuratedArticle(status)',
  'CREATE INDEX IF NOT EXISTS idx_content_node_type ON ContentNode(sourceType)',
  'CREATE INDEX IF NOT EXISTS idx_edge_a ON ContentEdge(nodeAId)',
  'CREATE INDEX IF NOT EXISTS idx_edge_b ON ContentEdge(nodeBId)',
];
for (const sql of indexes) db.exec(sql);

// Seed admin user if no users exist
const userCount = db.prepare('SELECT COUNT(*) as c FROM User').get();
if (userCount.c === 0) {
  const bcrypt = require('bcryptjs');
  const crypto = require('crypto');
  const hash = bcrypt.hashSync('admin123', 10);
  const token = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO User (username, password, role, apiToken, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)').run('admin', hash, 'admin', token, now, now);
  console.log('Admin user created: admin/admin123');
}

db.close();
console.log('Database initialized');
"

# Start the server
exec node server.js
