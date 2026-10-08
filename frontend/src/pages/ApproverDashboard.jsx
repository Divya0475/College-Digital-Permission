import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import StatusBadge from '../components/StatusBadge';
import api from '../lib/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  Clock,
  ClipboardList,
  CheckCircle2,
  XCircle,
  Check,
  X,
  Eye,
  AlertCircle,
  Building,
  User,
  Calendar,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  Receipt,
  Briefcase,
  BookOpen,
  GraduationCap,
  FileDown,
  FileText,
  FileSpreadsheet,
  Paperclip,
  ExternalLink
} from 'lucide-react';
import { FaClipboardList, FaClock, FaCircleCheck, FaCircleXmark } from 'react-icons/fa6';

const ROLE_LABELS = {
  CTPO: { name: 'CTPO Approval Console', pendingStatus: 'PENDING_CTPO', color: '#10b981', desc: 'Department-level review for out-pass, mess, internship & library requests' },
  HOD: { name: 'HOD Approval Console', pendingStatus: 'PENDING_HOD', color: '#10b981', desc: 'Head of Department authorization for permissions & clearances' },
  HOSTEL_INCHARGE: { name: 'Hostel Incharge Dashboard', pendingStatus: 'PENDING_HOSTEL', color: '#10b981', desc: 'Final gate permission clearance for hostel students' },
  PLACEMENT_OFFICER: { name: 'Placement Officer Console', pendingStatus: 'PENDING_PLACEMENT_OFFICER', color: '#10b981', desc: 'Final institutional authorization for student internships' },
};

const isHostellerRequest = (request) => {
  const studentType = String(
    request?.studentId?.studentType ||
    request?.studentId?.studentCategory ||
    request?.studentId?.type ||
    request?.studentType ||
    request?.studentCategory ||
    ''
  ).toUpperCase();
  if (studentType.includes('DAY')) return false;
  if (studentType.includes('HOSTEL')) return true;
  const isHosteller = request?.studentId?.isHosteller ?? request?.isHosteller;
  if (typeof isHosteller === 'boolean') return isHosteller;
  if (typeof isHosteller === 'string') return isHosteller.toLowerCase() === 'true';
  return Boolean(
    request?.studentId?.hostelName ||
    request?.studentId?.hostelRoom ||
    request?.studentId?.roomNumber ||
    request?.hostelName ||
    request?.hostelRoom
  );
};

export default function ApproverDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const role = user?.role;
  const cfg = ROLE_LABELS[role] || ROLE_LABELS.CTPO;
  const isHostelIncharge = role === 'HOSTEL_INCHARGE';

  const [pending, setPending] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(() => searchParams.get('view') || 'overview');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [history, setHistory] = useState([]);
  const [kpiFilter, setKpiFilter] = useState('TOTAL');
  const [showHostelExportModal, setShowHostelExportModal] = useState(false);
  const [hostelExportLoading, setHostelExportLoading] = useState('');

  const [rejectModal, setRejectModal] = useState(null); // { id, remarks, requestType }
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  const fetchAll = async () => {
    try {
      const [pendingRes, statsRes] = await Promise.all([
        api.get('/outpass/pending/for-me'),
        api.get('/outpass/dashboard-stats')
      ]);

      const pendingData = pendingRes.data.data || [];
      setPending(
        isHostelIncharge
          ? pendingData.filter((request) => isPendingHostelStatus(request?.status) && isHostellerRequest(request) && String(request?.requestType || '').toUpperCase() !== 'LIBRARY')
          : pendingData
      );
      setStats(statsRes.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await api.get('/outpass/all/for-me');
      const historyData = res.data.data || [];
      setHistory(
        isHostelIncharge
          ? historyData.filter((request) => isHostelRelevantRequest(request))
          : historyData
      );
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchAll();
    if (role === 'HOSTEL_INCHARGE') {
      fetchHistory();
    }
    const interval = setInterval(fetchAll, 6000);
    return () => clearInterval(interval);
  }, [role]);

  useEffect(() => {
    const requestedView = searchParams.get('view');

    if (isHostelIncharge) {
      if (requestedView === 'pending') {
        setTab('pending');
        setKpiFilter('PENDING');
      } else if (requestedView === 'history') {
        setTab('history');
        setKpiFilter('TOTAL');
      } else if (requestedView === 'overview') {
        setTab('overview');
        // Preserve the selected KPI filter while staying on Overview.
      } else {
        setTab('overview');
        setKpiFilter('TOTAL');
      }
    }
  }, [searchParams, isHostelIncharge]);

  useEffect(() => {
    if (tab === 'history') fetchHistory();
  }, [tab]);

  const handleApprove = async (id) => {
    setActionLoading(true);
    setActionMsg('');
    try {
      await api.post(`/outpass/${id}/approve`, { remarks: 'Approved' });
      setActionMsg('Request approved successfully!');
      fetchAll();
    } catch (e) {
      setActionMsg(e.response?.data?.message || 'Error approving request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectModal?.remarks?.trim()) return;
    setActionLoading(true);
    setActionMsg('');
    try {
      await api.post(`/outpass/${rejectModal.id}/reject`, { remarks: rejectModal.remarks });
      setRejectModal(null);
      setActionMsg('Request rejected with reason.');
      fetchAll();
    } catch (e) {
      setActionMsg(e.response?.data?.message || 'Error rejecting request');
    } finally {
      setActionLoading(false);
    }
  };

  // Build continuous 7-day Recharts data from approvedPerDay
  const chartData = [];
  const byDate = {};
  if (stats?.approvedPerDay) {
    stats.approvedPerDay.forEach(({ _id, count }) => {
      if (!byDate[_id.date]) byDate[_id.date] = { Approved: 0, Rejected: 0 };
      byDate[_id.date][_id.decision === 'APPROVED' ? 'Approved' : 'Rejected'] = count;
    });
  }

  // Generate continuous 7 days ending today
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().split('T')[0];
    const displayLabel = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    chartData.push({
      date: displayLabel,
      Approved: byDate[dateKey]?.Approved || 0,
      Rejected: byDate[dateKey]?.Rejected || 0
    });
  }

  const hasActivity = chartData.some(d => d.Approved > 0 || d.Rejected > 0);

  const getBadgeTypeIcon = (type) => {
    switch (type) {
      case 'MESS_FEE': return <Receipt size={12} />;
      case 'INTERNSHIP': return <Briefcase size={12} />;
      case 'LIBRARY': return <BookOpen size={12} />;
      default: return <GraduationCap size={12} />;
    }
  };

  const getBadgeTypeLabel = (type) => {
    switch (type) {
      case 'MESS_FEE': return 'Mess Fee';
      case 'INTERNSHIP': return 'Internship';
      case 'LIBRARY': return 'Library';
      default: return 'Out-Pass';
    }
  };

  const getBadgeTypeColor = (type) => {
    switch (type) {
      case 'MESS_FEE': return { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' };
      case 'INTERNSHIP': return { bg: '#ecfdf5', text: '#10b981', border: '#bfdbfe' };
      case 'LIBRARY': return { bg: '#fef3c7', text: '#d97706', border: '#fde68a' };
      default: return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
    }
  };

  const filteredPending = pending.filter(r => {
    if (typeFilter === 'ALL') return true;
    return (r.requestType || 'OUTPASS') === typeFilter;
  });

  const isPendingHostelStatus = (status) => {
    const normalized = String(status || '').toUpperCase();
    return normalized === 'PENDING_HOSTEL' || normalized === 'PENDING_HOSTEL_INCHARGE';
  };

  const isRejectedHostelStatus = (status) => {
    const normalized = String(status || '').toUpperCase();
    return (
      normalized === 'REJECTED_HOSTEL' ||
      normalized === 'REJECTED_HOSTEL_INCHARGE' ||
      normalized === 'REJECTED_HOSTEL_INCHARGE_APPROVAL'
    );
  };

  const isGatePassUsed = (status) =>
    String(status || '').toUpperCase() === 'GATE_PASS_USED';

  const isGatePassIssued = (status) =>
    String(status || '').toUpperCase() === 'GATE_PASS_ISSUED';

  const isApprovedHostelStatus = (status) => {
    const normalized = String(status || '').toUpperCase();
    return normalized === 'APPROVED' || isGatePassIssued(normalized) || isGatePassUsed(normalized);
  };

  const isHostelRelevantRequest = (request) => {
    if (!isHostellerRequest(request)) return false;
    if (String(request?.requestType || '').toUpperCase() === 'LIBRARY') return false;
    const status = String(request?.status || '').toUpperCase();
    return (
      isPendingHostelStatus(status) ||
      isRejectedHostelStatus(status) ||
      isApprovedHostelStatus(status)
    );
  };

  const normalizeHostelRequestType = (request) => {
    const type = String(request?.requestType || request?.type || 'OUTPASS')
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, '_');

    if (type === 'MESS') return 'MESS_FEE';
    if (type === 'OUT_PASS') return 'OUTPASS';
    return type;
  };

  const hostelReviewHistory = history.filter((request) =>
    isHostelRelevantRequest(request) && !isPendingHostelStatus(request.status)
  );

  const filteredHistory = (isHostelIncharge ? hostelReviewHistory : history).filter(r => {
    if (typeFilter === 'ALL') return true;
    return isHostelIncharge
      ? normalizeHostelRequestType(r) === typeFilter
      : (r.requestType || 'OUTPASS') === typeFilter;
  });

  const hostelHistoryStats = (() => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const countSince = (start) => hostelReviewHistory.filter((request) => {
      const date = new Date(request.createdAt || request.updatedAt || 0);
      return !Number.isNaN(date.getTime()) && date >= start;
    }).length;
    return { week: countSince(weekStart), month: countSince(monthStart) };
  })();

  const getHostelHistoryExportRows = () =>
    filteredHistory.map((request) => [
      request.referenceId || request._id,
      request.studentId?.name || '',
      request.studentId?.rollNo || '',
      getBadgeTypeLabel(normalizeHostelRequestType(request)),
      request.reason || '',
      request.createdAt ? new Date(request.createdAt).toLocaleDateString('en-IN') : '',
      isRejectedHostelStatus(request.status) ? 'Rejected' : 'Approved',
    ]);

  const exportHostelHistoryCSV = () => {
    setHostelExportLoading('csv');
    try {
      const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
      const rows = getHostelHistoryExportRows();
      const csv = [
        ['Reference ID', 'Student', 'Roll Number', 'Type', 'Reason', 'Submitted On', 'Status'].map(quote).join(','),
        ...rows.map((row) => row.map(quote).join(',')),
      ].join('\r\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `hostel-${typeFilter.toLowerCase()}-review-history-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setShowHostelExportModal(false);
    } catch (error) {
      console.error('Hostel CSV export failed:', error);
      setActionMsg('Unable to generate the CSV report.');
    } finally {
      setHostelExportLoading('');
    }
  };

  const exportHostelHistoryPDF = () => {
    setHostelExportLoading('pdf');
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      doc.setFontSize(18);
      doc.text('Hostel In-charge Review History', 14, 17);
      doc.setFontSize(10);
      doc.text(`Permission type: ${typeFilter === 'ALL' ? 'All Types' : getBadgeTypeLabel(typeFilter)}`, 14, 25);
      doc.text(`Reviewed requests: ${filteredHistory.length}`, 14, 31);
      doc.text(`This week: ${hostelHistoryStats.week}  |  This month: ${hostelHistoryStats.month}`, 14, 37);

      autoTable(doc, {
        startY: 44,
        head: [['Reference ID', 'Student', 'Roll Number', 'Type', 'Reason', 'Submitted On', 'Status']],
        body: getHostelHistoryExportRows(),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [16, 185, 129] },
      });

      doc.save(`hostel-${typeFilter.toLowerCase()}-review-history-${new Date().toISOString().slice(0, 10)}.pdf`);
      setShowHostelExportModal(false);
    } catch (error) {
      console.error('Hostel PDF export failed:', error);
      setActionMsg('Unable to generate the PDF report.');
    } finally {
      setHostelExportLoading('');
    }
  };

  // Hostel In-charge specific derivations.
  const hostelAllRequests = Array.from(
    new Map(
      [...pending, ...history]
        .filter((request) => request?._id && isHostelRelevantRequest(request))
        .map((request) => [String(request._id), request])
    ).values()
  );

  const getHostelDisplayStatus = (request) => {
    const status = String(request?.status || '').toUpperCase();

    // Hostel pending requests should be displayed simply as "Pending".
    // The workflow-specific status is still kept in the backend.
    if (isPendingHostelStatus(status)) {
      return 'PENDING';
    }

    // Hostel rejection should be displayed simply as "Rejected".
    // The workflow-specific status is still kept in the backend.
    if (isRejectedHostelStatus(status)) {
      return 'REJECTED';
    }

    // Out-Pass approval results in a gate pass. It is not shown as
    // generic "Approved" on the Hostel In-charge dashboard.
    if (request?.requestType === 'OUTPASS' || !request?.requestType) {
      if (isGatePassUsed(status)) return 'GATE_PASS_USED';
      if (isGatePassIssued(status) || status === 'APPROVED') {
        return 'GATE_PASS_ISSUED';
      }
    }

    return request?.status || '';
  };

  const hostelPendingRequests = hostelAllRequests.filter(r =>
    isPendingHostelStatus(r.status)
  );

  const hostelReviewedRequests = hostelAllRequests.filter(r =>
    !isPendingHostelStatus(r.status)
  );

  // Hostel Overview contains only requests that have already been reviewed
  // by the Hostel In-charge. Pending requests are shown exclusively in the
  // Pending Requests view.
  const hostelPending = hostelPendingRequests.length;
  const hostelApproved = hostelReviewedRequests.filter(r =>
    isApprovedHostelStatus(r.status)
  ).length;
  const hostelRejected = hostelReviewedRequests.filter(r =>
    isRejectedHostelStatus(r.status)
  ).length;

  // Total Requests on the Hostel dashboard means reviewed requests
  // (Approved + Rejected). Pending requests have their own KPI and view.
  const hostelTotal = hostelAllRequests.length;

  let hostelBaseData = hostelAllRequests;

  if (isHostelIncharge) {
    if (kpiFilter === 'APPROVED') {
      hostelBaseData = hostelReviewedRequests.filter(r =>
        isApprovedHostelStatus(r.status)
      );
    } else if (kpiFilter === 'REJECTED') {
      hostelBaseData = hostelReviewedRequests.filter(r =>
        isRejectedHostelStatus(r.status)
      );
    } else if (kpiFilter === 'PENDING') {
      // Pending KPI navigates to the dedicated Pending Requests view.
      hostelBaseData = hostelPendingRequests;
    } else {
      // Total: all relevant requests.
      hostelBaseData = hostelAllRequests;
    }
  }

  const filteredHostelData = hostelBaseData.filter(r => {
    if (typeFilter === 'ALL') return true;
    return normalizeHostelRequestType(r) === typeFilter;
  });

  const changeHostelView = (view) => {
    setTab(view);
    setSearchParams(view === 'overview' ? {} : { view });
  };

  const handleHostelKpi = (filter) => {
    setKpiFilter(filter);

    if (filter === 'PENDING') {
      changeHostelView('pending');
      return;
    }

    changeHostelView('overview');
  };

  return (
    <DashboardLayout>
      {isHostelIncharge ? (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ color: '#475569', fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                Welcome back,
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '-0.5px' }}>
                Hostel <span style={{ color: '#10b981' }}>In-charge</span>
              </h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', padding: '10px 16px', borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                <Calendar size={18} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{new Date().toLocaleDateString('en-US', { weekday: 'long' })}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                  {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="page-header" style={{ marginBottom: '24px' }}>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Building size={26} color={cfg.color} />
            <span>{cfg.name}</span>
          </h1>
          <p className="page-subtitle">
            {cfg.desc} Â· Logged in as <strong>{user?.name}</strong>
          </p>
        </div>
      )}

      {actionMsg && (
        <div
          className={`alert ${actionMsg.includes('approved') ? 'alert-success' : 'alert-error'}`}
          style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          {actionMsg.includes('approved') ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{actionMsg}</span>
        </div>
      )}

      {/* Stats Cards */}
      {isHostelIncharge ? (
        <div className="stats-grid placement-kpi-grid" style={{ marginBottom: '24px', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
          {[
            { key: 'TOTAL', label: 'TOTAL REQUESTS', value: hostelTotal, iconBg: '#f1f5f9', iconColor: '#3b82f6', valueColor: '#1e293b', icon: FaClipboardList },
            { key: 'APPROVED', label: 'APPROVED', value: hostelApproved, iconBg: '#ecfdf5', iconColor: '#10b981', valueColor: '#059669', icon: FaCircleCheck },
            { key: 'PENDING', label: 'PENDING', value: hostelPending, iconBg: '#fff7ed', iconColor: '#f59e0b', valueColor: '#d97706', icon: FaClock },
            { key: 'REJECTED', label: 'REJECTED', value: hostelRejected, iconBg: '#fef2f2', iconColor: '#ef4444', valueColor: '#dc2626', icon: FaCircleXmark },
          ].map((card) => {
            const Icon = card.icon;
            const isActive = kpiFilter === card.key;
            return (
              <div
                key={card.key}
                className="card stat-card-hover"
                onClick={() => handleHostelKpi(card.key)}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  padding: '20px 24px',
                  minHeight: 100,
                  boxShadow: isActive ? '0 4px 12px rgba(16, 185, 129, 0.1)' : '0 1px 2px rgba(15,23,42,0.04)',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 18px rgba(15,23,42,0.08)';
                  e.currentTarget.style.borderColor = '#bfdbfe';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = isActive ? '0 4px 12px rgba(16, 185, 129, 0.1)' : '0 1px 2px rgba(15,23,42,0.04)';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                }}
              >
                <div style={{ width: 48, height: 48, borderRadius: 12, background: card.iconBg, color: card.iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={20} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#64748b' }}>{card.label}</div>
                  <div style={{ fontSize: 28, lineHeight: 1, fontWeight: 800, color: card.valueColor }}>{card.value}</div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="stats-grid" style={{ marginBottom: '24px' }}>
          <div className="stat-card">
            <div className="stat-icon" style={{ color: 'var(--yellow)' }}>
              <Clock size={22} />
            </div>
            <div className="stat-label">Pending Queue</div>
            <div className="stat-value" style={{ color: 'var(--yellow)' }}>{stats?.pendingCount ?? pending.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ color: 'var(--accent)' }}>
              <ClipboardList size={22} />
            </div>
            <div className="stat-label">Total Requests</div>
            <div className="stat-value">{stats?.totalRequests ?? 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ color: 'var(--green)' }}>
              <CheckCircle2 size={22} />
            </div>
            <div className="stat-label">7-Day Decisions</div>
            <div className="stat-value" style={{ color: 'var(--green)' }}>
              {chartData.reduce((acc, curr) => acc + curr.Approved + curr.Rejected, 0)}
            </div>
          </div>
        </div>
      )}

      {/* 7-day Activity Chart */}
      {!isHostelIncharge && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="card-title">Approval Activity (Last 7 Days)</div>
              <div className="card-subtitle">Approved vs Rejected decisions recorded</div>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Daily Volume</span>
          </div>
          {hasActivity ? (
            <div style={{ height: 220, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      color: '#0f172a'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                  <Bar dataKey="Approved" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="Rejected" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{
              height: 120,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: '8px',
              color: 'var(--text-muted)',
              fontSize: '13px'
            }}>
              <Sparkles size={20} color="var(--text-muted)" />
              <span>No approvals or rejections recorded in the last 7 days yet.</span>
            </div>
          )}
        </div>
      )}

      {/* Main Tabs (Pending vs History) & Feature Filter Pills */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        {!isHostelIncharge && <div className="tabs" style={{ marginBottom: 0 }}>
            <button
              className={`tab ${isHostelIncharge ? (tab === 'overview' ? 'active' : '') : (tab === 'pending' ? 'active' : '')}`}
              onClick={() => {
                if (isHostelIncharge) {
                  setKpiFilter('TOTAL');
                  changeHostelView('overview');
                } else {
                  setTab('pending');
                }
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Clock size={14} />
              <span>{isHostelIncharge ? 'Overview' : `Pending Queue (${pending.length})`}</span>
            </button>
            {isHostelIncharge && (
              <button
                className={`tab ${tab === 'pending' ? 'active' : ''}`}
                onClick={() => {
                  setKpiFilter('PENDING');
                  changeHostelView('pending');
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Clock size={14} />
                <span>Pending Requests ({hostelPending})</span>
              </button>
            )}

            <button
              className={`tab ${tab === 'history' ? 'active' : ''}`}
              onClick={() => {
                if (isHostelIncharge) {
                  setKpiFilter('TOTAL');
                  changeHostelView('history');
                } else {
                  setTab('history');
                }
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <ClipboardList size={14} />
              <span>Review History</span>
            </button>
        </div>}

        {/* Feature Filter Pills */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {(isHostelIncharge
            ? ['ALL', 'OUTPASS', 'INTERNSHIP']
            : ['ALL', 'OUTPASS', 'MESS_FEE', 'INTERNSHIP', 'LIBRARY']
          ).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setTypeFilter(f)}
              style={{
                fontSize: '11px',
                padding: '4px 10px',
                borderRadius: '14px',
                border: typeFilter === f ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: typeFilter === f ? 'var(--accent)' : '#ffffff',
                color: typeFilter === f ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: typeFilter === f ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {f === 'ALL' && 'All Types'}
              {f === 'OUTPASS' && 'Out-Pass'}
              {f === 'MESS_FEE' && 'Mess Fee'}
              {f === 'INTERNSHIP' && 'Internship'}
              {f === 'LIBRARY' && 'Library'}
            </button>
          ))}
        </div>
      </div>

      {/* Hostel Overview / Pending Queue / Approver Pending Queue */}
      {((isHostelIncharge && (tab === 'overview' || tab === 'pending')) || (!isHostelIncharge && tab === 'pending')) && (
        <div className="card">
          {loading ? (
            <div className="loading-screen"><div className="spinner spinner-lg" /></div>
          ) : (isHostelIncharge ? filteredHostelData.length === 0 : filteredPending.length === 0) ? (
            <div className="empty-state">
              <div className="empty-state-icon" style={{ color: 'var(--green)' }}>
                <CheckCircle2 size={48} />
              </div>
              <div className="empty-state-title">All caught up!</div>
              <div className="empty-state-desc">
                {isHostelIncharge && tab === 'overview'
                  ? 'No permission requests found.'
                  : typeFilter === 'ALL'
                    ? 'No permission requests currently waiting in your queue.'
                    : `No ${typeFilter.replace('_', ' ')} requests pending in your queue.`}
              </div>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Student</th>
                    <th>{isHostelIncharge ? 'Reason / Details' : 'Request Details'}</th>
                    <th>{isHostelIncharge ? 'Date / Period' : 'Period / Schedule'}</th>
                    {!isHostelIncharge && <th>Attachment</th>}
                    {isHostelIncharge ? <th>Status</th> : <th>Actions</th>}
                    {isHostelIncharge && tab === 'pending' && <th>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {(isHostelIncharge ? filteredHostelData : filteredPending).map(req => {
                    const reqType = req.requestType || 'OUTPASS';
                    const tag = getBadgeTypeColor(reqType);
                    return (
                      <tr key={req._id}>
                        <td>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: tag.bg,
                            color: tag.text,
                            border: `1px solid ${tag.border}`
                          }}>
                            {getBadgeTypeIcon(reqType)}
                            <span>{getBadgeTypeLabel(reqType)}</span>
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{req.studentId?.name}</div>
                          <div className="td-muted" style={{ fontSize: 12 }}>
                            <code>{req.studentId?.rollNo}</code> | {req.branchId?.name || 'CSM'}
                          </div>
                        </td>
                        <td style={{ maxWidth: 220 }}>
                          <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: '2px' }}>
                            {req.reason}
                          </div>
                          {reqType === 'MESS_FEE' && (
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              Amount: <strong>INR {req.messAmount?.toLocaleString('en-IN')}</strong> |{' '}
                              <span style={{ color: req.paidStatus === 'Paid' ? 'var(--green)' : 'var(--yellow)', fontWeight: 600 }}>
                                {req.paidStatus}
                              </span>
                            </div>
                          )}
                          {reqType === 'INTERNSHIP' && (
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              <strong>{req.companyName}</strong> ({req.role}) | {req.internshipMode}
                            </div>
                          )}
                        </td>
                        <td className="td-muted">
                          {reqType === 'OUTPASS' && (
                            <>
                              <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                                {new Date(req.outDate).toLocaleDateString('en-IN')}
                              </div>
                              <div style={{ fontSize: 11 }}>{req.outTime} to {req.expectedReturnTime}</div>
                            </>
                          )}
                          {(reqType === 'MESS_FEE' || reqType === 'INTERNSHIP') && (
                            <>
                              <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                                {new Date(req.startDate).toLocaleDateString('en-IN')} to
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                                {new Date(req.endDate).toLocaleDateString('en-IN')}
                              </div>
                            </>
                          )}
                          {reqType === 'LIBRARY' && (
                            <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                              {new Date(req.requestDate || req.createdAt).toLocaleDateString('en-IN')}
                            </div>
                          )}
                        </td>
                        {!isHostelIncharge && (
                          <td>
                            {req.documentUrl ? (
                              <a
                                href={req.documentUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '11px',
                                  color: 'var(--accent)',
                                  textDecoration: 'none',
                                  background: 'var(--accent-dim)',
                                  padding: '3px 8px',
                                  borderRadius: '6px'
                                }}
                              >
                                <Paperclip size={12} />
                                <span>View Doc</span>
                              </a>
                            ) : (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>None</span>
                            )}
                          </td>
                        )}
                        {isHostelIncharge ? (
                          <>
                            <td>
                              <StatusBadge status={getHostelDisplayStatus(req) || cfg.pendingStatus} showIcon={!isHostelIncharge} />
                            </td>
                            {tab === 'pending' && (
                              <td>
                                <button
                                  className="btn btn-sm"
                                  onClick={() => navigate(`/outpass/${req._id}?mode=approval`)}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '5px 14px',
                                    background: 'rgba(209, 250, 229, 0.92)',
                                    color: '#10b981',
                                    border: '1px solid #a7f3d0',
                                    borderRadius: '50px',
                                    fontSize: '12.5px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                    fontFamily: 'inherit'
                                  }}
                                >
                                  <Eye size={14} />
                                  <span>View</span>
                                </button>
                              </td>
                            )}
                          </>
                        ) : (
                          <td>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <button
                                className="btn btn-success btn-sm"
                                disabled={actionLoading}
                                onClick={() => handleApprove(req._id)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 10px' }}
                              >
                                <Check size={14} />
                                <span>Approve</span>
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                disabled={actionLoading}
                                onClick={() => setRejectModal({ id: req._id, remarks: '', requestType: reqType })}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 10px' }}
                              >
                                <X size={14} />
                                <span>Reject</span>
                              </button>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => navigate(`/outpass/${req._id}?mode=approval`)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 10px' }}
                              >
                                <Eye size={14} />
                                <span>View</span>
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div className="card">
          {isHostelIncharge && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', color: 'var(--text-secondary)', fontSize: 13 }}>
                <span>This week: <strong>{hostelHistoryStats.week}</strong></span>
                <span>This month: <strong>{hostelHistoryStats.month}</strong></span>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowHostelExportModal(true)}
                disabled={filteredHistory.length === 0}
                style={{
                  height: 36,
                  padding: '0 14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  fontSize: 13,
                  whiteSpace: 'nowrap',
                  borderRadius: 6,
                }}
              >
                <FileDown size={16} />
                Export report
              </button>
            </div>
          )}
          {filteredHistory.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon" style={{ color: 'var(--text-muted)' }}>
                <ClipboardList size={40} />
              </div>
              <div className="empty-state-title">No historical requests found</div>
              <div className="empty-state-desc">Reviewed requests will appear here once processed.</div>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Student</th>
                    <th>Reason / Details</th>
                    <th>Date / Period</th>
                    <th>Status</th>
                    {isHostelIncharge && <th>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map(req => {
                    const reqType = req.requestType || 'OUTPASS';
                    const tag = getBadgeTypeColor(reqType);
                    return (
                      <tr key={req._id} style={{ cursor: isHostelIncharge ? 'default' : 'pointer' }} onClick={() => !isHostelIncharge && navigate(`/outpass/${req._id}`)}>
                        <td>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: tag.bg,
                            color: tag.text,
                            border: `1px solid ${tag.border}`
                          }}>
                            {getBadgeTypeIcon(reqType)}
                            <span>{getBadgeTypeLabel(reqType)}</span>
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{req.studentId?.name}</div>
                          <div className="td-muted" style={{ fontSize: 12 }}><code>{req.studentId?.rollNo}</code></div>
                        </td>
                        <td style={{ maxWidth: 220 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200, color: 'var(--text-primary)' }}>
                            {req.reason}
                          </div>
                        </td>
                        <td className="td-muted">
                          {reqType === 'OUTPASS' && (new Date(req.outDate).toLocaleDateString('en-IN'))}
                          {reqType === 'MESS_FEE' && (`${new Date(req.startDate).toLocaleDateString('en-IN')} - ${new Date(req.endDate).toLocaleDateString('en-IN')}`)}
                          {reqType === 'INTERNSHIP' && (`${new Date(req.startDate).toLocaleDateString('en-IN')} - ${new Date(req.endDate).toLocaleDateString('en-IN')}`)}
                          {reqType === 'LIBRARY' && (new Date(req.requestDate || req.createdAt).toLocaleDateString('en-IN'))}
                        </td>
                        <td><StatusBadge status={isHostelIncharge ? getHostelDisplayStatus(req) : req.status} showIcon={!isHostelIncharge} /></td>
                        {isHostelIncharge && (
                          <td>
                            <button
                              className="btn btn-sm"
                              onClick={() => navigate(`/outpass/${req._id}`)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '5px 14px',
                                background: 'rgba(209, 250, 229, 0.92)',
                                color: '#10b981',
                                border: '1px solid #a7f3d0',
                                borderRadius: '50px',
                                fontSize: '12.5px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                                fontFamily: 'inherit'
                              }}
                            >
                              <Eye size={14} />
                              <span>View</span>
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {isHostelIncharge && showHostelExportModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(15,23,42,0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !hostelExportLoading) {
              setShowHostelExportModal(false);
            }
          }}
        >
          <div className="card" style={{ width: '100%', maxWidth: 490, padding: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 35, height: 35, borderRadius: 9, background: 'var(--accent-dim)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileDown size={18} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>Export Report</h2>
                  <p style={{ margin: '3px 0 0', fontSize: 10, color: 'var(--text-muted)' }}>
                    Choose a format to download review history.
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close export dialog"
                disabled={Boolean(hostelExportLoading)}
                onClick={() => setShowHostelExportModal(false)}
                style={{ border: 'none', background: '#f3f4f6', width: 29, height: 29, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6b7280' }}
              >
                <X size={15} />
              </button>
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: 9, padding: 12, marginBottom: 15 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 2 }}>Report Period</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>
                    {typeFilter === 'ALL' ? 'All Types' : getBadgeTypeLabel(typeFilter)}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 2 }}>Total Requests</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>{filteredHistory.length}</span>
                </div>
              </div>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
              Choose a format to download your report:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={exportHostelHistoryPDF}
                disabled={Boolean(hostelExportLoading) || filteredHistory.length === 0}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 12px', height: 'auto', justifyContent: 'center', borderColor: '#e2e8f0', color: '#334155' }}
              >
                {hostelExportLoading === 'pdf' ? <span className="spinner" /> : <FileText size={24} color="#dc2626" />}
                <span style={{ fontWeight: 600 }}>Download PDF</span>
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={exportHostelHistoryCSV}
                disabled={Boolean(hostelExportLoading) || filteredHistory.length === 0}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 12px', height: 'auto', justifyContent: 'center', borderColor: '#e2e8f0', color: '#334155' }}
              >
                {hostelExportLoading === 'csv' ? <span className="spinner" /> : <FileSpreadsheet size={24} color="#16a34a" />}
                <span style={{ fontWeight: 600 }}>Download CSV</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setRejectModal(null)}>
          <div className="modal">
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--red)' }}>
              <ShieldAlert size={20} />
              <span>Reject {getBadgeTypeLabel(rejectModal.requestType)} Request</span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20 }}>
              Specify the official reason for rejection. This remark will be recorded and visible to the student for corrections and resubmission.
            </p>
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">Rejection Remarks (Mandatory)</label>
              <textarea
                rows={3}
                className="form-input"
                placeholder="e.g. Incomplete documentation, unpaid arrears, signature mismatch..."
                value={rejectModal.remarks}
                onChange={e => setRejectModal(m => ({ ...m, remarks: e.target.value }))}
              />
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-ghost" onClick={() => setRejectModal(null)}>Cancel</button>
              <button
                className="btn btn-danger"
                disabled={!rejectModal.remarks.trim() || actionLoading}
                onClick={handleReject}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {actionLoading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <X size={14} />}
                <span>Confirm Rejection</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .hostel-ctpo-kpi-grid .hostel-ctpo-kpi-card {
          flex-direction: row !important;
          align-items: center !important;
        }

        .hostel-ctpo-kpi-grid .hostel-ctpo-kpi-icon {
          flex: 0 0 48px !important;
        }

        @media (max-width: 900px) {
          .hostel-ctpo-kpi-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 560px) {
          .hostel-ctpo-kpi-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

    </DashboardLayout>
  );
}
