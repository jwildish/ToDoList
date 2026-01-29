// --- State ---
let currentUser = null;
let lists = [];
let selectedListId = null;
let items = [];

// --- Socket.IO ---
const socket = io();

socket.on('list:created', (list) => {
  if (!lists.find(l => l.id === list.id)) {
    lists.unshift(list);
    renderLists();
  }
});

socket.on('list:deleted', ({ id }) => {
  lists = lists.filter(l => l.id !== id);
  renderLists();
  if (selectedListId === id) {
    selectedListId = null;
    showNoListSelected();
  }
});

socket.on('item:created', (item) => {
  if (item.list_id === selectedListId && !items.find(i => i.id === item.id)) {
    items.push(item);
    sortItems();
    renderItems();
  }
  updateListCount(item.list_id);
});

socket.on('item:updated', (item) => {
  if (item.list_id === selectedListId) {
    const idx = items.findIndex(i => i.id === item.id);
    if (idx !== -1) {
      items[idx] = item;
      sortItems();
      renderItems();
    }
  }
});

socket.on('item:deleted', ({ id, listId }) => {
  if (listId === selectedListId) {
    items = items.filter(i => i.id !== id);
    renderItems();
  }
  if (listId) updateListCount(listId);
});

socket.on('items:cleared', ({ listId }) => {
  if (listId === selectedListId) {
    items = items.filter(i => !i.checked);
    renderItems();
  }
  updateListCount(listId);
});

// --- User Selection ---
function selectUser(name) {
  currentUser = name;
  localStorage.setItem('sharedListUser', name);
  document.getElementById('user-select').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  const badge = document.getElementById('current-user');
  badge.textContent = name;
  badge.className = 'user-badge ' + getUserClass(name);
  loadLists();
}

function switchUser() {
  localStorage.removeItem('sharedListUser');
  currentUser = null;
  selectedListId = null;
  document.getElementById('app').style.display = 'none';
  document.getElementById('user-select').style.display = 'flex';
}

function getUserClass(name) {
  return name === 'User 1' ? 'user1' : 'user2';
}

// --- Lists ---
async function loadLists() {
  const res = await fetch('/api/lists');
  lists = await res.json();
  renderLists();
}

function renderLists() {
  const container = document.getElementById('lists-container');
  container.innerHTML = '';
  lists.forEach(list => {
    const li = document.createElement('li');
    li.textContent = list.name;
    li.dataset.id = list.id;
    if (list.id === selectedListId) li.classList.add('active');
    li.onclick = () => selectList(list.id);
    container.appendChild(li);
  });
}

async function selectList(id) {
  selectedListId = id;
  const list = lists.find(l => l.id === id);
  renderLists();

  document.getElementById('no-list-selected').style.display = 'none';
  document.getElementById('list-view').style.display = 'block';
  document.getElementById('list-title').textContent = list.name;

  const res = await fetch(`/api/lists/${id}/items`);
  items = await res.json();
  renderItems();
  document.getElementById('item-input').focus();
}

function showNoListSelected() {
  document.getElementById('no-list-selected').style.display = 'flex';
  document.getElementById('list-view').style.display = 'none';
}

function showNewListModal() {
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('list-name-input').value = '';
  setTimeout(() => document.getElementById('list-name-input').focus(), 100);
}

function hideNewListModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

async function createList(e) {
  e.preventDefault();
  const name = document.getElementById('list-name-input').value.trim();
  if (!name) return;

  const res = await fetch('/api/lists', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, createdBy: currentUser }),
  });
  const list = await res.json();
  hideNewListModal();

  // The socket event will add it to the list, but select it immediately
  if (!lists.find(l => l.id === list.id)) {
    lists.unshift(list);
    renderLists();
  }
  selectList(list.id);
}

async function confirmDeleteList() {
  if (!selectedListId) return;
  const list = lists.find(l => l.id === selectedListId);
  if (!confirm(`Delete "${list.name}" and all its items?`)) return;

  await fetch(`/api/lists/${selectedListId}`, { method: 'DELETE' });
  lists = lists.filter(l => l.id !== selectedListId);
  selectedListId = null;
  renderLists();
  showNoListSelected();
}

// --- Items ---
function sortItems() {
  items.sort((a, b) => {
    if (a.checked !== b.checked) return a.checked - b.checked;
    return new Date(b.created_at) - new Date(a.created_at);
  });
}

function renderItems() {
  const container = document.getElementById('items-container');
  const noItems = document.getElementById('no-items');
  container.innerHTML = '';

  if (items.length === 0) {
    noItems.style.display = 'flex';
    return;
  }
  noItems.style.display = 'none';

  items.forEach(item => {
    const li = document.createElement('li');
    if (item.checked) li.classList.add('checked');

    const checkbox = document.createElement('div');
    checkbox.className = 'item-checkbox' + (item.checked ? ' checked' : '');
    checkbox.onclick = () => toggleItem(item.id);

    const text = document.createElement('span');
    text.className = 'item-text';
    text.textContent = item.text;

    const meta = document.createElement('div');
    meta.className = 'item-meta';

    const addedBy = document.createElement('span');
    addedBy.className = 'item-added-by ' + getUserClass(item.added_by);
    addedBy.textContent = item.added_by;
    meta.appendChild(addedBy);

    if (item.checked && item.checked_by) {
      const checkedBy = document.createElement('span');
      checkedBy.textContent = '✓ ' + item.checked_by;
      checkedBy.style.fontSize = '10px';
      meta.appendChild(checkedBy);
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'item-delete';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.onclick = () => deleteItem(item.id);

    li.append(checkbox, text, meta, deleteBtn);
    container.appendChild(li);
  });
}

async function addItem(e) {
  e.preventDefault();
  const input = document.getElementById('item-input');
  const text = input.value.trim();
  if (!text || !selectedListId) return;

  const res = await fetch(`/api/lists/${selectedListId}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, addedBy: currentUser }),
  });
  const item = await res.json();
  input.value = '';
  input.focus();

  if (!items.find(i => i.id === item.id)) {
    items.push(item);
    sortItems();
    renderItems();
  }
}

async function toggleItem(id) {
  const res = await fetch(`/api/items/${id}/toggle`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ checkedBy: currentUser }),
  });
  const updated = await res.json();
  const idx = items.findIndex(i => i.id === id);
  if (idx !== -1) {
    items[idx] = updated;
    sortItems();
    renderItems();
  }
}

async function deleteItem(id) {
  await fetch(`/api/items/${id}`, { method: 'DELETE' });
  items = items.filter(i => i.id !== id);
  renderItems();
}

async function clearChecked() {
  if (!selectedListId) return;
  const checkedCount = items.filter(i => i.checked).length;
  if (checkedCount === 0) return;
  if (!confirm(`Remove ${checkedCount} checked item(s)?`)) return;

  await fetch(`/api/lists/${selectedListId}/clear-checked`, { method: 'POST' });
  items = items.filter(i => !i.checked);
  renderItems();
}

async function updateListCount(listId) {
  // Re-fetch items count silently (for sidebar badge updates if needed)
  try {
    const res = await fetch(`/api/lists/${listId}/items`);
    if (res.ok && listId === selectedListId) {
      items = await res.json();
      renderItems();
    }
  } catch (e) {
    // ignore
  }
}

// --- Init ---
(function init() {
  const saved = localStorage.getItem('sharedListUser');
  if (saved && (saved === 'User 1' || saved === 'User 2')) {
    selectUser(saved);
  }
})();
