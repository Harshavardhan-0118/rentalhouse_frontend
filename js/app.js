(function () {
  const api = window.householdApi;
  const viewRoot = document.querySelector("#view");
  const navRoot = document.querySelector("#side-nav");
  const titleRoot = document.querySelector("#topbar-title");
  const actionsRoot = document.querySelector("#topbar-actions");
  const state = {
    view: location.hash.slice(1) || "browse",
    propertyId: null,
    filters: {},
    editingProperty: null
  };
  const photos = [
    "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=960&q=80",
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=960&q=80",
    "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=960&q=80",
    "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=960&q=80"
  ];
  const pageTitles = {
    browse: "Find a place to call home", dashboard: "Your rental overview", requests: "Rental requests",
    properties: "Property listings", addProperty: "Add a property", users: "User directory",
    messages: "Contact messages", profile: "Your profile", login: "Welcome back", register: "Create your account",
    details: "Property details", rentals: "Rental requests"
  };
  const navIcons = { dashboard: "▦", browse: "⌕", requests: "▤", properties: "⌂", addProperty: "+", users: "♙", messages: "✉", profile: "◉", rentals: "▤" };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }
  function money(value) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value || 0)); }
  function date(value) { return value ? new Date(value).toLocaleDateString() : "-"; }
  function currentUser() { return api.getUser(); }
  function toast(message, error = false) {
    const node = document.querySelector("#toast");
    node.textContent = message;
    node.classList.toggle("error", error);
    node.classList.add("show");
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => node.classList.remove("show"), 3300);
  }
  function setView(name) {
    state.view = name;
    if (name !== "addProperty") state.editingProperty = null;
    location.hash = name;
    render();
  }
  function navItems() {
    const user = currentUser();
    if (!user) return [{ view: "browse", label: "Explore homes" }];
    const shared = [{ view: "dashboard", label: "Overview" }];
    if (user.role === "TENANT") return [...shared, { view: "browse", label: "Find a home" }, { view: "requests", label: "My requests" }, { view: "messages", label: "Messages" }, { view: "profile", label: "Profile" }];
    if (user.role === "OWNER") return [...shared, { view: "properties", label: "My properties" }, { view: "addProperty", label: "Add property" }, { view: "requests", label: "Tenant requests" }, { view: "messages", label: "Messages" }, { view: "profile", label: "Profile" }];
    return [...shared, { view: "users", label: "Users" }, { view: "properties", label: "Properties" }, { view: "rentals", label: "Rental requests" }, { view: "messages", label: "Messages" }];
  }
  function renderShell() {
    const user = currentUser();
    const items = navItems();
    navRoot.innerHTML = items.map(item => `<button class="nav-link ${state.view === item.view ? "active" : ""}" data-view="${item.view}"><span class="nav-icon" aria-hidden="true">${navIcons[item.view] || "•"}</span>${escapeHtml(item.label)}</button>`).join("");
    document.querySelector("#nav-caption").textContent = user ? user.role : "DISCOVER";
    titleRoot.textContent = pageTitles[state.view] || "Household";
    actionsRoot.innerHTML = user
      ? `<span class="identity">${escapeHtml(user.fullName)} · ${escapeHtml(user.role.toLowerCase())}</span><button class="button secondary small" data-action="logout">Sign out</button>`
      : `<button class="button secondary small" data-view="login">Sign in</button><button class="button small" data-view="register">Create account</button>`;
  }
  async function get(path) { return api.request(path); }
  function emptyState(title, detail, action = "") {
    return `<div class="empty-state"><span class="empty-symbol" aria-hidden="true">⌂</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(detail)}</p>${action}</div>`;
  }
  function propertyCard(property) {
    const photo = property.imageUrl || photos[(Number(property.id) || 0) % photos.length];
    return `<article class="property-card">
      <div class="property-image"><img src="${escapeHtml(photo)}" alt="${escapeHtml(property.title)}" loading="lazy"><span class="availability">${property.availability ? "Available" : "Rented"}</span></div>
      <div class="property-body"><p class="property-location">${escapeHtml(property.location)}, ${escapeHtml(property.city)}</p>
        <h3 class="property-title">${escapeHtml(property.title)}</h3>
        <div class="property-facts"><span>${escapeHtml(property.bedrooms)} beds</span><span>${escapeHtml(property.bathrooms)} baths</span><span>${escapeHtml(property.area)} sq ft</span></div>
        <div class="property-footer"><div class="price">${money(property.monthlyRent)} <span>/ month</span></div><button class="button secondary small" data-action="property" data-id="${property.id}">View home</button></div>
      </div>
    </article>`;
  }
  function filterParams() {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(state.filters)) if (value) params.set(key, value);
    return params.toString();
  }
  async function renderBrowse() {
    const params = filterParams();
    const list = await get(`/properties${params ? `/search?${params}` : ""}`);
    viewRoot.innerHTML = `<div class="page-heading"><div><p class="eyebrow">A good move starts here</p><h1>Find a home that fits.</h1><p class="subhead">Browse available rentals from local owners.</p></div></div>
      <form class="toolbar" id="filter-form">
        <div class="field search-field"><label for="location">Area or city</label><input id="location" name="location" value="${escapeHtml(state.filters.location || "")}" placeholder="Try Downtown"></div>
        <div class="field short-field"><label for="propertyType">Home type</label><select id="propertyType" name="propertyType"><option value="">Any type</option>${["APARTMENT", "HOUSE", "VILLA", "STUDIO", "DUPLEX", "COMMERCIAL"].map(value => `<option ${state.filters.propertyType === value ? "selected" : ""}>${value}</option>`).join("")}</select></div>
        <div class="field short-field"><label for="minRent">Min rent</label><input id="minRent" name="minRent" type="number" min="0" value="${escapeHtml(state.filters.minRent || "")}" placeholder="$0"></div>
        <div class="field short-field"><label for="maxRent">Max rent</label><input id="maxRent" name="maxRent" type="number" min="0" value="${escapeHtml(state.filters.maxRent || "")}" placeholder="Any"></div>
        <button class="button" type="submit">Search homes</button>
      </form>
      ${list.length ? `<div class="property-grid">${list.map(propertyCard).join("")}</div>` : emptyState("No homes match those filters", "Adjust your search or clear filters to see more listings.", `<button class="button secondary" data-action="clear-filters">Clear filters</button>`)}
      ${!api.hasToken() ? `<div class="section-bar"><span class="subhead">Have a place to rent?</span><button class="button ghost" data-view="register">Join as an owner →</button></div>` : ""}`;
  }
  async function renderDetails() {
    if (!state.propertyId) { viewRoot.innerHTML = emptyState("Choose a home", "Select a property from the listings to see details.", `<button class="button" data-view="browse">Browse homes</button>`); return; }
    const p = await get(`/properties/${state.propertyId}`);
    const photo = p.imageUrl || photos[(Number(p.id) || 0) % photos.length];
    const user = currentUser();
    viewRoot.innerHTML = `<div class="page-heading"><div><p class="eyebrow">${escapeHtml(p.location)}, ${escapeHtml(p.city)}</p><h1>${escapeHtml(p.title)}</h1><p class="subhead">${escapeHtml(p.address)}, ${escapeHtml(p.city)}, ${escapeHtml(p.state)}</p></div><button class="button secondary" data-view="browse">← Back to homes</button></div>
      <div class="detail-layout"><div><img class="detail-photo" src="${escapeHtml(photo)}" alt="${escapeHtml(p.title)}">
        <section class="detail-panel"><h2>About this home</h2><p>${escapeHtml(p.description)}</p><div class="detail-meta"><span>${escapeHtml(p.bedrooms)} bedrooms</span><span>${escapeHtml(p.bathrooms)} bathrooms</span><span>${escapeHtml(p.area)} sq ft</span><span>${escapeHtml(p.furnishingStatus.replaceAll("_", " ").toLowerCase())}</span></div></section>
        <section class="detail-panel"><h2>Owner</h2><p>${escapeHtml(p.ownerName)} · ${escapeHtml(p.ownerPhone || p.ownerEmail)}</p></section></div>
        <aside><section class="detail-panel"><p class="eyebrow">Monthly rent</p><div class="price">${money(p.monthlyRent)} <span>/ month</span></div><p class="subhead">${money(p.securityDeposit)} security deposit</p>
          ${user?.role === "TENANT" && p.availability ? `<form id="rental-form" class="stack" data-property-id="${p.id}"><h3>Request this home</h3><div class="field"><label for="moveInDate">Preferred move-in date</label><input id="moveInDate" name="moveInDate" type="date" required></div><div class="field"><label for="requestMessage">Message to owner</label><textarea id="requestMessage" name="message" required placeholder="Tell the owner a little about your move."></textarea></div><button class="button full" type="submit">Send rental request</button></form>` : user ? `<p class="contact-card">${p.availability ? "Sign in as a tenant to request a viewing." : "This home is currently unavailable."}</p>` : `<p class="contact-card">Sign in or create a tenant account to request this home.</p><button class="button full" data-view="login">Sign in to continue</button>`}
          ${user?.role === "TENANT" ? `<form id="contact-form" class="stack" data-property-id="${p.id}" style="margin-top:20px"><h3>Ask the owner</h3><div class="field"><label for="contactMessage">Your message</label><textarea id="contactMessage" name="message" required placeholder="Ask a question about this home."></textarea></div><button class="button secondary full" type="submit">Contact owner</button></form>` : ""}
        </section></aside></div>`;
  }
  function stats(items) { return `<div class="stats-grid">${items.map(item => `<div class="stat"><div class="stat-label">${escapeHtml(item.label)}</div><div class="stat-value">${escapeHtml(item.value)}</div></div>`).join("")}</div>`; }
  async function renderDashboard() {
    const user = currentUser();
    if (!user) { setView("login"); return; }
    if (user.role === "ADMIN") {
      const d = await get("/admin/dashboard");
      viewRoot.innerHTML = `<div class="page-heading"><div><p class="eyebrow">Administrator</p><h1>Platform overview</h1><p class="subhead">A current view of the rental marketplace.</p></div></div>
        ${stats([{ label: "Registered users", value: d.users }, { label: "Property listings", value: d.properties }, { label: "Rental requests", value: d.rentalRequests }, { label: "Messages", value: d.contactMessages }])}
        <div class="section-bar"><h2>Administration</h2></div><div class="toolbar"><button class="button" data-view="users">Manage users</button><button class="button secondary" data-view="properties">Review properties</button><button class="button secondary" data-view="rentals">Review rental requests</button></div>`;
      return;
    }
    if (user.role === "OWNER") {
      const [listings, requests] = await Promise.all([get("/properties/mine"), get("/rental-requests/owner")]);
      const pending = requests.filter(request => request.status === "PENDING").length;
      viewRoot.innerHTML = `<div class="page-heading"><div><p class="eyebrow">Owner dashboard</p><h1>Good to see you, ${escapeHtml(user.fullName.split(" ")[0])}.</h1><p class="subhead">Keep your listings current and tenant requests moving.</p></div><button class="button" data-view="addProperty">＋ Add a property</button></div>
        ${stats([{ label: "Your listings", value: listings.length }, { label: "Available homes", value: listings.filter(p => p.availability).length }, { label: "Incoming requests", value: requests.length }, { label: "Need a response", value: pending }])}
        <div class="section-bar"><h2>Your latest listings</h2><button class="button ghost" data-view="properties">Manage listings →</button></div>${listings.length ? `<div class="property-grid">${listings.slice(0, 3).map(propertyCard).join("")}</div>` : emptyState("No listings yet", "Add your first property to start receiving requests.", `<button class="button" data-view="addProperty">Add property</button>`)}`;
      return;
    }
    const [requests, listings] = await Promise.all([get("/rental-requests/mine"), get("/properties")]);
    viewRoot.innerHTML = `<div class="page-heading"><div><p class="eyebrow">Tenant dashboard</p><h1>Welcome back, ${escapeHtml(user.fullName.split(" ")[0])}.</h1><p class="subhead">Your next place is out there. Keep track of your requests here.</p></div><button class="button" data-view="browse">Explore homes</button></div>
      ${stats([{ label: "Available homes", value: listings.length }, { label: "Your requests", value: requests.length }, { label: "Awaiting response", value: requests.filter(r => r.status === "PENDING").length }, { label: "Accepted", value: requests.filter(r => r.status === "ACCEPTED").length }])}
      <div class="section-bar"><h2>Recent requests</h2><button class="button ghost" data-view="requests">See all →</button></div>${requestList(requests.slice(0, 4), user.role)}`;
  }
  function requestList(items, role) {
    if (!items.length) return emptyState("Nothing here yet", "Your request activity will show up here.");
    return `<div class="data-list">${items.map(item => `<article class="request-row"><div class="request-main"><img class="request-thumb" src="${escapeHtml(item.property.imageUrl || photos[(Number(item.property.id) || 0) % photos.length])}" alt=""><div class="request-copy"><strong>${escapeHtml(item.property.title)}</strong><span>${role === "TENANT" ? `Sent ${date(item.requestDate)} · Move-in ${date(item.moveInDate)}` : `${escapeHtml(item.tenantName)} · Sent ${date(item.requestDate)}`}</span></div></div><div class="request-actions"><span class="badge ${item.status.toLowerCase()}">${escapeHtml(item.status.toLowerCase())}</span>${role !== "TENANT" && item.status === "PENDING" ? `<button class="button small" data-action="request-status" data-id="${item.id}" data-status="ACCEPTED">Accept</button><button class="button danger small" data-action="request-status" data-id="${item.id}" data-status="REJECTED">Decline</button>` : ""}${role === "TENANT" && item.status === "PENDING" ? `<button class="button secondary small" data-action="request-status" data-id="${item.id}" data-status="CANCELLED">Cancel</button>` : ""}</div></article>`).join("")}</div>`;
  }
  async function renderRequests() {
    const user = currentUser();
    const path = user.role === "TENANT" ? "/rental-requests/mine" : user.role === "OWNER" ? "/rental-requests/owner" : "/admin/rental-requests";
    const items = await get(path);
    viewRoot.innerHTML = `<div class="page-heading"><div><p class="eyebrow">${escapeHtml(user.role)}</p><h1>${user.role === "TENANT" ? "My rental requests" : "Tenant requests"}</h1><p class="subhead">Review current status and recent activity.</p></div></div>${requestList(items, user.role)}`;
  }
  function propertyForm(property = null) {
    const p = property || {};
    const input = (name, label, value = "", type = "text", wide = false) => `<div class="field ${wide ? "wide" : ""}"><label for="p-${name}">${label}</label><input id="p-${name}" name="${name}" type="${type}" value="${escapeHtml(value)}" ${["title", "description", "address", "city", "state", "location", "monthlyRent", "securityDeposit", "bedrooms", "bathrooms", "area"].includes(name) ? "required" : ""}></div>`;
    return `<div class="form-layout"><form id="property-form" class="form-panel"><p class="eyebrow">Owner workspace</p><h2>${p.id ? "Edit listing" : "Property details"}</h2><div class="form-grid">
      ${input("title", "Listing title", p.title, "text", true)}<div class="field wide"><label for="p-description">Description</label><textarea id="p-description" name="description" required>${escapeHtml(p.description || "")}</textarea></div>
      ${input("address", "Street address", p.address)}${input("city", "City", p.city)}${input("state", "State", p.state)}${input("location", "Neighborhood", p.location)}
      <div class="field"><label for="p-propertyType">Home type</label><select id="p-propertyType" name="propertyType" required>${["APARTMENT", "HOUSE", "VILLA", "STUDIO", "DUPLEX", "COMMERCIAL"].map(v => `<option ${p.propertyType === v ? "selected" : ""}>${v}</option>`).join("")}</select></div>
      ${input("monthlyRent", "Monthly rent", p.monthlyRent, "number")}${input("securityDeposit", "Security deposit", p.securityDeposit, "number")}${input("bedrooms", "Bedrooms", p.bedrooms ?? 1, "number")}${input("bathrooms", "Bathrooms", p.bathrooms ?? 1, "number")}${input("area", "Area (sq ft)", p.area, "number")}
      <div class="field"><label for="p-furnishingStatus">Furnishing</label><select id="p-furnishingStatus" name="furnishingStatus" required>${["FURNISHED", "SEMI_FURNISHED", "UNFURNISHED"].map(v => `<option ${p.furnishingStatus === v ? "selected" : ""}>${v}</option>`).join("")}</select></div>
      ${input("imageUrl", "Photo URL (optional)", p.imageUrl, "url", true)}</div><div class="form-actions"><button class="button secondary" type="reset">Clear</button><button class="button" type="submit">${p.id ? "Save changes" : "Publish listing"}</button></div></form>
      <aside class="side-panel"><p class="eyebrow">A clear listing gets noticed</p><h3>Make the details count.</h3><p class="subhead">Use a specific title, accurate rent, and a bright photo. Tenants can request a home as soon as it is published.</p></aside></div>`;
  }
  async function renderProperties() {
    const user = currentUser();
    if (user.role === "TENANT") { await renderBrowse(); return; }
    const items = user.role === "ADMIN" ? await get("/admin/properties") : await get("/properties/mine");
    viewRoot.innerHTML = `<div class="page-heading"><div><p class="eyebrow">${user.role === "ADMIN" ? "Platform" : "Owner workspace"}</p><h1>${user.role === "ADMIN" ? "All properties" : "My properties"}</h1><p class="subhead">${items.length} ${items.length === 1 ? "listing" : "listings"}</p></div>${user.role === "OWNER" ? `<button class="button" data-view="addProperty">＋ Add a property</button>` : ""}</div>
      ${items.length ? `<div class="property-grid">${items.map(p => `<article class="property-card">${propertyCard(p).match(/<div class="property-image">.*?<\/div>/s)?.[0] || ""}<div class="property-body"><p class="property-location">${escapeHtml(p.location)}, ${escapeHtml(p.city)}</p><h3 class="property-title">${escapeHtml(p.title)}</h3><div class="property-footer"><span class="badge ${p.availability ? "active" : "cancelled"}">${p.availability ? "Available" : "Unavailable"}</span><div class="request-actions"><button class="button secondary small" data-action="edit-property" data-id="${p.id}">Edit</button><button class="button secondary small" data-action="toggle-property" data-id="${p.id}" data-available="${!p.availability}">${p.availability ? "Mark rented" : "Relist"}</button><button class="button danger small" data-action="delete-property" data-id="${p.id}">Delete</button></div></div></div></article>`).join("")}</div>` : emptyState("No properties yet", "Add a listing to begin managing your rentals.", `<button class="button" data-view="addProperty">Add property</button>`)}`;
  }
  async function renderAddProperty() {
    const editing = state.editingProperty;
    viewRoot.innerHTML = `<div class="page-heading"><div><p class="eyebrow">List a home</p><h1>${editing ? "Edit property" : "Add a property"}</h1><p class="subhead">Enter the key details tenants need to make a decision.</p></div></div>${propertyForm(editing)}`;
  }
  async function renderUsers() {
    const users = await get("/admin/users");
    viewRoot.innerHTML = `<div class="page-heading"><div><p class="eyebrow">Administration</p><h1>User directory</h1><p class="subhead">${users.length} registered accounts</p></div></div>
      <div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>${users.map(user => `<tr><td>${escapeHtml(user.fullName)}</td><td>${escapeHtml(user.email)}</td><td>${escapeHtml(user.phone)}</td><td>${escapeHtml(user.role)}</td><td><span class="badge ${user.status.toLowerCase()}">${escapeHtml(user.status.toLowerCase())}</span></td><td>${user.role !== "ADMIN" ? `<button class="button danger small" data-action="delete-user" data-id="${user.id}">Remove</button>` : ""}</td></tr>`).join("")}</tbody></table></div>`;
  }
  async function renderMessages() {
    const items = await get("/contact");
    viewRoot.innerHTML = `<div class="page-heading"><div><p class="eyebrow">Inbox</p><h1>Contact messages</h1><p class="subhead">Messages connected to your rental listings.</p></div></div>
      ${items.length ? `<div class="data-list">${items.map(item => `<article class="request-row"><div class="request-copy"><strong>${escapeHtml(item.propertyTitle)} · ${escapeHtml(item.tenantName)}</strong><span>${escapeHtml(item.message)} · ${date(item.createdAt)}</span></div><span class="badge ${item.status.toLowerCase()}">${escapeHtml(item.status.toLowerCase())}</span></article>`).join("")}</div>` : emptyState("Your inbox is clear", "Property conversations will appear here.")}`;
  }
  async function renderProfile() {
    const user = await get("/users/me");
    viewRoot.innerHTML = `<div class="page-heading"><div><p class="eyebrow">Account settings</p><h1>Your profile</h1><p class="subhead">Update your contact details and password.</p></div></div>
      <form id="profile-form" class="form-panel" style="max-width:680px"><div class="form-grid"><div class="field"><label for="fullName">Full name</label><input id="fullName" name="fullName" required value="${escapeHtml(user.fullName)}"></div><div class="field"><label>Email</label><input disabled value="${escapeHtml(user.email)}"></div><div class="field"><label for="phone">Phone</label><input id="phone" name="phone" value="${escapeHtml(user.phone)}"></div><div class="field"><label>Role</label><input disabled value="${escapeHtml(user.role)}"></div><div class="field wide"><label for="address">Address</label><input id="address" name="address" value="${escapeHtml(user.address || "")}"></div><div class="field wide"><label for="password">New password</label><input id="password" name="password" type="password" minlength="6" placeholder="Leave blank to keep your current password"></div></div><div class="form-actions"><button class="button" type="submit">Save profile</button></div></form>`;
  }
  async function renderRentals() {
    const items = await get("/admin/rental-requests");
    viewRoot.innerHTML = `<div class="page-heading"><div><p class="eyebrow">Administration</p><h1>All rental requests</h1><p class="subhead">Review marketplace activity across every listing.</p></div></div>${requestList(items, "ADMIN")}`;
  }
  function renderLogin() {
    viewRoot.innerHTML = `<div class="auth-wrap"><div class="auth-visual"><h2>Find a place that feels like yours.</h2></div><form id="login-form" class="auth-form"><p class="eyebrow">Your account</p><h1>Welcome back.</h1><p>Sign in to manage your rental journey.</p><div class="stack"><div class="field"><label for="email">Email address</label><input id="email" name="email" type="email" autocomplete="email" required></div><div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required></div><button class="button full" type="submit">Sign in</button></div><p class="auth-switch">New to Household? <button class="text-button" type="button" data-view="register">Create an account</button></p></form></div>`;
  }
  function renderRegister() {
    viewRoot.innerHTML = `<div class="auth-wrap"><div class="auth-visual"><h2>Make the move that opens a new chapter.</h2></div><form id="register-form" class="auth-form"><p class="eyebrow">Get started</p><h1>Create your account.</h1><p>Join as a tenant or property owner.</p><div class="stack"><div class="field"><label for="fullName">Full name</label><input id="fullName" name="fullName" autocomplete="name" required></div><div class="field"><label for="email">Email address</label><input id="email" name="email" type="email" autocomplete="email" required></div><div class="field"><label for="phone">Phone</label><input id="phone" name="phone" autocomplete="tel" required></div><div class="field"><label for="role">I am joining as</label><select id="role" name="role"><option value="TENANT">Tenant</option><option value="OWNER">Property owner</option></select></div><div class="field"><label for="password">Password (6+ characters)</label><input id="password" name="password" type="password" minlength="6" required></div><div class="field"><label for="confirmPassword">Confirm password</label><input id="confirmPassword" name="confirmPassword" type="password" minlength="6" required></div><button class="button full" type="submit">Create account</button></div><p class="auth-switch">Already registered? <button class="text-button" type="button" data-view="login">Sign in</button></p></form></div>`;
  }
  async function render() {
    renderShell();
    try {
      const user = currentUser();
      const protectedViews = ["dashboard", "requests", "properties", "addProperty", "users", "messages", "profile", "rentals"];
      if (protectedViews.includes(state.view) && !user) { state.view = "login"; renderShell(); }
      const renderers = {
        browse: renderBrowse, details: renderDetails, dashboard: renderDashboard, requests: renderRequests,
        properties: renderProperties, addProperty: renderAddProperty, users: renderUsers,
        messages: renderMessages, profile: renderProfile, rentals: renderRentals,
        login: renderLogin, register: renderRegister
      };
      await (renderers[state.view] || renderBrowse)();
      renderShell();
    } catch (error) {
      viewRoot.innerHTML = emptyState("Could not load this view", error.message, `<button class="button secondary" data-action="reload">Try again</button>`);
      if (/401|403/.test(error.message)) toast(error.message, true);
    }
  }
  function formData(form) { return Object.fromEntries(new FormData(form).entries()); }
  function numberOrNull(value) { return value === "" ? null : Number(value); }

  document.addEventListener("click", async event => {
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) { setView(viewButton.dataset.view); return; }
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const { action, id } = button.dataset;
    try {
      if (action === "logout") { api.clearSession(); state.view = "browse"; await render(); toast("You have signed out."); }
      if (action === "property") { state.propertyId = id; setView("details"); }
      if (action === "edit-property") { state.editingProperty = await get(`/properties/${id}`); setView("addProperty"); }
      if (action === "clear-filters") { state.filters = {}; await render(); }
      if (action === "reload") await render();
      if (action === "request-status") { await api.request(`/rental-requests/${id}/${button.dataset.status.toLowerCase()}`, { method: "PUT" }); toast("Request updated."); await render(); }
      if (action === "toggle-property") { await api.request(`/properties/${id}/availability?available=${button.dataset.available}`, { method: "PUT" }); toast("Listing availability updated."); await render(); }
      if (action === "delete-property" && window.confirm("Delete this property and its related requests?")) { await api.request(`/properties/${id}`, { method: "DELETE" }); toast("Property deleted."); await render(); }
      if (action === "delete-user" && window.confirm("Remove this account? Related records may also be removed.")) { await api.request(`/users/${id}`, { method: "DELETE" }); toast("Account removed."); await render(); }
    } catch (error) { toast(error.message, true); }
  });

  document.addEventListener("submit", async event => {
    const form = event.target;
    event.preventDefault();
    try {
      if (form.id === "filter-form") {
        const data = formData(form);
        state.filters = Object.fromEntries(Object.entries(data).filter(([, value]) => value));
        await render();
      }
      if (form.id === "login-form") {
        const response = await api.request("/auth/login", { method: "POST", body: formData(form) });
        api.saveSession(response.token, response.user);
        toast(`Welcome, ${response.user.fullName.split(" ")[0]}.`);
        setView("dashboard");
      }
      if (form.id === "register-form") {
        const data = formData(form);
        await api.request("/auth/register", { method: "POST", body: { ...data, address: "" } });
        const response = await api.request("/auth/login", { method: "POST", body: { email: data.email, password: data.password } });
        api.saveSession(response.token, response.user);
        toast("Your account is ready.");
        setView("dashboard");
      }
      if (form.id === "property-form") {
        const data = formData(form);
        const body = { ...data, monthlyRent: Number(data.monthlyRent), securityDeposit: Number(data.securityDeposit), bedrooms: Number(data.bedrooms), bathrooms: Number(data.bathrooms), area: Number(data.area), availability: true };
        const editing = state.editingProperty;
        await api.request(editing ? `/properties/${editing.id}` : "/properties", { method: editing ? "PUT" : "POST", body });
        toast(editing ? "Your property was updated." : "Your property is now listed.");
        state.editingProperty = null;
        setView("properties");
      }
      if (form.id === "rental-form") {
        await api.request("/rental-requests", { method: "POST", body: { propertyId: Number(form.dataset.propertyId), moveInDate: formData(form).moveInDate, message: formData(form).message } });
        toast("Your rental request was sent.");
        setView("requests");
      }
      if (form.id === "contact-form") {
        await api.request("/contact", { method: "POST", body: { propertyId: Number(form.dataset.propertyId), message: formData(form).message } });
        toast("Your message was sent to the owner.");
        form.reset();
      }
      if (form.id === "profile-form") {
        const data = formData(form);
        const response = await api.request(`/users/${currentUser().id}`, { method: "PUT", body: data });
        localStorage.setItem("household.user", JSON.stringify(response.data));
        toast("Profile updated.");
        await render();
      }
    } catch (error) { toast(error.message, true); }
  });

  window.addEventListener("hashchange", () => {
    const next = location.hash.slice(1);
    if (next && next !== state.view) { state.view = next; render(); }
  });
  render();
})();