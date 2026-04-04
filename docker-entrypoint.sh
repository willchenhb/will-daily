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
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)\`,
  \`CREATE TABLE IF NOT EXISTS TeamMember (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
    department TEXT, role TEXT, avatarColor TEXT DEFAULT '#3B82F6',
    level INTEGER DEFAULT 1,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)\`,
  \`CREATE TABLE IF NOT EXISTS Project (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE, description TEXT,
    category TEXT NOT NULL, status TEXT DEFAULT 'planning',
    priority TEXT DEFAULT 'P1', ownerId INTEGER NOT NULL,
    startDate TEXT, targetEndDate TEXT, okrObjectiveId TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ownerId) REFERENCES TeamMember(id))\`,
  \`CREATE TABLE IF NOT EXISTS Milestone (
    id INTEGER PRIMARY KEY AUTOINCREMENT, projectId INTEGER NOT NULL,
    title TEXT NOT NULL, dueDate TEXT, completedDate TEXT,
    status TEXT DEFAULT 'not_started', deliverables TEXT,
    \"order\" INTEGER DEFAULT 0,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (projectId) REFERENCES Project(id) ON DELETE CASCADE)\`,
  \`CREATE TABLE IF NOT EXISTS ProjectRisk (
    id INTEGER PRIMARY KEY AUTOINCREMENT, projectId INTEGER NOT NULL,
    title TEXT NOT NULL, probability TEXT DEFAULT 'medium',
    impact TEXT DEFAULT 'medium', mitigation TEXT,
    status TEXT DEFAULT 'open', ownerId INTEGER,
    identifiedDate TEXT, resolvedDate TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (projectId) REFERENCES Project(id) ON DELETE CASCADE,
    FOREIGN KEY (ownerId) REFERENCES TeamMember(id))\`,
  \`CREATE TABLE IF NOT EXISTS DailyDigest (
    id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL,
    category TEXT NOT NULL, title TEXT NOT NULL,
    summary TEXT, url TEXT, source TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)\`,
  \`CREATE TABLE IF NOT EXISTS Session (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    userId INTEGER NOT NULL,
    expiresAt INTEGER NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE)\`
];

for (const sql of tables) db.exec(sql);

// Add milestoneId column to TodoItem if missing
try {
  db.prepare('SELECT milestoneId FROM TodoItem LIMIT 1').get();
} catch(e) {
  db.exec('ALTER TABLE TodoItem ADD COLUMN milestoneId INTEGER REFERENCES Milestone(id) ON DELETE SET NULL');
  console.log('Added milestoneId column to TodoItem');
}

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
  'CREATE INDEX IF NOT EXISTS idx_digest_date ON DailyDigest(date)',
  'CREATE INDEX IF NOT EXISTS idx_digest_category ON DailyDigest(category)',
  'CREATE INDEX IF NOT EXISTS idx_session_token ON Session(token)',
  'CREATE INDEX IF NOT EXISTS idx_project_owner ON Project(ownerId)',
  'CREATE INDEX IF NOT EXISTS idx_project_status ON Project(status)',
  'CREATE INDEX IF NOT EXISTS idx_project_category ON Project(category)',
  'CREATE INDEX IF NOT EXISTS idx_milestone_project ON Milestone(projectId)',
  'CREATE INDEX IF NOT EXISTS idx_risk_project ON ProjectRisk(projectId)',
  'CREATE INDEX IF NOT EXISTS idx_risk_owner ON ProjectRisk(ownerId)',
  'CREATE INDEX IF NOT EXISTS idx_todo_milestone ON TodoItem(milestoneId)',
];
for (const sql of indexes) db.exec(sql);

// Seed team members if empty
const memberCount = db.prepare('SELECT COUNT(*) as c FROM TeamMember').get();
if (memberCount.c === 0) {
  const members = [
    ['陈海彪','AI产品中心','中心负责人','#e74c3c',0],
    ['王亚洲','产品部','产品负责人','#3498db',1],
    ['袁小龙','商业化部','商业化负责人','#e91e63',1],
    ['张帅','瀚海平台部','平台负责人','#9b59b6',1],
    ['周一新','模型技术部','模型负责人','#1abc9c',1],
    ['陈斌','应用技术部','应用技术负责人','#e67e22',1],
    ['陈凯','创新技术部','创新技术负责人','#2ecc71',1],
    ['袁伟','技术保障部','技术保障负责人','#2ecc71',2],
    ['张坤','业务管理部','业务BP','#00bcd4',1],
  ];
  const now = new Date().toISOString();
  const stmt = db.prepare('INSERT INTO TeamMember (name,department,role,avatarColor,level,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)');
  for (const m of members) stmt.run(...m, now, now);
  console.log('Seeded 9 team members');
}

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
