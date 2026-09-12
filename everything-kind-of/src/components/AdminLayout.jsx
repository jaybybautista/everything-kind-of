import { NavLink, Link, useNavigate } from 'react-router-dom';
import { Feather, LayoutDashboard, PenLine, BookOpen, LogOut, ArrowUpRight, Flag } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function AdminLayout({ children }) {
  const { logout, profile } = useAuth();
  const navigate = useNavigate();
  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <Link to="/dashboard" className="studio-brand"><Feather size={25} /><span>Everything,<br />kind of<span className="studio-kicker">AUTHOR STUDIO</span></span></Link>
      <p className="sidebar-label">YOUR WORKSPACE</p>
      <nav aria-label="Author navigation">
        <NavLink to="/dashboard"><LayoutDashboard size={18} /> Overview</NavLink>
        <NavLink to="/write"><PenLine size={18} /> Write a story</NavLink>
        <NavLink to="/moderation"><Flag size={18} /> Comment reports</NavLink>
        <Link to="/browse"><BookOpen size={18} /> Reader library <ArrowUpRight size={14} /></Link>
      </nav>
      <div className="studio-note"><span>ONE CHAPTER AT A TIME</span><p>A little room for your next big idea.</p></div>
      <div className="studio-account"><div className="author-avatar">f</div><div><strong>{profile?.displayName || 'fluttershyyzh'}</strong><small>Administrator & author</small></div></div>
      <button className="studio-logout" onClick={async () => { await logout(); navigate('/'); }}><LogOut size={16} /> Log out</button>
    </aside>
    <div className="admin-main">
      <header className="studio-topbar"><span><span className="live-dot" /> Your private writing space</span><Link to="/">View reader site <ArrowUpRight size={14} /></Link></header>
      <main>{children}</main>
    </div>
  </div>;
}
