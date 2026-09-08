// Injects the sidebar + topbar into every protected page and highlights the
// active link. Each page just needs: <div id="sidebar"></div><div id="topbar"></div>
// and a <body data-page="products"> attribute to mark itself active.

const NAV_ITEMS = [
  { section: "Overview" },
  { page: "dashboard", href: "dashboard.html", label: "Dashboard", icon: "🏠" },

  { section: "Catalog" },
  { page: "products", href: "products.html", label: "Products", icon: "📦" },
  { page: "categories", href: "categories.html", label: "Categories", icon: "🏷️" },
  { page: "suppliers", href: "suppliers.html", label: "Suppliers", icon: "🚚" },
  { page: "purchase-orders", href: "purchase-orders.html", label: "Purchase Orders", icon: "🧾" },

  { section: "Sales" },
  { page: "pos", href: "pos.html", label: "New Sale (POS)", icon: "🛒" },
  { page: "sales-history", href: "sales-history.html", label: "Sales History", icon: "📄" },
  { page: "customers", href: "customers.html", label: "Customers", icon: "👥" },

  { section: "Insights" },
  { page: "reports", href: "reports.html", label: "Reports", icon: "📈" },

  { section: "Admin", adminOnly: true },
  { page: "users", href: "users.html", label: "Users", icon: "🔑", adminOnly: true },
  { page: "settings", href: "settings.html", label: "Shop Settings", icon: "⚙️", adminOnly: true }
];

function renderSidebar(activePage) {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;
  const admin = isAdmin();
  const shopName = localStorage.getItem("shop_name") || "Shop Manager";

  let html = `<a href="dashboard.html" class="brand"><span class="logo-dot"></span>${shopName}</a><nav class="nav flex-column">`;
  NAV_ITEMS.forEach(item => {
    if (item.adminOnly && !admin) return;
    if (item.section) {
      html += `<div class="nav-section">${item.section}</div>`;
      return;
    }
    const active = item.page === activePage ? "active" : "";
    html += `<a class="nav-link ${active}" href="${item.href}"><span>${item.icon}</span> ${item.label}</a>`;
  });
  html += `</nav>`;
  sidebar.innerHTML = html;
}

function renderTopbar(activePage) {
  const topbar = document.getElementById("topbar");
  if (!topbar) return;

  const user = currentUser();
  const title = (NAV_ITEMS.find(i => i.page === activePage) || {}).label || "";

  topbar.innerHTML = `
    <div class="page-title">${title}</div>
    <div class="d-flex align-items-center gap-3">
      <div style="position:relative">
        <button class="bell-btn" id="bellBtn">🔔<span class="bell-dot d-none" id="bellDot"></span></button>
        <div class="bell-dropdown" id="bellDropdown">
          <div class="bell-header">Low stock alerts</div>
          <div id="bellItems"></div>
        </div>
      </div>
      <span class="text-muted small">${user ? user.username : ""}</span>
      <span class="badge bg-secondary role-badge">${user ? user.role : ""}</span>
      <button class="btn btn-sm btn-outline-danger" onclick="logout()">Logout</button>
    </div>
  `;

  const bellBtn = document.getElementById("bellBtn");
  const bellDropdown = document.getElementById("bellDropdown");
  bellBtn.addEventListener("click", () => bellDropdown.classList.toggle("show"));
  document.addEventListener("click", e => {
    if (!bellBtn.contains(e.target) && !bellDropdown.contains(e.target)) {
      bellDropdown.classList.remove("show");
    }
  });

  loadLowStockBell();
}

async function loadLowStockBell() {
  try {
    const products = await getLowStockProducts();
    const dot = document.getElementById("bellDot");
    const items = document.getElementById("bellItems");
    if (!dot || !items) return;

    if (products.length > 0) {
      dot.classList.remove("d-none");
      items.innerHTML = products.slice(0, 6).map(p =>
        `<div class="bell-item">⚠️ <strong>${p.name}</strong> — only ${p.stock} left</div>`
      ).join("") + (products.length > 6
        ? `<div class="bell-item text-center"><a href="products.html">View all ${products.length} →</a></div>`
        : `<div class="bell-item text-center"><a href="products.html">View products →</a></div>`);
    } else {
      items.innerHTML = `<div class="bell-item text-muted">Nothing low on stock 🎉</div>`;
    }
  } catch {
    // silently ignore — this is a non-critical widget
  }
}

async function loadShopNameForSidebar() {
  try {
    const settings = await getSettings();
    if (settings.shop_name) {
      localStorage.setItem("shop_name", settings.shop_name);
      const brand = document.querySelector("#sidebar .brand");
      if (brand) brand.innerHTML = `<span class="logo-dot"></span>${settings.shop_name}`;
    }
    if (settings.currency_symbol) {
      localStorage.setItem("currency_symbol", settings.currency_symbol);
    }
  } catch {
    // keep the cached/default name
  }
}

function initLayout() {
  requireAuth();
  const activePage = document.body.dataset.page;
  renderSidebar(activePage);
  renderTopbar(activePage);
  loadShopNameForSidebar();

  // Hide admin-only elements for staff accounts
  if (!isAdmin()) {
    document.querySelectorAll("[data-admin-only]").forEach(el => el.remove());
  }
}

document.addEventListener("DOMContentLoaded", initLayout);
