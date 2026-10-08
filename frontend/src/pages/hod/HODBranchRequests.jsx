import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../lib/api';
import {
    ArrowLeft,
    Building2,
    Search,
    ChevronLeft,
    ChevronRight,
    Eye,
    ChevronDown,
    CalendarDays,
    RefreshCw,
    ClipboardList,
    Download,
    X,
    FileDown,
    CheckCircle2,
    FileText,
    FileSpreadsheet,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const PAGE_SIZE = 10;

const STATUS_TABS = [
    { key: 'ALL', label: 'All Requests' },
    { key: 'APPROVED', label: 'Approved' },
    { key: 'PENDING', label: 'Pending' },
    { key: 'REJECTED', label: 'Rejected' },
];

const BRANCHES = [
    { code: 'CSM', name: 'Computer Science & Machine Learning' },
    { code: 'CAI', name: 'Computer Science & Artificial Intelligence' },
    { code: 'CSD', name: 'Computer Science & Data Science' },
    { code: 'AID', name: 'Artificial Intelligence & Data Science' },
    { code: 'CSC', name: 'Cyber Security' },
];

/*
 * Your backend currently returns branchId like:
 *
 *   { code: "42", name: "CSM" }
 *   { code: "43", name: "CAI" }
 *
 * The branch name is therefore the safest branch key, while these
 * numeric mappings are also supported.
 */
const BRANCH_ID_TO_CODE = {
    '42': 'CSM',
    '43': 'CAI',
    '44': 'CSD',
    '45': 'AID',
    '46': 'CSC',
};

const NAME_TO_CODE = {
    'COMPUTER SCIENCE & MACHINE LEARNING': 'CSM',
    'COMPUTER SCIENCE & ENGINEERING (AI & ML)': 'CSM',
    'COMPUTER SCIENCE & ENGINEERING (AI AND ML)': 'CSM',

    'COMPUTER SCIENCE & ARTIFICIAL INTELLIGENCE': 'CAI',
    'COMPUTER SCIENCE & ENGINEERING (AI)': 'CAI',

    'COMPUTER SCIENCE & DATA SCIENCE': 'CSD',
    'COMPUTER SCIENCE & ENGINEERING (DATA SCIENCE)': 'CSD',

    'ARTIFICIAL INTELLIGENCE & DATA SCIENCE': 'AID',

    'CYBER SECURITY': 'CSC',
    'COMPUTER SCIENCE & ENGINEERING': 'CSC',
};

const normalize = value =>
    String(value ?? '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, ' ');

const getBranchCode = request => {
    if (!request) return '';

    // Actual populated backend response:
    // request.branchId.name = "CAI"
    // request.branchId.code = "43"
    const names = [
        request?.branchId?.name,
        request?.branch?.name,
        request?.branchName,
        request?.studentId?.branchId?.name,
        request?.student?.branchId?.name,
        request?.studentId?.branch?.name,
        request?.student?.branch?.name,
        request?.student?.branchName,
        request?.studentId?.branchName,
    ];

    for (const value of names) {
        const name = normalize(value);

        if (BRANCHES.some(branch => branch.code === name)) {
            return name;
        }

        if (NAME_TO_CODE[name]) {
            return NAME_TO_CODE[name];
        }

        if (
            name.includes('MACHINE LEARNING') ||
            name.includes('(AI & ML)') ||
            name.includes('(AI AND ML)')
        ) {
            return 'CSM';
        }

        if (
            name.includes('COMPUTER SCIENCE') &&
            name.includes('DATA SCIENCE')
        ) {
            return 'CSD';
        }

        if (
            name.includes('ARTIFICIAL INTELLIGENCE') &&
            name.includes('DATA SCIENCE')
        ) {
            return 'AID';
        }

        if (name.includes('CYBER SECURITY')) {
            return 'CSC';
        }

        if (name.includes('ARTIFICIAL INTELLIGENCE')) {
            return 'CAI';
        }
    }

    // Numeric branch codes returned by the backend.
    const numericCodes = [
        request?.branchId?.code,
        request?.branch?.code,
        request?.branchCode,
        request?.studentId?.branchId?.code,
        request?.student?.branchId?.code,
        request?.studentId?.branch?.code,
        request?.student?.branch?.code,
    ];

    for (const value of numericCodes) {
        const raw = normalize(value);

        if (BRANCH_ID_TO_CODE[raw]) {
            return BRANCH_ID_TO_CODE[raw];
        }

        if (BRANCHES.some(branch => branch.code === raw)) {
            return raw;
        }
    }

    return '';
};

const extractRequests = response => {
    const body = response?.data;

    if (Array.isArray(body)) return body;
    if (Array.isArray(body?.data)) return body.data;
    if (Array.isArray(body?.requests)) return body.requests;
    if (Array.isArray(body?.results)) return body.results;
    if (Array.isArray(body?.data?.requests)) return body.data.requests;
    if (Array.isArray(body?.data?.results)) return body.data.results;

    return [];
};

const statusOf = request =>
    normalize(request?.status);

const studentName = request =>
    request?.studentId?.name ||
    request?.student?.name ||
    request?.studentName ||
    request?.user?.name ||
    request?.name ||
    '-';

const rollNo = request =>
    request?.studentId?.rollNo ||
    request?.studentId?.rollNumber ||
    request?.student?.rollNo ||
    request?.student?.rollNumber ||
    request?.rollNo ||
    request?.rollNumber ||
    '-';

const yearOf = request =>
    request?.year ||
    request?.studentId?.year ||
    request?.student?.year ||
    request?.yearTier ||
    request?.studentId?.yearTier ||
    request?.student?.yearTier ||
    '-';

const requestTypeKey = request => {
    const type = normalize(
        request?.requestType ||
        request?.permissionType?.name ||
        request?.permissionType?.label ||
        request?.permissionType?.type ||
        request?.permissionType ||
        request?.type ||
        ''
    );

    if (type.includes('MESS')) return 'MESS_FEE';
    if (type.includes('INTERNSHIP')) return 'INTERNSHIP';
    if (type.includes('LIBRARY')) return 'LIBRARY';
    if (type.includes('OUTPASS') || type.includes('OUT_PASS')) return 'OUTPASS';

    if (request?.messAmount !== undefined || request?.paidStatus !== undefined) return 'MESS_FEE';
    if (request?.companyName !== undefined || request?.internshipMode !== undefined) return 'INTERNSHIP';
    if (request?.outDate !== undefined || request?.expectedReturnDate !== undefined || request?.outTime !== undefined) return 'OUTPASS';

    return 'OUTPASS';
};

const getRequestId = request => {
    const id = request?._id || request?.id || request?.requestId;
    return typeof id === 'object' ? id?._id || id?.id : id;
};

const requestType = request => {
    const key = requestTypeKey(request);
    if (key === 'MESS_FEE') return 'Mess Fee';
    if (key === 'INTERNSHIP') return 'Internship';
    if (key === 'LIBRARY') return 'Library';
    return 'Out-Pass';
};

const dateValue = request =>
    request?.createdAt ||
    request?.requestDate ||
    request?.outDate ||
    request?.date ||
    request?.startDate ||
    null;

const formatDate = request => {
    const value = dateValue(request);

    if (!value) return '-';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return '-';

    return date.toLocaleDateString('en-IN', {
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
        'PENDING_PLACEMENT_OFFICER'
    ].includes(status);

const isPending = status =>
    status === 'PENDING_HOD' || 
    status === 'PENDING_HOD_APPROVAL' ||
    status === 'PENDING_CTPO';

const isRejected = status =>
    status.startsWith('REJECTED');

const statusLabel = status => {
    if (isPending(status)) return 'Pending';
    if (isRejected(status)) return 'Rejected';
    if (isApproved(status)) return 'Approved';

    return status
        ? status
            .replace(/_/g, ' ')
            .toLowerCase()
            .replace(/\b\w/g, char => char.toUpperCase())
        : '-';
};

const statusStyle = status => {
    if (isPending(status)) {
        return {
            background: '#fff7ed',
            color: '#c2410c',
            border: '1px solid #fed7aa',
        };
    }

    if (isRejected(status)) {
        return {
            background: '#fef2f2',
            color: '#dc2626',
            border: '1px solid #fecaca',
        };
    }

    if (isApproved(status)) {
        return {
            background: '#ecfdf5',
            color: '#059669',
            border: '1px solid #a7f3d0',
        };
    }

    return {
        background: '#f1f5f9',
        color: '#475569',
        border: '1px solid #e2e8f0',
    };
};

export default function HODBranchRequests() {
    const navigate = useNavigate();
    const { branchCode } = useParams();

    const selectedBranch = normalize(branchCode);
    const branch = BRANCHES.find(
        item => item.code === selectedBranch
    );

    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');

    const [activeStatus, setActiveStatus] = useState('ALL');
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('ALL');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [downloadLoading, setDownloadLoading] = useState(false);
    const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
    const typeDropdownRef = useRef(null);

    // Close dropdown on click outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (typeDropdownRef.current && !typeDropdownRef.current.contains(event.target)) {
                setIsTypeDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchRequests = async (refresh = false) => {
        try {
            if (refresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            setError('');

            const response = await api.get(
                '/outpass/all/for-me'
            );

            const data = extractRequests(response);

            setRequests(data);
        } catch (err) {
            console.error(
                'HOD branch requests error:',
                err
            );

            setError(
                err?.response?.data?.message ||
                'Unable to load branch requests.'
            );

            setRequests([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (!branch) {
            setLoading(false);
            return undefined;
        }

        fetchRequests();

        const interval = setInterval(
            () => fetchRequests(true),
            6000
        );

        return () => clearInterval(interval);
    }, [selectedBranch]);

    /*
     * IMPORTANT:
     * Everything below is calculated only from the selected branch.
     * No branch uses hard-coded request counts.
     */
    const branchRequests = useMemo(() => {
        return requests.filter(
            request =>
                getBranchCode(request) ===
                selectedBranch
        );
    }, [requests, selectedBranch]);

    const counts = useMemo(() => {
        return branchRequests.reduce(
            (result, request) => {
                const status = statusOf(request);

                result.all += 1;

                if (isApproved(status)) {
                    result.approved += 1;
                } else if (isPending(status)) {
                    result.pending += 1;
                } else if (isRejected(status)) {
                    result.rejected += 1;
                }

                return result;
            },
            {
                all: 0,
                approved: 0,
                pending: 0,
                rejected: 0,
            }
        );
    }, [branchRequests]);

    const filteredRequests = useMemo(() => {
        const query = search
            .trim()
            .toLowerCase();

        return branchRequests.filter(request => {
            const status = statusOf(request);

            if (
                activeStatus === 'APPROVED' &&
                !isApproved(status)
            ) {
                return false;
            }

            if (
                activeStatus === 'PENDING' &&
                !isPending(status)
            ) {
                return false;
            }

            if (
                activeStatus === 'REJECTED' &&
                !isRejected(status)
            ) {
                return false;
            }

            if (
                typeFilter !== 'ALL' &&
                requestTypeKey(request) !== typeFilter
            ) {
                return false;
            }

            if (query) {
                const name = String(
                    studentName(request)
                ).toLowerCase();

                const roll = String(
                    rollNo(request)
                ).toLowerCase();

                if (
                    !name.includes(query) &&
                    !roll.includes(query)
                ) {
                    return false;
                }
            }

            const value = dateValue(request);

            if (fromDate && value) {
                if (
                    new Date(value) <
                    new Date(
                        `${fromDate}T00:00:00`
                    )
                ) {
                    return false;
                }
            }

            if (toDate && value) {
                if (
                    new Date(value) >
                    new Date(
                        `${toDate}T23:59:59`
                    )
                ) {
                    return false;
                }
            }

            return true;
        });
    }, [
        branchRequests,
        activeStatus,
        typeFilter,
        search,
        fromDate,
        toDate,
    ]);

    const totalPages = Math.max(
        1,
        Math.ceil(
            filteredRequests.length /
            PAGE_SIZE
        )
    );

    const pageRequests = useMemo(() => {
        const start =
            (currentPage - 1) *
            PAGE_SIZE;

        return filteredRequests.slice(
            start,
            start + PAGE_SIZE
        );
    }, [
        filteredRequests,
        currentPage,
    ]);

    useEffect(() => {
        setCurrentPage(1);
    }, [
        activeStatus,
        typeFilter,
        search,
        fromDate,
        toDate,
        selectedBranch,
    ]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const changeStatus = status => {
        setActiveStatus(status);
        setCurrentPage(1);
    };

    const clearFilters = () => {
        setSearch('');
        setTypeFilter('ALL');
        setFromDate('');
        setToDate('');
        setActiveStatus('ALL');
        setCurrentPage(1);
    };

    const exportBranchReport = () => {
        const headers = [
            'S.No',
            'Student',
            'Roll No',
            'Year',
            'Request Type',
            'Date',
            'Status',
        ];

        const rows = branchRequests.map((request, index) => [
            index + 1,
            studentName(request),
            rollNo(request),
            yearOf(request),
            requestType(request),
            formatDate(request),
            statusLabel(statusOf(request)),
        ]);

        const escapeCsv = value => {
            const text = String(value ?? '');
            return `"${text.replace(/"/g, '""')}"`;
        };

        const csv = [
            headers,
            ...rows,
        ]
            .map(row => row.map(escapeCsv).join(','))
            .join('\n');

        const blob = new Blob(
            [csv],
            { type: 'text/csv;charset=utf-8;' }
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = `${branch.code}_Branch_Report.csv`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const exportPDF = () => {
        setDownloadLoading(true);
        setTimeout(() => {
            try {
                const doc = new jsPDF();
                
                doc.setFontSize(18);
                doc.text(`${branch.name} (${branch.code}) Requests`, 14, 20);
                
                let filterText = `Status: ${activeStatus} | Type: ${typeFilter}`;
                if (fromDate) filterText += ` | From: ${fromDate}`;
                if (toDate) filterText += ` | To: ${toDate}`;
                
                doc.setFontSize(11);
                doc.text(filterText, 14, 30);
                
                const tableColumn = ["Name", "Roll No", "Type", "Status", "Date"];
                const tableRows = [];
                
                filteredRequests.forEach(request => {
                    tableRows.push([
                        studentName(request),
                        rollNo(request),
                        requestType(request),
                        statusLabel(statusOf(request)),
                        formatDate(request)
                    ]);
                });
                
                autoTable(doc, {
                    head: [tableColumn],
                    body: tableRows,
                    startY: 35,
                    styles: { fontSize: 9 },
                    headStyles: { fillColor: [37, 99, 235] }
                });
                
                doc.save(`${branch.code}_Requests_Report.pdf`);
            } catch (error) {
                console.error('Error generating PDF:', error);
                alert('An error occurred while generating the PDF.');
            } finally {
                setDownloadLoading(false);
                setShowGenerateModal(false);
            }
        }, 300);
    };

    const exportCSV = () => {
        setDownloadLoading(true);
        setTimeout(() => {
            try {
                const exportData = filteredRequests.map((request, idx) => ({
                    'S.No': idx + 1,
                    'Student Name': studentName(request),
                    'Roll Number': rollNo(request),
                    'Year': yearOf(request),
                    'Permission Type': requestType(request),
                    'Status': statusLabel(statusOf(request)),
                    'Date': formatDate(request),
                }));

                const worksheet = XLSX.utils.json_to_sheet(exportData);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, 'Requests');
                
                XLSX.writeFile(workbook, `${branch.code}_Requests_Report.xlsx`);
            } catch (error) {
                console.error('Error generating Excel:', error);
                alert('An error occurred while generating the Excel file.');
            } finally {
                setDownloadLoading(false);
                setShowGenerateModal(false);
            }
        }, 300);
    };

    const countFor = key => {
        if (loading) return '—';

        if (key === 'ALL') {
            return counts.all;
        }

        if (key === 'APPROVED') {
            return counts.approved;
        }

        if (key === 'PENDING') {
            return counts.pending;
        }

        return counts.rejected;
    };

    if (!branch) {
        return (
            <DashboardLayout>
                <div
                    className="card"
                    style={{
                        maxWidth: 600,
                        margin: '70px auto',
                        padding: 40,
                        textAlign: 'center',
                    }}
                >
                    <Building2
                        size={44}
                        color="#64748b"
                    />

                    <h2
                        style={{
                            color: '#0f172a',
                            margin: '15px 0 8px',
                        }}
                    >
                        Branch Not Found
                    </h2>

                    <p
                        style={{
                            color: '#64748b',
                            fontSize: 13,
                            marginBottom: 20,
                        }}
                    >
                        The selected branch does not
                        exist.
                    </p>

                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() =>
                            navigate(
                                '/hod/branches'
                            )
                        }
                    >
                        Back to Branches
                    </button>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div
                style={{
                    minHeight: '100%',
                    paddingBottom: 32,
                }}
            >
                {/* HEADER */}
                <div
                    className="page-header"
                    style={{
                        marginBottom: 18,
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: 16,
                        width: '100%',
                    }}
                >
                    <div>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                            }}
                        >
                            <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={() =>
                                    navigate(
                                        '/hod/branches'
                                    )
                                }
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 7,
                                }}
                            >
                                <ArrowLeft
                                    size={16}
                                />
                                Back
                            </button>

                            <div
                                style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 10,
                                    background: '#ecfdf5',
                                    color: '#10b981',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <Building2
                                    size={23}
                                />
                            </div>

                            <div>
                                <h1
                                    className="page-title"
                                    style={{
                                        margin: 0,
                                    }}
                                >
                                    {branch.code}
                                </h1>

                                <p
                                    className="page-subtitle"
                                    style={{
                                        marginTop: 3,
                                    }}
                                >
                                    {branch.name}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => setShowGenerateModal(true)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 7,
                            }}
                        >
                            <Download size={15} />
                            Export Report
                        </button>
                    </div>
                </div>

                {/* STATUS TABS — same interaction style as Student Requests */}
                <div
                    style={{
                        display: 'flex',
                        gap: 8,
                        borderBottom:
                            '1px solid #e2e8f0',
                        marginBottom: 18,
                        overflowX: 'auto',
                    }}
                >
                    {STATUS_TABS.map(tab => {
                        const active =
                            activeStatus ===
                            tab.key;

                        return (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() =>
                                    changeStatus(
                                        tab.key
                                    )
                                }
                                style={{
                                    border: 'none',
                                    borderBottom:
                                        active
                                            ? '3px solid #10b981'
                                            : '3px solid transparent',
                                    background:
                                        active
                                            ? '#ecfdf5'
                                            : 'transparent',
                                    color: active
                                        ? '#10b981'
                                        : '#64748b',
                                    padding:
                                        '12px 18px',
                                    borderRadius:
                                        '8px 8px 0 0',
                                    fontSize: 13,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    whiteSpace:
                                        'nowrap',
                                }}
                            >
                                {tab.label}

                                <span
                                    style={{
                                        marginLeft: 7,
                                    }}
                                >
                                    ({countFor(
                                        tab.key
                                    )})
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* FILTERS — same pattern as Student Requests */}
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
                        className="branch-request-filter-grid"
                        style={{
                            display: 'grid',
                            gridTemplateColumns:
                                'minmax(240px, 1fr) 170px 150px 150px auto',
                            gap: 10,
                            alignItems: 'center',
                        }}
                    >
                        {/* SEARCH */}
                        <div
                            style={{
                                position: 'relative',
                            }}
                        >
                            <Search
                                size={16}
                                style={{
                                    position:
                                        'absolute',
                                    left: 12,
                                    top: '50%',
                                    transform:
                                        'translateY(-50%)',
                                    color:
                                        '#94a3b8',
                                }}
                            />

                            <input
                                value={search}
                                onChange={e => {
                                    setSearch(
                                        e.target.value
                                    );
                                    setCurrentPage(1);
                                }}
                                placeholder="Search by name or roll number..."
                                style={{
                                    width: '100%',
                                    height: 40,
                                    padding:
                                        '0 12px 0 36px',
                                    border:
                                        '1px solid #e2e8f0',
                                    borderRadius: 8,
                                    outline: 'none',
                                    fontSize: 12,
                                    boxSizing:
                                        'border-box',
                                }}
                            />
                        </div>

                        {/* REQUEST TYPE */}
                        <div
                            ref={typeDropdownRef}
                            style={{
                                position: 'relative',
                                minWidth: '140px',
                            }}
                        >
                            <div
                                onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                                style={{
                                    width: '100%',
                                    height: 40,
                                    padding: '0 34px 0 12px',
                                    border: isTypeDropdownOpen ? '1px solid #10b981' : '1px solid #a7f3d0',
                                    borderRadius: 8,
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: 13,
                                    color: '#059669',
                                    background: '#ecfdf5',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    userSelect: 'none'
                                }}
                            >
                                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {typeFilter === 'ALL' ? 'All Types' :
                                     typeFilter === 'OUTPASS' ? 'Out-Pass' :
                                     typeFilter === 'MESS_FEE' ? 'Mess Fee' :
                                     typeFilter === 'INTERNSHIP' ? 'Internship' :
                                     typeFilter === 'LIBRARY' ? 'Library' : typeFilter}
                                </span>
                                <ChevronDown
                                    size={15}
                                    style={{
                                        position: 'absolute',
                                        right: 11,
                                        top: '50%',
                                        transform: `translateY(-50%) ${isTypeDropdownOpen ? 'rotate(180deg)' : ''}`,
                                        pointerEvents: 'none',
                                        color: '#059669',
                                        transition: 'transform 0.2s ease'
                                    }}
                                />
                            </div>

                            {isTypeDropdownOpen && (
                                <div style={{
                                    position: 'absolute',
                                    top: 'calc(100% + 4px)',
                                    left: 0,
                                    minWidth: '100%',
                                    background: '#ffffff',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: 8,
                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                                    zIndex: 50,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    padding: '4px'
                                }}>
                                    {[
                                        { value: 'ALL', label: 'All Types' },
                                        { value: 'OUTPASS', label: 'Out-Pass' },
                                        { value: 'MESS_FEE', label: 'Mess Fee' },
                                        { value: 'INTERNSHIP', label: 'Internship' },
                                        { value: 'LIBRARY', label: 'Library' }
                                    ].map((opt) => (
                                        <div
                                            key={opt.value}
                                            onClick={() => {
                                                setTypeFilter(opt.value);
                                                setCurrentPage(1);
                                                setIsTypeDropdownOpen(false);
                                            }}
                                            onMouseEnter={(e) => {
                                                if (typeFilter !== opt.value) {
                                                    e.currentTarget.style.background = '#d1fae5';
                                                    e.currentTarget.style.color = '#047857';
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (typeFilter !== opt.value) {
                                                    e.currentTarget.style.background = 'transparent';
                                                    e.currentTarget.style.color = '#0f172a';
                                                }
                                            }}
                                            style={{
                                                padding: '8px 12px',
                                                fontSize: 13,
                                                cursor: 'pointer',
                                                borderRadius: 6,
                                                background: typeFilter === opt.value ? '#10b981' : 'transparent',
                                                color: typeFilter === opt.value ? '#ffffff' : '#0f172a',
                                                fontWeight: typeFilter === opt.value ? 600 : 400,
                                                transition: 'all 0.15s ease',
                                                whiteSpace: 'nowrap'
                                            }}
                                        >
                                            {opt.label}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* FROM DATE */}
                        <DateInput
                            value={fromDate}
                            onChange={value => {
                                setFromDate(value);
                                setCurrentPage(1);
                            }}
                        />

                        {/* TO DATE */}
                        <DateInput
                            value={toDate}
                            onChange={value => {
                                setToDate(value);
                                setCurrentPage(1);
                            }}
                        />

                        {/* CLEAR */}
                        <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={
                                clearFilters
                            }
                            style={{
                                height: 40,
                            }}
                        >
                            Clear
                        </button>
                    </div>
                </div>

                {error && (
                    <div
                        style={{
                            marginBottom: 16,
                            padding:
                                '12px 14px',
                            borderRadius: 8,
                            background:
                                '#fef2f2',
                            color: '#b91c1c',
                            border:
                                '1px solid #fecaca',
                            fontSize: 12,
                        }}
                    >
                        {error}
                    </div>
                )}

                {/* SMALL BRANCH CONTEXT — not a KPI card */}
                <div
                    style={{
                        marginBottom: 12,
                        padding:
                            '11px 14px',
                        background: '#f8fafc',
                        border:
                            '1px solid #e2e8f0',
                        borderRadius: 8,
                        display: 'flex',
                        alignItems:
                            'center',
                        justifyContent:
                            'space-between',
                        gap: 12,
                        flexWrap: 'wrap',
                        fontSize: 12,
                        color: '#64748b',
                    }}
                >
                    <span>
                        Showing only{' '}
                        <strong
                            style={{
                                color: '#172554',
                            }}
                        >
                            {branch.code}
                        </strong>{' '}
                        requests
                    </span>

                    <span>
                        {loading
                            ? 'Loading...'
                            : `${filteredRequests.length} request${filteredRequests.length === 1 ? '' : 's'}`}
                    </span>
                </div>

                {/* TABLE */}
                <div
                    className="card"
                    style={{
                        padding: 0,
                        overflow: 'hidden',
                    }}
                >
                    <div
                        style={{
                            padding:
                                '16px 18px',
                            borderBottom:
                                '1px solid #e2e8f0',
                            display: 'flex',
                            alignItems:
                                'center',
                            gap: 9,
                        }}
                    >
                        <div
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: 8,
                                background:
                                    '#ecfdf5',
                                color: '#10b981',
                                display:
                                    'flex',
                                alignItems:
                                    'center',
                                justifyContent:
                                    'center',
                            }}
                        >
                            <ClipboardList
                                size={16}
                            />
                        </div>

                        <div>
                            <div
                                style={{
                                    fontSize: 14,
                                    fontWeight: 800,
                                    color: '#172554',
                                }}
                            >
                                {branch.code} ·{' '}
                                {
                                    STATUS_TABS.find(
                                        tab =>
                                            tab.key ===
                                            activeStatus
                                    )?.label
                                }
                            </div>

                            <div
                                style={{
                                    marginTop: 2,
                                    fontSize: 11,
                                    color: '#64748b',
                                }}
                            >
                                {loading
                                    ? 'Loading requests...'
                                    : `${filteredRequests.length} request${filteredRequests.length === 1 ? '' : 's'}`}
                            </div>
                        </div>
                    </div>

                    <div
                        style={{
                            width: '100%',
                            overflowX:
                                'auto',
                        }}
                    >
                        <table
                            style={{
                                width: '100%',
                                minWidth: 900,
                                borderCollapse:
                                    'collapse',
                            }}
                        >
                            <thead>
                                <tr
                                    style={{
                                        background:
                                            '#f8fafc',
                                    }}
                                >
                                    {[
                                        '#',
                                        'Student',
                                        'Roll No',
                                        'Year',
                                        'Request Type',
                                        'Date',
                                        'Status',
                                        'Action',
                                    ].map(
                                        header => (
                                            <th
                                                key={
                                                    header
                                                }
                                                style={{
                                                    padding:
                                                        '11px 12px',
                                                    textAlign:
                                                        'left',
                                                    fontSize:
                                                        10,
                                                    fontWeight:
                                                        800,
                                                    color:
                                                        '#64748b',
                                                    textTransform:
                                                        'uppercase',
                                                    whiteSpace:
                                                        'nowrap',
                                                    borderBottom:
                                                        '1px solid #e2e8f0',
                                                }}
                                            >
                                                {
                                                    header
                                                }
                                            </th>
                                        )
                                    )}
                                </tr>
                            </thead>

                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td
                                            colSpan={
                                                8
                                            }
                                            style={{
                                                padding:
                                                    40,
                                                textAlign:
                                                    'center',
                                                color:
                                                    '#94a3b8',
                                                fontSize:
                                                    12,
                                            }}
                                        >
                                            Loading{' '}
                                            {
                                                branch.code
                                            }{' '}
                                            requests...
                                        </td>
                                    </tr>
                                ) : pageRequests.length ===
                                    0 ? (
                                    <tr>
                                        <td
                                            colSpan={
                                                8
                                            }
                                            style={{
                                                padding:
                                                    52,
                                                textAlign:
                                                    'center',
                                                color:
                                                    '#64748b',
                                                fontSize:
                                                    12,
                                            }}
                                        >
                                            No requests
                                            found for
                                            the selected
                                            filters.
                                        </td>
                                    </tr>
                                ) : (
                                    pageRequests.map(
                                        (
                                            request,
                                            index
                                        ) => {
                                            const status =
                                                statusOf(
                                                    request
                                                );

                                            // Compute clean Reference ID
                                            const refId = (request?.referenceId || `KDP-${new Date(request?.createdAt).getFullYear()}-${(request?._id || '').toString().slice(-6).toUpperCase()}`).replace(/^PERM-/i, 'KDP-');

                                            return (
                                                <tr
                                                    key={
                                                        request?._id ||
                                                        request?.id ||
                                                        `${index}-${rollNo(request)}`
                                                    }
                                                    style={{
                                                        borderBottom:
                                                            '1px solid #f1f5f9',
                                                    }}
                                                >
                                                    <Cell>
                                                        {(currentPage -
                                                            1) *
                                                            PAGE_SIZE +
                                                            index +
                                                            1}
                                                    </Cell>

                                                    <Cell
                                                        bold
                                                    >
                                                        {studentName(
                                                            request
                                                        )}
                                                    </Cell>

                                                    <Cell>
                                                        {rollNo(
                                                            request
                                                        )}
                                                    </Cell>

                                                    <Cell>
                                                        {yearOf(
                                                            request
                                                        )}
                                                    </Cell>

                                                    <Cell>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                            <span>{requestType(request)}</span>
                                                            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500, fontFamily: 'monospace' }}>
                                                                Ref: {refId || 'N/A'}
                                                            </span>
                                                        </div>
                                                    </Cell>

                                                    <Cell>
                                                        {formatDate(
                                                            request
                                                        )}
                                                    </Cell>

                                                    <td
                                                        style={{
                                                            padding: 12,
                                                        }}
                                                    >
                                                        <span
                                                            style={{
                                                                ...statusStyle(
                                                                    status
                                                                ),
                                                                display:
                                                                    'inline-flex',
                                                                alignItems:
                                                                    'center',
                                                                padding:
                                                                    '5px 9px',
                                                                borderRadius:
                                                                    999,
                                                                fontSize:
                                                                    10,
                                                                fontWeight:
                                                                    800,
                                                                whiteSpace:
                                                                    'nowrap',
                                                            }}
                                                        >
                                                            {statusLabel(
                                                                status
                                                            )}
                                                        </span>
                                                    </td>

                                                    <td
                                                        style={{
                                                            padding: 12,
                                                        }}
                                                    >
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                navigate(`/outpass/${getRequestId(request)}?mode=approval`)
                                                            }
                                                            style={{
                                                                height: 32,
                                                                padding:
                                                                    '0 12px',
                                                                border:
                                                                    '1px solid #d1fae5',
                                                                borderRadius:
                                                                    50,
                                                                background:
                                                                    '#f0fdf4',
                                                                color:
                                                                    '#16a34a',
                                                                fontSize:
                                                                    11,
                                                                fontWeight:
                                                                    700,
                                                                cursor:
                                                                    'pointer',
                                                                display:
                                                                    'inline-flex',
                                                                alignItems:
                                                                    'center',
                                                                gap: 5,
                                                            }}
                                                        >
                                                            <Eye
                                                                size={
                                                                    14
                                                                }
                                                            />
                                                            Review
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        }
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>

                    {!loading &&
                        filteredRequests.length >
                        0 && (
                            <div
                                style={{
                                    padding:
                                        '13px 16px',
                                    borderTop:
                                        '1px solid #e2e8f0',
                                    display:
                                        'flex',
                                    alignItems:
                                        'center',
                                    justifyContent:
                                        'space-between',
                                    gap: 12,
                                    flexWrap:
                                        'wrap',
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 11,
                                        color:
                                            '#64748b',
                                    }}
                                >
                                    Showing{' '}
                                    <strong>
                                        {(currentPage -
                                            1) *
                                            PAGE_SIZE +
                                            1}
                                    </strong>{' '}
                                    to{' '}
                                    <strong>
                                        {Math.min(
                                            currentPage *
                                            PAGE_SIZE,
                                            filteredRequests.length
                                        )}
                                    </strong>{' '}
                                    of{' '}
                                    <strong>
                                        {
                                            filteredRequests.length
                                        }
                                    </strong>{' '}
                                    requests
                                </div>

                                <div
                                    style={{
                                        display:
                                            'flex',
                                        gap: 5,
                                    }}
                                >
                                    <PageButton
                                        disabled={
                                            currentPage ===
                                            1
                                        }
                                        onClick={() =>
                                            setCurrentPage(
                                                page =>
                                                    Math.max(
                                                        1,
                                                        page -
                                                        1
                                                    )
                                            )
                                        }
                                    >
                                        <ChevronLeft
                                            size={
                                                15
                                            }
                                        />
                                    </PageButton>

                                    {Array.from(
                                        {
                                            length: Math.min(
                                                totalPages,
                                                7
                                            ),
                                        },
                                        (
                                            _,
                                            index
                                        ) =>
                                            index +
                                            1
                                    ).map(
                                        page => (
                                            <PageButton
                                                key={
                                                    page
                                                }
                                                active={
                                                    page ===
                                                    currentPage
                                                }
                                                onClick={() =>
                                                    setCurrentPage(
                                                        page
                                                    )
                                                }
                                            >
                                                {
                                                    page
                                                }
                                            </PageButton>
                                        )
                                    )}

                                    <PageButton
                                        disabled={
                                            currentPage ===
                                            totalPages
                                        }
                                        onClick={() =>
                                            setCurrentPage(
                                                page =>
                                                    Math.min(
                                                        totalPages,
                                                        page +
                                                        1
                                                    )
                                            )
                                        }
                                    >
                                        <ChevronRight
                                            size={
                                                15
                                            }
                                        />
                                    </PageButton>
                                </div>
                            </div>
                        )}
                </div>
            </div>

            <style>{`
                @keyframes spin {
                    from {
                        transform: rotate(0deg);
                    }
                    to {
                        transform: rotate(360deg);
                    }
                }

                .branch-request-filter-grid input,
                .branch-request-filter-grid select {
                    height: 44px !important;
                    box-sizing: border-box;
                    line-height: 1.2;
                }

                .branch-type-filter:hover {
                    border-color: #10b981 !important;
                }
                .branch-type-filter:focus {
                    border-color: #10b981 !important;
                    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1) !important;
                }

                .branch-request-filter-grid input {
                    padding-top: 0 !important;
                    padding-bottom: 0 !important;
                }

                .branch-request-filter-grid select {
                    display: inline-flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 34px 0 12px !important;
                    appearance: none !important;
                }

                @media (max-width: 1100px) {
                    .branch-request-filter-grid {
                        grid-template-columns:
                            1fr 1fr !important;
                    }
                }

                @media (max-width: 640px) {
                    .branch-request-filter-grid {
                        grid-template-columns:
                            1fr !important;
                    }
                }
            `}</style>
            
            {/* GENERATE REPORT MODAL */}
            {showGenerateModal && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(15, 23, 42, 0.4)',
                        backdropFilter: 'blur(4px)',
                        zIndex: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 20,
                    }}
                >
                    <div
                        style={{
                            background: '#fff',
                            borderRadius: 16,
                            width: '100%',
                            maxWidth: 480,
                            boxShadow:
                                '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                            overflow: 'hidden',
                            animation: 'slideUp 0.3s ease-out',
                        }}
                    >
                        <div
                            style={{
                                padding: '20px 24px',
                                borderBottom: '1px solid #f1f5f9',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                            }}
                        >
                            <h2
                                style={{
                                    margin: 0,
                                    fontSize: 18,
                                    color: '#0f172a',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                }}
                            >
                                <Download size={20} color="#10b981" />
                                Export Report
                            </h2>
                            <button
                                onClick={() => setShowGenerateModal(false)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#94a3b8',
                                    cursor: 'pointer',
                                    padding: 4,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: 6,
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ padding: 24 }}>
                            <div
                                style={{
                                    background: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: 12,
                                    padding: 16,
                                    marginBottom: 24,
                                }}
                            >
                                <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#64748b', fontSize: 13, fontWeight: 500 }}>Report Period:</span>
                                    <span style={{ color: '#0f172a', fontSize: 13, fontWeight: 600 }}>
                                        {fromDate && toDate ? `${fromDate} to ${toDate}` : fromDate ? `From ${fromDate}` : toDate ? `Up to ${toDate}` : 'All Time'}
                                    </span>
                                </div>
                                <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#64748b', fontSize: 13, fontWeight: 500 }}>Branch:</span>
                                    <span style={{ color: '#0f172a', fontSize: 13, fontWeight: 600 }}>{branch.code}</span>
                                </div>
                                <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#64748b', fontSize: 13, fontWeight: 500 }}>Permission Type:</span>
                                    <span style={{ color: '#0f172a', fontSize: 13, fontWeight: 600 }}>{typeFilter === 'ALL' ? 'All Types' : typeFilter}</span>
                                </div>
                                <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#64748b', fontSize: 13, fontWeight: 500 }}>Status:</span>
                                    <span style={{ color: '#0f172a', fontSize: 13, fontWeight: 600 }}>{activeStatus === 'ALL' ? 'All Statuses' : activeStatus}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#64748b', fontSize: 13, fontWeight: 500 }}>Total Requests:</span>
                                    <span style={{ color: '#10b981', fontSize: 14, fontWeight: 700 }}>
                                        {filteredRequests.length}
                                    </span>
                                </div>
                            </div>

                            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>
                                Choose a format to download your report:
                            </p>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <button
                                    className="btn btn-outline"
                                    onClick={exportPDF}
                                    disabled={downloadLoading || filteredRequests.length === 0}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: 8,
                                        padding: '16px 12px',
                                        height: 'auto',
                                        justifyContent: 'center',
                                        borderColor: '#e2e8f0',
                                        color: '#334155',
                                    }}
                                >
                                    {downloadLoading ? (
                                        <RefreshCw size={24} className="spin" color="#64748b" />
                                    ) : (
                                        <FileText size={24} color="#dc2626" />
                                    )}
                                    <span style={{ fontWeight: 600 }}>Download PDF</span>
                                </button>
                                
                                <button
                                    className="btn btn-outline"
                                    onClick={exportCSV}
                                    disabled={downloadLoading || filteredRequests.length === 0}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: 8,
                                        padding: '16px 12px',
                                        height: 'auto',
                                        justifyContent: 'center',
                                        borderColor: '#e2e8f0',
                                        color: '#334155',
                                    }}
                                >
                                    {downloadLoading ? (
                                        <RefreshCw size={24} className="spin" color="#64748b" />
                                    ) : (
                                        <FileSpreadsheet size={24} color="#16a34a" />
                                    )}
                                    <span style={{ fontWeight: 600 }}>Download Excel</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}

function DateInput({ value, onChange }) {
    return (
        <div
            style={{
                position: 'relative',
            }}
        >
            <CalendarDays
                size={15}
                style={{
                    position:
                        'absolute',
                    left: 11,
                    top: '50%',
                    transform:
                        'translateY(-50%)',
                    color:
                        '#94a3b8',
                    pointerEvents:
                        'none',
                }}
            />

            <input
                type="date"
                value={value}
                onChange={e =>
                    onChange(
                        e.target.value
                    )
                }
                style={{
                    width: '100%',
                    height: 40,
                    padding:
                        '0 10px 0 34px',
                    border:
                        '1px solid #e2e8f0',
                    borderRadius: 8,
                    outline: 'none',
                    fontSize: 11,
                    color: '#475569',
                    background:
                        '#fff',
                    boxSizing:
                        'border-box',
                }}
            />
        </div>
    );
}

function Cell({
    children,
    bold = false,
}) {
    return (
        <td
            style={{
                padding: 12,
                fontSize: 12,
                color: bold
                    ? '#172554'
                    : '#475569',
                fontWeight: bold
                    ? 700
                    : 400,
                whiteSpace:
                    'nowrap',
            }}
        >
            {children}
        </td>
    );
}

function PageButton({
    children,
    active = false,
    disabled = false,
    onClick,
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            style={{
                minWidth: 32,
                height: 32,
                padding: '0 8px',
                border: active
                    ? '1px solid #10b981'
                    : '1px solid #e2e8f0',
                borderRadius: 7,
                background: active
                    ? '#10b981'
                    : '#fff',
                color: active
                    ? '#fff'
                    : disabled
                        ? '#cbd5e1'
                        : '#475569',
                fontSize: 11,
                fontWeight: 700,
                cursor: disabled
                    ? 'not-allowed'
                    : 'pointer',
                display: 'flex',
                alignItems:
                    'center',
                justifyContent:
                    'center',
            }}
        >
            {children}
        </button>
    );
}
