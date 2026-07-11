import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';

const blankReport = {
  title: '',
  description: '',
  category: '',
  priority: 'Medium',
  reporterName: '',
  reporterEmail: '',
};

const blankSuggestion = {
  title: '',
  category: '',
  priority: 'Medium',
  possibleCauses: [],
  initialChecks: [],
  warning: '',
};

export default function PublicAssetPage() {
  const { code } = useParams();
  const [asset, setAsset] = useState(null);
  const [issues, setIssues] = useState([]);
  const [report, setReport] = useState(blankReport);
  const [suggestion, setSuggestion] = useState(blankSuggestion);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadAsset = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/assets/public/${code}`);
      setAsset(response.data.asset);
      setIssues(response.data.recentIssues || []);
      setReport((current) => ({
        ...current,
        category: response.data.asset?.category || current.category,
        title: current.title || '',
      }));
    } catch (requestError) {
      setAsset(undefined);
      setError(requestError?.response?.data?.message || 'Asset not found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAsset();
  }, [code]);

  const generateSuggestion = async () => {
    setError('');
    setMessage('');
    try {
      const response = await api.post('/issues/triage', {
        assetCode: code,
        complaint: report.description,
      });
      setSuggestion(response.data.suggestion);
      setReport((current) => ({
        ...current,
        title: response.data.suggestion.title,
        category: response.data.suggestion.category,
        priority: response.data.suggestion.priority,
      }));
      setMessage('AI suggestion generated. Review before submitting.');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to generate suggestion');
    }
  };

  const submitReport = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      const response = await api.post(`/issues/public/${code}/report`, {
        ...report,
        aiSuggestion: {
          ...suggestion,
          reviewedByUser: true,
        },
      });
      setMessage(`Issue reported successfully: ${response.data.issue.issueNumber}`);
      setReport(blankReport);
      setSuggestion(blankSuggestion);
      await loadAsset();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to submit issue report');
    }
  };

  if (loading) {
    return <div className="shell"><section className="panel"><h2>Loading public asset...</h2></section></div>;
  }

  if (asset === undefined) {
    return <div className="shell"><section className="panel"><h2>Asset not found</h2><p>{error}</p></section></div>;
  }

  return <div className="shell public-shell">
    {error && <section className="notice error-notice">{error}</section>}
    {message && <section className="notice success-notice">{message}</section>}

    <section className="panel hero-banner">
      <p className="eyebrow">Public asset page</p>
      <h1>{asset.name}</h1>
      <p>{asset.code} · {asset.category} · {asset.location}</p>
      <div className="chips">
        <span>{asset.status}</span>
        <span>{asset.condition}</span>
      </div>
      <p className="muted">Safe public information only. Internal notes, cost, and admin controls are hidden.</p>
    </section>

    <div className="public-grid">
      <section className="panel">
        <h2>Report issue</h2>
        <form className="stack-form" onSubmit={submitReport}>
          <textarea value={report.description} onChange={(event) => setReport({ ...report, description: event.target.value })} placeholder="Describe the issue" rows={4} />
          <input value={report.title} onChange={(event) => setReport({ ...report, title: event.target.value })} placeholder="Title" />
          <input value={report.category} onChange={(event) => setReport({ ...report, category: event.target.value })} placeholder="Category" />
          <select value={report.priority} onChange={(event) => setReport({ ...report, priority: event.target.value })}>
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
            <option>Critical</option>
          </select>
          <input value={report.reporterName} onChange={(event) => setReport({ ...report, reporterName: event.target.value })} placeholder="Your name" />
          <input value={report.reporterEmail} onChange={(event) => setReport({ ...report, reporterEmail: event.target.value })} placeholder="Email (optional)" />
          <button type="button" onClick={generateSuggestion}>Generate AI suggestion</button>
          <button type="submit">Submit issue</button>
        </form>
      </section>

      <section className="panel">
        <h2>AI suggestion</h2>
        <div className="triage-card">
          <label>Title<input value={suggestion.title} onChange={(event) => setSuggestion({ ...suggestion, title: event.target.value })} /></label>
          <label>Category<input value={suggestion.category} onChange={(event) => setSuggestion({ ...suggestion, category: event.target.value })} /></label>
          <label>Priority<input value={suggestion.priority} onChange={(event) => setSuggestion({ ...suggestion, priority: event.target.value })} /></label>
          <label>Possible causes<textarea value={(suggestion.possibleCauses || []).join(', ')} onChange={(event) => setSuggestion({ ...suggestion, possibleCauses: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) })} rows={2} /></label>
          <label>Initial checks<textarea value={(suggestion.initialChecks || []).join(', ')} onChange={(event) => setSuggestion({ ...suggestion, initialChecks: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) })} rows={2} /></label>
          <label>Warning<textarea value={suggestion.warning} onChange={(event) => setSuggestion({ ...suggestion, warning: event.target.value })} rows={2} /></label>
        </div>
      </section>
    </div>

    <section className="panel">
      <h2>Recent issues</h2>
      <div className="timeline">
        {issues.map((issue) => (
          <div key={issue.issueNumber} className="timeline-item">
            <strong>{issue.issueNumber}</strong>
            <p>{issue.title}</p>
            <p className="muted">{issue.category} · {issue.priority} · {issue.status}</p>
          </div>
        ))}
      </div>
    </section>
  </div>;
}
