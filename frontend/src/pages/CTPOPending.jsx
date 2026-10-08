import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  FiSearch as Search,
  FiEye as Eye,
  FiFileText as FileText,
  FiCheckCircle as CheckCircle2,
} from 'react-icons/fi';

import DashboardLayout from '../components/DashboardLayout';
import api from '../lib/api';

export default function CTPOPending() {
  const navigate = useNavigate();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search input value
  const [searchInput, setSearchInput] = useState('');

  // Actual applied search
  const [search, setSearch] = useState('');

  // Permission type filter
  const [typeFilter, setTypeFilter] = useState('ALL');

  const [message, setMessage] = useState('');

  // ============================================================
  // FETCH PENDING REQUESTS
  // ============================================================

  const fetchPendingRequests = async () => {
    try {
      setLoading(true);
      setMessage('');

      const response = await api.get(
        '/outpass/pending/for-me'
      );

      console.log(
        'CTPO Pending API Response:',
        response?.data
      );

      const responseData = response?.data;

      let pendingRequests = [];

      if (Array.isArray(responseData)) {
        pendingRequests = responseData;
      } else if (Array.isArray(responseData?.data)) {
        pendingRequests = responseData.data;
      } else if (Array.isArray(responseData?.requests)) {
        pendingRequests = responseData.requests;
      } else if (
        Array.isArray(responseData?.data?.requests)
      ) {
        pendingRequests =
          responseData.data.requests;
      }

      console.log(
        'CTPO Pending Requests:',
        pendingRequests
      );

      setRequests(
        Array.isArray(pendingRequests)
          ? pendingRequests
          : []
      );
    } catch (error) {
      console.error(
        'Error fetching CTPO pending requests:',
        error
      );

      setRequests([]);

      setMessage(
        error?.response?.data?.message ||
        'Unable to load pending requests'
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // INITIAL LOAD
  // ============================================================

  useEffect(() => {
    fetchPendingRequests();

    const interval = setInterval(() => {
      fetchPendingRequests();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // ============================================================
  // STUDENT NAME
  // ============================================================

  const getStudentName = (request) => {
    return (
      request?.studentId?.name ||
      request?.studentId?.profile?.fullName ||
      request?.student?.name ||
      request?.student?.profile?.fullName ||
      request?.studentName ||
      request?.user?.name ||
      request?.user?.profile?.fullName ||
      'Unknown Student'
    );
  };

  // ============================================================
  // ROLL NUMBER
  // ============================================================

  const getRollNumber = (request) => {
    return (
      request?.studentId?.rollNo ||
      request?.studentId?.rollNumber ||
      request?.student?.rollNo ||
      request?.student?.rollNumber ||
      request?.rollNo ||
      request?.rollNumber ||
      request?.user?.rollNo ||
      request?.user?.rollNumber ||
      '—'
    );
  };

  // ============================================================
  // BRANCH
  // ============================================================

  const getBranch = (request) => {
    return (
      request?.branchId?.name ||
      request?.branchId?.code ||
      request?.studentId?.branch?.name ||
      request?.studentId?.branch?.code ||
      request?.student?.branch?.name ||
      request?.student?.branch?.code ||
      request?.branch?.name ||
      request?.branch?.code ||
      request?.branch ||
      ''
    );
  };

  // ============================================================
  // PERMISSION TYPE
  // ============================================================

  const getPermissionType = (request) => {
    const type =
      request?.permissionType ||
      request?.requestType ||
      request?.type ||
      request?.permission?.type ||
      request?.permissionTypeId?.name ||
      request?.permissionTypeId?.type ||
      '';

    if (
      typeof type === 'object' &&
      type !== null
    ) {
      return (
        type?.name ||
        type?.label ||
        type?.type ||
        ''
      );
    }

    return type || 'Permission';
  };

  // ============================================================
  // PERMISSION TYPE LABEL
  // ============================================================

  const getPermissionTypeLabel = (request) => {
    const rawType = String(
      getPermissionType(request)
    ).trim();

    const type = rawType.toUpperCase();

    if (
      type.includes('OUTPASS') ||
      type.includes('OUT-PASS') ||
      type.includes('OUT_PASS') ||
      type.includes('OUT PASS')
    ) {
      return 'Out-Pass';
    }

    if (type.includes('MESS')) {
      return 'Mess Fee';
    }

    if (type.includes('INTERNSHIP')) {
      return 'Internship';
    }

    if (type.includes('LIBRARY')) {
      return 'Library';
    }

    return rawType || 'Permission';
  };

  // ============================================================
  // PURPOSE
  // ============================================================

  const getPurpose = (request) => {
    return (
      request?.purpose ||
      request?.reason ||
      request?.description ||
      request?.requestData?.purpose ||
      request?.formData?.purpose ||
      '—'
    );
  };

  // ============================================================
  // DATE
  // ============================================================

  const getDate = (request) => {
    const date =
      request?.createdAt ||
      request?.submittedAt ||
      request?.dateSubmitted ||
      request?.createdDate;

    if (!date) {
      return '—';
    }

    const parsedDate = new Date(date);

    if (
      Number.isNaN(
        parsedDate.getTime()
      )
    ) {
      return String(date);
    }

    return parsedDate.toLocaleDateString(
      'en-GB',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }
    );
  };

  // ============================================================
  // SEARCH BUTTON
  // ============================================================

  const handleSearch = () => {
    setSearch(
      searchInput.trim()
    );
  };

  // ============================================================
  // ENTER KEY SEARCH
  // ============================================================

  const handleSearchKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSearch();
    }
  };

  // ============================================================
  // SEARCH INPUT
  // ============================================================

  const handleSearchInputChange = (event) => {
    const value =
      event.target.value;

    setSearchInput(value);

    if (!value.trim()) {
      setSearch('');
    }
  };

  // ============================================================
  // FILTER + SEARCH
  // ============================================================

  const filteredRequests = useMemo(() => {
    let result = [...requests];

    // ----------------------------------------------------------
    // TYPE FILTER
    // ----------------------------------------------------------

    if (typeFilter !== 'ALL') {
      result = result.filter(
        (request) => {
          const type = String(
            getPermissionType(request)
          ).toUpperCase();

          switch (typeFilter) {
            case 'OUT-PASS':
              return (
                type.includes('OUTPASS') ||
                type.includes('OUT-PASS') ||
                type.includes('OUT_PASS') ||
                type.includes('OUT PASS')
              );

            case 'MESS':
              return type.includes(
                'MESS'
              );

            case 'INTERNSHIP':
              return type.includes(
                'INTERNSHIP'
              );

            case 'LIBRARY':
              return type.includes(
                'LIBRARY'
              );

            default:
              return true;
          }
        }
      );
    }

    // ----------------------------------------------------------
    // SEARCH
    // ----------------------------------------------------------

    const searchValue =
      search.trim().toLowerCase();

    if (searchValue) {
      result = result.filter(
        (request) => {
          const studentName =
            getStudentName(
              request
            );

          const rollNumber =
            getRollNumber(
              request
            );

          const permissionType =
            getPermissionTypeLabel(
              request
            );

          const purpose =
            getPurpose(
              request
            );

          return (
            String(studentName)
              .toLowerCase()
              .includes(
                searchValue
              ) ||

            String(rollNumber)
              .toLowerCase()
              .includes(
                searchValue
              ) ||

            String(permissionType)
              .toLowerCase()
              .includes(
                searchValue
              ) ||

            String(purpose)
              .toLowerCase()
              .includes(
                searchValue
              )
          );
        }
      );
    }

    return result;
  }, [
    requests,
    search,
    typeFilter,
  ]);

  // ============================================================
  // VIEW REQUEST
  // ============================================================

  const handleView = (request) => {
    const id =
      request?._id ||
      request?.id ||
      request?.requestId;

    if (!id) {
      setMessage(
        'Request ID not found'
      );
      return;
    }

    navigate(
      `/outpass/${id}?mode=approval`
    );
  };

  // ============================================================
  // UI
  // ============================================================

  return (
    <DashboardLayout>

      <div className="ctpo-pending-page">

        {/* ======================================================
            HEADER
        ====================================================== */}

        <div className="ctpo-page-header">

          <div className="ctpo-pending-title-row">
            <div>
              <h1>
                Pending Requests
              </h1>

              <p>
                Requests waiting for your approval
              </p>
            </div>
          </div>

        </div>

        {/* ======================================================
            SEARCH + FILTER BAR
        ====================================================== */}

        <div
          className="ctpo-filter-bar"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            marginBottom: '24px',
            flexWrap: 'wrap',
          }}
        >

          {/* ==================================================
              SEARCH BOX
          ================================================== */}

          <div
            className="ctpo-search-box"
            style={{
              position: 'relative',
              flex: '1 1 auto',
              minWidth: 0,
              width: '100%',
              background: 'transparent',
              border: 'none',
              boxShadow: 'none',
              padding: 0,
            }}
          >

            {/* LEFT SEARCH ICON REMOVED */}

            <input
              type="text"
              placeholder="Search by student name or roll number..."
              value={searchInput}
              onChange={
                handleSearchInputChange
              }
              onKeyDown={
                handleSearchKeyDown
              }
              style={{
                width: '100%',
                height: '48px',

                // Changed from 44px because
                // there is no left search icon now
                paddingLeft: '16px',

                paddingRight: '58px',
                borderRadius: '10px',
                border:
                  '1px solid #dbe3ef',
                outline: 'none',
                background: '#ffffff',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            />

            {/* RIGHT SEARCH BUTTON */}

            <button
              type="button"
              onClick={handleSearch}
              title="Search"
              aria-label="Search"
              style={{
                position: 'absolute',
                right: '7px',
                top: '50%',
                transform:
                  'translateY(-50%)',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                borderRadius: '8px',
                background: 'transparent',
                color: '#475569',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <Search size={19} />
            </button>

          </div>

          {/* ==================================================
              TYPE FILTERS
          ================================================== */}

          <div
            className="ctpo-type-filters"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >

            {[
              {
                value: 'ALL',
                label: 'All Types',
              },
              {
                value: 'OUT-PASS',
                label: 'Out-Pass',
              },
              {
                value: 'MESS',
                label: 'Mess Fee',
              },
              {
                value: 'INTERNSHIP',
                label: 'Internship',
              },
              {
                value: 'LIBRARY',
                label: 'Library',
              },
            ].map(
              (filter) => (

                <button
                  key={
                    filter.value
                  }
                  type="button"
                  className={
                    typeFilter ===
                      filter.value
                      ? 'ctpo-filter active'
                      : 'ctpo-filter'
                  }
                  onClick={() =>
                    setTypeFilter(
                      filter.value
                    )
                  }
                  style={{
                    height: '48px',
                    padding:
                      '0 18px',
                    borderRadius:
                      '10px',
                    border:
                      typeFilter ===
                        filter.value
                        ? '1px solid #10b981'
                        : '1px solid #dbe3ef',
                    background:
                      typeFilter ===
                        filter.value
                        ? '#10b981'
                        : '#ffffff',
                    color:
                      typeFilter ===
                        filter.value
                        ? '#ffffff'
                        : '#475569',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    whiteSpace:
                      'nowrap',
                  }}
                >
                  {filter.label}
                </button>

              )
            )}

          </div>

        </div>

        {/* ======================================================
            MESSAGE
        ====================================================== */}

        {message && (
          <div className="ctpo-message">
            {message}
          </div>
        )}

        {/* ======================================================
            TABLE
        ====================================================== */}

        <div className="ctpo-table-card">

          {/* LOADING */}

          {loading ? (

            <div className="ctpo-loading">
              Loading pending requests...
            </div>

          ) : filteredRequests.length === 0 ? (

            <div className="ctpo-empty-state">

              <div className="ctpo-empty-icon">
                <CheckCircle2 size={42} />
              </div>

              <h2>
                All caught up!
              </h2>

              <p>
                No requests are currently
                pending in your queue.
              </p>

            </div>

          ) : (

            <div className="ctpo-table-wrapper">

              <table className="ctpo-request-table">

                <thead>

                  <tr>
                    <th>#</th>
                    <th>Student Name</th>
                    <th>Roll No.</th>
                    <th>Permission Type</th>
                    <th>Purpose</th>
                    <th>Date Submitted</th>
                    <th>Actions</th>
                  </tr>

                </thead>

                <tbody>

                  {filteredRequests.map(
                    (request, index) => {

                      const id =
                        request?._id ||
                        request?.id ||
                        request?.requestId;

                      const studentName =
                        getStudentName(
                          request
                        );

                      const rollNumber =
                        getRollNumber(
                          request
                        );

                      const branch =
                        getBranch(
                          request
                        );

                      const permissionType =
                        getPermissionTypeLabel(
                          request
                        );

                      const purpose =
                        getPurpose(
                          request
                        );

                      const date =
                        getDate(
                          request
                        );

                      return (

                        <tr
                          key={
                            id ||
                            `${studentName}-${index}`
                          }
                        >

                          {/* NUMBER */}

                          <td data-label="#">
                            {index + 1}
                          </td>

                          {/* STUDENT */}

                          <td data-label="Student">

                            <div className="ctpo-student-name">
                              {studentName}
                            </div>

                            {branch && (
                              <div className="ctpo-student-branch">
                                {branch}
                              </div>
                            )}

                          </td>

                          {/* ROLL NUMBER */}

                          <td data-label="Roll No">
                            {rollNumber}
                          </td>

                          <td data-label="Type">
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                              <span className="ctpo-type-badge">
                                <FileText size={14} />
                                {permissionType}
                              </span>
                            </div>
                          </td>

                          {/* PURPOSE */}

                          <td data-label="Purpose">
                            {purpose}
                          </td>

                          {/* DATE */}

                          <td data-label="Date">
                            {date}
                          </td>

                          {/* ACTIONS */}

                          <td data-label="Action">

                            <div className="ctpo-actions">

                              {/* ONLY VIEW BUTTON */}

                              <button
                                type="button"
                                className="ctpo-view-button"
                                onClick={() =>
                                  handleView(
                                    request
                                  )
                                }
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
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
                                <Eye size={15} />
                                View
                              </button>

                            </div>

                          </td>

                        </tr>

                      );
                    }
                  )}

                </tbody>

              </table>

            </div>

          )}

        </div>

      </div>

    </DashboardLayout>
  );
}

