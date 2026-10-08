import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const isValidDate = (value) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const year = date.getFullYear();
  return year >= 2000 && year <= 2100;
};

export function formatDate(value) {
  if (!isValidDate(value)) return 'Invalid date';
  return new Date(value).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).replace(/\//g, '-');
}

export function formatDateTime(value) {
  if (!isValidDate(value)) return 'Invalid date';
  const date = new Date(value);
  const datePart = date.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).replace(/\//g, '-');
  const timePart = date.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return `${datePart}, ${timePart}`;
}

export function formatDuration(start, end) {
  if (!isValidDate(start) || !isValidDate(end)) return 'Invalid date';
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffTime = endDate.getTime() - startDate.getTime();
  if (diffTime < 0) return 'Invalid date';
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return `${formatDate(start)} to ${formatDate(end)} (${diffDays} ${diffDays === 1 ? 'day' : 'days'})`;
}

export function getSimplifiedStatus(status) {
  if (!status) return 'Pending';
  const value = String(status).toLowerCase();
  if (value.includes('reject')) return 'Rejected';
  if (value.includes('pending')) return 'Pending';
  if (value.includes('approve') || value.includes('issued') || value.includes('used')) return 'Approved';
  return 'Pending';
}

export function getOrdinalYear(year) {
  const value = String(year).replace(/\D/g, '');
  if (value === '1') return '1st Year';
  if (value === '2') return '2nd Year';
  if (value === '3') return '3rd Year';
  if (value === '4') return '4th Year';
  return '';
}

export function formatTime12(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})/);
  if (!match) return value || '';
  const hour = Number(match[1]);
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${match[2]} ${period}`;
}
