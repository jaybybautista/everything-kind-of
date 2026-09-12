import { Routes, Route, useLocation } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import AdminLayout from "./components/AdminLayout";
import './studio.css';
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Browse from "./pages/Browse";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyEmail from "./pages/VerifyEmail";
import StoryDetail from "./pages/StoryDetail";
import ChapterReader from "./pages/ChapterReader";
import Dashboard from "./pages/Dashboard";
import WriteStory from "./pages/WriteStory";
import ChapterList from "./pages/ChapterList";
import ChapterEditor from "./pages/ChapterEditor";
import AuthorProfile from "./pages/AuthorProfile";
import CommentReports from './pages/CommentReports';

export default function App() {
  const { isAuthor } = useAuth();
  const { pathname } = useLocation();
  const authorView = isAuthor && (pathname === '/dashboard' || pathname === '/moderation' || pathname.startsWith('/write'));
  const Layout = authorView ? AdminLayout : ReaderLayout;
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/browse" element={<Browse />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/stories/:storyId" element={<StoryDetail />} />
        <Route path="/stories/:storyId/chapters/:chapterId" element={<ChapterReader />} />
        <Route path="/authors/:authorId" element={<AuthorProfile />} />
        <Route path="/my-reports" element={<ProtectedRoute authorOnly={false}><CommentReports /></ProtectedRoute>} />
        <Route path="/moderation" element={<ProtectedRoute><CommentReports moderation /></ProtectedRoute>} />

        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/write" element={<ProtectedRoute><WriteStory /></ProtectedRoute>} />
        <Route path="/write/:storyId" element={<ProtectedRoute><WriteStory /></ProtectedRoute>} />
        <Route path="/write/:storyId/chapters" element={<ProtectedRoute><ChapterList /></ProtectedRoute>} />
        <Route path="/write/:storyId/chapters/:chapterId" element={<ProtectedRoute><ChapterEditor /></ProtectedRoute>} />
      </Routes>
    </Layout>
  );
}

function ReaderLayout({ children }) {
  return <div className="min-h-screen bg-[var(--color-page)]"><Navbar />{children}</div>;
}
