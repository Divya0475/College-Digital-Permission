const mongoose = require('mongoose');
const { GridFSBucket, ObjectId } = require('mongodb');
const QRCode = require('qrcode');
const OutpassRequest = require('../../models/OutpassRequest');
const ApprovalStep = require('../../models/ApprovalStep');
const QRPass = require('../../models/QRPass');
const User = require('../../models/User');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const QR_TOKEN_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

const createQRToken = () => {
  const suffix = Array.from(
    { length: 6 },
    () => QR_TOKEN_ALPHABET[crypto.randomInt(QR_TOKEN_ALPHABET.length)]
  ).join('');
  return `SVT-${suffix}`;
};

const createUniqueQRPass = async (requestId, expiresAt) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const qrPass = await QRPass.create({
        requestId,
        token: createQRToken(),
        expiresAt
      });
      return qrPass.token;
    } catch (error) {
      const duplicateToken =
        error?.code === 11000 &&
        (error.keyPattern?.token || error.keyValue?.token);
      if (!duplicateToken) throw error;
    }
  }

  throw new Error('Could not generate a unique QR pass token after multiple attempts.');
};

const ensureCurrentQRTokenFormat = async (qrPass) => {
  if (/^SVT-[A-Z0-9]{6}$/.test(qrPass.token)) return false;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    qrPass.token = createQRToken();
    try {
      await qrPass.save();
      return true;
    } catch (error) {
      const duplicateToken =
        error?.code === 11000 &&
        (error.keyPattern?.token || error.keyValue?.token);
      if (!duplicateToken) throw error;
    }
  }

  throw new Error('Could not replace the legacy QR token with a unique token.');
};


// ─────────────────────────────────────────────────────────────
// FILE UPLOAD
// ─────────────────────────────────────────────────────────────

exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const uploadDir = path.join(__dirname, '../../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(req.file.originalname || '');
    const diskPath = path.join(uploadDir, uniqueName);
    
    // Save to local disk for fast serving
    fs.writeFileSync(diskPath, req.file.buffer);

    let gridFsId = null;
    const db = mongoose.connection.db;
    if (db) {
      try {
        const bucket = new GridFSBucket(db, { bucketName: 'uploads' });
        const uploadStream = bucket.openUploadStream(uniqueName, {
          contentType: req.file.mimetype,
          metadata: {
            uploadedBy: req.user.id,
            kind: 'outpass-document',
            originalName: req.file.originalname,
            contentType: req.file.mimetype
          }
        });
        
        await new Promise((resolve, reject) => {
          uploadStream.on('finish', resolve);
          uploadStream.on('error', reject);
          uploadStream.end(req.file.buffer);
        });
        
        gridFsId = uploadStream.id;
      } catch (err) {
        console.warn('GridFS save warning:', err);
      }
    }

    const fileUrl = `/uploads/${uniqueName}`;

    res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        fileUrl,
        fileName: req.file.originalname,
        storedFileName: uniqueName,
        gridFsId
      }
    });

  } catch (e) {
    console.error('[FILE UPLOAD ERROR]', e);
    res.status(500).json({
      success: false,
      message: 'File upload failed'
    });
  }
};


// ─────────────────────────────────────────────────────────────
// CREATE REQUEST
// ─────────────────────────────────────────────────────────────

exports.createRequest = async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      requestType,
      permissionType,
      year,
      yearTier,
      branchId,
      outDate,
      outTime,
      returnDate,
      returnTime,
      reason,
      documentUrl,
      documentName,
      ...otherFields
    } = req.body;

    const type = requestType || permissionType;

    if (!type) {
      return res.status(400).json({
        success: false,
        message: 'Request type is required'
      });
    }

    const student = await User.findById(userId);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const request = await OutpassRequest.create({
      ...otherFields,

      studentId: userId,

      requestType: type,

      year:
        year ||
        student.year ||
        null,

      yearTier:
        yearTier ||
        student.yearTier ||
        null,

      branchId:
        branchId ||
        student.branchId ||
        null,

      outDate,
      outTime,
      returnDate,
      returnTime,

      reason,

      documentUrl: documentUrl || '',
      documentName: documentName || '',

      status: 'PENDING_CTPO',

      currentApproverRole: 'CTPO'
    });

    res.status(201).json({
      success: true,
      data: request
    });

  } catch (e) {
    console.error('[CREATE REQUEST ERROR]', e);

    res.status(500).json({
      success: false,
      message: e.message || 'Server error'
    });
  }
};


// ─────────────────────────────────────────────────────────────
// GET MY REQUESTS
// ─────────────────────────────────────────────────────────────

exports.getMyRequests = async (req, res) => {
  try {
    const requests = await OutpassRequest.find({
      studentId: req.user.id
    })
      .populate('branchId')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: requests
    });

  } catch (e) {
    console.error('[GET MY REQUESTS ERROR]', e);

    res.status(500).json({
      success: false,
      message: e.message || 'Server error'
    });
  }
};


// ─────────────────────────────────────────────────────────────
// GET SINGLE REQUEST
// ─────────────────────────────────────────────────────────────

exports.getRequest = async (req, res) => {
  try {
    const request = await OutpassRequest.findById(req.params.id)
      .populate('studentId')
      .populate('branchId');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    const steps = await ApprovalStep.find({
      requestId: request._id
    })
      .populate('approverUserId', 'name email role')
      .sort({ decidedAt: 1 });

    res.json({
      success: true,
      data: {
        request,
        approvalSteps: steps
      }
    });

  } catch (e) {
    console.error('[GET REQUEST ERROR]', e);

    res.status(500).json({
      success: false,
      message: e.message || 'Server error'
    });
  }
};


// ─────────────────────────────────────────────────────────────
// GET ALL REQUESTS FOR APPROVER
// ─────────────────────────────────────────────────────────────

exports.getAllForMe = async (req, res) => {
  try {
    const { role, id } = req.user;

    let filter = {};

    if (role === 'CTPO') {
      const user = await User.findById(id);

      if (user?.branchId) {
        filter.branchId = user.branchId;
      }

      if (user?.assignedYear) {
        filter.year = user.assignedYear;
      }

    } else if (role === 'HOD') {
      const user = await User.findById(id);

      if (user?.authorityScope?.yearTier) {
        filter.yearTier =
          user.authorityScope.yearTier;
      }

    } else if (role === 'HOSTEL_INCHARGE') {
      // Do nothing, studentType 'HOSTELER' was removed
    } else if (role === 'PLACEMENT_OFFICER') {
      filter.requestType = 'INTERNSHIP';
    }

    const requests = await OutpassRequest.find(filter)
      .populate('studentId')
      .populate('branchId')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: requests
    });

  } catch (e) {
    console.error('[GET ALL REQUESTS ERROR]', e);

    res.status(500).json({
      success: false,
      message: e.message || 'Server error'
    });
  }
};


// ─────────────────────────────────────────────────────────────
// GET PENDING REQUESTS FOR CURRENT APPROVER
// ─────────────────────────────────────────────────────────────

exports.getPendingForMe = async (req, res) => {
  try {
    const { role, id } = req.user;

    let filter = {};

    if (role === 'CTPO') {

      const user = await User.findById(id);

      filter = {
        status: 'PENDING_CTPO'
      };

      if (user?.branchId) {
        filter.branchId = user.branchId;
      }

      if (user?.assignedYear) {
        filter.year = user.assignedYear;
      }

    } else if (role === 'HOD') {

      const user = await User.findById(id);

      // FIX:
      // HOD can handle both status values.
      filter = {
        status: {
          $in: [
            'PENDING_HOD',
            'PENDING_HOD_APPROVAL'
          ]
        }
      };

      if (user?.authorityScope?.yearTier) {
        filter.yearTier =
          user.authorityScope.yearTier;
      }

    } else if (role === 'HOSTEL_INCHARGE') {

      filter = {
        status: 'PENDING_HOSTEL_INCHARGE'
      };

    } else if (role === 'PLACEMENT_OFFICER') {

      filter = {
        status: 'PENDING_PLACEMENT_OFFICER',
        requestType: 'INTERNSHIP'
      };

    } else {

      return res.status(403).json({
        success: false,
        message: 'Your role cannot view pending requests'
      });
    }

    const requests = await OutpassRequest.find(filter)
      .populate('studentId')
      .populate('branchId')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: requests
    });

  } catch (e) {
    console.error('[GET PENDING ERROR]', e);

    res.status(500).json({
      success: false,
      message: e.message || 'Server error'
    });
  }
};


// ─────────────────────────────────────────────────────────────
// WORKFLOW
// ─────────────────────────────────────────────────────────────

function getWorkflowChain(request) {

  const type =
    String(request.requestType || '')
      .toUpperCase();

  if (type === 'OUTPASS') {

    return [
      'CTPO',
      'HOD'
    ];
  }

  if (type === 'MESS_FEE') {
    return [
      'CTPO',
      'HOD'
    ];
  }

  if (type === 'INTERNSHIP') {
    return [
      'CTPO',
      'HOD',
      'PLACEMENT_OFFICER'
    ];
  }

  if (type === 'LIBRARY') {
    return [
      'CTPO'
    ];
  }

  return [
    'CTPO',
    'HOD'
  ];
}


function resolveNextStage(request, decision) {

  if (decision === 'REJECTED') {
    return 'REJECTED';
  }

  const chain = getWorkflowChain(request);

  const currentRole =
    request.currentApproverRole;

  const currentIndex =
    chain.indexOf(currentRole);

  if (currentIndex === -1) {
    return 'APPROVED';
  }

  const nextRole =
    chain[currentIndex + 1];

  if (!nextRole) {

    if (
      request.requestType === 'OUTPASS'
    ) {
      return 'ISSUED';
    }

    if (
      request.requestType === 'MESS_FEE'
    ) {
      return 'CLEARED';
    }

    return 'APPROVED';
  }

  return `PENDING_${nextRole}`;
}


// ─────────────────────────────────────────────────────────────
// AUTHORITY VALIDATION
// ─────────────────────────────────────────────────────────────

async function validateAuthority(request, user) {

  const { role, id } = user;

  if (role === 'CTPO') {

    if (
      request.status !== 'PENDING_CTPO'
    ) {
      return 'Request is not pending CTPO approval';
    }

    const dbUser =
      await User.findById(id);

    if (!dbUser?.branchId) {
      return 'No branch assigned to this CTPO';
    }

    if (
      request.branchId?.toString() !==
      dbUser.branchId.toString()
    ) {
      return 'This request is not from your branch';
    }

    if (
      dbUser.assignedYear &&
      request.year &&
      request.year !== dbUser.assignedYear
    ) {
      return `This request is for Year ${request.year}, but you are CTPO for Year ${dbUser.assignedYear}`;
    }

  } else if (role === 'HOD') {

    // FIX:
    // Accept both HOD pending statuses.
    if (
      ![
        'PENDING_HOD',
        'PENDING_HOD_APPROVAL'
      ].includes(request.status)
    ) {
      return 'Request is not pending HOD approval';
    }

    const dbUser =
      await User.findById(id);

    if (
      dbUser.authorityScope?.yearTier &&
      request.yearTier &&
      request.yearTier !==
      dbUser.authorityScope.yearTier
    ) {
      return 'This request is not in your year tier';
    }



  } else if (role === 'HOSTEL_INCHARGE') {

    if (
      request.status !==
      'PENDING_HOSTEL_INCHARGE'
    ) {
      return 'Request is not pending Hostel In-charge approval';
    }

  } else if (role === 'PLACEMENT_OFFICER') {

    if (
      request.status !==
      'PENDING_PLACEMENT_OFFICER'
    ) {
      return 'Request is not pending Placement Officer approval';
    }

    if (
      request.requestType !==
      'INTERNSHIP'
    ) {
      return 'Placement Officer can only review Internship requests';
    }

  } else {

    return 'Your role cannot approve/reject requests';
  }

  return null;
}


// ─────────────────────────────────────────────────────────────
// APPROVE REQUEST
// ─────────────────────────────────────────────────────────────

exports.approveRequest = async (req, res) => {

  try {

    const request =
      await OutpassRequest.findById(
        req.params.id
      );

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    const authError =
      await validateAuthority(
        request,
        req.user
      );

    if (authError) {
      return res.status(403).json({
        success: false,
        message: authError
      });
    }

    const newStatus =
      resolveNextStage(
        request,
        'APPROVED'
      );

    const prevRole =
      request.currentApproverRole;

    request.status =
      newStatus;

    if (
      newStatus === 'PENDING_HOD'
    ) {
      request.currentApproverRole =
        'HOD';

    } else if (
      newStatus ===
      'PENDING_HOSTEL_INCHARGE'
    ) {
      request.currentApproverRole =
        'HOSTEL_INCHARGE';

    } else if (
      newStatus ===
      'PENDING_PLACEMENT_OFFICER'
    ) {
      request.currentApproverRole =
        'PLACEMENT_OFFICER';

    } else if (
      newStatus === 'ISSUED' ||
      newStatus === 'APPROVED' ||
      newStatus === 'CLEARED'
    ) {
      request.currentApproverRole =
        null;
    }

    await ApprovalStep.create({

      requestId:
        request._id,

      role:
        prevRole,

      approverUserId:
        req.user.id,

      decision:
        'APPROVED',

      remarks:
        req.body?.remarks || ''
    });

    // Create QR only when OUTPASS reaches final issued stage.
    if (
      request.requestType === 'OUTPASS' &&
      newStatus === 'ISSUED'
    ) {

      const expiresAt =
        new Date(request.outDate);

      expiresAt.setHours(
        23,
        59,
        59,
        999
      );

      request.qrToken = await createUniqueQRPass(request._id, expiresAt);
    }

    await request.save();

    res.json({
      success: true,
      data: request
    });

  } catch (e) {

    console.error(
      '[APPROVE REQUEST ERROR]',
      e
    );

    res.status(500).json({
      success: false,
      message:
        e.message ||
        'Server error'
    });
  }
};


// ─────────────────────────────────────────────────────────────
// REJECT REQUEST
// ─────────────────────────────────────────────────────────────

exports.rejectRequest = async (req, res) => {

  try {

    const request =
      await OutpassRequest.findById(
        req.params.id
      );

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    const authError =
      await validateAuthority(
        request,
        req.user
      );

    if (authError) {
      return res.status(403).json({
        success: false,
        message: authError
      });
    }

    if (
      !req.body?.remarks ||
      !String(req.body.remarks).trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Remarks are required when rejecting a request'
      });
    }

    const prevRole =
      request.currentApproverRole;

    const newStatus =
      resolveNextStage(
        request,
        'REJECTED'
      );

    request.status =
      newStatus;

    request.currentApproverRole =
      null;

    request.rejectionReason =
      req.body.remarks;

    request.rejectedByRole =
      prevRole;

    await ApprovalStep.create({

      requestId:
        request._id,

      role:
        prevRole,

      approverUserId:
        req.user.id,

      decision:
        'REJECTED',

      remarks:
        req.body.remarks
    });

    await request.save();

    res.json({
      success: true,
      data: request
    });

  } catch (e) {

    // Important:
    // This prints the real backend error in the terminal
    // instead of hiding it behind "Server error".
    console.error(
      '[REJECT REQUEST ERROR]',
      e
    );

    res.status(500).json({
      success: false,
      message:
        e.message ||
        'Server error'
    });
  }
};


// ─────────────────────────────────────────────────────────────
// DASHBOARD STATS
// ─────────────────────────────────────────────────────────────

exports.getDashboardStats = async (req, res) => {

  try {

    const {
      role,
      id
    } = req.user;

    const sevenDaysAgo =
      new Date();

    sevenDaysAgo.setDate(
      sevenDaysAgo.getDate() - 7
    );

    sevenDaysAgo.setHours(
      0,
      0,
      0,
      0
    );

    let matchFilter = {
      createdAt: {
        $gte: sevenDaysAgo
      }
    };

    if (role === 'CTPO') {

      const user =
        await User.findById(id);

      if (user?.branchId) {
        matchFilter.branchId =
          user.branchId;
      }

      if (user?.assignedYear) {
        matchFilter.year =
          user.assignedYear;
      }

    } else if (role === 'HOD') {

      const user =
        await User.findById(id);

      if (
        user?.authorityScope?.yearTier
      ) {
        matchFilter.yearTier =
          user.authorityScope.yearTier;
      }



    } else if (
      role === 'HOSTEL_INCHARGE'
    ) {



    } else if (
      role === 'PLACEMENT_OFFICER'
    ) {

      matchFilter.requestType =
        'INTERNSHIP';
    }

    const [
      total,
      approved,
      pending,
      rejected
    ] = await Promise.all([

      OutpassRequest.countDocuments(
        matchFilter
      ),

      OutpassRequest.countDocuments({
        ...matchFilter,
        status: {
          $in: [
            'APPROVED',
            'ISSUED',
            'CLEARED',
            'USED'
          ]
        }
      }),

      OutpassRequest.countDocuments({
        ...matchFilter,

        // FIX:
        // HOD pending count includes both
        // PENDING_HOD and PENDING_HOD_APPROVAL.
        status:
          role === 'HOD'
            ? {
              $in: [
                'PENDING_HOD',
                'PENDING_HOD_APPROVAL'
              ]
            }
            : role === 'CTPO'
              ? 'PENDING_CTPO'
              : role ===
                'HOSTEL_INCHARGE'
                ? 'PENDING_HOSTEL_INCHARGE'
                : 'PENDING_PLACEMENT_OFFICER'
      }),

      OutpassRequest.countDocuments({
        ...matchFilter,
        status: {
          $in: [
            'REJECTED',
            'REJECTED_BY_CTPO',
            'REJECTED_BY_HOD',
            'REJECTED_BY_HOSTEL_INCHARGE',
            'REJECTED_BY_PLACEMENT_OFFICER'
          ]
        }
      })
    ]);

    res.json({
      success: true,

      data: {
        total,
        approved,
        pending,
        rejected
      }
    });

  } catch (e) {

    console.error(
      '[DASHBOARD STATS ERROR]',
      e
    );

    res.status(500).json({
      success: false,
      message:
        e.message ||
        'Server error'
    });
  }
};


// ─────────────────────────────────────────────────────────────
// RESUBMIT REQUEST
// ─────────────────────────────────────────────────────────────

exports.resubmitRequest = async (req, res) => {

  try {

    const request =
      await OutpassRequest.findById(
        req.params.id
      );

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    if (
      request.studentId.toString() !==
      req.user.id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message:
          'You can only resubmit your own request'
      });
    }

    if (
      !String(request.status || '')
        .startsWith('REJECTED')
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Only rejected requests can be resubmitted'
      });
    }

    const {
      reason,
      documentUrl,
      documentName,
      ...otherFields
    } = req.body;

    Object.assign(
      request,
      otherFields
    );

    if (reason !== undefined) {
      request.reason =
        reason;
    }

    if (documentUrl !== undefined) {
      request.documentUrl =
        documentUrl;
    }

    if (documentName !== undefined) {
      request.documentName =
        documentName;
    }

    request.status =
      'PENDING_CTPO';

    request.currentApproverRole =
      'CTPO';

    request.rejectionReason =
      '';

    request.rejectedByRole =
      null;

    request.resubmissionCount =
      (request.resubmissionCount || 0) + 1;

    await request.save();

    res.json({
      success: true,
      data: request
    });

  } catch (e) {

    console.error(
      '[RESUBMIT ERROR]',
      e
    );

    res.status(500).json({
      success: false,
      message:
        e.message ||
        'Server error'
    });
  }
};

// ─────────────────────────────────────────────────────────────
// QR PASS IMAGE
// ─────────────────────────────────────────────────────────────
exports.getQRImage = async (req, res) => {
  try {
    const request = await OutpassRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

    // Authorization: only the owning student or admin
    if (req.user.role === 'STUDENT' && request.studentId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (request.status !== 'ISSUED' && request.status !== 'USED' && request.status !== 'APPROVED') {
      return res.status(400).json({ success: false, message: 'QR is only available for issued passes' });
    }

    const qrPass = await QRPass.findOne({ requestId: request._id });
    if (!qrPass) return res.status(404).json({ success: false, message: 'QR pass not found' });

    const tokenUpdated = await ensureCurrentQRTokenFormat(qrPass);
    if (tokenUpdated) {
      request.qrToken = qrPass.token;
      await request.save();
    }

    const verifyUrl = `${process.env.QR_BASE_URL || 'http://localhost:5173'}/verify/${qrPass.token}`;
    const qrImage = await QRCode.toDataURL(verifyUrl, { width: 300, margin: 2 });

    res.json({
      success: true,
      data: {
        qrImage,
        token: qrPass.token,
        status: qrPass.status,
        issuedAt: qrPass.issuedAt,
        expiresAt: qrPass.expiresAt
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────
// GET PROOF FILE (GridFS or disk storage support)
// ─────────────────────────────────────────────────────────────
exports.getProofFile = async (req, res) => {
  try {
    const { fileId } = req.params;

    // Check if file exists on disk first
    const diskPath = path.join(__dirname, '../../../uploads', fileId);
    if (fs.existsSync(diskPath)) {
      return res.sendFile(diskPath);
    }

    if (!ObjectId.isValid(fileId)) {
      return res.status(400).json({ success: false, message: 'Invalid proof file id' });
    }

    const db = mongoose.connection.db;
    if (!db) {
      return res.status(503).json({ success: false, message: 'Database unavailable' });
    }

    const request = await OutpassRequest.findOne({
      $or: [
        { documentFileId: fileId },
        { documentUrl: { $regex: new RegExp(`/uploads/${fileId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), $options: 'i' } }
      ]
    }).populate('studentId', 'name role branchId year yearTier').populate('branchId', 'name code');

    if (!request) {
      // Check directly in GridFS
      const file = await db.collection('uploads.files').findOne({ _id: new ObjectId(fileId) });
      if (!file) {
        return res.status(404).json({ success: false, message: 'Proof file not found' });
      }
      res.setHeader('Content-Type', file.contentType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
      const bucket = new GridFSBucket(db, { bucketName: 'uploads' });
      const stream = bucket.openDownloadStream(new ObjectId(fileId));
      stream.on('error', () => res.status(404).json({ success: false, message: 'Proof file not found' }));
      return stream.pipe(res);
    }

    const requestStudentId = request.studentId?._id?.toString();
    const isOwner = req.user.role === 'STUDENT' && requestStudentId === req.user.id;

    let isAuthorized = isOwner;
    if (!isAuthorized) {
      const actingUser = await User.findById(req.user.id).lean();
      if (!actingUser) {
        return res.status(401).json({ success: false, message: 'Authenticated user not found' });
      }

      if (req.user.role === 'ADMIN') {
        isAuthorized = true;
      } else if (req.user.role === 'CTPO') {
        isAuthorized = !!request.branchId && actingUser.branchId && request.branchId.toString() === actingUser.branchId.toString() &&
          (!actingUser.assignedYear || !request.year || request.year === actingUser.assignedYear);
      } else if (req.user.role === 'HOD') {
        isAuthorized = (!actingUser.authorityScope?.yearTier || request.yearTier === actingUser.authorityScope.yearTier);
      } else if (req.user.role === 'HOSTEL_INCHARGE') {
        isAuthorized = false;
      } else if (req.user.role === 'PLACEMENT_OFFICER') {
        isAuthorized = request.requestType === 'INTERNSHIP';
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({ success: false, message: 'Access denied: you are not allowed to view this proof' });
    }

    const file = await db.collection('uploads.files').findOne({ _id: new ObjectId(fileId) });
    if (!file) {
      return res.status(404).json({ success: false, message: 'Proof file not found in GridFS' });
    }

    res.setHeader('Content-Type', file.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);

    const bucket = new GridFSBucket(db, { bucketName: 'uploads' });
    const stream = bucket.openDownloadStream(new ObjectId(fileId));
    stream.on('error', () => {
      res.status(404).json({ success: false, message: 'Proof file not found' });
    });
    stream.pipe(res);
  } catch (e) {
    console.error('Get proof file error:', e);
    res.status(500).json({ success: false, message: 'Error fetching proof file' });
  }
};