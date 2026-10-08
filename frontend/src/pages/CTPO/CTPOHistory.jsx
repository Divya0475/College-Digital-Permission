import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useNavigate,
  useSearchParams,
} from 'react-router-dom';

import {
  FiClipboard as ClipboardList,
  FiCheckCircle as CheckCircle,
  FiXCircle as XCircle,
  FiClock as Clock,
  FiEye as Eye,
  FiFileText as FileText,
  FiDownload as Download,
} from 'react-icons/fi';

import jsPDF from 'jspdf';
import 'jspdf-autotable';

import DashboardLayout from '../../components/DashboardLayout';
import StatusBadge from '../../components/StatusBadge';
import api from '../../lib/api';
import { getSimplifiedStatus } from '../../lib/utils';

const getReferenceId = (request) => {
  const reference = request?.referenceId || request?.refId;
  if (reference) return String(reference).replace(/^PERM-/i, 'KDP-');
  const id = String(request?._id || request?.id || request?.requestId || '');
  if (!id) return 'N/A';
  const createdAt = request?.createdAt || request?.submittedAt;
  const year = createdAt && !Number.isNaN(new Date(createdAt).getTime())
    ? new Date(createdAt).getFullYear()
    : new Date().getFullYear();
  return `KDP-${year}-${id.slice(-6).toUpperCase()}`;
};


// ============================================================
// CTPO HISTORY / ALL REQUESTS
// ============================================================

export default function CTPOHistory() {
  const navigate = useNavigate();

  const [searchParams, setSearchParams] =
    useSearchParams();

  // ==========================================================
  // STATE
  // ==========================================================

  const [requests, setRequests] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const [activeStatus, setActiveStatus] =
    useState('ALL');

  const [searchInput, setSearchInput] =
    useState('');

  const [searchTerm, setSearchTerm] =
    useState('');

  const [typeFilter, setTypeFilter] =
    useState('ALL');

  const [timeFilter, setTimeFilter] =
    useState('ALL');


  // ==========================================================
  // READ STATUS FROM URL
  // ==========================================================

  useEffect(() => {
    const status = String(
      searchParams.get('status') || 'ALL'
    ).toUpperCase();

    if (
      status === 'APPROVED' ||
      status === 'REJECTED'
    ) {
      setActiveStatus(status);
    } else {
      setActiveStatus('ALL');
    }
  }, [searchParams]);


  // ==========================================================
  // LOAD ALL CTPO REQUESTS
  // ==========================================================

  const loadRequests = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await api.get(
        '/outpass/all/for-me'
      );

      const data = response?.data;

      let loadedRequests = [];

      if (Array.isArray(data)) {
        loadedRequests = data;
      } else if (Array.isArray(data?.requests)) {
        loadedRequests = data.requests;
      } else if (Array.isArray(data?.data)) {
        loadedRequests = data.data;
      } else if (
        Array.isArray(data?.data?.requests)
      ) {
        loadedRequests = data.data.requests;
      } else if (Array.isArray(data?.results)) {
        loadedRequests = data.results;
      }

      setRequests(
        Array.isArray(loadedRequests)
          ? loadedRequests
          : []
      );
    } catch (err) {
      console.error(
        'CTPO All Requests Error:',
        err
      );

      setRequests([]);

      if (
        err?.response?.status === 404
      ) {
        setError(
          'All Requests API returned 404. Please verify the backend route.'
        );
      } else {
        setError(
          err?.response?.data?.message ||
          'Failed to load all requests.'
        );
      }
    } finally {
      setLoading(false);
    }
  };


  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {
    loadRequests();
  }, []);


  // ==========================================================
  // NORMALIZE REQUESTS
  // ==========================================================

  const normalizedRequests = useMemo(() => {
    return requests.map((request) => {

      const rawStatus = String(
        request?.status ||
        request?.approvalStatus ||
        request?.requestStatus ||
        request?.currentStatus ||
        ''
      ).toUpperCase();


      // ------------------------------------------------------
      // PERMISSION TYPE
      // ------------------------------------------------------

      let permissionType =
        request?.permissionType?.name ||
        request?.permissionType?.label ||
        request?.permissionTypeName ||
        request?.requestType ||
        request?.type ||
        request?.permissionType ||
        'Other';


      const typeMap = {
        OUTPASS: 'Out-Pass',
        OUT_PASS: 'Out-Pass',
        MESS_FEE: 'Mess Fee',
        MESS: 'Mess Fee',
        INTERNSHIP: 'Internship',
        LIBRARY: 'Library',
        WORKSHOP: 'Workshop / Seminar',
        EVENT: 'Event',
        INDUSTRIAL_VISIT: 'Industrial Visit',
        HOSTEL_LEAVE: 'Hostel Leave',
        OTHER: 'Other',
      };


      permissionType =
        typeMap[
        String(permissionType)
          .toUpperCase()
        ] ||
        permissionType;


      // ====================================================
      // STUDENT OBJECT
      // ====================================================

      const student =
        request?.student ||
        request?.studentDetails ||
        request?.studentId ||
        request?.user ||
        request?.userDetails ||
        request?.applicant ||
        request?.applicantDetails ||
        request?.createdBy ||
        request?.submittedBy ||
        request?.requester ||
        request?.requesterDetails ||
        {};

      // ------------------------------------------------------
      // STUDENT NAME
      // ------------------------------------------------------

      const studentName =
        request?.studentName ||
        request?.studentNameSnapshot ||
        request?.studentFullName ||
        request?.applicantName ||
        student?.name ||
        student?.fullName ||
        student?.studentName ||
        student?.profile?.fullName ||
        request?.name ||
        request?.fullName ||
        request?.requesterName ||
        'Unknown Student';


      // ------------------------------------------------------
      // ROLL NUMBER
      // ------------------------------------------------------

      const rollNo =
        request?.rollNo ||
        request?.rollNumber ||
        request?.rollNumberSnapshot ||
        request?.studentRollNo ||
        request?.studentRollNumber ||
        student?.rollNo ||
        student?.rollNumber ||
        student?.rollno ||
        student?.registrationNumber ||
        student?.registrationNo ||
        '-';


      // ------------------------------------------------------
      // REQUEST ID
      // ------------------------------------------------------

      const requestId =
        request?._id ||
        request?.id ||
        request?.requestId;


      return {
        ...request,

        _id: requestId,

        _status: rawStatus,

        _permissionType:
          String(permissionType),

        _studentName:
          String(studentName),

        _rollNo:
          String(rollNo),
      };
    });
  }, [requests]);


  // ==========================================================
  // APPROVAL STAGES
  // ==========================================================

  const getApprovalStages = (request) => {
    const sources = [
      request?.approvalStages,
      request?.approvalHistory,
      request?.approvals,
      request?.workflowStages,
      request?.stages,
      request?.approvalSteps,
      request?.steps,
      request?.workflowHistory,
    ];

    return sources
      .filter(Array.isArray)
      .flat();
  };


  // ==========================================================
  // NORMALIZE DECISION
  // ==========================================================

  const normalizeDecision = (value) => {
    const decision = String(value || '')
      .trim()
      .toUpperCase();

    if (
      [
        'APPROVED',
        'APPROVE',
        'ACCEPTED',
        'ACCEPT',
        'CLEARED',
      ].includes(decision)
    ) {
      return 'APPROVED';
    }

    if (
      [
        'REJECTED',
        'REJECT',
        'DENIED',
        'DENY',
      ].includes(decision)
    ) {
      return 'REJECTED';
    }

    return '';
  };


  // ==========================================================
  // STAGE ROLE
  // ==========================================================

  const getStageRole = (stage) => {
    return String(
      stage?.approverRole ||
      stage?.role ||
      stage?.approver?.role ||
      stage?.authorityRole ||
      stage?.approver?.authorityRole ||
      stage?.approverType ||
      stage?.stepRole ||
      ''
    )
      .trim()
      .toUpperCase();
  };


  // ==========================================================
  // STAGE DECISION
  // ==========================================================

  const getStageDecision = (stage) => {

    const directDecision =
      normalizeDecision(
        stage?.decision ||
        stage?.action ||
        stage?.status ||
        stage?.approvalStatus ||
        stage?.result
      );

    if (directDecision) {
      return directDecision;
    }

    if (
      stage?.approved === true ||
      stage?.isApproved === true
    ) {
      return 'APPROVED';
    }

    if (
      stage?.rejected === true ||
      stage?.isRejected === true
    ) {
      return 'REJECTED';
    }

    return '';
  };


  // ==========================================================
  // AUTHORITY TEXT
  // ==========================================================

  const getDecisionAuthorityText = (
    request
  ) => {

    const values = [
      request?.rejectedByRole,
      request?.rejectedBy?.role,
      request?.rejectedBy?.authorityRole,
      request?.lastActionByRole,
      request?.lastDecisionByRole,
      request?.lastApproverRole,
      request?.currentApproverRole,
      request?.currentAuthorityRole,
      request?.currentStage?.role,
      request?.currentStage?.approverRole,
      request?.currentStage?.authorityRole,
      request?.lastStage?.role,
      request?.lastStage?.approverRole,
      request?.lastStage?.authorityRole,
      request?.rejection?.role,
      request?.rejection?.rejectedByRole,
      request?.rejection?.authorityRole,
    ];

    return values
      .filter(Boolean)
      .map((value) => {

        if (
          typeof value === 'object'
        ) {
          return [
            value?.role,
            value?.authorityRole,
            value?.name,
            value?.label,
            value?.title,
          ]
            .filter(Boolean)
            .join(' ');
        }

        return String(value);
      })
      .join(' ')
      .trim()
      .toUpperCase();
  };


  // ==========================================================
  // GET CTPO DECISION
  // ==========================================================

  const getCTPODecision = (request) => {

    const directDecision =
      normalizeDecision(
        request?.ctpoDecision ||
        request?.ctpoStatus ||
        request?.ctpoApprovalStatus ||
        request?.ctpoDecisionStatus
      );

    if (directDecision) {
      return directDecision;
    }


    // --------------------------------------------------------
    // CHECK APPROVAL STAGES
    // --------------------------------------------------------

    const stages =
      getApprovalStages(request);

    const ctpoStages =
      stages.filter((stage) => {

        const role =
          getStageRole(stage);

        return (
          (
            role === 'CTPO' ||
            role.includes('CTPO')
          ) &&
          Boolean(
            getStageDecision(stage)
          )
        );
      });


    if (ctpoStages.length > 0) {
      return getStageDecision(
        ctpoStages[
        ctpoStages.length - 1
        ]
      );
    }


    // --------------------------------------------------------
    // STATUS
    // --------------------------------------------------------

    const status = String(
      request?._status ||
      request?.status ||
      request?.requestStatus ||
      request?.currentStatus ||
      request?.approvalStatus ||
      ''
    )
      .trim()
      .toUpperCase();


    // CTPO rejected

    if (
      status === 'REJECTED_CTPO' ||
      status === 'REJECTED CTPO' ||
      status === 'CTPO_REJECTED' ||
      status === 'CTPO REJECTED'
    ) {
      return 'REJECTED';
    }


    // Still waiting for CTPO

    if (
      status.includes('PENDING_CTPO') ||
      status.includes('PENDING CTPO')
    ) {
      return '';
    }


    // Later workflow means CTPO approved

    if (
      status.includes('HOD') ||
      status.includes('WARDEN') ||
      status.includes('HOSTEL') ||
      status.includes('PLACEMENT') ||
      status.includes('DEAN') ||
      status.includes('PRINCIPAL') ||
      status.includes('SECURITY') ||
      status.includes('FACULTY') ||
      status === 'PENDING_HOD' ||
      status === 'PENDING_PLACEMENT_OFFICER' ||
      status === 'PENDING_HOSTEL_INCHARGE' ||
      status === 'APPROVED' ||
      status === 'FINALIZED' ||
      status === 'COMPLETED' ||
      status === 'ISSUED' ||
      status === 'VERIFIED' ||
      status === 'USED' ||
      status === 'RETURNED'
    ) {
      return 'APPROVED';
    }


    // Plain rejected

    if (
      status === 'REJECTED' ||
      status === 'DENIED' ||
      status === 'REJECT'
    ) {

      const authorityText =
        getDecisionAuthorityText(
          request
        );


      if (
        authorityText.includes('CTPO')
      ) {
        return 'REJECTED';
      }


      if (
        authorityText.includes('HOD') ||
        authorityText.includes('WARDEN') ||
        authorityText.includes('HOSTEL') ||
        authorityText.includes('PLACEMENT') ||
        authorityText.includes('DEAN') ||
        authorityText.includes('PRINCIPAL') ||
        authorityText.includes('SECURITY') ||
        authorityText.includes('FACULTY')
      ) {
        return 'APPROVED';
      }


      if (
        request?.hodDecision ||
        request?.hodStatus ||
        request?.hodApprovalStatus ||
        request?.hodRemarks ||
        request?.hodRejectedAt ||
        request?.hostelDecision ||
        request?.placementDecision
      ) {
        return 'APPROVED';
      }
    }


    return '';
  };


  // ==========================================================
  // COUNTS
  // ==========================================================

  const allCount =
    normalizedRequests.length;

  const approvedCount =
    normalizedRequests.filter(
      (request) =>
        getCTPODecision(request) ===
        'APPROVED'
    ).length;

  const rejectedCount =
    normalizedRequests.filter(
      (request) =>
        getCTPODecision(request) ===
        'REJECTED'
    ).length;

  const pendingCount =
    normalizedRequests.filter(
      (request) =>
        getCTPODecision(request) === ''
    ).length;


  // ==========================================================
  // STATUS DISPLAY
  // ==========================================================

  const getCTPODisplayStatus =
    (request) => {

      const decision =
        getCTPODecision(request);

      if (
        decision === 'APPROVED'
      ) {
        return 'APPROVED';
      }

      if (
        decision === 'REJECTED'
      ) {
        return 'REJECTED';
      }

      return 'PENDING_CTPO';
    };


  // ==========================================================
  // SEARCH
  // ==========================================================

  const handleSearch = () => {
    setSearchTerm(
      searchInput
        .trim()
        .toLowerCase()
    );
  };


  const handleSearchKeyDown = (
    event
  ) => {

    if (
      event.key === 'Enter'
    ) {
      handleSearch();
    }
  };


  // ==========================================================
  // STATUS CHANGE
  // ==========================================================

  const handleStatusChange = (
    status
  ) => {

    const normalizedStatus =
      String(status)
        .toUpperCase();

    setActiveStatus(
      normalizedStatus
    );

    if (
      normalizedStatus === 'ALL'
    ) {
      setSearchParams({});
    } else {
      setSearchParams({
        status:
          normalizedStatus,
      });
    }
  };


  // ==========================================================
  // FILTERED REQUESTS
  // ==========================================================

  const filteredRequests =
    useMemo(() => {

      const now = new Date();

      return normalizedRequests.filter(
        (request) => {

          // --------------------------------------------------
          // STATUS
          // --------------------------------------------------

          let matchesStatus = true;

          if (
            activeStatus === 'APPROVED'
          ) {
            matchesStatus =
              getCTPODecision(
                request
              ) === 'APPROVED';
          }

          if (
            activeStatus === 'REJECTED'
          ) {
            matchesStatus =
              getCTPODecision(
                request
              ) === 'REJECTED';
          }


          // --------------------------------------------------
          // TYPE
          // --------------------------------------------------

          let matchesType = true;

          if (
            typeFilter !== 'ALL'
          ) {
            matchesType =
              request._permissionType
                .toLowerCase()
                .includes(
                  typeFilter.toLowerCase()
                );
          }


          // --------------------------------------------------
          // SEARCH
          // --------------------------------------------------

          let matchesSearch = true;

          if (searchTerm) {

            const searchableText =
              `
                ${request._studentName}
                ${request._rollNo}
                ${request._permissionType}
                ${request._status}
                ${request?.reason || ''}
                ${request?.purpose || ''}
                ${request?.description || ''}
                ${request?.details || ''}
              `.toLowerCase();

            matchesSearch =
              searchableText.includes(
                searchTerm
              );
          }


          // --------------------------------------------------
          // TIME
          // --------------------------------------------------

          let matchesTime = true;

          if (
            timeFilter !== 'ALL'
          ) {

            const requestDate =
              new Date(
                request?.createdAt ||
                request?.submittedAt ||
                request?.createdDate ||
                request?.requestDate
              );

            if (
              !Number.isNaN(
                requestDate.getTime()
              )
            ) {

              if (
                timeFilter === 'TODAY'
              ) {
                matchesTime =
                  requestDate.toDateString() ===
                  now.toDateString();
              }


              if (
                timeFilter === 'WEEK'
              ) {
                const weekAgo =
                  new Date(now);

                weekAgo.setDate(
                  now.getDate() - 7
                );

                matchesTime =
                  requestDate >=
                  weekAgo;
              }


              if (
                timeFilter === 'MONTH'
              ) {
                matchesTime =
                  requestDate.getMonth() ===
                  now.getMonth() &&
                  requestDate.getFullYear() ===
                  now.getFullYear();
              }
            }
          }


          return (
            matchesStatus &&
            matchesType &&
            matchesSearch &&
            matchesTime
          );
        }
      );

    }, [
      normalizedRequests,
      activeStatus,
      typeFilter,
      timeFilter,
      searchTerm,
    ]);


  // ==========================================================
  // VIEW REQUEST
  // ==========================================================

  const handleViewRequest = (
    request
  ) => {

    if (!request?._id) {
      console.warn(
        'Request ID not found:',
        request
      );

      return;
    }

    navigate(
      `/outpass/${request._id}`
    );
  };


  // ==========================================================
  // FORMAT DATE
  // ==========================================================

  const formatDate = (
    value
  ) => {

    if (!value) {
      return '-';
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return '-';
    }

    return date.toLocaleDateString(
      'en-IN',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }
    );
  };

  // ==========================================================
  // EXPORT
  // ==========================================================

  const handleExport = () => {
    const doc = new jsPDF();

    // Add title
    doc.setFontSize(16);
    doc.text('CTPO Requests History', 14, 15);

    const headers = [
      'Request Type',
      'Student',
      'Roll Number',
      'Details',
      'Submitted',
      'CTPO Status',
    ];

    const rows = filteredRequests.map((request) => [
      request._permissionType,
      request._studentName,
      request._rollNo,
      request?.reason || request?.purpose || request?.description || request?.details || '',
      formatDate(request?.createdAt || request?.submittedAt || request?.createdDate || request?.requestDate),
      getSimplifiedStatus(getCTPODisplayStatus(request)),
    ]);

    doc.autoTable({
      head: [headers],
      body: rows,
      startY: 25,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [79, 70, 229] }
    });

    doc.save('ctpo-history.pdf');
  };


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <DashboardLayout>

      <div className="ctpo-history-page">

        {/* ==================================================
            HEADER
        ================================================== */}

        <div className="ctpo-history-header">

          <div className="ctpo-history-title-row">
            <div>
              <h1>
                All Requests
              </h1>

              <p>
                View and review all permission requests.
              </p>
            </div>
          </div>




        </div>


        {/* ==================================================
            STATUS TABS
        ================================================== */}

        <div className="ctpo-history-tabs">

          <button
            type="button"
            className={
              activeStatus === 'ALL'
                ? 'ctpo-history-tab active'
                : 'ctpo-history-tab'
            }
            onClick={() =>
              handleStatusChange('ALL')
            }
          >
            <ClipboardList size={18} />

            <span>
              All Requests
              <strong>
                ({allCount})
              </strong>
            </span>
          </button>


          <button
            type="button"
            className={
              activeStatus === 'APPROVED'
                ? 'ctpo-history-tab active'
                : 'ctpo-history-tab'
            }
            onClick={() =>
              handleStatusChange(
                'APPROVED'
              )
            }
          >
            <CheckCircle size={18} />

            <span>
              Approved
              <strong>
                ({approvedCount})
              </strong>
            </span>
          </button>


          <button
            type="button"
            className={
              activeStatus === 'REJECTED'
                ? 'ctpo-history-tab active'
                : 'ctpo-history-tab'
            }
            onClick={() =>
              handleStatusChange(
                'REJECTED'
              )
            }
          >
            <XCircle size={18} />

            <span>
              Rejected
              <strong>
                ({rejectedCount})
              </strong>
            </span>
          </button>


          {/* PENDING */}

          <button
            type="button"
            className="ctpo-history-tab pending-tab"
            onClick={() =>
              navigate('/ctpo/pending')
            }
          >
            <Clock size={18} />

            <span>
              Pending Requests
              <strong>
                ({pendingCount})
              </strong>
            </span>
          </button>

        </div>


        {/* ==================================================
            SEARCH + FILTERS
        ================================================== */}

        <div className="ctpo-search-filter-card">

          <div className="ctpo-search-box">

            <input
              type="text"
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value);
                setSearchTerm(event.target.value.trim().toLowerCase());
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search student, roll number, company or details..."
            />

          </div>


          <select
            className="ctpo-filter-select"
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(
                event.target.value
              )
            }
          >
            <option value="ALL">
              All Types
            </option>

            <option value="Out-Pass">
              Out-Pass
            </option>

            <option value="Mess Fee">
              Mess Fee
            </option>

            <option value="Internship">
              Internship
            </option>

            <option value="Library">
              Library
            </option>
          </select>


          <select
            className="ctpo-filter-select"
            value={timeFilter}
            onChange={(event) =>
              setTimeFilter(
                event.target.value
              )
            }
          >
            <option value="ALL">
              All Time
            </option>

            <option value="TODAY">
              Today
            </option>

            <option value="WEEK">
              This Week
            </option>

            <option value="MONTH">
              This Month
            </option>
          </select>

        </div>


        {/* ==================================================
            COUNT SUMMARY
        ================================================== */}




        {/* ==================================================
            TABLE
        ================================================== */}

        <div className="ctpo-history-card">

          {loading && (
            <div className="ctpo-history-state">
              Loading all requests...
            </div>
          )}


          {!loading && error && (
            <div className="ctpo-history-state error">

              <FileText size={36} />

              <p>
                {error}
              </p>

              <button
                type="button"
                onClick={loadRequests}
              >
                Retry
              </button>

            </div>
          )}


          {!loading &&
            !error &&
            filteredRequests.length === 0 && (
              <div className="ctpo-history-state">

                <ClipboardList size={40} />

                <h3>
                  {searchTerm ? "No matching student found." : "No Requests Found"}
                </h3>

                <p>
                  No requests match the selected filters.
                </p>

              </div>
            )}


          {!loading &&
            !error &&
            filteredRequests.length > 0 && (

              <div className="ctpo-table-wrapper">

                <table className="ctpo-history-table">

                  <thead>

                    <tr>

                      <th>
                        REQUEST TYPE
                      </th>

                      <th>
                        STUDENT
                      </th>

                      <th>
                        DETAILS
                      </th>

                      <th>
                        SUBMITTED
                      </th>

                      <th>
                        CTPO STATUS
                      </th>

                      <th>
                        ACTION
                      </th>

                    </tr>

                  </thead>


                  <tbody>

                    {filteredRequests.map(
                      (
                        request,
                        index
                      ) => (

                        <tr
                          key={
                            request._id ||
                            `request-${index}`
                          }
                        >

                          <td data-label="Type">
                            <div className="ctpo-request-type" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <FileText size={17} />
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                <span>{request._permissionType}</span>
                                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500, fontFamily: 'monospace', marginTop: '2px' }}>
                                  Ref: {getReferenceId(request)}
                                </span>
                              </div>
                            </div>
                          </td>


                          {/* STUDENT */}

                          <td data-label="Student">

                            <div className="ctpo-student-info">

                              <strong>
                                {
                                  request._studentName
                                }
                              </strong>

                              <span>
                                {
                                  request._rollNo
                                }
                              </span>

                            </div>

                          </td>


                          {/* DETAILS */}

                          <td data-label="Details">

                            <div
                              className="ctpo-request-details"
                              title={
                                request?.reason ||
                                request?.purpose ||
                                request?.description ||
                                request?.details ||
                                '-'
                              }
                            >
                              {
                                request?.reason ||
                                request?.purpose ||
                                request?.description ||
                                request?.details ||
                                '-'
                              }
                            </div>

                          </td>


                          {/* SUBMITTED */}

                          <td data-label="Submitted">

                            {
                              formatDate(
                                request?.createdAt ||
                                request?.submittedAt ||
                                request?.createdDate ||
                                request?.requestDate
                              )
                            }

                          </td>


                          {/* STATUS */}

                          <td data-label="Status">

                            <StatusBadge
                              status={
                                getSimplifiedStatus(getCTPODisplayStatus(request))
                              }
                              showIcon={false}
                            />

                          </td>


                          {/* ACTION */}

                          <td data-label="Action">

                            <button
                              type="button"
                              className="ctpo-view-button"
                              onClick={() =>
                                handleViewRequest(
                                  request
                                )
                              }
                            >

                              <Eye
                                size={16}
                              />

                              Review

                            </button>

                          </td>

                        </tr>

                      )
                    )}

                  </tbody>

                </table>

              </div>
            )}

        </div>

      </div>


      {/* ====================================================
          STYLES
      ==================================================== */}

      <style>{`
        * {
          box-sizing: border-box;
        }

        .ctpo-history-page {
          width: 100%;
          max-width: 100%;
          padding: 0;
          margin: 0;
          color: #0f172a;
        }

        /* HEADER - matches the Student Requests reference */
        .ctpo-history-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 24px;
        }

        .ctpo-history-header h1 {
          margin: 0;
          color: #0f172a;
          font-size: 29px;
          line-height: 1.2;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .ctpo-history-header p {
          margin: 7px 0 0;
          color: #64748b;
          font-size: 14px;
          line-height: 1.5;
          font-weight: 400;
        }

        /* HEADER ACTIONS */
        .ctpo-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .ctpo-action-button,
        .ctpo-export-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 42px;
          padding: 0 16px;
          border-radius: 9px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
        }

        .ctpo-action-button {
          background: #ffffff;
          border: 1px solid #dbe3ef;
          color: #334155;
        }

        .ctpo-export-button {
          background: #10b981;
          border: 1px solid #10b981;
          color: #ffffff;
        }

        .ctpo-action-button:hover {
          background: #f8fafc;
        }

        .ctpo-export-button:hover {
          background: #1d4ed8;
        }

        /* STATUS TABS - flat layout like Student Requests */
        .ctpo-history-tabs {
          display: flex;
          align-items: stretch;
          justify-content: flex-start;
          gap: 0;
          flex-wrap: nowrap;
          width: 100%;
          margin-bottom: 18px;
          border-bottom: 1px solid #e2e8f0;
        }

        .ctpo-history-tab {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 48px;
          padding: 0 22px;
          border: 0;
          border-radius: 0;
          background: transparent;
          color: #334155;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          transition: background 0.2s ease, color 0.2s ease;
          white-space: nowrap;
        }

        .ctpo-history-tab:hover {
          background: #f8fafc;
          color: #10b981;
        }

        .ctpo-history-tab.active {
          background: #ecfdf5;
          color: #10b981;
        }

        .ctpo-history-tab.active::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          bottom: -1px;
          height: 2px;
          background: #10b981;
        }

        .ctpo-history-tab strong {
          font-weight: 700;
          margin-left: 1px;
        }

        .ctpo-history-tab.pending-tab,
        .ctpo-history-tab.pending-tab:hover {
          margin-left: 0;
          color: #334155;
          background: transparent;
          border-color: transparent;
        }

        /* SEARCH + FILTERS - separate containers */
        .ctpo-search-filter-card {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 12px;
          padding: 0;
          background: transparent;
          border: none;
          border-radius: 0;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }

        .ctpo-search-box {
          position: relative;
          flex: 1;
          min-width: 250px;
          border: 1px solid #dbe3ef;
          border-radius: 12px;
          background: #ffffff;
        }

        /* Inner input: borderless — the outer card provides the single border */
        .ctpo-search-box input {
          width: 100%;
          height: 44px;
          padding: 0 14px;
          border: none;
          border-radius: 12px;
          outline: none;
          background: transparent;
          color: #334155;
          font-size: 13px;
          font-weight: 400;
        }

        .ctpo-search-box input::placeholder {
          color: #94a3b8;
          opacity: 1;
        }

        .ctpo-search-box input:focus {
          background: #f0fdf4;
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.12);
        }

        .ctpo-filter-select {
          height: 44px;
          padding: 0 14px;
          min-width: 145px;
          border: 1px solid #dbe3ef;
          border-radius: 12px;
          background: #ffffff;
          color: #334155;
          font-size: 12px;
          font-weight: 600;
          outline: none;
          cursor: pointer;
          flex-shrink: 0;
        }

        .ctpo-filter-select:focus {
          border-color: #10b981;
          background: #f0fdf4;
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.12);
        }

        /* TABLE CARD */
        .ctpo-history-card {
          width: 100%;
          background: #ffffff;
          border: 1px solid #dbe3ef;
          border-radius: 14px;
          overflow: hidden;
        }

        .ctpo-table-wrapper {
          width: 100%;
          overflow-x: auto;
        }

        .ctpo-history-table {
          width: 100%;
          min-width: 1000px;
          border-collapse: collapse;
          table-layout: fixed;
        }

        .ctpo-history-table th {
          padding: 13px 16px;
          background: #f1f5f9;
          border-bottom: 1px solid #e2e8f0;
          color: #64748b;
          text-align: left;
          font-size: 11px;
          line-height: 1.2;
          font-weight: 700;
          letter-spacing: 0.02em;
          white-space: nowrap;
        }

        .ctpo-history-table td {
          padding: 14px 16px;
          border-bottom: 1px solid #eef2f7;
          color: #475569;
          font-size: 12px;
          line-height: 1.35;
          font-weight: 400;
          vertical-align: middle;
        }

        .ctpo-history-table tbody tr:hover {
          background: #f8fafc;
        }

        .ctpo-history-table tbody tr:last-child td {
          border-bottom: none;
        }

        /* COLUMN ORIENTATION / WIDTHS */
        .ctpo-history-table th:nth-child(1),
        .ctpo-history-table td:nth-child(1) {
          width: 16%;
        }

        .ctpo-history-table th:nth-child(2),
        .ctpo-history-table td:nth-child(2) {
          width: 23%;
        }

        .ctpo-history-table th:nth-child(3),
        .ctpo-history-table td:nth-child(3) {
          width: 19%;
        }

        .ctpo-history-table th:nth-child(4),
        .ctpo-history-table td:nth-child(4) {
          width: 14%;
        }

        .ctpo-history-table th:nth-child(5),
        .ctpo-history-table td:nth-child(5) {
          width: 16%;
        }

        .ctpo-history-table th:nth-child(6),
        .ctpo-history-table td:nth-child(6) {
          width: 12%;
        }

        /* REQUEST TYPE */
        .ctpo-request-type {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #334155;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
        }

        .ctpo-request-type svg {
          flex: 0 0 auto;
          color: #475569;
        }

        /* STUDENT */
        .ctpo-student-info {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
        }

        .ctpo-student-info strong {
          color: #1e293b;
          font-size: 12px;
          font-weight: 600;
          line-height: 1.25;
          white-space: normal;
        }

        .ctpo-student-info span {
          color: #64748b;
          font-size: 12px;
          font-weight: 400;
        }

        /* DETAILS */
        .ctpo-request-details {
          max-width: 100%;
          color: #64748b;
          font-size: 12px;
          font-weight: 400;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* REVIEW */
        .ctpo-view-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          padding: 5px 14px;
          border-radius: 50px;
          font-size: 12.5px;
          font-weight: 600;
          color: #10b981;
          background: rgba(209, 250, 229, 0.92);
          border: 1px solid #a7f3d0;
          cursor: pointer;
          transition: all 0.15s;
          font-family: inherit;
          white-space: nowrap;
        }

        .ctpo-view-button:hover {
          background: #d1fae5;
          border-color: #6ee7b7;
          transform: translateY(-1px);
        }

        /* REJECTED BADGE — scoped to CTPO All Requests only */
        .ctpo-history-page .badge-rejected {
          background: #fee2e2;
          color: #b91c1c;
          border: 1px solid #fecaca;
        }

        /* STATES */
        .ctpo-history-state {
          min-height: 300px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 40px;
          color: #64748b;
          text-align: center;
        }

        .ctpo-history-state h3 {
          margin: 0;
          color: #334155;
          font-weight: 600;
        }

        .ctpo-history-state p {
          margin: 0;
          font-weight: 400;
        }

        .ctpo-history-state.error {
          color: #dc2626;
        }

        .ctpo-history-state.error button {
          padding: 9px 18px;
          border: none;
          border-radius: 8px;
          background: #10b981;
          color: #ffffff;
          cursor: pointer;
          font-weight: 600;
        }

        /* RESPONSIVE */
        @media (max-width: 1100px) {
          .ctpo-history-page {
            padding: 0;
          }

          .ctpo-search-filter-card {
            flex-wrap: wrap;
          }

          /* Search occupies full top row */
          .ctpo-search-box {
            flex-basis: 100%;
            width: 100%;
            margin-bottom: 12px;
          }

          /* Dropdowns share the bottom row */
          .ctpo-filter-select {
            flex: 1;
            margin-right: 12px;
          }

          .ctpo-filter-select:last-of-type {
            margin-right: 0;
          }
        }

        @media (max-width: 800px) {
          .ctpo-history-header {
            flex-direction: column;
          }

          .ctpo-history-title-row {
            width: 100%;
          }

          .ctpo-header-actions {
            width: 100%;
          }

          .ctpo-action-button,
          .ctpo-export-button {
            flex: 1;
          }

          .ctpo-history-tabs {
            overflow-x: auto;
          }

          .ctpo-history-tab {
            flex: 0 0 auto;
            min-width: 135px;
          }

          .ctpo-history-tab.pending-tab {
            margin-left: 0;
          }
        }

        @media (max-width: 600px) {
          .ctpo-history-page {
            padding: 0;
          }

          .ctpo-history-header h1 {
            font-size: 22px;
          }

          .ctpo-history-title-row {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .ctpo-history-tabs {
            width: 100%;
          }

          .ctpo-history-tab {
            min-width: 110px;
            padding: 0 10px;
            font-size: 11px;
          }

          .ctpo-search-filter-card {
            flex-direction: column;
            align-items: stretch;
          }

          .ctpo-search-box {
            margin-bottom: 12px;
          }

          .ctpo-filter-select {
            width: 100%;
            min-width: unset;
            flex: none;
            margin-bottom: 12px;
          }

          .ctpo-filter-select:last-of-type {
            margin-bottom: 0;
          }

          /* Mobile card layout — replaces horizontal table scroll */
          .ctpo-table-wrapper {
            overflow-x: visible;
          }

          .ctpo-history-table {
            display: block;
            min-width: unset;
          }

          .ctpo-history-table thead {
            display: none;
          }

          .ctpo-history-table tbody {
            display: block;
          }

          .ctpo-history-table tbody tr {
            display: block;
            margin-bottom: 12px;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 12px 14px;
            background: #fff;
          }

          .ctpo-history-table td {
            display: flex;
            flex-direction: column;
            align-items: stretch;
            gap: 4px;
            padding: 5px 0;
            border-bottom: none;
            font-size: 12px;
            min-width: 0;
          }

          .ctpo-history-table td::before {
            content: attr(data-label);
            font-size: 10px;
            font-weight: 700;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            flex-shrink: 0;
            width: auto;
            padding-top: 1px;
          }

          .ctpo-request-type,
          .ctpo-student-info,
          .ctpo-request-details {
            width: 100%;
            min-width: 0;
          }

          .ctpo-request-type {
            white-space: normal;
            overflow-wrap: anywhere;
          }

          .ctpo-request-type > div {
            min-width: 0;
            overflow-wrap: anywhere;
          }

          .ctpo-request-details {
            white-space: normal;
            overflow-wrap: anywhere;
          }

          .ctpo-history-table td:last-child {
            border-top: 1px solid #f1f5f9;
            margin-top: 4px;
            padding-top: 10px;
          }

          .ctpo-view-button {
            width: 100%;
          }

          .ctpo-student-info strong,
          .ctpo-student-info span {
            white-space: normal;
          }
        }

        @media print {
          .ctpo-header-actions,
          .ctpo-history-tabs,
          .ctpo-search-filter-card {
            display: none !important;
          }

          .ctpo-history-page {
            padding: 0;
          }

          .ctpo-history-card {
            border: 1px solid #ddd;
          }
        }
`}</style>

    </DashboardLayout>
  );
}