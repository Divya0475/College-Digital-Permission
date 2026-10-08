import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import StatusBadge from '../components/StatusBadge';
import api from '../lib/api';
import { formatDate, formatDateTime, formatDuration, getSimplifiedStatus } from '../lib/utils';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    Cell
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
    Paperclip,
    ExternalLink,
    RefreshCw,
    Download,
    Search,
    CalendarDays,
    TrendingUp,
    FileText,
    MapPin,
    Menu,
    X as CloseIcon,
    LogOut,
    FileDown,
    FileSpreadsheet
} from 'lucide-react';
import { FaClipboardList, FaClock, FaCircleCheck, FaCircleXmark } from "react-icons/fa6";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const ROLE_LABELS = {
    CTPO: { name: 'CTPO Approval Console', pendingStatus: 'PENDING_CTPO', color: '#10b981', desc: 'Department-level review for out-pass, mess, internship & library requests' },
    HOD: { name: 'HOD Approval Console', pendingStatus: 'PENDING_HOD', color: '#10b981', desc: 'Head of Department authorization for permissions & clearances' },
    PLACEMENT_OFFICER: { name: 'Placement Officer Console', pendingStatus: 'PENDING_PLACEMENT_OFFICER', color: '#10b981', desc: 'Final institutional authorization for student internships' },
};

export default function ApproverDashboard() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const role = user?.role;
    const cfg = ROLE_LABELS[role] || ROLE_LABELS.CTPO;
    const isHostelIncharge = role === 'HOSTEL_INCHARGE';
    const isPlacementOfficer = role === 'PLACEMENT_OFFICER';

    const [pending, setPending] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState(() => searchParams.get('view') || 'overview');
    const [typeFilter, setTypeFilter] = useState('ALL');
    const [history, setHistory] = useState([]);
    const [kpiFilter, setKpiFilter] = useState('TOTAL');

    const [rejectModal, setRejectModal] = useState(null); // { id, remarks, requestType }
    const [actionLoading, setActionLoading] = useState(false);
    const [actionMsg, setActionMsg] = useState('');

    // Placement Officer UI state. This state is only used when the logged-in
    // role is PLACEMENT_OFFICER; existing CTPO/HOD/Hostel behavior is unchanged.
    const [placementSearch, setPlacementSearch] = useState('');
    const [placementStatusFilter, setPlacementStatusFilter] = useState('ALL');
    const [placementPeriod, setPlacementPeriod] = useState('ALL');
    const [placementFromDate, setPlacementFromDate] = useState('');
    const [placementToDate, setPlacementToDate] = useState('');
    const [placementRefreshLoading, setPlacementRefreshLoading] = useState(false);
    const [placementMobileOpen, setPlacementMobileOpen] = useState(false);
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [downloadLoading, setDownloadLoading] = useState(false);

    const handlePlacementLogout = () => {
        logout();
        navigate('/login', { replace: true });
    };

    useEffect(() => {
        setPlacementMobileOpen(false);
    }, [location.pathname]);

    const fetchAll = async () => {
        try {
            const [pendingRes, statsRes] = await Promise.all([
                api.get('/outpass/pending/for-me'),
                api.get('/outpass/dashboard-stats')
            ]);

            const pendingData = pendingRes.data.data || [];
            setPending(
                isHostelIncharge
                    ? pendingData.filter((request) => isPendingHostelStatus(request?.status))
                    : isPlacementOfficer
                        ? pendingData.filter(
                            (request) =>
                                request?.requestType === 'INTERNSHIP' &&
                                request?.status === 'PENDING_PLACEMENT_OFFICER'
                        )
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
                    : isPlacementOfficer
                        ? historyData.filter((request) => request?.requestType === 'INTERNSHIP')
                        : historyData
            );
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchAll();
        if (role === 'HOSTEL_INCHARGE' || role === 'PLACEMENT_OFFICER') {
            fetchHistory();
        }
        const interval = setInterval(fetchAll, 6000);
        return () => clearInterval(interval);
    }, [role]);

    useEffect(() => {
        const requestedView = searchParams.get('view');

        if (isPlacementOfficer) {
            if (requestedView === 'history' || location.pathname.includes('/placement/history')) {
                const status = searchParams.get('status');
                if (status === 'APPROVED' || status === 'REJECTED_PLACEMENT_OFFICER' || status === 'PENDING_PLACEMENT_OFFICER' || status === 'ALL') {
                    setPlacementStatusFilter(status);
                } else {
                    setPlacementStatusFilter('ALL');
                }
                setPlacementPeriod(searchParams.get('period') || 'ALL');
                return;
            }

            if (requestedView === 'pending') {
                setPlacementStatusFilter('PENDING_PLACEMENT_OFFICER');
                return;
            }

            setPlacementStatusFilter('REVIEWED');
            setPlacementPeriod('ALL');
            setPlacementFromDate('');
            setPlacementToDate('');
        }

        if (isHostelIncharge) {
            if (requestedView === 'pending' || requestedView === 'history' || requestedView === 'overview') {
                setTab(requestedView);
                setKpiFilter(requestedView === 'pending' ? 'PENDING' : 'TOTAL');
            } else {
                setTab('overview');
                setKpiFilter('TOTAL');
            }
        }
    }, [searchParams, location.pathname, isHostelIncharge, isPlacementOfficer]);

    useEffect(() => {
        if (tab === 'history') fetchHistory();
    }, [tab]);

    useEffect(() => {
        if (!isPlacementOfficer) return;

        const placementInterval = setInterval(() => {
            fetchHistory();
        }, 10000);

        return () => clearInterval(placementInterval);
    }, [isPlacementOfficer]);

    const handleApprove = async (id) => {
        setActionLoading(true);
        setActionMsg('');
        try {
            await api.post(`/outpass/${id}/approve`, { remarks: 'Approved' });
            setActionMsg('Request approved successfully!');
            fetchAll();
            if (isPlacementOfficer) fetchHistory();
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
            if (isPlacementOfficer) fetchHistory();
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
        const status = String(request?.status || '').toUpperCase();
        return (
            isPendingHostelStatus(status) ||
            isRejectedHostelStatus(status) ||
            isApprovedHostelStatus(status)
        );
    };

    const filteredHistory = history.filter(r => {
        if (isHostelIncharge && isPendingHostelStatus(r.status)) return false;
        if (typeFilter === 'ALL') return true;
        return (r.requestType || 'OUTPASS') === typeFilter;
    });

    // Hostel In-charge specific derivations.
    const hostelAllRequests = Array.from(
        new Map(
            [...pending, ...history]
                .filter((request) => request?._id && isHostelRelevantRequest(request))
                .map((request) => [String(request._id), request])
        ).values()
    );

    const renderHostelStatus = (request) => {
        const status = String(request?.status || '').toUpperCase();

        if (isPendingHostelStatus(status)) {
            return (
                <span
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '5px 10px',
                        borderRadius: '999px',
                        background: '#fff7ed',
                        color: '#c2410c',
                        border: '1px solid #fed7aa',
                        fontSize: '11px',
                        fontWeight: 700
                    }}
                >
                    <Clock size={13} />
                    <span>Pending</span>
                </span>
            );
        }

        if (isRejectedHostelStatus(status)) {
            return (
                <span
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '5px 10px',
                        borderRadius: '999px',
                        background: '#fef2f2',
                        color: '#dc2626',
                        border: '1px solid #fecaca',
                        fontSize: '11px',
                        fontWeight: 700
                    }}
                >
                    <XCircle size={13} />
                    <span>Rejected</span>
                </span>
            );
        }

        if (isApprovedHostelStatus(status)) {
            return (
                <span
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '5px 10px',
                        borderRadius: '999px',
                        background: '#ecfdf5',
                        color: '#059669',
                        border: '1px solid #a7f3d0',
                        fontSize: '11px',
                        fontWeight: 700
                    }}
                >
                    <CheckCircle2 size={13} />
                    <span>Approved</span>
                </span>
            );
        }

        return (
            <span
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '5px 10px',
                    borderRadius: '999px',
                    background: '#f8fafc',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    fontSize: '11px',
                    fontWeight: 700
                }}
            >
                <Clock size={13} />
                <span>{status.replace(/_/g, ' ') || 'Unknown'}</span>
            </span>
        );
    };

    const getHostelDisplayStatus = (request) => {
        const status = String(request?.status || '').toUpperCase();

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

    const hostelTotal = hostelAllRequests.length;
    const hostelPending = hostelPendingRequests.length;
    const hostelApproved = hostelReviewedRequests.filter(r =>
        isApprovedHostelStatus(r.status)
    ).length;
    const hostelRejected = hostelReviewedRequests.filter(r =>
        isRejectedHostelStatus(r.status)
    ).length;

    // Hostel Overview shows reviewed requests only (Approved/Rejected).
    // Pending requests are shown separately through Pending Requests.
    //
    // The TOTAL KPI still counts all relevant requests:
    // pending + approved/gate-pass + rejected.
    let hostelBaseData = hostelReviewedRequests;

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
            hostelBaseData = hostelPendingRequests;
        } else {
            // TOTAL on Overview shows reviewed requests only.
            // Pending requests are shown separately in Pending Requests.
            hostelBaseData = hostelReviewedRequests;
        }
    }

    const filteredHostelData = hostelBaseData.filter(r => {
        if (typeFilter === 'ALL') return true;
        return (r.requestType || 'OUTPASS') === typeFilter;
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


    /* -----------------------------------------------------------------------
       Placement Officer dashboard
       -----------------------------------------------------------------------
       This branch is rendered only for PLACEMENT_OFFICER. It reuses the
       existing APIs, authentication, approval handlers and DashboardLayout.
       No CTPO/HOD/Hostel UI is changed by this branch.
    ----------------------------------------------------------------------- */

    const placementAllRequests = history.filter(
        (request) =>
            String(request?.requestType || '').toUpperCase() === 'INTERNSHIP' ||
            Boolean(request?.companyName)
    );

    const getPlacementRequestDate = (request) =>
        request?.createdAt || request?.requestDate || request?.startDate || null;

    const getDateOnly = (value) => {
        if (!value) return null;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return null;
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    };

    const startOfDay = (date) =>
        new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const endOfDay = (date) =>
        new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

    const placementToday = new Date();
    const placementTodayStart = startOfDay(placementToday);

    const placementPeriodRange = (() => {
        const now = new Date();

        if (placementPeriod === 'TODAY') {
            return {
                start: startOfDay(now),
                end: endOfDay(now),
            };
        }

        if (placementPeriod === 'WEEK') {
            const start = startOfDay(now);
            const day = start.getDay();
            const mondayOffset = day === 0 ? 6 : day - 1;
            start.setDate(start.getDate() - mondayOffset);
            return { start, end: endOfDay(now) };
        }

        if (placementPeriod === 'MONTH') {
            return {
                start: new Date(now.getFullYear(), now.getMonth(), 1),
                end: endOfDay(now),
            };
        }

        if (placementPeriod === 'CUSTOM') {
            const start = placementFromDate
                ? new Date(`${placementFromDate}T00:00:00`)
                : null;
            const end = placementToDate
                ? new Date(`${placementToDate}T23:59:59.999`)
                : null;
            return { start, end };
        }

        return { start: null, end: null };
    })();

    const placementDashboardRequests = placementAllRequests.filter((request) => {
        const dateValue = getPlacementRequestDate(request);
        const date = dateValue ? new Date(dateValue) : null;

        if (placementPeriodRange.start && (!date || date < placementPeriodRange.start)) {
            return false;
        }

        if (placementPeriodRange.end && (!date || date > placementPeriodRange.end)) {
            return false;
        }

        return true;
    });

    const placementPendingRequests = placementAllRequests.filter(
        (request) => request?.status === 'PENDING_PLACEMENT_OFFICER'
    );

    const placementDashboardPendingRequests = placementDashboardRequests.filter(
        (request) => request?.status === 'PENDING_PLACEMENT_OFFICER'
    );

    const hasCTPOApproval = (request) => {
        const directDecision = String(
            request?.ctpoDecision ||
            request?.ctpoStatus ||
            request?.ctpoApprovalStatus ||
            request?.ctpoDecisionStatus ||
            ''
        ).trim().toUpperCase();
        if (directDecision) {
            return ['APPROVED', 'APPROVE', 'ACCEPTED', 'ACCEPT', 'CLEARED'].includes(directDecision);
        }

        const stages = [
            request?.approvalStages,
            request?.approvalHistory,
            request?.approvals,
            request?.workflowStages,
            request?.stages,
            request?.approvalSteps,
            request?.steps,
            request?.workflowHistory,
        ].filter(Array.isArray).flat();
        const ctpoStages = stages.filter((stage) => {
            const role = String(
                stage?.approverRole ||
                stage?.role ||
                stage?.approver?.role ||
                stage?.authorityRole ||
                stage?.approver?.authorityRole ||
                stage?.approverType ||
                stage?.stepRole ||
                ''
            ).toUpperCase();
            return role === 'CTPO' || role.includes('CTPO');
        });

        if (ctpoStages.length) {
            const stage = ctpoStages[ctpoStages.length - 1];
            const decision = String(
                stage?.decision ||
                stage?.action ||
                stage?.status ||
                stage?.approvalStatus ||
                stage?.result ||
                ''
            ).trim().toUpperCase();
            return stage?.approved === true || stage?.isApproved === true ||
                ['APPROVED', 'APPROVE', 'ACCEPTED', 'ACCEPT', 'CLEARED'].includes(decision);
        }

        const status = String(
            request?._status ||
            request?.status ||
            request?.requestStatus ||
            request?.currentStatus ||
            request?.approvalStatus ||
            ''
        ).toUpperCase();
        return !status.includes('PENDING_CTPO') &&
            !status.includes('PENDING CTPO') &&
            !status.includes('REJECTED_CTPO') &&
            !status.includes('CTPO_REJECTED');
    };

    const placementApprovedRequests = placementDashboardRequests.filter(
        (request) => request?.status === 'APPROVED'
    );

    const placementRejectedRequests = placementDashboardRequests.filter(
        (request) => request?.status === 'REJECTED_PLACEMENT_OFFICER'
    );

    const placementStatusData = [
        { name: 'Approved', value: placementApprovedRequests.length },
        { name: 'Pending', value: placementDashboardPendingRequests.length },
        { name: 'Rejected', value: placementRejectedRequests.length },
    ];

    const placementActivityData = Array.from({ length: 30 }, (_, index) => {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() - (29 - index));

        const key = date.toISOString().slice(0, 10);

        const requests = placementAllRequests.filter((request) => {
            const requestDate = getPlacementRequestDate(request);
            if (!requestDate) return false;
            const parsed = new Date(requestDate);
            return !Number.isNaN(parsed.getTime()) &&
                parsed.toISOString().slice(0, 10) === key;
        }).length;

        return {
            date: date.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
            }),
            requests,
        };
    });

    const placementSearchTerm = placementSearch.trim().toLowerCase();

    const placementPendingFiltered = placementPendingRequests.filter((request) => {
        if (!placementSearchTerm) return true;

        const studentName = String(request?.studentId?.name || '').toLowerCase();
        const rollNo = String(request?.studentId?.rollNo || '').toLowerCase();
        const company = String(request?.companyName || '').toLowerCase();
        const internshipRole = String(request?.role || '').toLowerCase();

        return (
            studentName.includes(placementSearchTerm) ||
            rollNo.includes(placementSearchTerm) ||
            company.includes(placementSearchTerm) ||
            internshipRole.includes(placementSearchTerm)
        );
    });

    const placementHistoryFiltered = placementDashboardRequests.filter((request) => {
        if (!hasCTPOApproval(request)) return false;
        const status = String(request?.status || '').toUpperCase();
        if (status !== 'APPROVED' && status !== 'REJECTED_PLACEMENT_OFFICER') {
            return false;
        }

        if (placementStatusFilter !== 'REVIEWED' &&
            placementStatusFilter !== 'ALL' &&
            status !== placementStatusFilter) {
            return false;
        }

        if (!placementSearchTerm) return true;
        const studentName = String(request?.studentId?.name || '').toLowerCase();
        const rollNo = String(request?.studentId?.rollNo || '').toLowerCase();
        const company = String(request?.companyName || '').toLowerCase();
        const internshipRole = String(request?.role || '').toLowerCase();
        return (
            studentName.includes(placementSearchTerm) ||
            rollNo.includes(placementSearchTerm) ||
            company.includes(placementSearchTerm) ||
            internshipRole.includes(placementSearchTerm)
        );
    });

    const placementLatestPending = [...placementPendingRequests]
        .sort(
            (a, b) =>
                new Date(getPlacementRequestDate(b) || 0) -
                new Date(getPlacementRequestDate(a) || 0)
        )
        .slice(0, 5);

    const placementView =
        location.pathname.includes('/placement/pending')
            ? 'pending'
            : location.pathname.includes('/placement/history')
                ? 'history'
                : searchParams.get('view') || 'dashboard';

    useEffect(() => {
        setPlacementSearch('');
        setPlacementPeriod('ALL');
        setPlacementFromDate('');
        setPlacementToDate('');
        if (placementView === 'history') {
            return;
        } else if (placementView === 'pending') {
            setPlacementStatusFilter('PENDING_PLACEMENT_OFFICER');
        }
    }, [placementView]);

    const formatPlacementDate = (value) => {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        return formatDate(value);
    };

    const formatPlacementDateTime = (value) => {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        return formatDateTime(value);
    };

    const getPlacementDocumentUrl = (documentUrl) => {
        if (!documentUrl) return '';
        if (/^https?:\/\//i.test(documentUrl)) return documentUrl;

        let backendBaseUrl = api?.defaults?.baseURL || '';
        if (backendBaseUrl) {
            backendBaseUrl = backendBaseUrl.replace(/\/api\/?$/, '');
        }

        if (!backendBaseUrl) {
            backendBaseUrl =
                `${window.location.protocol}//${window.location.hostname}:5000`;
        }

        return `${backendBaseUrl}${documentUrl.startsWith('/') ? documentUrl : `/${documentUrl}`}`;
    };

    const exportPlacementCSV = (records = placementHistoryFiltered) => {
        const headers = [
            'Request ID',
            'Student Name',
            'Roll Number',
            'Branch',
            'Year',
            'Company',
            'Company Location',
            'Internship Role',
            'Mode',
            'Request Date',
            'Start Date',
            'End Date',
            'Status',
            'Rejection Reason',
        ];

        const escapeCSV = (value) =>
            `"${String(value ?? '').replace(/"/g, '""')}"`;

        const rows = records.map((request) => [
            request?._id,
            request?.studentId?.name,
            request?.studentId?.rollNo,
            request?.branchId?.name || request?.branchId?.code,
            request?.year || request?.studentId?.year,
            request?.companyName,
            request?.companyLocation,
            request?.role,
            request?.internshipMode,
            formatPlacementDateTime(getPlacementRequestDate(request)),
            formatPlacementDate(request?.startDate),
            formatPlacementDate(request?.endDate),
            getSimplifiedStatus(request?.status),
            request?.rejectionReason,
        ]);

        const csv = [
            headers.map(escapeCSV).join(','),
            ...rows.map((row) => row.map(escapeCSV).join(',')),
        ].join('\n');

        const blob = new Blob([csv], {
            type: 'text/csv;charset=utf-8;',
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `placement-internship-report-${new Date()
            .toISOString()
            .slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        setDownloadLoading(false);
    };

    const exportPlacementPDF = (records = placementHistoryFiltered) => {
        try {
            setDownloadLoading('pdf');
            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

            doc.setFontSize(20);
            doc.setTextColor(40, 45, 90);
            doc.text('Digital Permission', 14, 16);

            doc.setFontSize(14);
            doc.text('Placement Officer Report', 14, 24);

            doc.setFontSize(9);
            doc.setTextColor(100, 100, 110);
            doc.text(`Period: ${placementPeriod === 'ALL' ? 'All Time' : placementPeriod}`, 14, 32);
            doc.text(`Total Requests: ${records.length}`, 14, 38);

            autoTable(doc, {
                startY: 45,
                head: [[
                    'Student', 'Roll No', 'Branch', 'Company', 'Role', 'Status'
                ]],
                body: records.map(req => [
                    req?.studentId?.name || '-',
                    req?.studentId?.rollNo || '-',
                    req?.branchId?.name || req?.branchId?.code || '-',
                    req?.companyName || '-',
                    req?.role || '-',
                    getSimplifiedStatus(req?.status)
                ]),
                styles: { fontSize: 8 },
                headStyles: { fillColor: [40, 45, 90] }
            });

            doc.save(`placement-internship-report-${new Date().toISOString().slice(0, 10)}.pdf`);
        } catch (error) {
            console.error('PDF generation error:', error);
            alert('Unable to generate PDF.');
        } finally {
            setDownloadLoading(false);
        }
    };

    const refreshPlacementDashboard = async () => {
        if (!isPlacementOfficer) return;

        setPlacementRefreshLoading(true);
        try {
            await Promise.all([fetchAll(), fetchHistory()]);
            setActionMsg('Placement dashboard refreshed successfully.');
        } catch (e) {
            console.error(e);
            setActionMsg(
                e.response?.data?.message || 'Unable to refresh placement dashboard.'
            );
        } finally {
            setPlacementRefreshLoading(false);
        }
    };

    const handlePlacementKpi = (filter) => {
        setPlacementPeriod('ALL');
        setPlacementFromDate('');
        setPlacementToDate('');
        setPlacementSearch('');

        if (filter === 'PENDING') {
            setPlacementStatusFilter('PENDING_PLACEMENT_OFFICER');
            navigate('/placement/history?status=PENDING_PLACEMENT_OFFICER');
        } else if (filter === 'APPROVED') {
            setPlacementStatusFilter('APPROVED');
            navigate('/placement/history?status=APPROVED');
        } else if (filter === 'REJECTED') {
            setPlacementStatusFilter('REJECTED_PLACEMENT_OFFICER');
            navigate('/placement/history?status=REJECTED_PLACEMENT_OFFICER');
        } else {
            setPlacementStatusFilter('ALL');
            navigate('/placement/history?status=ALL');
        }
    };

    const renderPlacementStatus = (status, showIcon = true) => {
        const normalized = String(status || '').toUpperCase();

        if (normalized === 'PENDING_PLACEMENT_OFFICER') {
            return (
                <span
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '5px 10px',
                        borderRadius: 999,
                        background: '#fff7ed',
                        color: '#c2410c',
                        border: '1px solid #fed7aa',
                        fontSize: 11,
                        fontWeight: 700,
                    }}
                >
                    {showIcon && <Clock size={13} />}
                    Pending
                </span>
            );
        }

        if (normalized === 'APPROVED') {
            return (
                <span
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '5px 10px',
                        borderRadius: 999,
                        background: '#ecfdf5',
                        color: '#059669',
                        border: '1px solid #a7f3d0',
                        fontSize: 11,
                        fontWeight: 700,
                    }}
                >
                    {showIcon && <CheckCircle2 size={13} />}
                    Approved
                </span>
            );
        }

        if (normalized === 'REJECTED_PLACEMENT_OFFICER') {
            return (
                <span
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '5px 10px',
                        borderRadius: 999,
                        background: '#fef2f2',
                        color: '#dc2626',
                        border: '1px solid #fecaca',
                        fontSize: 11,
                        fontWeight: 700,
                    }}
                >
                    {showIcon && <XCircle size={13} />}
                    Rejected
                </span>
            );
        }

        return <StatusBadge status={status} showIcon={false} />;
    };

    const printPlacementReport = (records = placementHistoryFiltered) => {
        const rows = records
            .map(
                (request) => `
          <tr>
            <td>${request?.studentId?.name || '-'}</td>
            <td>${request?.studentId?.rollNo || '-'}</td>
            <td>${request?.companyName || '-'}</td>
            <td>${request?.role || '-'}</td>
            <td>${request?.internshipMode || '-'}</td>
            <td>${formatPlacementDate(request?.startDate)} - ${formatPlacementDate(request?.endDate)}</td>
            <td>${getSimplifiedStatus(request?.status)}</td>
            <td>${request?.rejectionReason || '-'}</td>
          </tr>
        `
            )
            .join('');

        const reportWindow = window.open('', '_blank', 'width=1200,height=800');

        if (!reportWindow) {
            setActionMsg('Please allow pop-ups to print the report.');
            return;
        }

        reportWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Placement Internship Permission Report</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 32px;
              color: #0f172a;
            }
            h1 { margin: 0 0 6px; }
            p { color: #64748b; margin-top: 0; }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 24px;
              font-size: 12px;
            }
            th, td {
              border: 1px solid #dbe3ef;
              padding: 8px;
              text-align: left;
              vertical-align: top;
            }
            th {
              background: #f1f5f9;
              font-weight: 700;
            }
            .summary {
              display: flex;
              gap: 24px;
              margin-top: 18px;
            }
          </style>
        </head>
        <body>
          <h1>Placement Internship Permission Report</h1>
          <p>Generated on ${new Date().toLocaleString('en-IN')}</p>

          <div class="summary">
            <strong>Total: ${records.length}</strong>
            <strong>Approved: ${records.filter((r) => r?.status === 'APPROVED').length}</strong>
            <strong>Pending: ${records.filter((r) => getSimplifiedStatus(r?.status) === 'Pending').length}</strong>
            <strong>Rejected: ${records.filter((r) => r?.status === 'REJECTED_PLACEMENT_OFFICER').length}</strong>
          </div>

          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Roll Number</th>
                <th>Company</th>
                <th>Role</th>
                <th>Mode</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `);

        reportWindow.document.close();
        reportWindow.focus();
        setTimeout(() => reportWindow.print(), 250);
    };

    const renderPlacementDashboard = () => {
        const total = placementAllRequests.length;
        const approved = placementApprovedRequests.length;
        const pendingCount = placementDashboardPendingRequests.length;
        const rejected = placementRejectedRequests.length;

        const todayLabel = new Date().toLocaleDateString('en-IN', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });

        // HOD-style approval activity: decisions recorded during the last 7 days.
        const placementApprovalActivity = Array.from({ length: 7 }, (_, index) => {
            const date = new Date();
            date.setHours(0, 0, 0, 0);
            date.setDate(date.getDate() - (6 - index));

            const nextDate = new Date(date);
            nextDate.setDate(nextDate.getDate() + 1);

            const approvedCount = placementAllRequests.filter((request) => {
                if (request?.requestType !== 'INTERNSHIP') return false;
                if (request?.status !== 'APPROVED') return false;

                const decisionDate = request?.updatedAt || request?.approvedAt || request?.createdAt;
                if (!decisionDate) return false;

                const parsed = new Date(decisionDate);
                return !Number.isNaN(parsed.getTime()) &&
                    parsed >= date &&
                    parsed < nextDate;
            }).length;

            const rejectedCount = placementAllRequests.filter((request) => {
                if (request?.requestType !== 'INTERNSHIP') return false;
                if (request?.status !== 'REJECTED_PLACEMENT_OFFICER') return false;

                const decisionDate = request?.updatedAt || request?.rejectedAt || request?.createdAt;
                if (!decisionDate) return false;

                const parsed = new Date(decisionDate);
                return !Number.isNaN(parsed.getTime()) &&
                    parsed >= date &&
                    parsed < nextDate;
            }).length;

            return {
                date: date.toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                }),
                approved: approvedCount,
                rejected: rejectedCount,
            };
        });

        return (
            <>
                <style>{`
          @media (max-width: 768px) {
            .placement-kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 10px !important; }
            .placement-analytics-grid { grid-template-columns: minmax(0, 1fr) !important; gap: 12px !important; width: 100% !important; min-width: 0 !important; }
            .placement-analytics-grid > * { width: 100% !important; min-width: 0 !important; box-sizing: border-box !important; }
            .placement-kpi-grid .stat-card { min-width: 0 !important; min-height: 126px !important; padding: 14px !important; box-sizing: border-box !important; }
            .placement-kpi-grid .stat-icon { width: 34px !important; height: 34px !important; }
            .placement-kpi-grid .stat-label { font-size: 10px !important; line-height: 1.3 !important; }
            .placement-kpi-grid .stat-value { font-size: 26px !important; line-height: 1 !important; }
          }
          @media (max-width: 400px) {
            .placement-kpi-grid { gap: 8px !important; }
            .placement-kpi-grid .stat-card { min-height: 118px !important; padding: 12px !important; }
          }
        `}</style>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 20,
                        flexWrap: 'wrap',
                        marginBottom: 22,
                    }}
                >
                    <div>
                        <h1
                            style={{
                                margin: 0,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                fontSize: 28,
                                fontWeight: 800,
                                color: '#0f172a',
                                letterSpacing: '-0.5px',
                            }}
                        >
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '16px', fontWeight: 600, color: '#64748b', letterSpacing: 'normal', marginBottom: '4px' }}>Welcome back,</span>
                                <span>
                                    <span style={{ color: '#0f172a' }}>Placement </span>
                                    <span style={{ color: '#059669' }}>Officer</span>
                                </span>
                            </div>
                        </h1>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', padding: '10px 16px', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                            <Calendar size={20} />
                        </div>
                        <div>
                            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{new Date().toLocaleDateString('en-US', { weekday: 'long' })}</div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                                {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                        </div>
                    </div>
                </div>

                {actionMsg && (
                    <div
                        className={`alert ${actionMsg.toLowerCase().includes('success')
                            ? 'alert-success'
                            : 'alert-error'
                            }`}
                        style={{
                            marginBottom: 20,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                        }}
                    >
                        {actionMsg.toLowerCase().includes('success') ? (
                            <CheckCircle2 size={16} />
                        ) : (
                            <AlertCircle size={16} />
                        )}
                        <span>{actionMsg}</span>
                    </div>
                )}

                {/* KPI CARDS */}
                <div style={{
                    marginBottom: 16,
                    fontSize: 16,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                }}>
                    <Briefcase size={18} color="#10b981" />
                    Internship Overview
                </div>
                <div
                    className="stats-grid placement-kpi-grid"
                    style={{
                        marginBottom: 16,
                        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                    }}
                >
                    {[
                        { key: 'TOTAL', label: 'Total Requests', value: total, iconBg: 'rgba(13,148,136,0.12)', iconColor: '#0d9488', valueColor: '#115e59', icon: FaClipboardList },
                        { key: 'PENDING', label: 'Pending', value: pendingCount, iconBg: 'rgba(245,158,11,0.12)', iconColor: '#d97706', valueColor: '#d97706', icon: FaClock },
                        { key: 'APPROVED', label: 'Approved', value: approved, iconBg: 'rgba(22,163,74,0.12)', iconColor: '#16a34a', valueColor: '#16a34a', icon: FaCircleCheck },
                        { key: 'REJECTED', label: 'Rejected', value: rejected, iconBg: 'rgba(220,38,38,0.12)', iconColor: '#dc2626', valueColor: '#dc2626', icon: FaCircleXmark },
                    ].map((card) => {
                        const Icon = card.icon;

                        return (
                            <div
                                key={card.key}
                                className="card stat-card-hover"
                                onClick={() => handlePlacementKpi(card.key)}
                                style={{
                                    background: '#ffffff',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: 12,
                                    padding: '20px 24px',
                                    minHeight: 100,
                                    boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
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
                                    e.currentTarget.style.boxShadow = '0 1px 2px rgba(15,23,42,0.04)';
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

                {/* HOD-STYLE ANALYTICS ROW */}
                <div
                    className="placement-analytics-grid"
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1.15fr) minmax(320px, 0.85fr)',
                        gap: 16,
                        marginBottom: 16,
                    }}
                >
                    {/* Approval Activity */}
                    <div className="card" style={{ marginBottom: 0, minHeight: 300 }}>
                        <div
                            className="card-header"
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                gap: 12,
                            }}
                        >
                            <div>
                                <div
                                    className="card-title"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 7,
                                    }}
                                >
                                    <TrendingUp size={17} color="#10b981" />
                                    Approval Activity (Last 7 Days)
                                </div>
                                <div className="card-subtitle">
                                    Approved vs rejected internship decisions recorded
                                </div>
                            </div>

                            <span
                                style={{
                                    fontSize: 12,
                                    color: '#94a3b8',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                Daily Volume
                            </span>
                        </div>

                        <div style={{ height: 195, marginTop: 4 }}>
                            {placementApprovalActivity.some(
                                (item) => item.approved > 0 || item.rejected > 0
                            ) ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={placementApprovalActivity}
                                        margin={{ top: 10, right: 12, left: -10, bottom: 8 }}
                                        barGap={4}
                                    >
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            stroke="#e2e8f0"
                                            vertical={false}
                                        />

                                        <XAxis
                                            dataKey="date"
                                            stroke="#64748b"
                                            fontSize={11}
                                            tickLine={false}
                                            axisLine={false}
                                        />

                                        <YAxis
                                            stroke="#64748b"
                                            fontSize={11}
                                            allowDecimals={false}
                                            tickLine={false}
                                            axisLine={false}
                                        />

                                        <Tooltip
                                            contentStyle={{
                                                borderRadius: 10,
                                                border: '1px solid #e2e8f0',
                                                boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
                                            }}
                                        />

                                        <Legend
                                            wrapperStyle={{
                                                fontSize: 12,
                                                paddingTop: 8,
                                            }}
                                        />

                                        <Bar
                                            dataKey="approved"
                                            name="Approved"
                                            fill="#10b981"
                                            radius={[4, 4, 0, 0]}
                                            maxBarSize={28}
                                            cursor="pointer"
                                            onClick={() => handlePlacementKpi('APPROVED')}
                                        />

                                        <Bar
                                            dataKey="rejected"
                                            name="Rejected"
                                            fill="#ef4444"
                                            radius={[4, 4, 0, 0]}
                                            maxBarSize={28}
                                            cursor="pointer"
                                            onClick={() => handlePlacementKpi('REJECTED')}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div
                                    className="empty-state"
                                    style={{ height: '100%', padding: 20 }}
                                >
                                    <div className="empty-state-icon">
                                        <TrendingUp size={34} />
                                    </div>

                                    <div className="empty-state-title">
                                        No decisions recorded
                                    </div>

                                    <div className="empty-state-desc">
                                        Approved and rejected decisions will appear here.
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Internship request summary */}
                    <div className="card" style={{ marginBottom: 0, minHeight: 300 }}>
                        <div className="card-header">
                            <div
                                className="card-title"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 7,
                                }}
                            >
                                <Briefcase size={17} color="#10b981" />
                                Internship Requests
                            </div>

                            <div className="card-subtitle">
                                Current request status
                            </div>
                        </div>

                        <div style={{ padding: '4px 0 6px' }}>
                            {[
                                {
                                    label: 'Pending Requests',
                                    value: pendingCount,
                                    color: '#f59e0b',
                                    icon: Clock,
                                    onClick: () => handlePlacementKpi('PENDING'),
                                },
                                {
                                    label: 'Approved Requests',
                                    value: approved,
                                    color: '#059669',
                                    icon: CheckCircle2,
                                    onClick: () => handlePlacementKpi('APPROVED'),
                                },
                                {
                                    label: 'Rejected Requests',
                                    value: rejected,
                                    color: '#dc2626',
                                    icon: XCircle,
                                    onClick: () => handlePlacementKpi('REJECTED'),
                                },
                            ].map((item) => {
                                const Icon = item.icon;

                                return (
                                    <div
                                        key={item.label}
                                        style={{
                                            width: '100%',
                                            border: 0,
                                            borderBottom: '1px solid #eef2f7',
                                            background: 'transparent',
                                            padding: '17px 4px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 12,
                                            textAlign: 'left',
                                        }}
                                    >
                                        <span
                                            style={{
                                                width: 38,
                                                height: 38,
                                                borderRadius: 10,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                background: `${item.color}12`,
                                                color: item.color,
                                                flexShrink: 0,
                                            }}
                                        >
                                            <Icon size={18} />
                                        </span>

                                        <span style={{ flex: 1 }}>
                                            <span
                                                style={{
                                                    display: 'block',
                                                    fontSize: 13,
                                                    fontWeight: 700,
                                                    color: '#334155',
                                                }}
                                            >
                                                {item.label}
                                            </span>
                                        </span>

                                        <strong
                                            style={{
                                                fontSize: 22,
                                                color: item.color,
                                            }}
                                        >
                                            {item.value}
                                        </strong>
                                    </div>
                                );
                            })}

                            <button
                                type="button"
                                onClick={() => handlePlacementKpi('TOTAL')}
                                style={{
                                    width: '100%',
                                    border: 0,
                                    background: '#f8fafc',
                                    borderRadius: 10,
                                    marginTop: 12,
                                    padding: '13px 12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    cursor: 'pointer',
                                    color: '#10b981',
                                    fontWeight: 700,
                                }}
                            >
                                <span>View all internship requests</span>
                                <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Dashboard ends here. Pending requests are intentionally kept on /placement/pending only. */}
            </>
        );
    };

    const renderPlacementRequests = (view) => {
        const isPendingView = view === 'pending';

        const records = isPendingView
            ? placementPendingFiltered
            : placementHistoryFiltered;

        return (
            <>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 16,
                        flexWrap: 'wrap',
                        marginBottom: 20,
                    }}
                >
                    <div>
                        <h1 className="page-title" style={{ margin: 0 }}>
                            {isPendingView
                                ? 'Pending Internship Requests'
                                : 'Review History'}
                        </h1>
                        <p className="page-subtitle" style={{ marginTop: 7 }}>
                            {isPendingView
                                ? 'Review and take action on internship permission requests.'
                                : 'View all internship permission records visible to the Placement Officer.'}
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>

                        {!isPendingView && (
                            <button
                                className="btn btn-ghost"
                                onClick={() => printPlacementReport(records)}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 7,
                                }}
                            >
                                <FileText size={15} />
                                Print
                            </button>
                        )}

                        {!isPendingView && (
                            <button
                                className="btn btn-primary"
                                onClick={() => setShowGenerateModal(true)}
                                style={{

                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 7,
                                }}
                            >
                                <Download size={15} />
                                Export
                            </button>
                        )}
                    </div>
                </div>

                <div
                    className="card placement-request-filter-card"
                    style={{
                        marginBottom: 16,
                        padding: 14,
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            gap: 8,
                            flexWrap: 'wrap',
                            alignItems: 'center',
                        }}
                    >
                        <div
                            className="placement-request-filter-search"
                            style={{
                                flex: '1 1 280px',
                                position: 'relative',
                            }}
                        >
                            <Search
                                size={16}
                                style={{
                                    position: 'absolute',
                                    left: 12,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--text-muted)',
                                }}
                            />
                            <input
                                className="form-input placement-request-filter-input"
                                value={placementSearch}
                                onChange={(e) => setPlacementSearch(e.target.value)}
                                placeholder="Search student, roll number, company or role..."
                                style={{ paddingLeft: 36 }}
                            />
                        </div>

                        {!isPendingView && (
                            <select
                                className="form-input placement-request-filter-select"
                                value={placementStatusFilter}
                                onChange={(e) => setPlacementStatusFilter(e.target.value)}
                                style={{ width: 165 }}
                            >
                                <option value="ALL">All Requests</option>
                                <option value="APPROVED">Approved</option>
                                <option value="REJECTED_PLACEMENT_OFFICER">Rejected</option>
                            </select>
                        )}

                        <select
                            className="form-input placement-request-filter-select"
                            value={placementPeriod}
                            onChange={(e) => setPlacementPeriod(e.target.value)}
                            style={{ width: 145 }}
                        >
                            <option value="ALL">All Time</option>
                            <option value="TODAY">Today</option>
                            <option value="WEEK">This Week</option>
                            <option value="MONTH">This Month</option>
                            <option value="CUSTOM">Custom Range</option>
                        </select>
                    </div>

                    {placementPeriod === 'CUSTOM' && (
                        <div
                            style={{
                                display: 'flex',
                                gap: 8,
                                marginTop: 10,
                                flexWrap: 'wrap',
                            }}
                        >
                            <input
                                type="date"
                                className="form-input"
                                value={placementFromDate}
                                onChange={(e) => setPlacementFromDate(e.target.value)}
                                style={{ maxWidth: 180 }}
                            />
                            <input
                                type="date"
                                className="form-input"
                                value={placementToDate}
                                onChange={(e) => setPlacementToDate(e.target.value)}
                                style={{ maxWidth: 180 }}
                            />
                        </div>
                    )}
                </div>

                <div className="card">
                    {loading ? (
                        <div className="loading-screen">
                            <div className="spinner spinner-lg" />
                        </div>
                    ) : records.length === 0 ? (
                        <div className="empty-state" style={{ padding: '60px 20px' }}>
                            <div className="empty-state-icon">
                                {isPendingView ? (
                                    <CheckCircle2 size={46} />
                                ) : (
                                    <ClipboardList size={46} />
                                )}
                            </div>
                            <div className="empty-state-title">
                                {placementSearch
                                    ? 'No internship requests match your search'
                                    : isPendingView
                                        ? 'No pending internship requests'
                                        : 'No reviewed internship permission records found'}
                            </div>
                            <div className="empty-state-desc">
                                {isPendingView
                                    ? 'New internship requests will appear here when they reach Placement Officer approval.'
                                    : 'Processed internship permission records will appear here.'}
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* MOBILE REVIEW/PENDING CARDS */}
                            <div className="placement-mobile-request-list">
                                {records.map((request) => {
                                    const documentUrl = getPlacementDocumentUrl(request?.documentUrl);
                                    return (
                                        <article className="placement-mobile-request-card" key={`mobile-${request._id}`}>
                                            <div className="placement-mobile-request-top">
                                                <div>
                                                    <div className="placement-mobile-student">
                                                        {request.studentId?.name || 'Unknown Student'}
                                                    </div>
                                                    <div className="placement-mobile-roll">
                                                        {request.studentId?.rollNo || '-'} - {request.branchId?.name || request.branchId?.code || '-'} - Year {request.year || request.studentId?.year || '-'}
                                                    </div>
                                                </div>
                                                {renderPlacementStatus(request.status)}
                                            </div>

                                            <div className="placement-mobile-divider" />

                                            <div className="placement-mobile-info-grid">
                                                <div>
                                                    <span>COMPANY</span>
                                                    <strong>{request.companyName || '-'}</strong>
                                                    <small>{request.companyLocation || '-'}</small>
                                                </div>
                                                <div>
                                                    <span>INTERNSHIP ROLE</span>
                                                    <strong>{request.role || '-'}</strong>
                                                    <small>{request.internshipMode || '-'}</small>
                                                </div>
                                                <div>
                                                    <span>DURATION</span>
                                                    <strong>{formatPlacementDate(request.startDate)}</strong>
                                                    <small>to {formatPlacementDate(request.endDate)}</small>
                                                </div>
                                                <div>
                                                    <span>SUBMITTED</span>
                                                    <strong>{formatPlacementDateTime(getPlacementRequestDate(request))}</strong>
                                                </div>
                                            </div>

                                            <div className="placement-mobile-actions">
                                                {documentUrl && (
                                                    <a href={documentUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm placement-mobile-action-btn">
                                                        <Paperclip size={13} /> View Doc
                                                    </a>
                                                )}
                                                <button
                                                    className="btn btn-primary btn-sm placement-mobile-view-btn"
                                                    onClick={() => navigate(`/outpass/${request._id}`)}
                                                >
                                                    <Eye size={13} /> View Request
                                                </button>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>

                            {/* DESKTOP TABLE */}
                            <div className="placement-desktop-request-table table-wrapper">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Student</th>
                                            <th>Internship Details</th>
                                            <th>Duration</th>
                                            <th>Submitted</th>
                                            <th>Status</th>
                                            <th>Document</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {records.map((request) => {
                                            const documentUrl = getPlacementDocumentUrl(
                                                request?.documentUrl
                                            );

                                            return (
                                                <tr key={request._id}>
                                                    <td>
                                                        <div
                                                            style={{
                                                                fontWeight: 600,
                                                                color: 'var(--text-primary)',
                                                            }}
                                                        >
                                                            {request.studentId?.name || 'Unknown Student'}
                                                        </div>
                                                        <div
                                                            className="td-muted"
                                                            style={{ marginTop: 2, fontSize: '11px' }}
                                                        >
                                                            <code>{request.studentId?.rollNo || '-'}</code>
                                                        </div>
                                                        <div className="td-muted" style={{ fontSize: '11px' }}>
                                                            {request.branchId?.name ||
                                                                request.branchId?.code ||
                                                                '-'}{' '}
                                                            · {request.year || request.studentId?.year || '-'}
                                                        </div>
                                                    </td>

                                                    <td style={{ minWidth: 220 }}>
                                                        <div
                                                            style={{
                                                                fontWeight: 600,
                                                                color: 'var(--text-primary)',
                                                            }}
                                                        >
                                                            {request.companyName || '-'}
                                                        </div>

                                                        <div
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 4,
                                                                fontSize: 11,
                                                                color: 'var(--text-secondary)',
                                                                marginTop: 3,
                                                            }}
                                                        >
                                                            <MapPin size={12} />
                                                            {request.companyLocation || '-'}
                                                        </div>

                                                        <div
                                                            style={{
                                                                fontSize: 12,
                                                                color: 'var(--text-secondary)',
                                                                marginTop: 3,
                                                            }}
                                                        >
                                                            {request.role || '-'} -{' '}
                                                            {request.internshipMode || '-'}
                                                        </div>
                                                    </td>

                                                    <td className="td-muted">
                                                        <div>
                                                            {formatPlacementDate(request.startDate)}
                                                        </div>
                                                        <div style={{ marginTop: 3 }}>
                                                            to {formatPlacementDate(request.endDate)}
                                                        </div>
                                                    </td>

                                                    <td className="td-muted">
                                                        {formatPlacementDateTime(
                                                            getPlacementRequestDate(request)
                                                        )}
                                                    </td>

                                                    <td>{renderPlacementStatus(request.status, false)}</td>

                                                    <td>
                                                        {documentUrl ? (
                                                            <a
                                                                href={documentUrl}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="btn btn-ghost btn-sm"
                                                                style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: 5,
                                                                    textDecoration: 'none',
                                                                }}
                                                            >
                                                                <Paperclip size={13} />
                                                                Document
                                                            </a>
                                                        ) : (
                                                            <div style={{ textAlign: 'center' }}>
                                                                <span className="td-muted">None</span>
                                                            </div>
                                                        )}
                                                    </td>

                                                    <td>
                                                        <div
                                                            style={{
                                                                display: 'flex',
                                                                gap: 6,
                                                                alignItems: 'center',
                                                                flexWrap: 'wrap',
                                                            }}
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    navigate(
                                                                        isPendingView
                                                                            ? `/outpass/${request._id}?mode=approval`
                                                                            : `/outpass/${request._id}`
                                                                    )
                                                                }
                                                                style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    gap: '5px',
                                                                    padding: '5px 14px',
                                                                    borderRadius: '50px',
                                                                    fontSize: '12.5px',
                                                                    fontWeight: 600,
                                                                    color: '#10b981',
                                                                    background: 'rgba(209, 250, 229, 0.92)',
                                                                    border: '1px solid #a7f3d0',
                                                                    cursor: 'pointer',
                                                                    transition: 'all 0.15s',
                                                                    fontFamily: 'inherit',
                                                                    whiteSpace: 'nowrap'
                                                                }}
                                                            >
                                                                <Eye size={14} />
                                                                {isPendingView ? 'Review' : 'View'}
                                                            </button>


                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </>
        );
    };

    const renderPlacementOfficerLayout = () => (
        <DashboardLayout>
            <style>{`
                .placement-request-filter-card .placement-request-filter-input {
                    height: 44px !important;
                    box-sizing: border-box;
                    padding: 0 14px 0 36px !important;
                    line-height: 1.2;
                }
                .placement-request-filter-card .placement-request-filter-select {
                    display: inline-flex;
                    align-items: center;
                    justify-content: space-between;
                    height: 44px !important;
                    box-sizing: border-box;
                    padding: 0 14px !important;
                    line-height: 1.2;
                }
                .placement-request-filter-card .placement-request-filter-select::picker-icon {
                    display: block;
                    margin-left: auto;
                    color: #64748b;
                    font-size: 10px;
                }

        /* Placement mobile history/request cards */
        .placement-mobile-request-list { display:none; }
        .placement-mobile-request-card {
          background:#fff;
          border:1px solid #e2e8f0;
          border-radius:14px;
          padding:14px;
          margin-bottom:10px;
          box-sizing:border-box;
          box-shadow:0 1px 2px rgba(15,23,42,.04);
        }
        .placement-mobile-request-top {
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:10px;
        }
        .placement-mobile-student { font-size:14px; font-weight:750; color:#0f172a; line-height:1.35; }
        .placement-mobile-roll { margin-top:3px; font-size:11px; color:#64748b; line-height:1.45; }
        .placement-mobile-divider { height:1px; background:#e2e8f0; margin:12px 0; }
        .placement-mobile-info-grid { display:grid; grid-template-columns:1fr 1fr; gap:13px 16px; }
        .placement-mobile-info-grid > div { min-width:0; }
        .placement-mobile-info-grid span { display:block; font-size:9px; font-weight:800; letter-spacing:.7px; color:#94a3b8; margin-bottom:4px; }
        .placement-mobile-info-grid strong { display:block; font-size:12px; color:#0f172a; line-height:1.35; overflow-wrap:anywhere; }
        .placement-mobile-info-grid small { display:block; margin-top:2px; font-size:10px; color:#64748b; line-height:1.35; overflow-wrap:anywhere; }
        .placement-mobile-actions { display:flex; gap:7px; flex-wrap:wrap; margin-top:13px; }
        .placement-mobile-action-btn, .placement-mobile-view-btn { min-height:34px; }
        .placement-mobile-view-btn { flex:1 1 130px; justify-content:center; }
        @media (max-width:768px) {
          .placement-mobile-request-list { display:block; }
          .placement-desktop-request-table { display:none !important; }
        }
        @media (max-width:400px) {
          .placement-mobile-request-card { padding:13px; border-radius:13px; }
          .placement-mobile-student { font-size:13px; }
          .placement-mobile-info-grid { gap:11px 12px; }
          .placement-mobile-info-grid strong { font-size:11.5px; }
          .placement-mobile-info-grid small { font-size:9.5px; }
          .placement-mobile-actions { gap:6px; }
        }
      `}</style>
            <div style={{ width: '100%', paddingBottom: 24 }}>
                {placementView === 'dashboard' ? renderPlacementDashboard() : renderPlacementRequests(placementView)}
            </div>
        </DashboardLayout>
    );

    return (
        <>
            {isPlacementOfficer ? (
                renderPlacementOfficerLayout()
            ) : (
                <DashboardLayout>
                    <>
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
                                    {cfg.desc} - Logged in as <strong>{user?.name}</strong>
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
                                <div className="card-header" style={{ paddingBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                            {!isHostelIncharge && (
                                <div className="tabs" style={{ marginBottom: 0 }}>
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
                                </div>
                            )}

                            {/* Feature Filter Pills */}
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {['ALL', 'OUTPASS', 'MESS_FEE', 'INTERNSHIP'].map(f => (
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
                                                                    <code>{req.studentId?.rollNo}</code> - {req.branchId?.name || 'CSM'}
                                                                </div>
                                                            </td>
                                                            <td style={{ maxWidth: 220 }}>
                                                                <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: '2px' }}>
                                                                    {req.reason}
                                                                </div>
                                                                {reqType === 'MESS_FEE' && (
                                                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                                                        Amount: <strong>₹{req.messAmount?.toLocaleString('en-IN')}</strong> -{' '}
                                                                        <span style={{ color: req.paidStatus === 'Paid' ? 'var(--green)' : 'var(--yellow)', fontWeight: 600 }}>
                                                                            {req.paidStatus}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {reqType === 'INTERNSHIP' && (
                                                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                                                        <strong>{req.companyName}</strong> ({req.role}) - {req.internshipMode}
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
                                                                            href={getPlacementDocumentUrl(req.documentUrl)}
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
                                                                        <div style={{ textAlign: 'center' }}>
                                                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>None</span>
                                                                        </div>
                                                                    )}
                                                                </td>
                                                            )}
                                                            {isHostelIncharge ? (
                                                                <>
                                                                    <td>
                                                                        {renderHostelStatus(req)}
                                                                    </td>
                                                                    {tab === 'pending' && (
                                                                        <td>
                                                                            <button
                                                                                className="btn btn-sm"
                                                                                onClick={() => navigate(`/outpass/${req._id}?mode=approval`)}
                                                                                style={{
                                                                                    display: 'inline-flex',
                                                                                    alignItems: 'center',
                                                                                    gap: '4px',
                                                                                    padding: '6px 12px',
                                                                                    background: '#ecfdf5',
                                                                                    color: '#10b981',
                                                                                    border: '1px solid #10b981',
                                                                                    borderRadius: '6px',
                                                                                    fontWeight: 600
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
                                                                {reqType === 'OUTPASS' && formatDate(req.outDate)}
                                                                {reqType === 'MESS_FEE' && formatDuration(req.startDate, req.endDate)}
                                                                {reqType === 'INTERNSHIP' && formatDuration(req.startDate, req.endDate)}
                                                                {reqType === 'LIBRARY' && formatDate(req.requestDate || req.createdAt)}
                                                            </td>
                                                            <td>{isHostelIncharge ? renderHostelStatus(req) : <StatusBadge status={getSimplifiedStatus(req.status)} showIcon={false} />}</td>
                                                            {isHostelIncharge && (
                                                                <td>
                                                                    <button
                                                                        className="btn btn-sm"
                                                                        onClick={() => navigate(`/outpass/${req._id}`)}
                                                                        style={{
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            gap: '4px',
                                                                            padding: '6px 12px',
                                                                            background: '#ecfdf5',
                                                                            color: '#10b981',
                                                                            border: '1px solid #10b981',
                                                                            borderRadius: '6px',
                                                                            fontWeight: 600
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

                    </>
                </DashboardLayout>
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
            {showGenerateModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onMouseDown={(e) => { if (e.target === e.currentTarget) setShowGenerateModal(false); }}>
                    <div className="card" style={{ width: '100%', maxWidth: 490, padding: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                <div style={{ width: 35, height: 35, borderRadius: 9, background: 'var(--accent-dim)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <FileDown size={18} />
                                </div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>Generate Report</h2>
                                    <p style={{ margin: '3px 0 0', fontSize: 10, color: 'var(--text-muted)' }}>Choose a format to download the selected report.</p>
                                </div>
                            </div>
                            <button type="button" onClick={() => setShowGenerateModal(false)} style={{ border: 'none', background: '#f3f4f6', width: 29, height: 29, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6b7280' }}>
                                <X size={15} />
                            </button>
                        </div>

                        <div style={{ border: '1px solid var(--border)', borderRadius: 9, padding: 12, marginBottom: 15 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Report Period</span><span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>{placementPeriod === 'ALL' ? 'All Time' : placementPeriod}</span></div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Permission Type</span><span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>Internship</span></div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Total Requests</span><span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>{placementHistoryFiltered.length}</span></div>
                            </div>
                        </div>

                        <div style={{ marginBottom: 15 }}>
                            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text)', marginBottom: 7 }}>Report Includes</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                {['Summary', 'Request Details'].map((item) => (
                                    <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, color: 'var(--text-muted)' }}>
                                        <CheckCircle2 size={12} style={{ color: '#10b981' }} /> {item}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                            <button type="button" onClick={() => exportPlacementPDF(placementHistoryFiltered)} disabled={!!downloadLoading} style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '11px 8px', color: '#dc2626', fontSize: 10, fontWeight: 800, cursor: downloadLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: downloadLoading ? 0.6 : 1 }}>
                                {downloadLoading === 'pdf' ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <FileText size={15} />} Download PDF
                            </button>
                            <button type="button" onClick={() => exportPlacementCSV(placementHistoryFiltered)} disabled={!!downloadLoading} style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '11px 8px', color: '#16a34a', fontSize: 10, fontWeight: 800, cursor: downloadLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: downloadLoading ? 0.6 : 1 }}>
                                {downloadLoading === 'excel' ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <FileSpreadsheet size={15} />} Download CSV
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
