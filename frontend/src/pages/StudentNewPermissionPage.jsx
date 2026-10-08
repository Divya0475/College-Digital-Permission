import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import StudentLayout from '../components/StudentLayout';
import DateInput from '../components/DateInput';
import TimeInput12 from '../components/TimeInput12';
import api from '../lib/api';
import { formatTime12 } from '../lib/utils';
import {
  FileText,
  Calendar,
  Clock,
  PlusCircle,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Building,
  User,
  Home,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  Briefcase,
  BookOpen,
  Receipt,
  UploadCloud,
  Trash2,
  DollarSign,
  IndianRupee,
  MapPin,
  Laptop,
  Check,
  Phone
} from 'lucide-react';

const OUTPASS_REASONS = [
  'Going Home for Weekend',
  'Medical Consultation / Emergency',
  'Family Event / Function',
  'Off-Campus Interview / Drive',
  'Urgent Personal Work'
];

const MESS_REASONS = [
  'Semester Mess Fee Clearance',
  'Hostel Mess Dues Settlement',
  'Hostel Vacation Refund / Adjustment',
  'Exam Hall Ticket Mess Clearance'
];

const LIBRARY_REASONS = [
  'Book Borrowing & Reading Room Access',
  'Semester End Library Clearance / No Dues',
  'Digital Library & Research Database Access',
  'Reference Section Extended Study Hours'
];

const getTodayDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const validateLeaveDateRange = (startDate, endDate) => {
  if (!startDate) return 'Please select a valid start date.';
  if (endDate && endDate < startDate) return 'Period end date cannot be earlier than the start date. Please select a date on or after the chosen start date.';

  return '';
};

const getInitialFormState = () => ({
  requestType: 'OUTPASS',
  reason: '',
  documentUrl: '',
  documentName: '',
  emergencyContact: '',
  outDate: '',
  outTime: '17:00',
  expectedReturnDate: '',
  startDate: '',
  endDate: '',
  messAmount: '',
  paidStatus: 'Paid',
  companyName: '',
  companyLocation: '',
  role: '',
  internshipMode: 'Offline',
  requestDate: ''
});

const getPermissionFormState = (tab) => ({
  ...getInitialFormState(),
  requestType: tab,
  reason: '',
  documentUrl: '',
  documentName: '',
  emergencyContact: '',
  outDate: '',
  outTime: '17:00',
  expectedReturnDate: '',
  startDate: '',
  endDate: '',
  messAmount: '',
  paidStatus: 'Paid',
  companyName: '',
  companyLocation: '',
  role: '',
  internshipMode: 'Offline',
  requestDate: ''
});

const PERMISSION_META = {
  OUTPASS: {
    title: 'Apply for Campus Out-Pass',
    description: 'Request permission to leave campus for personal or official purposes',
    icon: GraduationCap,
    chips: ['Easy Process', 'Track Status', 'Get Notified'],
    stepLabels: ['Basic Details', 'Out-Pass Details', 'Additional Info', 'Review & Submit']
  },

  MESS_FEE: {
    title: 'Apply for Mess Fee Permission',
    description: 'Submit your mess fee clearance, refund, or related request.',
    icon: IndianRupee,
    chips: ['Clear Details', 'Document Check', 'Fast Approval'],
    stepLabels: ['Basic Details', 'Hostel Staying Period', 'Payment Details', 'Review & Submit']
  },

  INTERNSHIP: {
    title: 'Apply for Internship Permission',
    description: 'Submit your internship details and request approval.',
    icon: Briefcase,
    chips: ['Verify Details', 'Document Proof', 'Approval Tracking'],
    stepLabels: ['Company Info', 'Role & Mode', 'Duration', 'Review & Submit']
  },

  LIBRARY: {
    title: 'Apply for Library Permission',
    description: 'Request permission for library access and related requirements.',
    icon: BookOpen,
    chips: ['Access Request', 'Purpose Check', 'Status Tracking'],
    stepLabels: ['Basic Details', 'Access Details', 'Review & Submit']
  }
};

export default function StudentNewPermissionPage() {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('OUTPASS');
  const [form, setForm] = useState(() => getInitialFormState());
  const activePermission = PERMISSION_META[activeTab] || PERMISSION_META.OUTPASS;
  const studentType = String(user?.studentType || user?.studentCategory || '').toUpperCase();
  const registeredStudentType = studentType.includes('HOSTEL')
    ? 'HOSTELLER'
    : studentType.includes('DAY')
      ? 'DAY_SCHOLAR'
      : '';
  const [displayStudentType, setDisplayStudentType] = useState(registeredStudentType || 'DAY_SCHOLAR');
  const activeDisplayStudentType = displayStudentType || registeredStudentType;

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setError('');
    setSuccess('');
    setForm(getPermissionFormState(tab));
  };

  const handleReset = () => {
    setError('');
    setSuccess('');
    setForm(getPermissionFormState(activeTab));
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError('File is too large. Maximum allowed size is 10 MB.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setUploadingDoc(true);
    setError('');

    try {
      const res = await api.post(
        '/outpass/upload',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setForm(f => ({
        ...f,
        documentUrl: res.data.data.fileUrl,
        documentName: res.data.data.fileName
      }));
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Failed to upload document'
      );
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleRemoveFile = () => {
    setForm(f => ({
      ...f,
      documentUrl: '',
      documentName: ''
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (activeTab === 'MESS_FEE') {
      const amount = Number(form.messAmount);
      if (!Number.isFinite(amount) || amount < 0 || amount > 100000) {
        setError('Mess fee amount must be between ₹0 and ₹1,00,000.');
        return;
      }
      if (amount % 100 !== 0) {
        setError('Please enter the mess fee in increments of ₹100.');
        return;
      }
    }

    if (
      activeTab === 'MESS_FEE' &&
      (!form.documentUrl || !form.documentName)
    ) {
      setError('Please upload the required mess fee proof document.');
      return;
    }

    if (
      activeTab === 'INTERNSHIP' &&
      (!form.documentUrl || !form.documentName)
    ) {
      setError('Please upload the required internship proof document.');
      return;
    }

    let dateError = '';

    if (activeTab === 'OUTPASS') {
      if (!/^\d{10}$/.test(form.emergencyContact)) {
        setError('Phone number must be exactly 10 digits.');
        return;
      }

      if (!form.expectedReturnDate) {
        setError('Please select a return date.');
        return;
      }

      if (form.outDate < getTodayDateString()) {
        setError('Out-Pass date cannot be in the past.');
        return;
      }

      dateError = validateLeaveDateRange(
        form.outDate,
        form.expectedReturnDate
      );
    } else if (activeTab === 'LIBRARY') {
      if (form.requestDate !== getTodayDateString()) {
        setError('Library access date must be today.');
        return;
      }
      dateError = validateLeaveDateRange(
        form.requestDate,
        form.requestDate
      );
    } else {
      if (activeTab === 'INTERNSHIP' && form.startDate < getTodayDateString()) {
        setError('Internship start date cannot be in the past.');
        return;
      }
      if (activeTab === 'INTERNSHIP' && !form.endDate) {
        setError('Please select an internship end date.');
        return;
      }
      dateError = validateLeaveDateRange(
        form.startDate,
        form.endDate
      );
    }

    if (dateError) {
      setError(dateError);
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        ...form,
        requestType: activeTab
      };

      if (activeTab === 'INTERNSHIP') {
        payload.reason =
          `Internship at ${form.companyName || 'Company'} for ${form.role || 'Role'} role`;
      }

      await api.post('/outpass', payload);

      const tabLabels = {
        OUTPASS: 'Campus Out-Pass',
        MESS_FEE: 'Mess Fee Clearance',
        INTERNSHIP: 'Internship Permission',
        LIBRARY: 'Library Permission'
      };

      setSuccess(
        `${tabLabels[activeTab]} request submitted successfully! Tracking approval progress.`
      );

      setForm(getPermissionFormState(activeTab));
    } catch (e) {
      setError(
        e.response?.data?.message ||
        'Failed to submit request'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StudentLayout pageTitle="New Permission" pageSubtitle="Fill in the details to request permission">
      <div className="s-perm-tabs">
        {[
          { key: 'OUTPASS', label: 'Out-Pass', icon: GraduationCap },
          { key: 'MESS_FEE', label: 'Mess Fee', icon: IndianRupee },
          { key: 'INTERNSHIP', label: 'Internship', icon: Briefcase },
          { key: 'LIBRARY', label: 'Library', icon: BookOpen }
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            className={"s-perm-tab" + (activeTab === key ? " active" : "")}
            onClick={() => handleTabChange(key)}
          >
            <Icon size={15} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="s-form-card">
              {error && (
                <div
                  className="s-alert s-alert-error"
                >
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div
                  className="s-alert s-alert-success"
                >
                  <CheckCircle2 size={16} />
                  <span>{success}</span>
                </div>
              )}

              <form
                onSubmit={handleSubmit}
                className="student-form"
              >
                {activeTab === 'OUTPASS' && (
                  <>
                    <div className="s-student-outpass-profile">
                      <div className="s-student-type-picker" role="group" aria-label="Student type">
                        {[
                          { value: 'DAY_SCHOLAR', label: 'Day Scholar' },
                          { value: 'HOSTELLER', label: 'Hosteller' }
                        ].map(({ value, label }) => (
                          <button
                            key={value}
                            type="button"
                            className={`s-student-type-option${value === 'DAY_SCHOLAR' ? ' day-scholar' : ''}${activeDisplayStudentType === value ? ' active' : ''}`}
                            aria-pressed={activeDisplayStudentType === value}
                            onClick={() => setDisplayStudentType(value)}
                          >
                            {value === 'DAY_SCHOLAR' ? <Home size={15} /> : <Building size={15} />}
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* CHANGE 1: 2 -> 1 */}
                    <div style={{ marginBottom: '20px' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          marginBottom: '14px'
                        }}
                      >
                        <div
                          className="s-section-badge"
                        >
                          1
                        </div>

                        <div>
                          <div
                            style={{
                              fontSize: '15px',
                              fontWeight: 800,
                              color: '#0f172a'
                            }}
                          >
                            Reason for Leaving Campus
                          </div>
                        </div>
                      </div>

                      <textarea
                        required
                        rows={3}
                        className="s-form-input"
                        placeholder="Explain the specific reason you need to leave campus..."
                        value={form.reason}
                        onChange={e =>
                          setForm(f => ({
                            ...f,
                            reason: e.target.value
                          }))
                        }
                        style={{
                          borderRadius: '10px',
                          padding: '12px 14px',
                          minHeight: '76px',
                          border: '1px solid rgba(226,232,240,0.85)',
                          background: 'rgba(248,250,252,0.90)',
                          width: '100%'
                        }}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-[8px] mt-[12px]">
                        {/* Quick reasons removed */}
                      </div>
                    </div>

                    {/* CHANGE 2: 3 -> 2 */}
                    <div style={{ marginBottom: '20px' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          marginBottom: '14px'
                        }}
                      >
                        <div
                          className="s-section-badge"
                        >
                          2
                        </div>

                        <div>
                          <div
                            style={{
                              fontSize: '15px',
                              fontWeight: 800,
                              color: '#0f172a'
                            }}
                          >
                            Out-Pass Details
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px]">
                        <div>
                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              marginBottom: '8px',
                              fontSize: '13px',
                              fontWeight: 700,
                              color: '#0f172a'
                            }}
                          >
                            <Calendar
                              size={13}
                              color="#10b981"
                            />
                            Out Date
                          </label>

                          <StudentDateInput
                            required
                            className="s-form-input"
                            min={getTodayDateString()}
                            value={form.outDate}
                            onChange={e => {
                              const value = e.target.value;
                              const validationError =
                                validateLeaveDateRange(
                                  value,
                                  form.expectedReturnDate
                                );

                              if (validationError) {
                                setError(validationError);
                                return;
                              }

                              setError('');

                              setForm(f => ({
                                ...f,
                                outDate: value
                              }));
                            }}
                            style={{
                              borderRadius: '10px',
                              padding: '10px 12px',
                              height: '44px',
                              border: '1px solid rgba(226,232,240,0.85)',
                              background: 'rgba(248,250,252,0.90)',
                              width: '100%'
                            }}
                          />
                        </div>

                        <div>
                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              marginBottom: '8px',
                              fontSize: '13px',
                              fontWeight: 700,
                              color: '#0f172a'
                            }}
                          >
                            <Clock
                              size={13}
                              color="#10b981"
                            />
                            Out Time (AM/PM)
                          </label>

                          <TimeInput12
                            required
                            className="s-form-input"
                            value={form.outTime}
                            onChange={e =>
                              setForm(f => ({
                                ...f,
                                outTime: e.target.value
                              }))
                            }
                            style={{
                              borderRadius: '10px',
                              padding: '10px 12px',
                              height: '44px',
                              border: '1px solid rgba(226,232,240,0.85)',
                              background: 'rgba(248,250,252,0.90)',
                              width: '100%'
                            }}
                          />
                          {form.outTime && (
                            <div style={{ marginTop: 5, fontSize: 12, color: '#64748b' }}>
                              Selected time: {formatTime12(form.outTime)}
                            </div>
                          )}
                        </div>

                        <div
                          style={{
                            gridColumn: '1 / -1'
                          }}
                        >
                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              marginBottom: '8px',
                              fontSize: '13px',
                              fontWeight: 700,
                              color: '#0f172a'
                            }}
                          >
                            <Calendar
                              size={13}
                              color="#10b981"
                            />
                            Return Date
                          </label>

                          <StudentDateInput
                            required
                            className="s-form-input"
                            min={
                              form.outDate ||
                              getTodayDateString()
                            }
                            value={form.expectedReturnDate}
                            onChange={e => {
                              const value = e.target.value;

                              const validationError =
                                validateLeaveDateRange(
                                  form.outDate,
                                  value
                                );

                              if (validationError) {
                                setError(validationError);
                                return;
                              }

                              setError('');

                              setForm(f => ({
                                ...f,
                                expectedReturnDate: value
                              }));
                            }}
                            style={{
                              borderRadius: '10px',
                              padding: '10px 12px',
                              height: '44px',
                              border: '1px solid rgba(226,232,240,0.85)',
                              background: 'rgba(248,250,252,0.90)',
                              width: '100%'
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* CHANGE 3: 4 -> 3 */}
                    <div style={{ marginBottom: '20px' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          marginBottom: '14px'
                        }}
                      >
                        <div
                          className="s-section-badge"
                        >
                          3
                        </div>

                        <div>
                          <div
                            style={{
                              fontSize: '15px',
                              fontWeight: 800,
                              color: '#0f172a'
                            }}
                          >
                            Emergency Contact
                          </div>
                        </div>
                      </div>

                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginBottom: '8px',
                          fontSize: '13px',
                          fontWeight: 700,
                          color: '#0f172a'
                        }}
                      >
                        <Phone
                          size={13}
                          color="#10b981"
                        />
                        Parent Number
                      </label>

                      <input
                        type="tel"
                        required
                        className="s-form-input"
                        placeholder="e.g. 9392393340"
                        value={form.emergencyContact}
                        onChange={e =>
                          setForm(f => ({
                            ...f,
                            emergencyContact: e.target.value
                              .replace(/\D/g, '')
                              .slice(0, 10)
                          }))
                        }
                        style={{
                          borderRadius: '10px',
                          padding: '10px 12px',
                          height: '44px',
                          border: '1px solid rgba(226,232,240,0.85)',
                          background: 'rgba(248,250,252,0.90)',
                          width: '100%'
                        }}
                      />
                    </div>
                  </>
                )}

                {activeTab === 'MESS_FEE' && (
                  <>
                    {[
                      'Clearance Purpose',
                      'Hostel Staying Period',
                      'Payment Details'
                    ].map((section, sectionIndex) => (
                      <div
                        key={section}
                        style={{
                          marginBottom: '18px',
                          padding: '16px',
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '14px'
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            marginBottom: '14px'
                          }}
                        >
                          <div
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '8px',
                              background: 'rgba(16,185,129,0.08)',
                              color: '#10b981',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '12px',
                              fontWeight: 700
                            }}
                          >
                            {sectionIndex + 1}
                          </div>

                          <div>
                            <div
                              style={{
                                fontSize: '14px',
                                fontWeight: 800,
                                color: '#0f172a'
                              }}
                            >
                              {section}
                            </div>
                          </div>
                        </div>

                        {sectionIndex === 0 && (
                          <>
                            <textarea
                              required
                              rows={2}
                              className="s-form-input"
                              placeholder="e.g. Mess Fee Settlement for Fall Semester 2026..."
                              value={form.reason}
                              onChange={e =>
                                setForm(f => ({
                                  ...f,
                                  reason: e.target.value
                                }))
                              }
                              style={{
                                borderRadius: '10px',
                                padding: '12px 14px',
                                minHeight: '70px',
                                border: '1px solid rgba(226,232,240,0.85)',
                                background: 'rgba(248,250,252,0.90)',
                                width: '100%'
                              }}
                            />

                            {/* Quick reasons removed */}
                          </>
                        )}

                        {sectionIndex === 1 && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px]">
                            <div>
                              <label
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  marginBottom: '8px',
                                  fontSize: '13px',
                                  fontWeight: 700,
                                  color: '#0f172a'
                                }}
                              >
                                <Calendar
                                  size={13}
                                  color="#10b981"
                                />
                                Entry Date
                              </label>

                              <StudentDateInput
                                required
                                className="s-form-input"
                                value={form.startDate}
                                onChange={e => {
                                  const value =
                                    e.target.value;

                                  const validationError =
                                    validateLeaveDateRange(
                                      value,
                                      form.endDate
                                    );

                                  if (validationError) {
                                    setError(validationError);
                                    return;
                                  }

                                  setError('');

                                  setForm(f => ({
                                    ...f,
                                    startDate: value
                                  }));
                                }}
                                style={{
                                  borderRadius: '10px',
                                  padding: '10px 12px',
                                  height: '44px',
                                  border: '1px solid rgba(226,232,240,0.85)',
                                  background: 'rgba(248,250,252,0.90)',
                                  width: '100%'
                                }}
                              />
                            </div>

                            <div>
                              <label
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  marginBottom: '8px',
                                  fontSize: '13px',
                                  fontWeight: 700,
                                  color: '#0f172a'
                                }}
                              >
                                <Calendar
                                  size={13}
                                  color="#10b981"
                                />
                                Vacating Date
                              </label>

                              <StudentDateInput
                                required
                                className="s-form-input"
                                value={form.endDate}
                                onChange={e => {
                                  const value =
                                    e.target.value;

                                  const validationError =
                                    validateLeaveDateRange(
                                      form.startDate,
                                      value
                                    );

                                  if (validationError) {
                                    setError(validationError);
                                    return;
                                  }

                                  setError('');

                                  setForm(f => ({
                                    ...f,
                                    endDate: value
                                  }));
                                }}
                                style={{
                                  borderRadius: '10px',
                                  padding: '10px 12px',
                                  height: '44px',
                                  border: '1px solid rgba(226,232,240,0.85)',
                                  background: 'rgba(248,250,252,0.90)',
                                  width: '100%'
                                }}
                              />
                              <small className="s-date-format-hint">
                                End date must be on or after the start date.
                              </small>
                            </div>
                          </div>
                        )}

                        {sectionIndex === 2 && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px]">
                            <div>
                              <label
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  marginBottom: '8px',
                                  fontSize: '13px',
                                  fontWeight: 700,
                                  color: '#0f172a'
                                }}
                              >
                                <IndianRupee
                                  size={13}
                                  color="#10b981"
                                />
                                Mess Fee Amount
                              </label>

                              <input
                                type="number"
                                required
                                min="0"
                                max="100000"
                                step="100"
                                inputMode="numeric"
                                placeholder="e.g. 5200"
                                className="s-form-input"
                                value={form.messAmount}
                                onChange={e => {
                                  const value = e.target.value;
                                  if (value === '' || Number(value) <= 100000) {
                                    setForm(f => ({
                                      ...f,
                                      messAmount: value
                                    }));
                                  }
                                }}
                                style={{
                                  borderRadius: '10px',
                                  padding: '10px 12px',
                                  height: '44px',
                                  border: '1px solid rgba(226,232,240,0.85)',
                                  background: 'rgba(248,250,252,0.90)',
                                  width: '100%'
                                }}
                              />
                              {form.messAmount !== '' && Number.isFinite(Number(form.messAmount)) && (
                                <small className="s-currency-preview">
                                  Amount: ₹{new Intl.NumberFormat('en-IN').format(Number(form.messAmount))}
                                </small>
                              )}
                            </div>

                            <div>
                              <label
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  marginBottom: '8px',
                                  fontSize: '13px',
                                  fontWeight: 700,
                                  color: '#0f172a'
                                }}
                              >
                                <CheckCircle2
                                  size={13}
                                  color="#10b981"
                                />
                                Payment Status
                              </label>

                              <select
                                className="s-form-input"
                                value={form.paidStatus}
                                onChange={e =>
                                  setForm(f => ({
                                    ...f,
                                    paidStatus: e.target.value
                                  }))
                                }
                                style={{
                                  borderRadius: '10px',
                                  padding: '10px 12px',
                                  height: '44px',
                                  border: '1px solid rgba(226,232,240,0.85)',
                                  background: 'rgba(248,250,252,0.90)',
                                  width: '100%'
                                }}
                              >
                                <option value="Paid">
                                  Paid (Full Payment Done)
                                </option>
                                <option value="Partially Paid">
                                  Partially Paid
                                </option>
                                <option value="Not Paid">
                                  Not Paid (Pending Verification)
                                </option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    <div
                      style={{
                        marginBottom: '18px',
                        padding: '16px',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '14px'
                      }}
                    >
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '8px',
                          fontSize: '13px',
                          fontWeight: 700,
                          color: '#0f172a'
                        }}
                      >
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <UploadCloud
                            size={14}
                            color="#10b981"
                          />
                          Payment Proof / Receipt *
                        </span>

                        <span
                          style={{
                            fontSize: '11px',
                            color: '#64748b'
                          }}
                        >
                          PDF, PNG, JPG (max 10MB)
                        </span>
                      </label>

                      {form.documentUrl ? (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            borderRadius: '10px',
                            background: 'rgba(16,185,129,0.08)',
                            border: '1px solid #a7f3d0'
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              overflow: 'hidden'
                            }}
                          >
                            <Check
                              size={16}
                              color="#10b981"
                            />

                            <span
                              style={{
                                fontSize: '13px',
                                fontWeight: 600,
                                color: '#1e40af',
                                textOverflow: 'ellipsis',
                                overflow: 'hidden',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {form.documentName ||
                                'Attached Document'}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={handleRemoveFile}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#dc2626',
                              cursor: 'pointer',
                              padding: '4px'
                            }}
                            title="Remove file"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ) : (
                        <label
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '16px',
                            borderRadius: '10px',
                            border: '2px dashed rgba(226,232,240,0.85)',
                            background: 'rgba(248,250,252,0.90)',
                            cursor: uploadingDoc
                              ? 'wait'
                              : 'pointer',
                            transition:
                              'border-color 0.2s'
                          }}
                        >
                          <input
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg"
                            style={{ display: 'none' }}
                            disabled={uploadingDoc}
                            onChange={handleFileUpload}
                          />

                          <UploadCloud
                            size={22}
                            color={
                              uploadingDoc
                                ? '#10b981'
                                : '#64748b'
                            }
                          />

                          <span
                            style={{
                              fontSize: '12px',
                              marginTop: '6px',
                              color: '#475569'
                            }}
                          >
                            {uploadingDoc
                              ? 'Uploading receipt...'
                              : 'Click to attach any proof'}
                          </span>
                        </label>
                      )}
                    </div>
                  </>
                )}

                {activeTab === 'INTERNSHIP' && (
                  <>
                    {[
                      {
                        title: 'Company Information',
                        body: (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px]">
                            <div>
                              <label
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  marginBottom: '8px',
                                  fontSize: '13px',
                                  fontWeight: 700,
                                  color: '#0f172a'
                                }}
                              >
                                <Building
                                  size={13}
                                  color="#10b981"
                                />
                                Company Name
                              </label>

                              <input
                                type="text"
                                required
                                placeholder="e.g. Google, TCS, Infosys"
                                className="s-form-input"
                                value={form.companyName}
                                onChange={e =>
                                  setForm(f => ({
                                    ...f,
                                    companyName:
                                      e.target.value
                                  }))
                                }
                                style={{
                                  borderRadius: '10px',
                                  padding: '10px 12px',
                                  height: '44px',
                                  border: '1px solid rgba(226,232,240,0.85)',
                                  background: 'rgba(248,250,252,0.90)',
                                  width: '100%'
                                }}
                              />
                            </div>

                            <div>
                              <label
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  marginBottom: '8px',
                                  fontSize: '13px',
                                  fontWeight: 700,
                                  color: '#0f172a'
                                }}
                              >
                                <MapPin
                                  size={13}
                                  color="#10b981"
                                />
                                Company Location
                              </label>

                              <input
                                type="text"
                                required
                                placeholder="e.g. Hyderabad, Bangalore, Remote"
                                className="s-form-input"
                                value={form.companyLocation}
                                onChange={e =>
                                  setForm(f => ({
                                    ...f,
                                    companyLocation:
                                      e.target.value
                                  }))
                                }
                                style={{
                                  borderRadius: '10px',
                                  padding: '10px 12px',
                                  height: '44px',
                                  border: '1px solid rgba(226,232,240,0.85)',
                                  background: 'rgba(248,250,252,0.90)',
                                  width: '100%'
                                }}
                              />
                            </div>
                          </div>
                        )
                      },

                      {
                        title: 'Role & Mode',
                        body: (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px]">
                            <div>
                              <label
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  marginBottom: '8px',
                                  fontSize: '13px',
                                  fontWeight: 700,
                                  color: '#0f172a'
                                }}
                              >
                                <Briefcase
                                  size={13}
                                  color="#10b981"
                                />
                                Role
                              </label>

                              <input
                                type="text"
                                required
                                placeholder="e.g. Software Engineer Intern"
                                className="s-form-input"
                                value={form.role}
                                onChange={e =>
                                  setForm(f => ({
                                    ...f,
                                    role: e.target.value
                                  }))
                                }
                                style={{
                                  borderRadius: '10px',
                                  padding: '10px 12px',
                                  height: '44px',
                                  border: '1px solid rgba(226,232,240,0.85)',
                                  background: 'rgba(248,250,252,0.90)',
                                  width: '100%'
                                }}
                              />
                            </div>

                            <div>
                              <label
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  marginBottom: '8px',
                                  fontSize: '13px',
                                  fontWeight: 700,
                                  color: '#0f172a'
                                }}
                              >
                                <Laptop
                                  size={13}
                                  color="#10b981"
                                />
                                Internship Mode
                              </label>

                              <select
                                className="s-form-input"
                                value={form.internshipMode}
                                onChange={e =>
                                  setForm(f => ({
                                    ...f,
                                    internshipMode:
                                      e.target.value
                                  }))
                                }
                                style={{
                                  borderRadius: '10px',
                                  padding: '10px 12px',
                                  height: '44px',
                                  border: '1px solid rgba(226,232,240,0.85)',
                                  background: 'rgba(248,250,252,0.90)',
                                  width: '100%'
                                }}
                              >
                                <option value="Offline">
                                  Offline (Onsite)
                                </option>
                                <option value="Online">
                                  Online (Work from Home)
                                </option>
                                <option value="Hybrid">
                                  Hybrid
                                </option>
                              </select>
                            </div>
                          </div>
                        )
                      },

                      {
                        title: 'Internship Duration',
                        body: (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px]">
                            <div>
                              <label
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  marginBottom: '8px',
                                  fontSize: '13px',
                                  fontWeight: 700,
                                  color: '#0f172a'
                                }}
                              >
                                <Calendar
                                  size={13}
                                  color="#10b981"
                                />
                                Internship Start Date
                              </label>

                              <StudentDateInput
                                required
                                className="s-form-input"
                                min={getTodayDateString()}
                                value={form.startDate}
                                onChange={e => {
                                  const value =
                                    e.target.value;

                                  const validationError =
                                    validateLeaveDateRange(
                                      value,
                                      form.endDate
                                    );

                                  if (validationError) {
                                    setError(validationError);
                                    return;
                                  }

                                  setError('');

                                  setForm(f => ({
                                    ...f,
                                    startDate: value
                                  }));
                                }}
                                style={{
                                  borderRadius: '10px',
                                  padding: '10px 12px',
                                  height: '44px',
                                  border: '1px solid rgba(226,232,240,0.85)',
                                  background: 'rgba(248,250,252,0.90)',
                                  width: '100%'
                                }}
                              />
                            </div>

                            <div>
                              <label
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  marginBottom: '8px',
                                  fontSize: '13px',
                                  fontWeight: 700,
                                  color: '#0f172a'
                                }}
                              >
                                <Calendar
                                  size={13}
                                  color="#10b981"
                                />
                                Internship End Date
                              </label>

                              <StudentDateInput
                                required
                                className="s-form-input"
                                min={
                                  form.startDate ||
                                  getTodayDateString()
                                }
                                value={form.endDate}
                                onChange={e => {
                                  const value =
                                    e.target.value;

                                  const validationError =
                                    validateLeaveDateRange(
                                      form.startDate,
                                      value
                                    );

                                  if (validationError) {
                                    setError(validationError);
                                    return;
                                  }

                                  setError('');

                                  setForm(f => ({
                                    ...f,
                                    endDate: value
                                  }));
                                }}
                                style={{
                                  borderRadius: '10px',
                                  padding: '10px 12px',
                                  height: '44px',
                                  border: '1px solid rgba(226,232,240,0.85)',
                                  background: 'rgba(248,250,252,0.90)',
                                  width: '100%'
                                }}
                              />
                              <small className="s-date-format-hint">
                                Required; same day as or after the start date.
                              </small>
                            </div>
                          </div>
                        )
                      }
                    ].map(({ title, body }, idx) => (
                      <div
                        key={title}
                        style={{
                          marginBottom: '18px',
                          padding: '16px',
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '14px'
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            marginBottom: '14px'
                          }}
                        >
                          <div
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '8px',
                              background: 'rgba(16,185,129,0.08)',
                              color: '#10b981',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '12px',
                              fontWeight: 700
                            }}
                          >
                            {idx + 1}
                          </div>

                          <div>
                            <div
                              style={{
                                fontSize: '14px',
                                fontWeight: 800,
                                color: '#0f172a'
                              }}
                            >
                              {title}
                            </div>
                          </div>
                        </div>

                        {body}
                      </div>
                    ))}

                    <div
                      style={{
                        marginBottom: '18px',
                        padding: '16px',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '14px'
                      }}
                    >
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '8px',
                          fontSize: '13px',
                          fontWeight: 700,
                          color: '#0f172a'
                        }}
                      >
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <UploadCloud
                            size={14}
                            color="#10b981"
                          />
                          Offer Letter / Selection Email *
                        </span>

                        <span
                          style={{
                            fontSize: '11px',
                            color: '#64748b'
                          }}
                        >
                          PDF, PNG, JPG (max 10MB)
                        </span>
                      </label>

                      {form.documentUrl ? (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            borderRadius: '10px',
                            background: 'rgba(16,185,129,0.08)',
                            border: '1px solid #a7f3d0'
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              overflow: 'hidden'
                            }}
                          >
                            <Check
                              size={16}
                              color="#10b981"
                            />

                            <span
                              style={{
                                fontSize: '13px',
                                fontWeight: 600,
                                color: '#1e40af',
                                textOverflow: 'ellipsis',
                                overflow: 'hidden',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {form.documentName ||
                                'Attached Offer Letter'}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={handleRemoveFile}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#dc2626',
                              cursor: 'pointer',
                              padding: '4px'
                            }}
                            title="Remove file"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ) : (
                        <label
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '16px',
                            borderRadius: '10px',
                            border: '2px dashed rgba(226,232,240,0.85)',
                            background: 'rgba(248,250,252,0.90)',
                            cursor: uploadingDoc
                              ? 'wait'
                              : 'pointer',
                            transition:
                              'border-color 0.2s'
                          }}
                        >
                          <input
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg"
                            style={{ display: 'none' }}
                            disabled={uploadingDoc}
                            onChange={handleFileUpload}
                          />

                          <UploadCloud
                            size={22}
                            color={
                              uploadingDoc
                                ? '#10b981'
                                : '#64748b'
                            }
                          />

                          <span
                            style={{
                              fontSize: '12px',
                              marginTop: '6px',
                              color: '#475569'
                            }}
                          >
                            {uploadingDoc
                              ? 'Uploading document...'
                              : 'Click to attach internship offer letter or email'}
                          </span>
                        </label>
                      )}
                    </div>
                  </>
                )}

                {activeTab === 'LIBRARY' && (
                  <>
                    {/* Library workflow info removed */}

                    <div
                      style={{
                        marginBottom: '18px',
                        padding: '16px',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '14px'
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          marginBottom: '14px'
                        }}
                      >
                        <div
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '8px',
                            background: 'rgba(16,185,129,0.08)',
                            color: '#10b981',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 700
                          }}
                        >
                          1
                        </div>

                        <div>
                          <div
                            style={{
                              fontSize: '14px',
                              fontWeight: 800,
                              color: '#0f172a'
                            }}
                          >
                            Library Access Details
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px] mb-[14px]">
                        <div>
                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              marginBottom: '8px',
                              fontSize: '13px',
                              fontWeight: 700,
                              color: '#0f172a'
                            }}
                          >
                            <User
                              size={13}
                              color="#10b981"
                            />
                            Student Roll Number
                          </label>

                          <input
                            type="text"
                            disabled
                            className="s-form-input"
                            value={
                              user?.rollNo ||
                              user?.username ||
                              ''
                            }
                            style={{
                              background: 'rgba(248,250,252,0.90)',
                              cursor: 'not-allowed',
                              borderRadius: '10px',
                              padding: '10px 12px',
                              height: '44px',
                              border: '1px solid rgba(226,232,240,0.85)',
                              width: '100%'
                            }}
                          />
                        </div>

                        <div>
                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              marginBottom: '8px',
                              fontSize: '13px',
                              fontWeight: 700,
                              color: '#0f172a'
                            }}
                          >
                            <Calendar
                              size={13}
                              color="#10b981"
                            />
                            Access Date
                          </label>

                          <StudentDateInput
                            required
                            className="s-form-input"
                            min={getTodayDateString()}
                            max={getTodayDateString()}
                            value={form.requestDate}
                            onChange={e => {
                              const value =
                                e.target.value;

                              const validationError =
                                validateLeaveDateRange(
                                  value,
                                  value
                                );

                              if (validationError) {
                                setError(validationError);
                                return;
                              }

                              setError('');

                              setForm(f => ({
                                ...f,
                                requestDate: value
                              }));
                            }}
                            style={{
                              borderRadius: '10px',
                              padding: '10px 12px',
                              height: '44px',
                              border: '1px solid rgba(226,232,240,0.85)',
                              background: 'rgba(248,250,252,0.90)',
                              width: '100%'
                            }}
                          />
                          <small className="s-date-format-hint">
                            Today only
                          </small>
                        </div>
                      </div>

                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginBottom: '8px',
                          fontSize: '13px',
                          fontWeight: 700,
                          color: '#0f172a'
                        }}
                      >
                        <FileText
                          size={14}
                          color="#10b981"
                        />
                        Purpose
                      </label>

                      <textarea
                        required
                        rows={2}
                        className="s-form-input"
                        placeholder="Specify books to borrow, reading hall hours, or no-dues requirement..."
                        value={form.reason}
                        onChange={e =>
                          setForm(f => ({
                            ...f,
                            reason: e.target.value
                          }))
                        }
                        style={{
                          borderRadius: '10px',
                          padding: '12px 14px',
                          minHeight: '70px',
                          border: '1px solid rgba(226,232,240,0.85)',
                          background: 'rgba(248,250,252,0.90)',
                          width: '100%'
                        }}
                      />

                      {/* Quick reasons removed */}
                    </div>
                  </>
                )}

                {/* Final workflow summary removed */}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '12px',
                    alignItems: 'center',
                    flexWrap: 'wrap'
                  }}
                >
                  <button
                    type="button"
                    onClick={handleReset}
                    style={{
                      minWidth: '110px',
                      padding: '12px 18px',
                      borderRadius: '10px',
                      minHeight: '46px',
                      fontSize: '14px',
                      border: '1px solid rgba(226,232,240,0.85)',
                      background: '#fff',
                      color: '#334155',
                      cursor: 'pointer'
                    }}
                  >
                    Reset
                  </button>

                  <button
                    type="submit"
                    disabled={submitting || uploadingDoc}
                    className="s-btn-primary"
                    style={{ minWidth: '220px', minHeight: '46px', justifyContent: 'center' }}
                  >
                    {submitting ? (
                      <>
                        <span
                          style={{
                            width: 15,
                            height: 15,
                            borderRadius: '50%',
                            border:
                              '2px solid rgba(255,255,255,0.5)',
                            borderTopColor: '#fff',
                            display: 'inline-block',
                            animation:
                              'spin 1s linear infinite'
                          }}
                        />

                        <span>
                          Submitting Request...
                        </span>
                      </>
                    ) : (
                      <span>Submit</span>
                    )}
                  </button>
                </div>
              </form>
      </div>
    </StudentLayout>
  );
}

function StudentDateInput(props) {
  const { value } = props;

  return (
    <div className={`s-date-input-wrap${value ? ' has-value' : ''}`}>
      <DateInput
        {...props}
        className={`${props.className || ''}${value ? '' : ' s-date-empty'}`}
      />
      {!value && (
        <span className="s-date-input-placeholder" aria-hidden="true">
          DD-MM-YYYY
        </span>
      )}
    </div>
  );
}
