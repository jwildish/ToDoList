const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const dbPath = path.join(dataDir, 'lists.json');

function loadData() {
  if (!fs.existsSync(dbPath)) {
    return { lists: [], items: [], nextListId: 1, nextItemId: 1 };
  }
  return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function saveData(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = {
  getLists() {
    const data = loadData();
    return data.lists.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  createList(name, createdBy) {
    const data = loadData();
    const list = {
      id: data.nextListId++,
      name,
      created_by: createdBy,
      created_at: new Date().toISOString(),
    };
    data.lists.push(list);
    saveData(data);
    return list;
  },

  deleteList(id) {
    const data = loadData();
    const numId = Number(id);
    data.lists = data.lists.filter(l => l.id !== numId);
    data.items = data.items.filter(i => i.list_id !== numId);
    saveData(data);
  },

  getItems(listId) {
    const data = loadData();
    const numId = Number(listId);
    return data.items
      .filter(i => i.list_id === numId)
      .sort((a, b) => {
        if (a.checked !== b.checked) return a.checked - b.checked;
        return new Date(b.created_at) - new Date(a.created_at);
      });
  },

  getItem(id) {
    const data = loadData();
    return data.items.find(i => i.id === Number(id)) || null;
  },

  addItem(listId, text, addedBy) {
    const data = loadData();
    const item = {
      id: data.nextItemId++,
      list_id: Number(listId),
      text,
      checked: 0,
      added_by: addedBy,
      checked_by: null,
      created_at: new Date().toISOString(),
    };
    data.items.push(item);
    saveData(data);
    return item;
  },

  toggleItem(id, checkedBy) {
    const data = loadData();
    const numId = Number(id);
    const item = data.items.find(i => i.id === numId);
    if (!item) return null;
    item.checked = item.checked ? 0 : 1;
    item.checked_by = item.checked ? checkedBy : null;
    saveData(data);
    return item;
  },

  deleteItem(id) {
    const data = loadData();
    data.items = data.items.filter(i => i.id !== Number(id));
    saveData(data);
  },

  clearCheckedItems(listId) {
    const data = loadData();
    const numId = Number(listId);
    data.items = data.items.filter(i => !(i.list_id === numId && i.checked));
    saveData(data);
  },
};
