import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import '../discussions.css';

export default function CommentReports({ moderation = false }) {
  const [reports, setReports] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const load = useCallback(async () => {
    try { const { data } = await api.get('/api/discussions/reports', { params: { moderation } }); setReports(data.reports); setError(''); }
    catch (failure) { setError(failure.response?.data?.error || 'Could not load reports.'); }
    finally { setLoading(false); }
  }, [moderation]);
  useEffect(() => {
    let active = true;
    api.get('/api/discussions/reports', { params: { moderation } })
      .then(({ data }) => { if (active) { setReports(data.reports); setError(''); } })
      .catch(failure => { if (active) setError(failure.response?.data?.error || 'Could not load reports.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [moderation]);
  const visible = reports.filter(report => filter === 'all' || (filter === 'pending' ? report.status === 'pending' : report.status !== 'pending'));
  return <div className="reports-page"><div className="reports-heading"><div><p className="discussion-eyebrow">COMMUNITY CARE</p><h1>{moderation ? 'Comment reports' : 'My reports'}</h1><p>{moderation ? 'Review reports and keep the conversations welcoming.' : 'Track the reports you submitted and the author’s decisions.'}</p></div><button onClick={load} disabled={loading}>Refresh</button></div>
    <div className="report-filters">{[['pending', 'Pending'], ['reviewed', 'Reviewed'], ['all', 'All reports']].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
    {loading && <p role="status">Loading reports...</p>}{error && <p role="alert" className="discussion-error">{error}</p>}
    {!loading && !visible.length && <div className="reports-empty">No {filter === 'all' ? '' : filter} reports.</div>}
    {visible.map(report => <ReportCard key={report.id} report={report} moderation={moderation} onReviewed={load} />)}
  </div>;
}
function ReportCard({ report, moderation, onReviewed }) {
  const [note, setNote] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function review(decision) {
    setBusy(true); setError('');
    try { await api.post(`/api/discussions/reports/${report.id}/review`, { decision, note }); await onReviewed(); }
    catch (failure) { setError(failure.response?.data?.error || 'Could not review report.'); }
    finally { setBusy(false); }
  }
  return <article className="report-card"><header><strong>{report.reason}</strong><span className={`report-status ${report.status}`}>{report.status}</span></header><p className="report-context">{report.commentUserName} · {report.chapterTitle || 'Chapter comment'}</p><blockquote>{report.commentText}</blockquote>{report.details && <p>{report.details}</p>}
    <p className="report-context">Reported {new Date(report.createdAt).toLocaleString()}</p>{report.storyId && <Link to={`/stories/${report.storyId}/chapters/${report.chapterId}`}>View chapter</Link>}
    {report.status !== 'pending' && <div className="review-outcome"><strong>{report.status === 'removed' ? 'The author removed the comment.' : 'The author dismissed this report.'}</strong>{report.resolutionNote && <p>{report.resolutionNote}</p>}</div>}
    {moderation && report.status === 'pending' && <div className="review-controls"><textarea aria-label="Review note" placeholder="Optional explanation shared with the person who reported this comment" maxLength={2000} value={note} onChange={event => setNote(event.target.value)} /><div><button disabled={busy} onClick={() => review('dismiss')}>Dismiss report</button><button className="discussion-primary" disabled={busy} onClick={() => review('remove')}>Remove comment</button></div></div>}
    {error && <p className="discussion-error" role="alert">{error}</p>}
  </article>;
}
