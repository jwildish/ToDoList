const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- REST API ---

// Get all lists
app.get('/api/lists', (req, res) => {
  const lists = db.getLists();
  res.json(lists);
});

// Create a new list
app.post('/api/lists', (req, res) => {
  const { name, createdBy } = req.body;
  if (!name || !createdBy) return res.status(400).json({ error: 'name and createdBy required' });
  const list = db.createList(name.trim(), createdBy);
  io.emit('list:created', list);
  res.status(201).json(list);
});

// Delete a list
app.delete('/api/lists/:id', (req, res) => {
  db.deleteList(req.params.id);
  io.emit('list:deleted', { id: Number(req.params.id) });
  res.json({ ok: true });
});

// Get items for a list
app.get('/api/lists/:listId/items', (req, res) => {
  const items = db.getItems(req.params.listId);
  res.json(items);
});

// Add item to a list
app.post('/api/lists/:listId/items', (req, res) => {
  const { text, addedBy } = req.body;
  if (!text || !addedBy) return res.status(400).json({ error: 'text and addedBy required' });
  const item = db.addItem(req.params.listId, text.trim(), addedBy);
  io.emit('item:created', item);
  res.status(201).json(item);
});

// Toggle item checked
app.patch('/api/items/:id/toggle', (req, res) => {
  const { checkedBy } = req.body;
  const item = db.toggleItem(req.params.id, checkedBy || null);
  if (!item) return res.status(404).json({ error: 'item not found' });
  io.emit('item:updated', item);
  res.json(item);
});

// Delete item
app.delete('/api/items/:id', (req, res) => {
  const item = db.getItem(req.params.id);
  db.deleteItem(req.params.id);
  io.emit('item:deleted', { id: Number(req.params.id), listId: item ? item.list_id : null });
  res.json({ ok: true });
});

// Clear checked items from a list
app.post('/api/lists/:listId/clear-checked', (req, res) => {
  db.clearCheckedItems(req.params.listId);
  io.emit('items:cleared', { listId: Number(req.params.listId) });
  res.json({ ok: true });
});

// --- WebSocket ---
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// --- Start ---
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`Shared List App running at http://0.0.0.0:${PORT}`);
});
