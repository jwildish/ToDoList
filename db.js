const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const db = new Database(path.join(dataDir, 'lists.db'));

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    checked INTEGER DEFAULT 0,
    added_by TEXT NOT NULL,
    checked_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE
  );
`);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Prepared statements
const stmts = {
  getLists: db.prepare('SELECT * FROM lists ORDER BY created_at DESC'),
  createList: db.prepare('INSERT INTO lists (name, created_by) VALUES (?, ?)'),
  deleteList: db.prepare('DELETE FROM lists WHERE id = ?'),
  getItems: db.prepare('SELECT * FROM items WHERE list_id = ? ORDER BY checked ASC, created_at DESC'),
  getItem: db.prepare('SELECT * FROM items WHERE id = ?'),
  addItem: db.prepare('INSERT INTO items (list_id, text, added_by) VALUES (?, ?, ?)'),
  toggleItem: db.prepare('UPDATE items SET checked = CASE WHEN checked = 0 THEN 1 ELSE 0 END, checked_by = ? WHERE id = ?'),
  deleteItem: db.prepare('DELETE FROM items WHERE id = ?'),
  clearCheckedItems: db.prepare('DELETE FROM items WHERE list_id = ? AND checked = 1'),
};

module.exports = {
  getLists() {
    return stmts.getLists.all();
  },

  createList(name, createdBy) {
    const info = stmts.createList.run(name, createdBy);
    return { id: info.lastInsertRowid, name, created_by: createdBy };
  },

  deleteList(id) {
    return stmts.deleteList.run(id);
  },

  getItems(listId) {
    return stmts.getItems.all(listId);
  },

  getItem(id) {
    return stmts.getItem.get(id);
  },

  addItem(listId, text, addedBy) {
    const info = stmts.addItem.run(listId, text, addedBy);
    return { id: info.lastInsertRowid, list_id: Number(listId), text, checked: 0, added_by: addedBy, checked_by: null };
  },

  toggleItem(id, checkedBy) {
    stmts.toggleItem.run(checkedBy, id);
    return stmts.getItem.get(id);
  },

  deleteItem(id) {
    return stmts.deleteItem.run(id);
  },

  clearCheckedItems(listId) {
    return stmts.clearCheckedItems.run(listId);
  },
};
