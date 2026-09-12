import axios from "axios";
import { auth } from "../firebase/config";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000",
  timeout: 100000,
});

// Attach the current user's Firebase ID token to every request,
// so the Express server can verify who's calling the AI/proxy routes.
api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
