const API_URL = "http://localhost:5000";

// ---------- helpers ----------
function authHeaders(json = true) {
  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

function qs(params = {}) {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== "" && v !== undefined && v !== null));
  const s = new URLSearchParams(clean).toString();
  return s ? `?${s}` : "";
}

function requireAuth() {
  if (!localStorage.getItem("token")) {
    window.location.href = "login.html";
  }
}

function currentUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function isAdmin() {
  const u = currentUser();
  return u && u.role === "admin";
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "login.html";
}

function toast(message, type = "success") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  const icon = type === "danger" ? "⚠️" : type === "success" ? "✅" : "ℹ️";
  const el = document.createElement("div");
  el.className = `app-toast ${type}`;
  el.innerHTML = `<span>${icon}</span><span class="flex-grow-1">${message}</span>`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// Renders shimmering placeholder rows into a <tbody> while data loads.
function showSkeleton(tbodyId, cols, rows = 4) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = Array.from({ length: rows }).map(() =>
    `<tr class="skeleton-row">${'<td></td>'.repeat(cols)}</tr>`
  ).join("");
}

// A friendly "nothing here yet" row for empty tables.
function emptyStateRow(colspan, message, icon = "📭") {
  return `<tr><td colspan="${colspan}">
    <div class="empty-state">
      <div class="empty-icon">${icon}</div>
      <div>${message}</div>
    </div>
  </td></tr>`;
}

// Downloads an array of objects as a CSV file.
function exportCSV(filename, rows) {
  if (!rows || rows.length === 0) {
    toast("Nothing to export", "danger");
    return;
  }
  const headers = Object.keys(rows[0]);
  const escape = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [
    headers.join(","),
    ...rows.map(row => headers.map(h => escape(row[h])).join(","))
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function money(n) {
  const symbol = localStorage.getItem("currency_symbol") || "Rs";
  return `${symbol} ${Number(n || 0).toFixed(2)}`;
}

// ---------- AUTH ----------
async function registerUser(username, password, email) {
  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, email })
  });
  return res.json();
}

async function loginUser(username, password) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  return res.json();
}

async function getMe() {
  const res = await fetch(`${API_URL}/api/auth/me`, { headers: authHeaders() });
  return res.json();
}

// ---------- CATEGORIES ----------
async function getCategories() {
  const res = await fetch(`${API_URL}/api/categories`, { headers: authHeaders() });
  return res.json();
}
async function addCategory(data) {
  const res = await fetch(`${API_URL}/api/categories`, { method: "POST", headers: authHeaders(), body: JSON.stringify(data) });
  return res.json();
}
async function updateCategory(id, data) {
  const res = await fetch(`${API_URL}/api/categories/${id}`, { method: "PUT", headers: authHeaders(), body: JSON.stringify(data) });
  return res.json();
}
async function deleteCategory(id) {
  const res = await fetch(`${API_URL}/api/categories/${id}`, { method: "DELETE", headers: authHeaders() });
  return res.json();
}

// ---------- SUPPLIERS ----------
async function getSuppliers() {
  const res = await fetch(`${API_URL}/api/suppliers`, { headers: authHeaders() });
  return res.json();
}
async function addSupplier(data) {
  const res = await fetch(`${API_URL}/api/suppliers`, { method: "POST", headers: authHeaders(), body: JSON.stringify(data) });
  return res.json();
}
async function updateSupplier(id, data) {
  const res = await fetch(`${API_URL}/api/suppliers/${id}`, { method: "PUT", headers: authHeaders(), body: JSON.stringify(data) });
  return res.json();
}
async function deleteSupplier(id) {
  const res = await fetch(`${API_URL}/api/suppliers/${id}`, { method: "DELETE", headers: authHeaders() });
  return res.json();
}

// ---------- PRODUCTS ----------
async function getProducts(params = {}) {
  const res = await fetch(`${API_URL}/api/products${qs(params)}`, { headers: authHeaders() });
  return res.json();
}
async function getLowStockProducts() {
  const res = await fetch(`${API_URL}/api/products/low-stock`, { headers: authHeaders() });
  return res.json();
}
async function getProductByBarcode(code) {
  const res = await fetch(`${API_URL}/api/products/barcode/${encodeURIComponent(code)}`, { headers: authHeaders() });
  return res.json();
}
async function addProduct(formData) {
  const res = await fetch(`${API_URL}/api/products`, { method: "POST", headers: authHeaders(false), body: formData });
  return res.json();
}
async function updateProduct(id, formData) {
  const res = await fetch(`${API_URL}/api/products/${id}`, { method: "PUT", headers: authHeaders(false), body: formData });
  return res.json();
}
async function deleteProduct(id) {
  const res = await fetch(`${API_URL}/api/products/${id}`, { method: "DELETE", headers: authHeaders() });
  return res.json();
}
async function importProducts(file) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_URL}/api/products/import`, { method: "POST", headers: authHeaders(false), body: fd });
  return res.json();
}

// ---------- CUSTOMERS ----------
async function getCustomers(params = {}) {
  const res = await fetch(`${API_URL}/api/customers${qs(params)}`, { headers: authHeaders() });
  return res.json();
}
async function getCustomerHistory(id) {
  const res = await fetch(`${API_URL}/api/customers/${id}/history`, { headers: authHeaders() });
  return res.json();
}
async function addCustomer(data) {
  const res = await fetch(`${API_URL}/api/customers`, { method: "POST", headers: authHeaders(), body: JSON.stringify(data) });
  return res.json();
}
async function updateCustomer(id, data) {
  const res = await fetch(`${API_URL}/api/customers/${id}`, { method: "PUT", headers: authHeaders(), body: JSON.stringify(data) });
  return res.json();
}
async function deleteCustomer(id) {
  const res = await fetch(`${API_URL}/api/customers/${id}`, { method: "DELETE", headers: authHeaders() });
  return res.json();
}

// ---------- SALES ----------
async function getSales(params = {}) {
  const res = await fetch(`${API_URL}/api/sales${qs(params)}`, { headers: authHeaders() });
  return res.json();
}
async function getSale(id) {
  const res = await fetch(`${API_URL}/api/sales/${id}`, { headers: authHeaders() });
  return res.json();
}
async function addSale(data) {
  const res = await fetch(`${API_URL}/api/sales`, { method: "POST", headers: authHeaders(), body: JSON.stringify(data) });
  return res.json();
}

// ---------- PURCHASE ORDERS ----------
async function getPurchaseOrders() {
  const res = await fetch(`${API_URL}/api/purchase-orders`, { headers: authHeaders() });
  return res.json();
}
async function getPurchaseOrder(id) {
  const res = await fetch(`${API_URL}/api/purchase-orders/${id}`, { headers: authHeaders() });
  return res.json();
}
async function addPurchaseOrder(data) {
  const res = await fetch(`${API_URL}/api/purchase-orders`, { method: "POST", headers: authHeaders(), body: JSON.stringify(data) });
  return res.json();
}
async function receivePurchaseOrder(id) {
  const res = await fetch(`${API_URL}/api/purchase-orders/${id}/receive`, { method: "PUT", headers: authHeaders() });
  return res.json();
}
async function cancelPurchaseOrder(id) {
  const res = await fetch(`${API_URL}/api/purchase-orders/${id}/cancel`, { method: "PUT", headers: authHeaders() });
  return res.json();
}

// ---------- DASHBOARD ----------
async function getDashboardStats() {
  const res = await fetch(`${API_URL}/api/dashboard/stats`, { headers: authHeaders() });
  return res.json();
}

// ---------- SETTINGS ----------
async function getSettings() {
  const res = await fetch(`${API_URL}/api/settings`, { headers: authHeaders() });
  return res.json();
}
async function updateSettings(data) {
  const res = await fetch(`${API_URL}/api/settings`, { method: "PUT", headers: authHeaders(), body: JSON.stringify(data) });
  return res.json();
}

// ---------- USERS (admin) ----------
async function getUsers() {
  const res = await fetch(`${API_URL}/api/users`, { headers: authHeaders() });
  return res.json();
}
async function updateUserRole(id, role) {
  const res = await fetch(`${API_URL}/api/users/${id}/role`, { method: "PUT", headers: authHeaders(), body: JSON.stringify({ role }) });
  return res.json();
}
async function updateUserStatus(id, is_active) {
  const res = await fetch(`${API_URL}/api/users/${id}/status`, { method: "PUT", headers: authHeaders(), body: JSON.stringify({ is_active }) });
  return res.json();
}
async function deleteUser(id) {
  const res = await fetch(`${API_URL}/api/users/${id}`, { method: "DELETE", headers: authHeaders() });
  return res.json();
}

// ---------- REFUNDS ----------
async function refundSale(id, payload) {
  const res = await fetch(`${API_URL}/api/sales/${id}/refund`, { method: "POST", headers: authHeaders(), body: JSON.stringify(payload) });
  return res.json();
}
