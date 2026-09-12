import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function ProtectedRoute({ children, authorOnly = true }) {
  const { user, isAuthor } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (authorOnly && !isAuthor) return <Navigate to="/browse" replace />;
  return children;
}
