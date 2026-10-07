export const simplifyStatus = (status) => {
    if (!status) return 'Pending';
    const s = status.toLowerCase();
    if (s.includes('reject')) return 'Rejected';
    if (s.includes('approve') || s.includes('issued') || s.includes('used')) return 'Approved';
    return 'Pending';
};

export const getRefId = (request) => {
    if (!request) return 'N/A';
    const rawRef = request.referenceId || request.refId;
    if (rawRef && rawRef !== 'N/A') return rawRef;
    
    const id = (request._id || request.id || '').toString();
    const date = new Date(request.createdAt || Date.now());
    const year = date.getFullYear();
    const shortId = id.slice(-6).toUpperCase();
    
    if (shortId) {
        return `KDP-${year}-${shortId}`;
    }
    return 'N/A';
};

export const formatDateDMY = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).replace(/\//g, '-');
};

export const formatTime12 = (timeString) => {
    if (!timeString) return '';
    
    // Check if it's already a full date string or just a time like HH:MM
    if (timeString.includes('T') || timeString.includes(' ')) {
        const d = new Date(timeString);
        if (isNaN(d.getTime())) return timeString;
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    
    // For raw time strings like "14:30"
    const [hours, minutes] = timeString.split(':');
    if (!hours || !minutes) return timeString;
    
    let h = parseInt(hours, 10);
    const m = parseInt(minutes, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12; // the hour '0' should be '12'
    
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
};

export const formatDuration = (start, end) => {
    if (!start || !end) return '';
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return '';
    
    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive
    
    return `${formatDateDMY(start)} to ${formatDateDMY(end)} (${diffDays} days)`;
};

export const formatINR = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount);
};
