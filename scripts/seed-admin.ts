import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import path from 'path'

const db = new Database(path.resolve(process.cwd(), 'data', 'daily.db'))

const existing = db.prepare("SELECT id FROM User WHERE username = ?").get('admin')
if (existing) {
  console.log('Admin user already exists, skipping.')
} else {
  const hash = bcrypt.hashSync('admin123', 10)
  const apiToken = crypto.randomUUID()
  db.prepare(
    "INSERT INTO User (username, password, role, apiToken, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))"
  ).run('admin', hash, 'admin', apiToken)
  console.log('Default admin user created (username: admin, password: admin123)')
}

db.close()
