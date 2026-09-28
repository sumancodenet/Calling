// Keep in sync with PORT in backend/.env. 8080 is not usable: Apache
// (PEMHTTPD-x64) holds 0.0.0.0:8080 on this machine.
const BASE_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8100").replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Turns the API's [{ field, message }] list into { field: message } for form display. */
  get fieldErrors() {
    if (!Array.isArray(this.details)) return {};
    return this.details.reduce((acc, item) => {
      if (item?.field) acc[item.field] = item.message;
      return acc;
    }, {});
  }
}

// Held in memory only: a token in localStorage survives XSS, one in a closure does not.
let accessToken = null;
let refreshInFlight = null;
let unauthorizedHandler = null;

const readBody = async (res) => {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const send = async (path, { method = "GET", body, auth = false } = {}) => {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    if (!accessToken) {
      throw new ApiError(401, "UNAUTHENTICATED", "Your session has ended. Please sign in again.");
    }
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      credentials: "include",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Cannot reach the server. Check your connection.");
  }

  const payload = await readBody(res);

  if (!res.ok) {
    throw new ApiError(
      res.status,
      payload?.code ?? "ERROR",
      payload?.message ?? "Something went wrong",
      payload?.data,
    );
  }

  return payload;
};

const performRefresh = async () => {
  const payload = await send("/api/auth/refresh", { method: "POST" });
  accessToken = payload.data.accessToken;
  return payload.data;
};

// A single in-flight refresh shared by every concurrent 401, so a page that fires
// several requests at once does not rotate the cookie N times and invalidate itself.
const refreshSession = () => {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
};

const REFRESHABLE_CODES = new Set(["TOKEN_EXPIRED", "INVALID_TOKEN", "UNAUTHENTICATED", "UNAUTHORIZED"]);

const qs = (params) => {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, value);
  }
  const serialised = search.toString();
  return serialised ? `?${serialised}` : "";
};

const request = async (path, options = {}) => {
  try {
    return await send(path, options);
  } catch (error) {
    const canRetry =
      options.auth &&
      options.retry !== false &&
      error instanceof ApiError &&
      error.status === 401 &&
      REFRESHABLE_CODES.has(error.code);

    if (!canRetry) throw error;

    try {
      await refreshSession();
    } catch {
      accessToken = null;
      unauthorizedHandler?.();
      throw error;
    }

    return send(path, { ...options, retry: false });
  }
};

export const setUnauthorizedHandler = (fn) => {
  unauthorizedHandler = fn;
};

export const auth = {
  async login(credentials) {
    const payload = await send("/api/auth/login", { method: "POST", body: credentials });
    accessToken = payload.data.accessToken;
    return payload.data.user;
  },

  async restoreSession() {
    const payload = await send("/api/auth/refresh", { method: "POST" });
    accessToken = payload.data.accessToken;
    return payload.data.user;
  },

  async logout() {
    try {
      await send("/api/auth/logout", { method: "POST" });
    } finally {
      accessToken = null;
    }
  },

  me: () => request("/api/auth/me", { auth: true }),
  sessions: () => request("/api/auth/sessions", { auth: true }),
  logoutAll: () => request("/api/auth/logout-all", { method: "POST", auth: true }),
  createUser: (payload) => request("/api/auth/super-admin", { method: "POST", auth: true, body: payload }),

  listRoles: () => request("/api/auth/roles", { auth: true }),
  listUsers: (params) => request(`/api/users${qs(params)}`, { auth: true }),

  createUsers: (users) => request("/api/users/bulk", { method: "POST", auth: true, body: { users } }),

  getUser: (id) => request(`/api/users/${id}`, { auth: true }),
  updateUser: (id, patch) => request(`/api/users/${id}`, { method: "PATCH", auth: true, body: patch }),
  changePassword: (id, newPassword) => request(`/api/users/${id}/password`, { method: "POST", auth: true, body: { newPassword } }),
  deleteUser: (id) => request(`/api/users/${id}`, { method: "DELETE", auth: true }),

  // ---- pipelines / stages / tags ----
  listPipelines: (params) => request(`/api/pipelines${qs(params)}`, { auth: true }),
  getPipeline: (id) => request(`/api/pipelines/${id}`, { auth: true }),
  pipelineFunnel: (id) => request(`/api/pipelines/${id}/funnel`, { auth: true }),
  createPipeline: (body) => request("/api/pipelines", { method: "POST", auth: true, body }),
  updatePipeline: (id, patch) => request(`/api/pipelines/${id}`, { method: "PATCH", auth: true, body: patch }),
  deletePipeline: (id) => request(`/api/pipelines/${id}`, { method: "DELETE", auth: true }),

  createStage: (pipelineId, body) => request(`/api/pipelines/${pipelineId}/stages`, { method: "POST", auth: true, body }),
  updateStage: (pipelineId, stageId, patch) =>
    request(`/api/pipelines/${pipelineId}/stages/${stageId}`, { method: "PATCH", auth: true, body: patch }),
  deleteStage: (pipelineId, stageId) => request(`/api/pipelines/${pipelineId}/stages/${stageId}`, { method: "DELETE", auth: true }),

  createTag: (pipelineId, stageId, body) =>
    request(`/api/pipelines/${pipelineId}/stages/${stageId}/tags`, { method: "POST", auth: true, body }),
  updateTag: (pipelineId, stageId, tagId, patch) =>
    request(`/api/pipelines/${pipelineId}/stages/${stageId}/tags/${tagId}`, { method: "PATCH", auth: true, body: patch }),
  deleteTag: (pipelineId, stageId, tagId) =>
    request(`/api/pipelines/${pipelineId}/stages/${stageId}/tags/${tagId}`, { method: "DELETE", auth: true }),

  // ---- campaigns ----
  listCampaigns: (params) => request(`/api/campaigns${qs(params)}`, { auth: true }),
  campaignOptions: () => request("/api/campaigns/options", { auth: true }),
  createCampaign: (body) => request("/api/campaigns", { method: "POST", auth: true, body }),
  updateCampaignStatus: (id, Status) => request(`/api/campaigns/${id}/status`, { method: "PATCH", auth: true, body: { Status } }),
  getCampaign: (id) => request(`/api/campaigns/${id}`, { auth: true }),
  campaignAnalytics: (id) => request(`/api/campaigns/${id}/analytics`, { auth: true }),
  deleteCampaign: (id) => request(`/api/campaigns/${id}`, { method: "DELETE", auth: true }),
  listCampaignLeads: (id, params) => request(`/api/campaigns/${id}/leads${qs(params)}`, { auth: true }),
  listUploadLeads: (id, uploadId, params) => request(`/api/campaigns/${id}/uploads/${uploadId}/leads${qs(params)}`, { auth: true }),
  deleteUpload: (id, uploadId) => request(`/api/campaigns/${id}/uploads/${uploadId}`, { method: "DELETE", auth: true }),
  uploadDownloadUrl: (id, uploadId) => request(`/api/campaigns/${id}/uploads/${uploadId}/download`, { auth: true }),

  // Multipart: sent straight through fetch rather than the JSON `send` helper,
  // so the browser sets the multipart boundary itself.
  uploadCampaignLeads: async (id, formData) => {
    if (!accessToken) throw new ApiError(401, "UNAUTHENTICATED", "Your session has ended. Please sign in again.");

    let res;
    try {
      res = await fetch(`${BASE_URL}/api/campaigns/${id}/leads/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        credentials: "include",
        body: formData,
      });
    } catch {
      throw new ApiError(0, "NETWORK_ERROR", "Cannot reach the server. Check your connection.");
    }

    const payload = await readBody(res);
    if (!res.ok) {
      throw new ApiError(
        res.status,
        payload?.code ?? "ERROR",
        payload?.message ?? "The upload failed",
        payload?.data,
      );
    }
    return payload;
  },
};

export default auth;
