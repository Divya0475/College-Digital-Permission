import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import StatusBadge from '../components/StatusBadge';
import api from '../lib/api';
import { formatDate, formatDuration, formatTime12, getOrdinalYear } from '../lib/utils';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import {
  ArrowLeft,
  QrCode,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  User,
  Building,
  Home,
  FileText,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Receipt,
  Briefcase,
  BookOpen,
  DollarSign,
  IndianRupee,
  MapPin,
  Laptop,
  Paperclip,
  Printer,
  Edit3,
  UploadCloud,
  Check,
  Trash2,
  X,
  Phone
} from 'lucide-react';

const ROLE_STEP_LABELS = {
  CTPO: 'CTPO Verification',
  HOD: 'HOD Authorization',
  HOSTEL_INCHARGE: 'Hostel Warden Clearance',
  PLACEMENT_OFFICER: 'Placement Officer Authorization',
  SECURITY: 'Campus Gate Security Checkout',
  STUDENT: 'Student Resubmission'
};

function getWorkflowChain(request) {
  const type = request.requestType || 'OUTPASS';
  if (type === 'MESS_FEE') return ['CTPO', 'HOD'];
  if (type === 'INTERNSHIP') return ['CTPO', 'HOD', 'PLACEMENT_OFFICER'];
  if (type === 'LIBRARY') return ['CTPO'];
  // OUTPASS:
  return ['CTPO', 'HOD'];
}


/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   ATTACHED DOCUMENT URL
   Uploaded files are served by the backend, not the Vite frontend.
   This converts a relative file URL such as /uploads/file.jpg
   into the backend URL such as http://localhost:5000/uploads/file.jpg.
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const getDocumentUrl = (documentUrl) => {
  if (!documentUrl) return '';

  // If the backend already returned a complete URL, use it directly.
  if (/^(https?:|data:|blob:)/i.test(documentUrl)) {
    return documentUrl;
  }

  // Use the Axios backend URL when available.
  // If it ends in /api, remove that suffix because uploaded files
  // are served from the backend root (/uploads/...).
  let backendBaseUrl = api?.defaults?.baseURL || '';

  if (backendBaseUrl) {
    backendBaseUrl = backendBaseUrl.replace(/\/api\/?$/, '');
  }

  // Fallback for the current local development setup.
  if (!backendBaseUrl) {
    backendBaseUrl = `${window.location.protocol}//${window.location.hostname}:5000`;
  }

  const path = documentUrl.startsWith('/')
    ? documentUrl
    : `/${documentUrl}`;

  return `${backendBaseUrl}${path}`;
};

function Timeline({ steps, status, request }) {
  const chain = getWorkflowChain(request);

  return (
    <div className="timeline">
      {chain.map((role, i) => {
        const step = steps.find(s => s.role === role);
        const pendingStatus = `PENDING_${role}`;
        const isPending = status === pendingStatus;
        const isWaiting = !step && !isPending;
        const dotClass = step
          ? (step.decision === 'APPROVED' ? 'approved' : 'rejected')
          : isPending ? 'pending' : 'waiting';

        return (
          <div className="timeline-item" key={role}>
            <div className="timeline-line">
              <div className={`timeline-dot ${dotClass}`} />
              {i < chain.length - 1 && <div className="timeline-connector" />}
            </div>
            <div className="timeline-content">
              <div className="timeline-role" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{ROLE_STEP_LABELS[role]}</span>
                {isPending && (
                  <span style={{
                    fontSize: 11,
                    color: 'var(--yellow)',
                    background: 'var(--yellow-dim)',
                    padding: '2px 8px',
                    borderRadius: '20px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <Clock size={11} /> Awaiting Decision
                  </span>
                )}
                {isWaiting && !step && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Waiting in queue</span>
                )}
              </div>
              {step && (
                <div style={{ marginTop: '4px' }}>
                  <div className="timeline-meta" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                    {step.decision === 'APPROVED' ? (
                      <span style={{ color: 'var(--green)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                        <CheckCircle2 size={13} /> Approved
                      </span>
                    ) : (
                      <span style={{ color: 'var(--red)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                        <XCircle size={13} /> Rejected
                      </span>
                    )}
                    <span>by <strong>{step.approverUserId?.name || 'Authorized Staff'}</strong></span>
                    <span>&middot;</span>
                    <span>{new Date(step.decidedAt).toLocaleString('en-IN')}</span>
                  </div>
                  {step.remarks && (
                    <div className="timeline-remarks" style={{ marginTop: '6px', fontStyle: 'italic', background: '#f8fafc', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      "{step.remarks}"
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function RequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qrImage, setQrImage] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);

  // Approver Approval State
  const [approverRemarks, setApproverRemarks] = useState('');
  const [approverActionLoading, setApproverActionLoading] = useState(false);
  const [approverActionError, setApproverActionError] = useState('');
  const [rejectModalOpen, setRejectModalOpen] = useState(false);

  // Edit & Resubmit Modal State
  const [resubmitModalOpen, setResubmitModalOpen] = useState(false);
  const [resubmitForm, setResubmitForm] = useState({});
  const [resubmitting, setResubmitting] = useState(false);
  const [resubmitError, setResubmitError] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Document View Modal State
  const [documentModalOpen, setDocumentModalOpen] = useState(false);

  // Official Document View / Print Modal State
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const printRef = useRef();

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get(`/outpass/${id}`);
      setData(res.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchQR = useCallback(async () => {
    setQrLoading(true);
    try {
      const res = await api.get(`/outpass/${id}/qr`);
      setQrImage(res.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setQrLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (data?.request?.status === 'ISSUED' && !qrImage) {
      fetchQR();
    }
  }, [data?.request?.status, qrImage, fetchQR]);

  const handleOpenResubmit = () => {
    const req = data.request;
    setResubmitForm({
      reason: req.reason || '',
      outDate: req.outDate ? new Date(req.outDate).toISOString().split('T')[0] : '',
      outTime: req.outTime || '17:00',
      expectedReturnDate: req.expectedReturnDate ? new Date(req.expectedReturnDate).toISOString().split('T')[0] : '',
      emergencyContact: req.emergencyContact || '',
      startDate: req.startDate ? new Date(req.startDate).toISOString().split('T')[0] : '',
      endDate: req.endDate ? new Date(req.endDate).toISOString().split('T')[0] : '',
      messAmount: req.messAmount ?? '',
      paidStatus: req.paidStatus || 'Paid',
      companyName: req.companyName || '',
      companyLocation: req.companyLocation || '',
      role: req.role || '',
      internshipMode: req.internshipMode || 'Offline',
      requestDate: req.requestDate ? new Date(req.requestDate).toISOString().split('T')[0] : '',
      documentUrl: req.documentUrl || '',
      documentName: req.documentName || '',
      resubmitRemarks: ''
    });
    setResubmitError('');
    setResubmitModalOpen(true);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setUploadingDoc(true);
    try {
      const res = await api.post('/outpass/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResubmitForm(f => ({
        ...f,
        documentUrl: res.data.data.fileUrl,
        documentName: res.data.data.fileName
      }));
    } catch (err) {
      setResubmitError(err.response?.data?.message || 'File upload failed');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleResubmitSubmit = async (e) => {
    e.preventDefault();
    setResubmitError('');
    if (reqType === 'MESS_FEE') {
      const amount = Number(resubmitForm.messAmount);
      if (!Number.isFinite(amount) || amount < 0 || amount > 100000) {
        setResubmitError('Mess fee amount must be between ₹0 and ₹1,00,000.');
        return;
      }
    }
    setResubmitting(true);
    try {
      await api.post(`/outpass/${id}/resubmit`, resubmitForm);
      setResubmitModalOpen(false);
      fetchData();
    } catch (err) {
      setResubmitError(err.response?.data?.message || 'Failed to resubmit request');
    } finally {
      setResubmitting(false);
    }
  };

  // Approver Approve
  const handleApproverApprove = async () => {
    setApproverActionError('');
    setApproverActionLoading(true);

    try {
      await api.post(`/outpass/${id}/approve`, {
        remarks: 'Approved'
      });

      await fetchData();
      setApproverRemarks('');
      setRejectModalOpen(false);
      toast.success('Request approved successfully');
    } catch (err) {
      setApproverActionError(
        err.response?.data?.message || 'Failed to approve request'
      );
    } finally {
      setApproverActionLoading(false);
    }
  };

  // Approver Reject
  const handleApproverReject = async () => {
    const remarks = approverRemarks.trim();

    if (!remarks) {
      setApproverActionError(
        'Please enter remarks before rejecting the request.'
      );
      return;
    }

    setApproverActionError('');
    setApproverActionLoading(true);

    try {
      await api.post(`/outpass/${id}/reject`, {
        remarks
      });

      await fetchData();
      setApproverRemarks('');
      setRejectModalOpen(false);
      toast.success('Request rejected successfully');
    } catch (err) {
      setApproverActionError(
        err.response?.data?.message || 'Failed to reject request'
      );
    } finally {
      setApproverActionLoading(false);
    }
  };

  const handleDownloadPermissionDocument = () => {
    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 18;
      const contentWidth = pageWidth - margin * 2;
      let y = 20;

      const addHeading = (text) => {
        if (y > pageHeight - 28) {
          doc.addPage();
          y = 20;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        doc.text(text.toUpperCase(), margin, y);
        y += 7;
      };

      const addRow = (label, value) => {
        const wrapped = doc.splitTextToSize(String(value || '-'), contentWidth - 44);
        const rowHeight = Math.max(6, wrapped.length * 5);
        if (y + rowHeight > pageHeight - 18) {
          doc.addPage();
          y = 20;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(71, 85, 105);
        doc.text(`${label}:`, margin, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(15, 23, 42);
        doc.text(wrapped, margin + 44, y);
        y += rowHeight;
      };

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42);
      doc.text('COLLEGE DIGITAL PERMISSION', pageWidth / 2, y, { align: 'center' });
      y += 7;
      doc.setFontSize(12);
      doc.text('& APPROVAL PLATFORM', pageWidth / 2, y, { align: 'center' });
      y += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(`Official Permission Confirmation · ${refId}`, pageWidth / 2, y, { align: 'center' });
      y += 5;
      doc.setDrawColor(148, 163, 184);
      doc.line(margin, y, pageWidth - margin, y);
      y += 10;

      addHeading('Student Information');
      addRow('Name', studentName);
      addRow('Roll Number', rollNo);
      addRow('Department', branchName);
      addRow('Year', yearLabel);
      addRow('Student Type', studentTypeLabel || 'Not specified');
      y += 3;

      addHeading('Permission Information');
      addRow('Permission Type', getPermissionTypeLabel());
      addRow('Status', request.status);
      addRow('Reason / Purpose', request.reason);

      if (reqType === 'OUTPASS') {
        addRow('Out Date', `${formatDate(request.outDate)} at ${formatTime12(request.outTime)}`);
        addRow('Return Date', formatDate(request.expectedReturnDate));
        if (request.emergencyContact) addRow('Emergency Contact', request.emergencyContact);
      } else if (reqType === 'MESS_FEE') {
        addRow('Mess Amount', `₹${Number(request.messAmount || 0).toLocaleString('en-IN')}`);
        addRow('Payment Status', request.paidStatus);
        addRow('Period', formatDuration(request.startDate, request.endDate));
      } else if (reqType === 'INTERNSHIP') {
        addRow('Company', request.companyName);
        addRow('Location', request.companyLocation);
        addRow('Role', request.role);
        addRow('Work Mode', request.internshipMode);
        addRow('Duration', formatDuration(request.startDate, request.endDate));
      } else if (reqType === 'LIBRARY') {
        addRow('Access Date', formatDate(request.requestDate || request.createdAt));
      }
      addRow('Submitted On', formatDate(request.createdAt));
      y += 3;

      addHeading('Approval History');
      const finalizedSteps = (approvalSteps || []).filter(step => step.role !== 'STUDENT');
      if (finalizedSteps.length) {
        finalizedSteps.forEach(step => {
          const decisionDate = step.decidedAt
            ? new Date(step.decidedAt).toLocaleString('en-GB')
            : 'Date not recorded';
          addRow(step.role, `${step.decision || 'Recorded'} · ${decisionDate}`);
        });
      } else {
        addRow('Approval', 'Digitally recorded by the college authority.');
      }

      const qrDataUrl = qrImage?.qrImage;
      if (
        reqType === 'OUTPASS' &&
        typeof qrDataUrl === 'string' &&
        /^data:image\/(png|jpeg);base64,/i.test(qrDataUrl)
      ) {
        y += 3;
        addHeading('Security Verification');
        if (y + 48 > pageHeight - 18) {
          doc.addPage();
          y = 20;
        }
        doc.addImage(qrDataUrl, /^data:image\/jpeg/i.test(qrDataUrl) ? 'JPEG' : 'PNG', margin, y, 42, 42);
        y += 46;
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated ${new Date().toLocaleString('en-GB')}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      const safeReference = String(refId).replace(/[^a-z0-9-]/gi, '-');
      doc.save(`Permission-Confirmation-${safeReference}.pdf`);
    } catch (error) {
      console.error('Failed to generate permission confirmation PDF:', error);
      toast.error('Could not download the permission document. Please try again.');
    }
  };

  if (loading) return (
    <DashboardLayout>
      <div className="loading-screen"><div className="spinner spinner-lg" /></div>
    </DashboardLayout>
  );

  if (!data) return (
    <DashboardLayout>
      <div className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <AlertTriangle size={16} />
        <span>Request not found</span>
      </div>
    </DashboardLayout>
  );

  const { request, approvalSteps } = data;
  const reqType = request.requestType || 'OUTPASS';
  const student = request?.student || request?.studentDetails || request?.studentId || request?.user || request?.applicant || {};
  const studentName = request?.studentName || student?.name || student?.fullName || student?.studentName || 'Unknown Student';
  const rollNo = request?.rollNo || request?.rollNumber || student?.rollNo || student?.rollNumber || '-';
  const branchName = request?.branchName || request?.branchId?.name || student?.branchName || student?.branch?.name || 'CSM';
  const isOwner = user?.role === 'STUDENT' && (request.studentId?._id === user?.id || request.studentId === user?.id || student?._id === user?.id);
  const reasonDisplay = user?.role === 'HOSTEL_INCHARGE'
    ? String(request.reason || '').replace(/(?:\s*[-,;|:]\s*)?\bA\+/g, '').replace(/\s+/g, ' ').trim()
    : request.reason;
  const isApprovedOrIssued = request.status === 'APPROVED' || request.status === 'ISSUED' || request.status === 'USED';

  const isApproverPending =
    (user?.role === 'CTPO' && (request.status === 'PENDING_CTPO' || request.status === 'PENDING CTPO' || request.status === 'PENDING_CTPO_APPROVAL')) ||
    (user?.role === 'HOD' &&
      (request.status === 'PENDING_HOD' ||
        request.status === 'PENDING_HOD_APPROVAL')) ||
    (user?.role === 'HOSTEL_INCHARGE' &&
      request.status === 'PENDING_HOSTEL_INCHARGE') ||
    (user?.role === 'PLACEMENT_OFFICER' &&
      request.requestType === 'INTERNSHIP' &&
      request.status === 'PENDING_PLACEMENT_OFFICER');

  // Approval actions are shown only when the request was opened
  // from a Pending Requests / approval queue using ?mode=approval.
  // Review/history/overview pages remain read-only.
  const isApprovalMode = searchParams.get('mode') === 'approval';
  const showApproverApprovalActions =
    isApproverPending && isApprovalMode;

  const approverTitle =
    user?.role === 'PLACEMENT_OFFICER'
      ? 'Placement Officer Approval'
      : user?.role === 'HOSTEL_INCHARGE'
        ? 'Hostel In-charge Approval'
        : user?.role === 'CTPO'
          ? 'CTPO Approval'
          : 'HOD Approval';

  // Compute clean Reference ID
  const refId = (request.referenceId || `KDP-${new Date(request.createdAt).getFullYear()}-${request._id.toString().slice(-6).toUpperCase()}`).replace(/^PERM-/i, 'KDP-');
  const studentType = String(
    request.studentId?.studentType ||
    request.studentId?.studentCategory ||
    request.studentType ||
    ''
  ).toUpperCase();
  const studentTypeLabel = studentType.includes('HOSTEL')
    ? 'Hosteller'
    : studentType.includes('DAY')
      ? 'Day Scholar'
      : '';
  const yearValue = request.year || request.studentId?.year || request.studentId?.yearTier;
  const yearLabel = getOrdinalYear(yearValue) || yearValue || 'Not specified';

  // Permission type label
  const getPermissionTypeLabel = () => {
    if (reqType === 'OUTPASS') return 'Out-Pass';
    if (reqType === 'MESS_FEE') return 'Mess Fee Clearance';
    if (reqType === 'INTERNSHIP') return 'Internship Permission';
    if (reqType === 'LIBRARY') return 'Library Permission';
    return 'Digital Permission';
  };

  return (
    <DashboardLayout>
      {/* Top Navigation Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate(-1)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
          <div className="page-title" style={{ margin: 0 }}>
            {getPermissionTypeLabel()} Details
          </div>
          <StatusBadge status={request.status} />
        </div>

        {/* Action Button: View Official Slip Modal (Available whenever Approved or Issued) */}
        {isApprovedOrIssued && user?.role !== 'HOD' && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setPrintModalOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Printer size={15} />
            <span>View Official Permission Document</span>
          </button>
        )}
      </div>

      {/* Rejection Alert Banner with Edit & Resubmit Button */}
      {request.status.startsWith('REJECTED') && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: '#ef4444',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <XCircle size={22} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#991b1b' }}>
                Request Rejected by {request.rejectedByRole || 'Approver'}
              </div>
              <div style={{ fontSize: '13px', color: '#b91c1c', marginTop: '2px' }}>
                <strong>Remarks:</strong> {request.rejectionReason || 'Please review required documentation and correct details.'}
              </div>
            </div>
          </div>

          {isOwner && (
            <button
              className="btn btn-primary btn-sm"
              onClick={handleOpenResubmit}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#dc2626', borderColor: '#b91c1c' }}
            >
              <Edit3 size={14} />
              <span>Edit & Resubmit Request</span>
            </button>
          )}
        </div>
      )}

      <div className="request-detail-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '24px' }}>
        {/* Left Column: Permission Details & Attachments */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card">
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '16px', justifyContent: 'flex-start' }}>
              {reqType === 'OUTPASS' && <FileText size={18} color="var(--accent)" />}
              {reqType === 'MESS_FEE' && <Receipt size={18} color="var(--green)" />}
              {reqType === 'INTERNSHIP' && <Briefcase size={18} color="#10b981" />}
              {reqType === 'LIBRARY' && <BookOpen size={18} color="var(--yellow)" />}
              <div className="card-title" style={{ margin: 0 }}>Permission Details</div>
            </div>

            <div style={{ display: 'grid', gap: '14px' }}>
              <Row icon={Sparkles} label="Reference ID" value={<code>{refId}</code>} />
              <Row icon={User} label="Student Name" value={`${studentName} (${rollNo})`} />
              <Row icon={Building} label="Department" value={branchName} />
              <Row icon={Calendar} label="Academic Year" value={yearLabel} />
              {studentTypeLabel && <Row icon={Home} label="Student Type" value={studentTypeLabel} />}
              <Row icon={FileText} label="Reason / Purpose" value={reasonDisplay} />

              {/* OUTPASS specifics */}
              {reqType === 'OUTPASS' && (
                <>
                  <Row icon={Calendar} label="Out Date & Time" value={`${formatDate(request.outDate)} at ${formatTime12(request.outTime)}`} />
                  <Row icon={Clock} label="Return Date" value={formatDate(request.expectedReturnDate)} />
                  {request.expectedReturnTime && request.expectedReturnTime !== '20:00' && (
                    <Row icon={Clock} label="Return Time" value={formatTime12(request.expectedReturnTime)} />
                  )}
                  {request.emergencyContact && (
                    <Row icon={Phone} label="Emergency Contact" value={request.emergencyContact} />
                  )}
                </>
              )}

              {/* MESS_FEE specifics */}
              {reqType === 'MESS_FEE' && (
                <>
                  <Row icon={IndianRupee} label="Mess Amount" value={`₹${Number(request.messAmount || 0).toLocaleString('en-IN')}`} />
                  <Row icon={CheckCircle2} label="Payment Status" value={request.paidStatus} />
                  <Row icon={Calendar} label="Period Range" value={formatDuration(request.startDate, request.endDate)} />
                </>
              )}

              {/* INTERNSHIP specifics */}
              {reqType === 'INTERNSHIP' && (
                <>
                  <Row icon={Building} label="Company Name" value={request.companyName} />
                  <Row icon={MapPin} label="Company Location" value={request.companyLocation} />
                  <Row icon={Briefcase} label="Internship Role" value={request.role} />
                  <Row icon={Laptop} label="Work Mode" value={request.internshipMode} />
                  <Row icon={Calendar} label="Duration" value={formatDuration(request.startDate, request.endDate)} />
                </>
              )}

              {/* LIBRARY specifics */}
              {reqType === 'LIBRARY' && (
                <Row icon={Calendar} label="Access Date" value={formatDate(request.requestDate || request.createdAt)} />
              )}

              {/* Attached Document Row */}
              {request.documentUrl && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                  <span style={{ minWidth: 150, fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Paperclip size={14} color="var(--accent)" />
                    <span>Attached Document</span>
                  </span>
                  <button
                    onClick={() => setDocumentModalOpen(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--accent)',
                      background: 'var(--accent-dim)',
                      border: 'none',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                    title="Open attached document"
                  >
                    <span>{request.documentName || 'View Document'}</span>
                  </button>
                </div>
              )}

              <Row icon={Clock} label="Submitted On" value={new Date(request.createdAt).toLocaleString('en-IN')} />
              {request.resubmitCount > 0 && (
                <Row icon={Sparkles} label="Resubmission Cycle" value={`Cycle #${request.resubmitCount}`} />
              )}
            </div>
          </div>

          {/* QR Code Pass Card for Outpass */}
          {reqType === 'OUTPASS' && request.status === 'ISSUED' && user?.role !== 'CTPO' && user?.role !== 'HOD' && (
            <div className="card" style={{ textAlign: 'center', border: '1px solid var(--green)' }}>
              <div className="card-title" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--green)' }}>
                <QrCode size={20} />
                <span>Authorized Out-Pass QR Code</span>
              </div>
              <div className="alert alert-info" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <ShieldCheck size={16} />
                <span>Show this QR code to the security gate guard upon exit. Only outpass requires security verification.</span>
              </div>
              {qrLoading ? (
                <div className="loading-screen"><div className="spinner spinner-lg" /></div>
              ) : qrImage ? (
                <div className="qr-container" style={{ background: '#fff', padding: '16px', borderRadius: '12px', display: 'inline-block', margin: '0 auto 12px auto' }}>
                  <img src={qrImage.qrImage} alt="Out-pass QR" className="qr-image" style={{ width: 220, height: 220, display: 'block' }} />
                  <div style={{ fontSize: '12px', color: '#1f2937', marginTop: '8px', fontWeight: 600 }}>
                    Token: <code>{qrImage.token.slice(0, 18)}...</code>
                  </div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                    Valid until {new Date(qrImage.expiresAt).toLocaleDateString('en-IN')} 23:59
                  </div>
                </div>
              ) : (
                <button className="btn btn-primary" onClick={fetchQR}>Generate / Load QR Code</button>
              )}
            </div>
          )}

          {reqType === 'OUTPASS' && request.status === 'USED' && (
            <div className="card" style={{ border: '1px solid var(--green)' }}>
              <div className="alert alert-success" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={18} />
                <span>This out-pass has been verified and used at the campus security gate. Exit recorded.</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Approval Timeline */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '20px', justifyContent: 'flex-start' }}>
            <ShieldCheck size={18} color="var(--purple)" />
            <div className="card-title" style={{ margin: 0 }}>Approval Workflow Status</div>
          </div>
          <Timeline
            steps={approvalSteps || []}
            status={request.status}
            request={request}
          />
        </div>
      </div>

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          APPROVAL ACTIONS
      â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {showApproverApprovalActions && (
        <>
          <div
            className="card"
            style={{
              marginTop: '24px',
              border: '1px solid var(--border)'
            }}
          >
            <div
              className="card-header"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '20px'
              }}
            >
              <ShieldCheck size={18} color="var(--purple)" />
              <div className="card-title" style={{ margin: 0 }}>
                {approverTitle}
              </div>
            </div>

            {approverActionError && (
              <div
                className="alert alert-error"
                style={{
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <AlertTriangle size={16} />
                <span>{approverActionError}</span>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '12px',
                width: '100%'
              }}
            >
              {/* APPROVE BUTTON */}
              <button
                type="button"
                className="btn"
                onClick={handleApproverApprove}
                disabled={approverActionLoading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '7px',
                  width: '154px',
                  height: '44px',
                  padding: '0',
                  borderRadius: '8px',
                  background: '#16a34a',
                  color: '#fff',
                  border: '1px solid #16a34a',
                  fontWeight: 700,
                  fontSize: '15px',
                  cursor: approverActionLoading ? 'not-allowed' : 'pointer',
                  opacity: approverActionLoading ? 0.65 : 1
                }}
              >
                {approverActionLoading ? 'Processing...' : 'Approve'}
              </button>

              {/* REJECT BUTTON */}
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setApproverRemarks('');
                  setApproverActionError('');
                  setRejectModalOpen(true);
                }}
                disabled={approverActionLoading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '7px',
                  width: '154px',
                  height: '44px',
                  padding: '0',
                  borderRadius: '8px',
                  background: '#dc2626',
                  color: '#fff',
                  border: '1px solid #dc2626',
                  fontWeight: 700,
                  fontSize: '15px',
                  cursor: approverActionLoading ? 'not-allowed' : 'pointer',
                  opacity: approverActionLoading ? 0.65 : 1
                }}
              >
                Reject
              </button>
            </div>
          </div>

          {/* Reject Remarks Popup */}
          {rejectModalOpen && (
            <div
              className="modal-overlay"
              onClick={(e) => {
                if (e.target === e.currentTarget && !approverActionLoading) {
                  setRejectModalOpen(false);
                  setApproverRemarks('');
                  setApproverActionError('');
                }
              }}
              style={{
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <div
                className="modal"
                style={{
                  width: 'min(520px, calc(100vw - 32px))',
                  maxWidth: '520px',
                  padding: '24px',
                  borderRadius: '14px'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '18px'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}
                  >
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        background: '#fee2e2',
                        color: '#dc2626',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <XCircle size={20} />
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: '16px',
                          fontWeight: 700,
                          color: 'var(--text-primary)'
                        }}
                      >
                        Reject Request
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'var(--text-muted)',
                          marginTop: '2px'
                        }}
                      >
                        Enter a reason before rejecting this request.
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (approverActionLoading) return;
                      setRejectModalOpen(false);
                      setApproverRemarks('');
                      setApproverActionError('');
                    }}
                    disabled={approverActionLoading}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: approverActionLoading ? 'not-allowed' : 'pointer',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '4px'
                    }}
                    aria-label="Close"
                  >
                    <X size={20} />
                  </button>
                </div>

                {approverActionError && (
                  <div
                    className="alert alert-error"
                    style={{
                      marginBottom: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <AlertTriangle size={16} />
                    <span>{approverActionError}</span>
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label className="form-label">
                    Rejection Remarks <span style={{ color: '#dc2626' }}>*</span>
                  </label>

                  <textarea
                    className="form-input"
                    rows={5}
                    autoFocus
                    placeholder="Enter reason for rejecting this request..."
                    value={approverRemarks}
                    onChange={(e) => {
                      setApproverRemarks(e.target.value);
                      setApproverActionError('');
                    }}
                    disabled={approverActionLoading}
                    style={{
                      resize: 'vertical',
                      minHeight: '120px'
                    }}
                  />
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '10px'
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      if (approverActionLoading) return;
                      setRejectModalOpen(false);
                      setApproverRemarks('');
                      setApproverActionError('');
                    }}
                    disabled={approverActionLoading}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="btn"
                    onClick={handleApproverReject}
                    disabled={approverActionLoading}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      background: '#dc2626',
                      color: '#fff',
                      border: '1px solid #dc2626',
                      minWidth: '135px'
                    }}
                  >
                    {approverActionLoading ? 'Rejecting...' : 'Confirm Reject'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      {/* â”€â”€â”€ Edit & Resubmit Modal â”€â”€â”€ */}
      {resubmitModalOpen && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setResubmitModalOpen(false)}>
          <div className="modal" style={{ maxWidth: '540px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <Edit3 size={18} color="var(--accent)" />
                <span>Edit & Resubmit Request</span>
              </div>
              <button
                type="button"
                onClick={() => setResubmitModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {resubmitError && (
              <div className="alert alert-error" style={{ marginBottom: '14px', fontSize: '13px' }}>
                {resubmitError}
              </div>
            )}

            <form onSubmit={handleResubmitSubmit}>
              {/* Feature 1: OUTPASS */}
              {reqType === 'OUTPASS' && (
                <>
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">Reason</label>
                    <textarea
                      required
                      rows={2}
                      className="form-input"
                      value={resubmitForm.reason}
                      onChange={e => setResubmitForm(f => ({ ...f, reason: e.target.value }))}
                    />
                  </div>
                  <div className="form-grid" style={{ marginBottom: '12px' }}>
                    <div className="form-group">
                      <label className="form-label">Out Date</label>
                      <input
                        type="date"
                        required
                        className="form-input"
                        value={resubmitForm.outDate}
                        onChange={e => setResubmitForm(f => ({ ...f, outDate: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Out Time</label>
                      <input
                        type="time"
                        required
                        className="form-input"
                        value={resubmitForm.outTime}
                        onChange={e => setResubmitForm(f => ({ ...f, outTime: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">Return Date</label>
                    <input
                      type="date"
                      required
                      className="form-input"
                      value={resubmitForm.expectedReturnDate}
                      onChange={e => setResubmitForm(f => ({ ...f, expectedReturnDate: e.target.value }))}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">Emergency Contact Number</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 9392393340"
                      value={resubmitForm.emergencyContact}
                      onChange={e => setResubmitForm(f => ({ ...f, emergencyContact: e.target.value }))}
                    />
                  </div>
                </>
              )}

              {/* Feature 2: MESS_FEE */}
              {reqType === 'MESS_FEE' && (
                <>
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">Clearance Reason</label>
                    <textarea
                      required
                      rows={2}
                      className="form-input"
                      value={resubmitForm.reason}
                      onChange={e => setResubmitForm(f => ({ ...f, reason: e.target.value }))}
                    />
                  </div>
                  <div className="form-grid" style={{ marginBottom: '12px' }}>
                    <div className="form-group">
                      <label className="form-label">Mess Amount (â‚¹)</label>
                      <input
                        type="number"
                        required
                        min="0"
                        max="100000"
                        step="100"
                        className="form-input"
                        value={resubmitForm.messAmount}
                        onChange={e => setResubmitForm(f => ({ ...f, messAmount: e.target.value }))}
                      />
                      <small style={{ display: 'block', marginTop: 5, color: '#64748b' }}>
                        Maximum allowed: ₹1,00,000
                      </small>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Payment Status</label>
                      <select
                        className="form-input"
                        value={resubmitForm.paidStatus}
                        onChange={e => setResubmitForm(f => ({ ...f, paidStatus: e.target.value }))}
                      >
                        <option value="Paid">Paid</option>
                        <option value="Partially Paid">Partially Paid</option>
                        <option value="Not Paid">Not Paid</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-grid" style={{ marginBottom: '12px' }}>
                    <div className="form-group">
                      <label className="form-label">Start Date</label>
                      <input
                        type="date"
                        required
                        className="form-input"
                        value={resubmitForm.startDate}
                        onChange={e => setResubmitForm(f => ({ ...f, startDate: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">End Date</label>
                      <input
                        type="date"
                        required
                        className="form-input"
                        value={resubmitForm.endDate}
                        onChange={e => setResubmitForm(f => ({ ...f, endDate: e.target.value }))}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Feature 3: INTERNSHIP */}
              {reqType === 'INTERNSHIP' && (
                <>
                  <div className="form-grid" style={{ marginBottom: '12px' }}>
                    <div className="form-group">
                      <label className="form-label">Company Name</label>
                      <input
                        type="text"
                        required
                        className="form-input"
                        value={resubmitForm.companyName}
                        onChange={e => setResubmitForm(f => ({ ...f, companyName: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Company Location</label>
                      <input
                        type="text"
                        required
                        className="form-input"
                        value={resubmitForm.companyLocation}
                        onChange={e => setResubmitForm(f => ({ ...f, companyLocation: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="form-grid" style={{ marginBottom: '12px' }}>
                    <div className="form-group">
                      <label className="form-label">Role</label>
                      <input
                        type="text"
                        required
                        className="form-input"
                        value={resubmitForm.role}
                        onChange={e => setResubmitForm(f => ({ ...f, role: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Mode</label>
                      <select
                        className="form-input"
                        value={resubmitForm.internshipMode}
                        onChange={e => setResubmitForm(f => ({ ...f, internshipMode: e.target.value }))}
                      >
                        <option value="Offline">Offline</option>
                        <option value="Online">Online</option>
                        <option value="Hybrid">Hybrid</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-grid" style={{ marginBottom: '12px' }}>
                    <div className="form-group">
                      <label className="form-label">Start Date</label>
                      <input
                        type="date"
                        required
                        className="form-input"
                        value={resubmitForm.startDate}
                        onChange={e => setResubmitForm(f => ({ ...f, startDate: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">End Date</label>
                      <input
                        type="date"
                        required
                        className="form-input"
                        value={resubmitForm.endDate}
                        onChange={e => setResubmitForm(f => ({ ...f, endDate: e.target.value }))}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Feature 4: LIBRARY */}
              {reqType === 'LIBRARY' && (
                <>
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">Purpose / Reason</label>
                    <textarea
                      required
                      rows={2}
                      className="form-input"
                      value={resubmitForm.reason}
                      onChange={e => setResubmitForm(f => ({ ...f, reason: e.target.value }))}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">Access Date</label>
                    <input
                      type="date"
                      required
                      className="form-input"
                      value={resubmitForm.requestDate}
                      onChange={e => setResubmitForm(f => ({ ...f, requestDate: e.target.value }))}
                    />
                  </div>
                </>
              )}

              {/* Document upload during resubmission */}
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">Supporting Document (Optional)</label>
                {resubmitForm.documentUrl ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '12px' }}>{resubmitForm.documentName || 'Document attached'}</span>
                    <button type="button" onClick={() => setResubmitForm(f => ({ ...f, documentUrl: '', documentName: '' }))} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ) : (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', borderRadius: '6px', border: '1px dashed var(--border)', cursor: 'pointer', fontSize: '12px' }}>
                    <input type="file" style={{ display: 'none' }} onChange={handleFileUpload} />
                    <UploadCloud size={16} />
                    <span>{uploadingDoc ? 'Uploading...' : 'Attach updated proof / receipt'}</span>
                  </label>
                )}
              </div>

              {/* Resubmission Remarks */}
              <div className="form-group" style={{ marginBottom: '18px' }}>
                <label className="form-label">Note to Approver</label>
                <input
                  type="text"
                  placeholder="e.g. Attached receipt with correct dates and updated parent contact."
                  className="form-input"
                  value={resubmitForm.resubmitRemarks}
                  onChange={e => setResubmitForm(f => ({ ...f, resubmitRemarks: e.target.value }))}
                />
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setResubmitModalOpen(false)}>Cancel</button>
                <button type="submit" disabled={resubmitting || uploadingDoc} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  {resubmitting ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <Check size={14} />}
                  <span>Resubmit to CTPO</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* â”€â”€â”€ Official Digital Permission Document Modal (Exact Replica of Sample) â”€â”€â”€ */}
      {printModalOpen && (
        createPortal(
        <div className="modal-overlay permission-slip-overlay" onClick={(e) => e.target === e.currentTarget && setPrintModalOpen(false)}>
          <div className="modal permission-slip-modal" style={{ maxWidth: '640px', maxHeight: '90vh', overflow: 'hidden', padding: '24px', background: '#ffffff', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Printer size={18} color="var(--accent)" />
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Official Digital Permission Slip
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPrintModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Printable Document Sheet matching user's exact uploaded sample */}
            <div ref={printRef} className="official-permission-doc permission-slip-document" style={{
              background: '#ffffff',
              border: '1.5px solid #0f172a',
              borderRadius: '6px',
              padding: '28px 32px',
              maxHeight: 'calc(90vh - 150px)',
              overflowY: 'auto',
              color: '#0f172a',
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
            }}>
              {/* Header Title */}
              <div style={{ textAlign: 'center', marginBottom: '14px' }}>
                <div style={{ fontSize: '17px', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', lineHeight: 1.3 }}>
                  COLLEGE DIGITAL PERMISSION<br />& APPROVAL PLATFORM
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginTop: '8px' }}>
                  Reference ID: {refId}
                </div>
              </div>

              <div style={{ borderBottom: '1.5px solid #0f172a', margin: '14px 0' }} />

              {/* Student Information Section */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' }}>
                  STUDENT INFORMATION
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '4px', fontSize: '13px', lineHeight: 1.5 }}>
                  <div><strong>Name:</strong> {studentName}</div>
                  <div><strong>Roll Number:</strong> {rollNo}</div>
                  <div><strong>Department:</strong> {branchName}</div>
                  <div><strong>Year:</strong> {yearLabel}</div>
                  <div><strong>Student Type:</strong> {studentTypeLabel || 'Not specified'}</div>
                </div>
              </div>

              <div style={{ borderBottom: '1.5px solid #0f172a', margin: '14px 0' }} />

              {/* Permission Information Section */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' }}>
                  PERMISSION INFORMATION
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '4px', fontSize: '13px', lineHeight: 1.5 }}>
                  <div><strong>Permission Type:</strong> {getPermissionTypeLabel()}</div>
                  <div><strong>Reason:</strong> {request.reason}</div>

                  {reqType === 'OUTPASS' && (
                    <>
                      <div><strong>Date:</strong> {formatDate(request.outDate)} at {formatTime12(request.outTime)}{request.expectedReturnTime && request.expectedReturnTime !== '20:00' ? ` to ${formatTime12(request.expectedReturnTime)}` : ''}</div>
                      {request.emergencyContact && (
                        <div><strong>Emergency Contact:</strong> {request.emergencyContact}</div>
                      )}
                    </>
                  )}

                  {reqType === 'MESS_FEE' && (
                    <>
                      <div><strong>Date:</strong> {formatDuration(request.startDate, request.endDate)}</div>
                      <div><strong>Mess Amount:</strong> ₹{Number(request.messAmount || 0).toLocaleString('en-IN')}</div>
                      <div><strong>Payment Status:</strong> {request.paidStatus}</div>
                    </>
                  )}

                  {reqType === 'INTERNSHIP' && (
                    <>
                      <div><strong>Company:</strong> {request.companyName} ({request.companyLocation})</div>
                      <div><strong>Role & Mode:</strong> {request.role} ({request.internshipMode})</div>
                      <div><strong>Duration:</strong> {formatDuration(request.startDate, request.endDate)}</div>
                    </>
                  )}

                  {reqType === 'LIBRARY' && (
                    <div><strong>Date:</strong> {formatDate(request.requestDate || request.createdAt)}</div>
                  )}
                </div>
              </div>

              <div style={{ borderBottom: '1.5px solid #0f172a', margin: '14px 0' }} />

              {/* Approval History Section */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' }}>
                  APPROVAL HISTORY
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                  {approvalSteps && approvalSteps.length > 0 ? (
                    approvalSteps.filter(s => s.role !== 'STUDENT').map((step, idx) => (
                      <div key={idx} style={{ lineHeight: 1.4 }}>
                        <div style={{ fontWeight: 700 }}>{step.role}</div>
                        <div style={{ paddingLeft: '8px', color: '#1e293b' }}>
                          <div>Approver: {step.approverUserId?.name || 'Authorized Faculty'}</div>
                          <div>Status: {step.decision === 'APPROVED' ? 'Approved' : step.decision}</div>
                          <div>Approved At: {new Date(step.decidedAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ color: '#64748b' }}>Approvals recorded digitally by college authority.</div>
                  )}
                </div>
              </div>

              <div style={{ borderBottom: '1.5px solid #0f172a', margin: '14px 0' }} />

              {/* Reference / QR Code Section */}
              <div style={{ marginBottom: '12px' }}>
                {reqType === 'OUTPASS' ? (
                  <>
                    <div style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' }}>
                      REFERENCE / QR CODE
                    </div>
                    <div style={{ fontSize: '12px', marginBottom: '10px' }}>
                      Scan this QR code for security verification:
                    </div>
                    <div style={{ textAlign: 'center', margin: '8px 0' }}>
                      {qrImage?.qrImage ? (
                        <img
                          src={qrImage.qrImage}
                          alt="Out-pass Security QR"
                          style={{ width: '160px', height: '160px', display: 'inline-block', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                        />
                      ) : (
                        <div style={{ padding: '20px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '4px', fontSize: '12px', color: '#64748b' }}>
                          QR Code available upon gate checkout verification
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' }}>
                      REFERENCE / VERIFICATION
                    </div>
                    <div style={{ fontSize: '12px', color: '#334155', lineHeight: 1.5 }}>
                      Official Institutional Clearance Reference: <strong>{refId}</strong><br />
                      This certificate validates institutional permission approved through the College Digital Permission & Approval Platform. No physical security gate checkout is required for this clearance type.
                    </div>
                  </>
                )}
              </div>

              {/* Bottom Footer Generated Timestamp */}
              <div style={{ textAlign: 'center', fontSize: '11px', color: '#64748b', marginTop: '16px' }}>
                Document generated on {new Date().toLocaleString('en-GB')}
              </div>
            </div>

            {/* Modal Controls */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px', paddingTop: '12px', background: '#ffffff', flexShrink: 0 }}>
              <button className="btn btn-ghost" onClick={() => setPrintModalOpen(false)}>Close</button>
              <button className="btn btn-primary" onClick={handleDownloadPermissionDocument} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Printer size={15} />
                <span>Download PDF</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
        )
      )}

      {/* Document View Modal */}
      <DocumentViewer
        isOpen={documentModalOpen}
        onClose={() => setDocumentModalOpen(false)}
        documentUrl={request.documentUrl}
        documentName={request.documentName}
      />
    </DashboardLayout>
  );
}

function DocumentViewer({ isOpen, onClose, documentUrl, documentName }) {
  if (!isOpen || !documentUrl) return null;
  const resolvedUrl = getDocumentUrl(documentUrl);
  const isPdf = /\.pdf(?:$|[?#])/i.test(`${documentName || ''} ${documentUrl}`);

  return (
    createPortal(
    <div
      className="modal-overlay attached-document-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div className="modal attached-document-modal" style={{ width: 'min(900px, 95vw)', height: 'min(90vh, 800px)', padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} color="var(--accent)" />
            <span>{documentName || 'Attached Document'}</span>
          </div>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: '6px' }}>
            <X size={20} />
          </button>
        </div>
        <div className="attached-document-content" style={{ flex: 1, minHeight: 0, border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', background: '#f8fafc', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {isPdf ? (
            <iframe src={resolvedUrl} title={documentName || 'Attached PDF'} style={{ width: '100%', height: '100%', minHeight: 300, border: 0 }} />
          ) : (
            <img
              src={resolvedUrl}
              alt={documentName || 'Document'}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling.style.display = 'flex';
              }}
            />
          )}
          {!isPdf && (
            <div style={{ display: 'none', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '40px' }}>
              <FileText size={48} color="#94a3b8" />
              <span style={{ color: '#64748b' }}>Cannot preview this file type.</span>
              <a href={resolvedUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ marginTop: '12px' }}>
                Download / Open in New Tab
              </a>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
    )
  );
}

function Row({ icon: Icon, label, value }) {
  return (
    <div className="request-detail-row" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <span className="request-detail-label" style={{ minWidth: 150, fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
        {Icon && <Icon size={14} color="var(--accent)" />}
        <span>{label}</span>
      </span>
      <span className="request-detail-value" style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{value || 'â€”'}</span>
    </div>
  );
}
