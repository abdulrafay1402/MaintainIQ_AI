import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const blankAssetForm = {
  name: '',
  code: '',
  category: '',
  location: '',
  condition: 'Good',
  status: 'Operational',
  serialNumber: '',
  notes: '',
};

const blankTriageForm = {
  assetCode: '',
  complaint: '',
};

const blankMaintenanceForm = {
  notes: '',
  cost: '0',
  startedAt: '',
  completedAt: '',
  nextServiceDate: '',
  partsText: '',
  evidenceText: '',
};

const statusOptions = ['Reported', 'Assigned', 'Inspection Started', 'Maintenance In Progress', 'Waiting for Parts', 'Resolved', 'Closed', 'Reopened'];

const parseParts = (partsText) => {
  if (!partsText.trim()) return [];
  return partsText.split(',').map((item) => {
    const [name = '', quantity = '1', cost = '0'] = item.split(':').map((value) => value.trim());
    return { name, quantity: Number(quantity) || 1, cost: Number(cost) || 0 };
  }).filter((item) => item.name);
};

const parseEvidence = (evidenceText) => {
  if (!evidenceText.trim()) return [];
  return evidenceText.split(',').map((item) => item.trim()).filter(Boolean);
};

export default function DashboardPage() {
  const auth = useAuth();
  const [assets, setAssets] = useState([]);
  const [issues, setIssues] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [assetHistory, setAssetHistory] = useState([]);
  const [assetQr, setAssetQr] = useState(null);
  const [assetSearch, setAssetSearch] = useState('');
  const [issueSearch, setIssueSearch] = useState('');
  const [assetStatusFilter, setAssetStatusFilter] = useState('');
  const [issueStatusFilter, setIssueStatusFilter] = useState('');
  const [assetForm, setAssetForm] = useState(blankAssetForm);
  const [triageForm, setTriageForm] = useState(blankTriageForm);
  const [triageResult, setTriageResult] = useState(null);
  const [maintenanceForm, setMaintenanceForm] = useState(blankMaintenanceForm);
  const [statusForm, setStatusForm] = useState({ status: 'Inspection Started', note: '' });
  const [assignTechnicianId, setAssignTechnicianId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const canManageAssignments = auth.user?.role === 'admin';

  const publicUrl = useMemo(() => {
    if (!selectedAsset?.code) return '';
    return `${window.location.origin}/public/assets/${selectedAsset.code}`;
  }, [selectedAsset]);

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      const matchesSearch = [asset.name, asset.code, asset.category, asset.location, asset.status]
        .some((value) => String(value || '').toLowerCase().includes(assetSearch.toLowerCase()));
      const matchesStatus = !assetStatusFilter || asset.status === assetStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [assets, assetSearch, assetStatusFilter]);

  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      const matchesSearch = [issue.issueNumber, issue.title, issue.description, issue.assetCode, issue.status]
        .some((value) => String(value || '').toLowerCase().includes(issueSearch.toLowerCase()));
      const matchesStatus = !issueStatusFilter || issue.status === issueStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [issues, issueSearch, issueStatusFilter]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [assetResponse, issueResponse, technicianResponse] = await Promise.all([
        api.get('/assets'),
        api.get('/issues'),
        canManageAssignments ? api.get('/users/technicians') : Promise.resolve({ data: { technicians: [] } }),
      ]);
      setAssets(assetResponse.data.assets || []);
      setIssues(issueResponse.data.issues || []);
      setTechnicians(technicianResponse.data.technicians || []);
      if (!selectedAsset && assetResponse.data.assets?.length) {
        await selectAsset(assetResponse.data.assets[0]);
      }
      if (!selectedIssue && issueResponse.data.issues?.length) {
        await selectIssue(issueResponse.data.issues[0]);
      }
      if (canManageAssignments && technicianResponse.data.technicians?.[0]) {
        setAssignTechnicianId((current) => current || technicianResponse.data.technicians[0]._id);
      }
    } catch (fetchError) {
      setError(fetchError?.response?.data?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const selectAsset = async (asset) => {
    if (!asset?._id) {
      return;
    }

    setSelectedAsset(asset);
    try {
      const [detailsResponse, historyResponse, qrResponse] = await Promise.all([
        api.get(`/assets/${asset._id}`),
        api.get(`/history/asset/${asset._id}`),
        api.get(`/assets/${asset._id}/qr`),
      ]);
      setSelectedAsset(detailsResponse.data.asset);
      setAssetHistory(historyResponse.data.history || []);
      setAssetQr(qrResponse.data);
      const latestIssue = detailsResponse.data.recentIssues?.[0];
      if (latestIssue) {
        await selectIssue(latestIssue);
      }
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to load asset details');
    }
  };

  const selectIssue = async (issue) => {
    if (!issue?._id) {
      return;
    }

    try {
      const response = await api.get(`/issues/${issue._id}`);
      setSelectedIssue(response.data.issue);
      if (response.data.issue.assignedTechnician?._id) {
        setAssignTechnicianId(response.data.issue.assignedTechnician._id);
      }
      setStatusForm({ status: response.data.issue.status || 'Inspection Started', note: response.data.issue.maintenanceNotes || '' });
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to load issue details');
    }
  };

  const submitAsset = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      const response = await api.post('/assets', assetForm);
      setMessage('Asset created successfully');
      setAssetForm(blankAssetForm);
      await loadDashboard();
      await selectAsset(response.data.asset);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to create asset');
    }
  };

  const submitTriage = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      const response = await api.post('/issues/triage', triageForm);
      setTriageResult(response.data.suggestion);
      setMessage('AI triage generated. Review and edit before saving.');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to generate triage');
    }
  };

  const submitAssign = async () => {
    if (!selectedIssue) return;
    try {
      await api.patch(`/issues/${selectedIssue._id}/assign`, { technicianId: assignTechnicianId });
      setMessage('Issue assigned successfully');
      await loadDashboard();
      await selectIssue({ _id: selectedIssue._id });
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to assign issue');
    }
  };

  const submitStatus = async () => {
    if (!selectedIssue) return;
    try {
      await api.patch(`/issues/${selectedIssue._id}/status`, statusForm);
      setMessage('Issue status updated');
      await loadDashboard();
      await selectIssue({ _id: selectedIssue._id });
      if (selectedAsset) {
        await selectAsset({ _id: selectedAsset._id });
      }
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to update issue status');
    }
  };

  const submitMaintenance = async () => {
    if (!selectedIssue) return;
    try {
      await api.post(`/issues/${selectedIssue._id}/maintenance`, {
        notes: maintenanceForm.notes,
        cost: Number(maintenanceForm.cost),
        startedAt: maintenanceForm.startedAt,
        completedAt: maintenanceForm.completedAt,
        nextServiceDate: maintenanceForm.nextServiceDate,
        partsUsed: parseParts(maintenanceForm.partsText),
        evidence: parseEvidence(maintenanceForm.evidenceText),
      });
      setMessage('Maintenance record saved');
      setMaintenanceForm(blankMaintenanceForm);
      await loadDashboard();
      await selectIssue({ _id: selectedIssue._id });
      if (selectedAsset) {
        await selectAsset({ _id: selectedAsset._id });
      }
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to save maintenance record');
    }
  };

  const copyPublicLink = async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setMessage('Public asset link copied');
  };

  const downloadQr = () => {
    if (!assetQr?.qrCodeDataUrl) return;
    const link = document.createElement('a');
    link.href = assetQr.qrCodeDataUrl;
    link.download = `${selectedAsset.code}-qr.png`;
    link.click();
  };

  return <div className="shell dashboard-shell">
    <header className="topbar">
      <div>
        <p className="eyebrow">MaintainIQ</p>
        <h1>Operations dashboard</h1>
        <p className="muted">Signed in as {auth.user?.name} ({auth.user?.role})</p>
      </div>
      <nav className="nav">
        <Link to="/dashboard">Dashboard</Link>
        {selectedAsset?.code && <Link to={`/public/assets/${selectedAsset.code}`}>Public page</Link>}
        <button className="link-button" onClick={auth.logout}>Logout</button>
      </nav>
    </header>

    {error && <section className="notice error-notice">{error}</section>}
    {message && <section className="notice success-notice">{message}</section>}
    {loading && <section className="notice">Loading dashboard...</section>}

    <section className="stats-grid">
      <div className="stat-card"><span>Assets</span><strong>{assets.length}</strong></div>
      <div className="stat-card"><span>Issues</span><strong>{issues.length}</strong></div>
      <div className="stat-card"><span>Technicians</span><strong>{technicians.length}</strong></div>
      <div className="stat-card"><span>Selected status</span><strong>{selectedAsset?.status || 'None'}</strong></div>
    </section>

    <main className="dashboard-grid">
      <section className="panel">
        <div className="panel-head">
          <h2>Register asset</h2>
        </div>
        <form className="stack-form" onSubmit={submitAsset}>
          <input value={assetForm.name} onChange={(event) => setAssetForm({ ...assetForm, name: event.target.value })} placeholder="Asset name" />
          <input value={assetForm.code} onChange={(event) => setAssetForm({ ...assetForm, code: event.target.value })} placeholder="Asset code (optional)" />
          <input value={assetForm.category} onChange={(event) => setAssetForm({ ...assetForm, category: event.target.value })} placeholder="Category" />
          <input value={assetForm.location} onChange={(event) => setAssetForm({ ...assetForm, location: event.target.value })} placeholder="Location" />
          <select value={assetForm.condition} onChange={(event) => setAssetForm({ ...assetForm, condition: event.target.value })}>
            <option>Good</option>
            <option>Fair</option>
            <option>Poor</option>
          </select>
          <select value={assetForm.status} onChange={(event) => setAssetForm({ ...assetForm, status: event.target.value })}>
            <option>Operational</option>
            <option>Issue Reported</option>
            <option>Under Inspection</option>
            <option>Under Maintenance</option>
            <option>Out of Service</option>
            <option>Retired</option>
          </select>
          <input value={assetForm.serialNumber} onChange={(event) => setAssetForm({ ...assetForm, serialNumber: event.target.value })} placeholder="Serial number" />
          <textarea value={assetForm.notes} onChange={(event) => setAssetForm({ ...assetForm, notes: event.target.value })} placeholder="Notes" rows={3} />
          <button type="submit">Create asset</button>
        </form>
      </section>

      <section className="panel panel-wide">
        <div className="panel-head">
          <h2>Assets</h2>
          <div className="filters">
            <input value={assetSearch} onChange={(event) => setAssetSearch(event.target.value)} placeholder="Search assets" />
            <select value={assetStatusFilter} onChange={(event) => setAssetStatusFilter(event.target.value)}>
              <option value="">All statuses</option>
              <option>Operational</option>
              <option>Issue Reported</option>
              <option>Under Inspection</option>
              <option>Under Maintenance</option>
              <option>Out of Service</option>
              <option>Retired</option>
            </select>
          </div>
        </div>
        <div className="table-list">
          {filteredAssets.map((asset) => (
            <button key={asset._id} className={`table-row ${selectedAsset?._id === asset._id ? 'active' : ''}`} onClick={() => selectAsset(asset)}>
              <strong>{asset.name}</strong>
              <span>{asset.code}</span>
              <span>{asset.category}</span>
              <span>{asset.location}</span>
              <span>{asset.status}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Asset details</h2>
        </div>
        {selectedAsset ? <div className="stack">
          <div>
            <strong>{selectedAsset.name}</strong>
            <p className="muted">{selectedAsset.code}</p>
            <p>{selectedAsset.category} · {selectedAsset.location}</p>
            <p>{selectedAsset.condition} · {selectedAsset.status}</p>
            <p>Last service: {selectedAsset.lastServiceDate ? new Date(selectedAsset.lastServiceDate).toLocaleDateString() : 'N/A'}</p>
            <p>Next service: {selectedAsset.nextServiceDate ? new Date(selectedAsset.nextServiceDate).toLocaleDateString() : 'N/A'}</p>
          </div>
          {assetQr?.qrCodeDataUrl && <img className="qr-preview" src={assetQr.qrCodeDataUrl} alt="Asset QR" />}
          <div className="actions-row">
            <button type="button" onClick={copyPublicLink}>Copy public link</button>
            <button type="button" onClick={downloadQr}>Download QR</button>
            <a className="button-link" href={publicUrl} target="_blank" rel="noreferrer">Open public page</a>
          </div>
          <div className="label-card">
            <p className="eyebrow">Print label preview</p>
            <h3>{selectedAsset.name}</h3>
            <p>{selectedAsset.code}</p>
            <p>{selectedAsset.location}</p>
            <p className="muted">Scan to open the public asset page.</p>
          </div>
        </div> : <p>No asset selected</p>}
      </section>

      <section className="panel panel-wide">
        <div className="panel-head">
          <h2>AI triage</h2>
        </div>
        <form className="stack-form" onSubmit={submitTriage}>
          <input value={triageForm.assetCode} onChange={(event) => setTriageForm({ ...triageForm, assetCode: event.target.value.toUpperCase() })} placeholder="Asset code" />
          <textarea value={triageForm.complaint} onChange={(event) => setTriageForm({ ...triageForm, complaint: event.target.value })} placeholder="Complaint" rows={3} />
          <button type="submit">Generate triage</button>
        </form>
        {triageResult && <div className="triage-card">
          <div className="two-column">
            <label>Title<input value={triageResult.title} onChange={(event) => setTriageResult({ ...triageResult, title: event.target.value })} /></label>
            <label>Category<input value={triageResult.category} onChange={(event) => setTriageResult({ ...triageResult, category: event.target.value })} /></label>
            <label>Priority<input value={triageResult.priority} onChange={(event) => setTriageResult({ ...triageResult, priority: event.target.value })} /></label>
            <label>Warning<input value={triageResult.warning || ''} onChange={(event) => setTriageResult({ ...triageResult, warning: event.target.value })} /></label>
          </div>
          <label>Possible causes<textarea value={(triageResult.possibleCauses || []).join(', ')} onChange={(event) => setTriageResult({ ...triageResult, possibleCauses: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) })} rows={2} /></label>
          <label>Initial checks<textarea value={(triageResult.initialChecks || []).join(', ')} onChange={(event) => setTriageResult({ ...triageResult, initialChecks: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) })} rows={2} /></label>
        </div>}
      </section>

      <section className="panel panel-wide">
        <div className="panel-head">
          <h2>Issues</h2>
          <div className="filters">
            <input value={issueSearch} onChange={(event) => setIssueSearch(event.target.value)} placeholder="Search issues" />
            <select value={issueStatusFilter} onChange={(event) => setIssueStatusFilter(event.target.value)}>
              <option value="">All statuses</option>
              {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
        </div>
        <div className="table-list">
          {filteredIssues.map((issue) => (
            <button key={issue._id} className={`table-row ${selectedIssue?._id === issue._id ? 'active' : ''}`} onClick={() => selectIssue(issue)}>
              <strong>{issue.issueNumber}</strong>
              <span>{issue.title}</span>
              <span>{issue.assetCode}</span>
              <span>{issue.priority}</span>
              <span>{issue.status}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Selected issue</h2>
        </div>
        {selectedIssue ? <div className="stack">
          <p><strong>{selectedIssue.issueNumber}</strong></p>
          <p>{selectedIssue.title}</p>
          <p>{selectedIssue.description}</p>
          <p>{selectedIssue.category} · {selectedIssue.priority}</p>
          <p>{selectedIssue.status}</p>
          <p>Reporter: {selectedIssue.reporterName}</p>
          <div className="stack-form">
            {canManageAssignments ? <>
              <select value={assignTechnicianId} onChange={(event) => setAssignTechnicianId(event.target.value)}>
                <option value="">Select technician</option>
                {technicians.map((technician) => <option key={technician._id} value={technician._id}>{technician.name}</option>)}
              </select>
              <button type="button" onClick={submitAssign}>Assign technician</button>
            </> : <p className="muted">Assignment controls are available to admins only.</p>}
            <select value={statusForm.status} onChange={(event) => setStatusForm({ ...statusForm, status: event.target.value })}>
              {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <textarea value={statusForm.note} onChange={(event) => setStatusForm({ ...statusForm, note: event.target.value })} placeholder="Status note" rows={3} />
            <button type="button" onClick={submitStatus}>Update status</button>
          </div>
        </div> : <p>No issue selected</p>}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Maintenance record</h2>
        </div>
        <div className="stack-form">
          <textarea value={maintenanceForm.notes} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, notes: event.target.value })} placeholder="Maintenance notes" rows={4} />
          <input value={maintenanceForm.cost} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, cost: event.target.value })} placeholder="Cost" />
          <input type="datetime-local" value={maintenanceForm.startedAt} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, startedAt: event.target.value })} />
          <input type="datetime-local" value={maintenanceForm.completedAt} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, completedAt: event.target.value })} />
          <input type="date" value={maintenanceForm.nextServiceDate} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, nextServiceDate: event.target.value })} />
          <input value={maintenanceForm.partsText} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, partsText: event.target.value })} placeholder="Parts as name:qty:cost, ..." />
          <input value={maintenanceForm.evidenceText} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, evidenceText: event.target.value })} placeholder="Evidence URLs, comma separated" />
          <button type="button" onClick={submitMaintenance}>Save maintenance</button>
        </div>
      </section>

      <section className="panel panel-wide">
        <div className="panel-head">
          <h2>Asset history</h2>
        </div>
        <div className="timeline">
          {assetHistory.map((entry) => (
            <div key={entry._id} className="timeline-item">
              <strong>{entry.action}</strong>
              <p className="muted">{new Date(entry.createdAt).toLocaleString()} · {entry.actorName}</p>
              <p>{entry.details}</p>
              {entry.issue?.issueNumber && <p>Issue: {entry.issue.issueNumber}</p>}
            </div>
          ))}
        </div>
      </section>
    </main>
  </div>;
}
