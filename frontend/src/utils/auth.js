export const getAuthHeaders = (headers = {}) => {
  const token = localStorage.getItem("auth.access");
  if (!token) {
    return headers;
  }
  return { ...headers, Authorization: `Bearer ${token}` };
};
