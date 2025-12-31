export const getAuthHeaders = (headers = {}) => {
  const token = localStorage.getItem("auth.access");
  if (!token) {
    return headers;
  }
  return { ...headers, Authorization: `Bearer ${token}` };
};

export const getRefreshToken = () => localStorage.getItem("auth.refresh");

export const clearAuthStorage = () => {
  localStorage.removeItem("auth.access");
  localStorage.removeItem("auth.refresh");
  localStorage.removeItem("auth.name");
};
