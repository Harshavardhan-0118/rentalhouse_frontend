(function () {
  const backendOrigin = (
    window.location.protocol === "file:" ||
    (window.location.hostname === "localhost" && window.location.port === "5500")
  ) ? "http://localhost:8080" : window.location.origin;
  const baseUrl = `${backendOrigin}/api`;
  const tokenKey = "household.token";

  async function request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    const token = localStorage.getItem(tokenKey);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (options.body !== undefined) headers.set("Content-Type", "application/json");
    let response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body)
      });
    } catch {
      throw new Error("Cannot reach the backend. Make sure it is running at http://localhost:8080.");
    }
    const text = await response.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = { message: text }; }
    }
    if (!response.ok) {
      const detail = data?.errors ? Object.values(data.errors).join("; ") : data?.message;
      throw new Error(detail || `Request failed (${response.status})`);
    }
    return data;
  }

  window.householdApi = {
    request,
    saveSession(token, user) {
      localStorage.setItem(tokenKey, token);
      localStorage.setItem("household.user", JSON.stringify(user));
    },
    clearSession() {
      localStorage.removeItem(tokenKey);
      localStorage.removeItem("household.user");
    },
    getUser() {
      try { return JSON.parse(localStorage.getItem("household.user") || "null"); }
      catch { return null; }
    },
    hasToken() { return Boolean(localStorage.getItem(tokenKey)); }
  };
})();