import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../lib/api';
import { Search, ChevronLeft, ChevronRight, Eye, ChevronDown, CalendarDays, ClipboardList } from 'lucide-react';

const PAGE_SIZE = 10;

const STATUS_TABS = [
    { key: 'ALL', label: 'All Requests' },
    { key: 'APPROVED', label: 'Approved' },
    { key: 'PENDING', label: 'Pending' },
    { key: 'REJECTED', label: 'Rejected' },
];

const statusOf = r => String(r?.status || '').trim().toUpperCase();

const studentName = r =>
    r?.studentId?.name || r?.student?.name || r?.studentName || r?.name || '-';

const rollNo = r =>
    r?.studentId?.rollNo || r?.student?.rollNo || r?.rollNo || '-';

const branchName = r =>
    r?.branchId?.name || r?.branchId?.code || r?.branch?.name ||
    r?.branch?.code || r?.branchName || '-';

const yearOf = r =>
    r?.yearTier || r?.year || r?.studentId?.yearTier ||
    r?.student?.yearTier || '-';

const requestType = r => {
    const type = String(
        r?.requestType ||
        r?.permissionType?.name ||
        r?.permissionType?.label ||
        r?.permissionType?.type ||
        r?.permissionType ||
        r?.type ||
        'OUTPASS'
    ).toUpperCase();

    if (type.includes('MESS')) return 'Mess Fee';
    if (type.includes('INTERNSHIP')) return 'Internship';
    if (type.includes('LIBRARY')) return 'Library';
    if (type.includes('OUTPASS') || type.includes('OUT-PASS') || type.includes('OUT_PASS')) return 'Out-Pass';

    return r?.requestType || r?.permissionType || type;
};

const dateValue = r =>
    r?.createdAt || r?.requestDate || r?.outDate || r?.date || null;

const formatDate = r => {
    const value = dateValue(r);
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';

    return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
};

const isApproved = status =>
    [
        'APPROVED',
        'ISSUED',
        'USED',
        'CLEARED',
        'PENDING_HOSTEL_INCHARGE',
        'PENDING_PLACEMENT_OFFICER',
        'PENDING_CTPO'
    ].includes(status);

const isPending = status => 
    status === 'PENDING_HOD' || 
    status === 'PENDING_HOD_APPROVAL';
const isRejected = status => status.startsWith('REJECTED');

const statusLabel = status => {
    if (isPending(status)) return 'Pending';
    if (isRejected(status)) return 'Rejected';
    if (isApproved(status)) return 'Approved';

    return status
        ? status.replace(/_/g, ' ').toLowerCase()
            .replace(/\b\w/g, c => c.toUpperCase())
        : '-';
};

const statusStyle = status => {
    if (isPending(status)) {
        return { background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' };
    }
    if (isRejected(status)) {
        return { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' };
    }
    if (isApproved(status)) {
        return { background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' };
    }
    return { background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' };
};

export default function HODStudentRequests() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const urlStatus = String(searchParams.get('status') || 'ALL').toUpperCase();

    // Branch selected from the HOD Branches page.
    // Example: /hod/student-requests?branch=CSM
    const branchFilter = String(
        searchParams.get('branch') || ''
    ).trim().toUpperCase();

    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');

    const [activeStatus, setActiveStatus] = useState(
        STATUS_TABS.some(t => t.key === urlStatus) ? urlStatus : 'ALL'
    );

    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('ALL');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
    const typeDropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = event => {
            if (typeDropdownRef.current && !typeDropdownRef.current.contains(event.target)) {
                setIsTypeDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchRequests = async (refresh = false) => {
        try {
            refresh ? setRefreshing(true) : setLoading(true);
            setError('');

            const res = await api.get('/outpass/all/for-me');
            const body = res?.data;

            const data = Array.isArray(body)
                ? body
                : body?.data || body?.requests || [];

            const isHODVisibleRequest = (request) => {
                const type = String(
                    request?.requestType ||
                    request?.type ||
                    request?.permissionType ||
                    ''
                )
                    .trim()
                    .toUpperCase()
                    .replace(/[\s-]+/g, '_');

                return type !== 'LIBRARY';
            };

            setRequests(Array.isArray(data) ? data.filter(isHODVisibleRequest) : []);
        } catch (err) {
            console.error('HOD student requests error:', err);
            setError(
                err?.response?.data?.message ||
                'Unable to load student requests.'
            );
            setRequests([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchRequests();

        const interval = setInterval(() => fetchRequests(true), 6000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const status = String(searchParams.get('status') || 'ALL').toUpperCase();
        setActiveStatus(
            STATUS_TABS.some(t => t.key === status) ? status : 'ALL'
        );
        setCurrentPage(1);
    }, [searchParams]);

    const counts = useMemo(() => {
        return requests.reduce((acc, r) => {
            const status = statusOf(r);
            acc.all += 1;

            if (isApproved(status)) acc.approved += 1;
            else if (isPending(status)) acc.pending += 1;
            else if (isRejected(status)) acc.rejected += 1;

            return acc;
        }, { all: 0, approved: 0, pending: 0, rejected: 0 });
    }, [requests]);

    const filteredRequests = useMemo(() => {
        const q = search.trim().toLowerCase();

        return requests.filter(r => {
            const status = statusOf(r);

            // When opened from a branch card, show only that branch.
            // Supports both populated branch objects and direct branch fields.
            const requestBranch = String(
                r?.branchId?.code ||
                r?.branch?.code ||
                r?.branchCode ||
                r?.branchId?.name ||
                r?.branch?.name ||
                r?.branchName ||
                ''
            ).trim().toUpperCase();

            if (
                branchFilter &&
                requestBranch !== branchFilter
            ) {
                return false;
            }

            if (activeStatus === 'APPROVED' && !isApproved(status)) return false;
            if (activeStatus === 'PENDING' && !isPending(status)) return false;
            if (activeStatus === 'REJECTED' && !isRejected(status)) return false;

            if (typeFilter !== 'ALL') {
                const type = String(
                    r?.requestType ||
                    r?.permissionType?.name ||
                    r?.permissionType?.label ||
                    r?.permissionType?.type ||
                    r?.permissionType ||
                    r?.type ||
                    ''
                ).toUpperCase();

                const normalizedType = type.replace(/[\s-]+/g, '_');
                const expectedType = typeFilter === 'MESS_FEE' ? 'MESS' : typeFilter;
                if (normalizedType !== typeFilter && normalizedType !== expectedType) return false;
            }

            if (q) {
                const name = String(studentName(r)).toLowerCase();
                const roll = String(rollNo(r)).toLowerCase();

                if (!name.includes(q) && !roll.includes(q)) return false;
            }

            const value = dateValue(r);

            if (fromDate && value) {
                if (new Date(value) < new Date(`${fromDate}T00:00:00`)) return false;
            }

            if (toDate && value) {
                if (new Date(value) > new Date(`${toDate}T23:59:59`)) return false;
            }

            return true;
        });
    }, [
        requests,
        activeStatus,
        typeFilter,
        search,
        fromDate,
        toDate,
        branchFilter,
    ]);

    const totalPages = Math.max(
        1,
        Math.ceil(filteredRequests.length / PAGE_SIZE)
    );

    const pageRequests = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredRequests.slice(start, start + PAGE_SIZE);
    }, [filteredRequests, currentPage]);

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [currentPage, totalPages]);

    const changeStatus = status => {
        // Pending tab redirects to the dedicated Pending Approvals page.
        if (status === 'PENDING') {
            navigate('/hod/approvals');
            return;
        }

        setCurrentPage(1);

        const params = {};

        if (branchFilter) {
            params.branch = branchFilter;
        }

        if (status !== 'ALL') {
            params.status = status;
        }

        setSearchParams(params);
    };

    const clearFilters = () => {
        setSearch('');
        setTypeFilter('ALL');
        setFromDate('');
        setToDate('');
        setCurrentPage(1);
    };

    const countFor = key => {
        if (loading) return '—';
        if (key === 'ALL') return counts.all;
        if (key === 'APPROVED') return counts.approved;
        if (key === 'PENDING') return counts.pending;
        return counts.rejected;
    };

    return (
        <DashboardLayout>
            <div style={{ minHeight: '100%', paddingBottom: 32 }}>

                <div className="page-header" style={{ marginBottom: 22 }}>
                    <div>
                        <h1 className="page-title">Student Requests</h1>
                        <p className="page-subtitle">
                            View and manage all student requests under your department
                        </p>
                    </div>

                </div>

                {/* STATUS TABS */}
                <div
                    style={{
                        display: 'flex',
                        gap: 8,
                        borderBottom: '1px solid #e2e8f0',
                        marginBottom: 18,
                        overflowX: 'auto'
                    }}
                >
                    {STATUS_TABS.map(tab => {
                        const active = activeStatus === tab.key;

                        return (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => changeStatus(tab.key)}
                                style={{
                                    border: 'none',
                                    borderBottom: active
                                        ? '3px solid #10b981'
                                        : '3px solid transparent',
                                    background: active ? '#ecfdf5' : 'transparent',
                                    color: active ? '#10b981' : '#64748b',
                                    padding: '12px 18px',
                                    borderRadius: '8px 8px 0 0',
                                    fontSize: 13,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                {tab.label}
                                <span style={{ marginLeft: 7 }}>
                                    ({countFor(tab.key)})
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* FILTERS - no branch filter */}
                <div
                    className="card"
                    style={{
                        marginBottom: 18,
                        padding: 16,
                        position: 'relative',
                        zIndex: isTypeDropdownOpen ? 20 : 1,
                    }}
                >
                    <div
                        className="student-request-filter-grid"
                        style={{
                            display: 'grid',
                            gridTemplateColumns:
                                'minmax(240px, 1fr) 170px 150px 150px auto',
                            gap: 10,
                            alignItems: 'center'
                        }}
                    >
                        <div style={{ position: 'relative' }}>
                            <Search
                                size={16}
                                style={{
                                    position: 'absolute',
                                    left: 12,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: '#94a3b8'
                                }}
                            />
                            <input
                                value={search}
                                onChange={e => {
                                    setSearch(e.target.value);
                                    setCurrentPage(1);
                                }}
                                placeholder="Search by name or roll number..."
                                style={{
                                    width: '100%',
                                    height: 40,
                                    padding: '0 12px 0 36px',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: 8,
                                    outline: 'none',
                                    fontSize: 12,
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>

                        <div
                            ref={typeDropdownRef}
                            style={{ position: 'relative', minWidth: 0 }}
                        >
                            <button
                                type="button"
                                aria-haspopup="listbox"
                                aria-expanded={isTypeDropdownOpen}
                                onClick={() => setIsTypeDropdownOpen(open => !open)}
                                style={{
                                    width: '100%',
                                    height: 40,
                                    padding: '0 34px 0 12px',
                                    border: isTypeDropdownOpen || typeFilter !== 'ALL'
                                        ? '1px solid #10b981'
                                        : '1px solid #e2e8f0',
                                    borderRadius: 8,
                                    outline: 'none',
                                    fontSize: 12,
                                    color: typeFilter === 'ALL' ? '#475569' : '#059669',
                                    background: typeFilter === 'ALL' ? '#fff' : '#ecfdf5',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    position: 'relative',
                                }}
                            >
                                {typeFilter === 'ALL' ? 'All Types' : {
                                    OUTPASS: 'Out-Pass',
                                    MESS_FEE: 'Mess Fee',
                                    INTERNSHIP: 'Internship',
                                    LIBRARY: 'Library',
                                }[typeFilter] || typeFilter}
                                <ChevronDown
                                    size={15}
                                    style={{
                                        position: 'absolute',
                                        right: 11,
                                        top: '50%',
                                        transform: `translateY(-50%) ${isTypeDropdownOpen ? 'rotate(180deg)' : ''}`,
                                        pointerEvents: 'none',
                                        color: '#059669',
                                        transition: 'transform 0.2s ease',
                                    }}
                                />
                            </button>
                            {isTypeDropdownOpen && (
                                <div
                                    role="listbox"
                                    aria-label="Permission type"
                                    style={{
                                        position: 'absolute',
                                        top: 'calc(100% + 4px)',
                                        left: 0,
                                        width: '100%',
                                        minWidth: 140,
                                        background: '#fff',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: 8,
                                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                                        zIndex: 50,
                                        padding: 4,
                                    }}
                                >
                                    {[
                                        { value: 'ALL', label: 'All Types' },
                                        { value: 'OUTPASS', label: 'Out-Pass' },
                                        { value: 'MESS_FEE', label: 'Mess Fee' },
                                        { value: 'INTERNSHIP', label: 'Internship' },
                                        { value: 'LIBRARY', label: 'Library' },
                                    ].map(option => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            role="option"
                                            aria-selected={typeFilter === option.value}
                                            onClick={() => {
                                                setTypeFilter(option.value);
                                                setCurrentPage(1);
                                                setIsTypeDropdownOpen(false);
                                            }}
                                            style={{
                                                display: 'block',
                                                width: '100%',
                                                padding: '8px 12px',
                                                border: 'none',
                                                borderRadius: 6,
                                                background: typeFilter === option.value ? '#10b981' : 'transparent',
                                                color: typeFilter === option.value ? '#fff' : '#0f172a',
                                                fontSize: 13,
                                                fontWeight: typeFilter === option.value ? 600 : 400,
                                                textAlign: 'left',
                                                cursor: 'pointer',
                                            }}
                                            onMouseEnter={event => {
                                                if (typeFilter !== option.value) {
                                                    event.currentTarget.style.background = '#d1fae5';
                                                    event.currentTarget.style.color = '#047857';
                                                }
                                            }}
                                            onMouseLeave={event => {
                                                if (typeFilter !== option.value) {
                                                    event.currentTarget.style.background = 'transparent';
                                                    event.currentTarget.style.color = '#0f172a';
                                                }
                                            }}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <DateInput
                            value={fromDate}
                            onChange={value => {
                                setFromDate(value);
                                setCurrentPage(1);
                            }}
                        />

                        <DateInput
                            value={toDate}
                            onChange={value => {
                                setToDate(value);
                                setCurrentPage(1);
                            }}
                        />

                        <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={clearFilters}
                            style={{ height: 40 }}
                        >
                            Clear
                        </button>
                    </div>
                </div>

                {error && (
                    <div
                        style={{
                            marginBottom: 16,
                            padding: '12px 14px',
                            borderRadius: 8,
                            background: '#fef2f2',
                            color: '#b91c1c',
                            border: '1px solid #fecaca',
                            fontSize: 12
                        }}
                    >
                        {error}
                    </div>
                )}

                {/* TABLE */}
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div
                        style={{
                            padding: '16px 18px',
                            borderBottom: '1px solid #e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 9
                        }}
                    >
                        <div
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: 8,
                                background: '#ecfdf5',
                                color: '#10b981',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <ClipboardList size={16} />
                        </div>

                        <div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: '#172554' }}>
                                {STATUS_TABS.find(t => t.key === activeStatus)?.label}
                            </div>
                            <div style={{ marginTop: 2, fontSize: 11, color: '#64748b' }}>
                                {loading
                                    ? 'Loading requests...'
                                    : `${filteredRequests.length} request${filteredRequests.length === 1 ? '' : 's'}`}
                            </div>
                        </div>
                    </div>

                    <div style={{ width: '100%', overflowX: 'auto' }}>
                        <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc' }}>
                                    {['#', 'Student Name', 'Roll No', 'Branch', 'Type', 'Date', 'Status', 'Action']
                                        .map(h => (
                                            <th
                                                key={h}
                                                style={{
                                                    padding: '11px 12px',
                                                    textAlign: 'left',
                                                    fontSize: 10,
                                                    fontWeight: 800,
                                                    color: '#64748b',
                                                    textTransform: 'uppercase',
                                                    whiteSpace: 'nowrap',
                                                    borderBottom: '1px solid #e2e8f0'
                                                }}
                                            >
                                                {h}
                                            </th>
                                        ))}
                                </tr>
                            </thead>

                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={9} style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
                                            Loading student requests...
                                        </td>
                                    </tr>
                                ) : pageRequests.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} style={{ padding: 52, textAlign: 'center', color: '#64748b', fontSize: 12 }}>
                                            No student requests found for the selected filters.
                                        </td>
                                    </tr>
                                ) : (
                                    pageRequests.map((request, index) => {
                                        const status = statusOf(request);

                                        return (
                                            <tr
                                                key={request?._id || request?.id || `${index}-${rollNo(request)}`}
                                                style={{ borderBottom: '1px solid #f1f5f9' }}
                                            >
                                                <Cell>{(currentPage - 1) * PAGE_SIZE + index + 1}</Cell>
                                                <Cell bold>{studentName(request)}</Cell>
                                                <Cell>{rollNo(request)}</Cell>
                                                <Cell>{branchName(request)}</Cell>
                                                <Cell>{requestType(request)}</Cell>
                                                <Cell>{formatDate(request)}</Cell>

                                                <td style={{ padding: 12 }}>
                                                    <span
                                                        style={{
                                                            ...statusStyle(status),
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            padding: '5px 9px',
                                                            borderRadius: 999,
                                                            fontSize: 10,
                                                            fontWeight: 800,
                                                            whiteSpace: 'nowrap'
                                                        }}
                                                    >
                                                        {statusLabel(status)}
                                                    </span>
                                                </td>

                                                <td style={{ padding: 12 }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => navigate(`/outpass/${request?._id || request?.id || request?.requestId}?mode=approval`)}
                                                        style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: 5,
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
                                                        Review
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {!loading && filteredRequests.length > 0 && (
                        <div
                            style={{
                                padding: '13px 16px',
                                borderTop: '1px solid #e2e8f0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 12,
                                flexWrap: 'wrap'
                            }}
                        >
                            <div style={{ fontSize: 11, color: '#64748b' }}>
                                Showing <strong>{(currentPage - 1) * PAGE_SIZE + 1}</strong> to{' '}
                                <strong>{Math.min(currentPage * PAGE_SIZE, filteredRequests.length)}</strong>{' '}
                                of <strong>{filteredRequests.length}</strong> requests
                            </div>

                            <div style={{ display: 'flex', gap: 5 }}>
                                <PageButton
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                >
                                    <ChevronLeft size={15} />
                                </PageButton>

                                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(page => (
                                    <PageButton
                                        key={page}
                                        active={page === currentPage}
                                        onClick={() => setCurrentPage(page)}
                                    >
                                        {page}
                                    </PageButton>
                                ))}

                                <PageButton
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                >
                                    <ChevronRight size={15} />
                                </PageButton>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

                .student-request-filter-grid input,
                .student-request-filter-grid select {
                    height: 44px !important;
                    box-sizing: border-box;
                    line-height: 1.2;
                }

                .student-request-filter-grid input {
                    padding-top: 0 !important;
                    padding-bottom: 0 !important;
                }

                .student-request-filter-grid select {
                    display: inline-flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 34px 0 12px !important;
                    appearance: none !important;
                }

        @media (max-width: 1100px) {
          .student-request-filter-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }

        @media (max-width: 640px) {
          .student-request-filter-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
        </DashboardLayout>
    );
}

function DateInput({ value, onChange }) {
    return (
        <div style={{ position: 'relative' }}>
            <CalendarDays
                size={15}
                style={{
                    position: 'absolute',
                    left: 11,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#94a3b8',
                    pointerEvents: 'none'
                }}
            />
            <input
                type="date"
                value={value}
                onChange={e => onChange(e.target.value)}
                style={{
                    width: '100%',
                    height: 40,
                    padding: '0 10px 0 34px',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    outline: 'none',
                    fontSize: 11,
                    color: '#475569',
                    background: '#fff',
                    boxSizing: 'border-box'
                }}
            />
        </div>
    );
}

function Cell({ children, bold = false }) {
    return (
        <td
            style={{
                padding: 12,
                fontSize: 12,
                color: bold ? '#172554' : '#475569',
                fontWeight: bold ? 700 : 400,
                whiteSpace: 'nowrap'
            }}
        >
            {children}
        </td>
    );
}

function PageButton({ children, active = false, disabled = false, onClick }) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            style={{
                minWidth: 32,
                height: 32,
                padding: '0 8px',
                border: active ? '1px solid #10b981' : '1px solid #e2e8f0',
                borderRadius: 7,
                background: active ? '#10b981' : '#fff',
                color: active ? '#fff' : disabled ? '#cbd5e1' : '#475569',
                fontSize: 11,
                fontWeight: 700,
                cursor: disabled ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}
        >
            {children}
        </button>
    );
}
