import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface ApproverInfo {
  supervisorName?: string;
  hcgaName?: string;
}

const drawDottedLine = (doc: jsPDF, x: number, y: number, width: number) => {
  doc.setDrawColor(100);
  doc.setLineWidth(0.3);
  const step = 2;
  for (let i = 0; i < width; i += step * 2) {
    doc.line(x + i, y, x + i + step, y);
  }
  doc.setDrawColor(0);
};

const drawHeader = (doc: jsPDF): number => {
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 18;

  // PETROLOG header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 51, 102);
  doc.text('PETROLOG', 15, y);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80);
  doc.text('HEAVY LOGISTICS | PLANT SERVICES | ENVIRO SERVICES', 15, y + 5);
  doc.setTextColor(0);

  y += 16;
  doc.setDrawColor(0, 51, 102);
  doc.setLineWidth(0.8);
  doc.line(15, y, pageWidth - 15, y);

  return y + 10;
};

export const generateLeaveRequestPDF = (request: any, approverNames: ApproverInfo) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const leftMargin = 15;
  const rightMargin = pageWidth - 15;
  const contentWidth = rightMargin - leftMargin;

  let y = drawHeader(doc);

  // Title
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text('APPLICATION FOR LEAVE', pageWidth / 2, y, { align: 'center' });
  y += 6;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('PERMINTAAN CUTI', pageWidth / 2, y, { align: 'center' });
  y += 12;

  // Separator line
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.line(leftMargin, y, rightMargin, y);
  y += 10;

  const midX = pageWidth / 2 + 5;

  // Row 1: Name & Service Date
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Name :', leftMargin, y);
  doc.setFont('helvetica', 'italic');
  doc.text('Nama', leftMargin, y + 4);
  doc.setFont('helvetica', 'bold');
  doc.text(request.staff_name || '-', leftMargin + 25, y);
  drawDottedLine(doc, leftMargin + 24, y + 1, 55);

  doc.setFont('helvetica', 'normal');
  doc.text('Service Date :', midX, y);
  doc.setFont('helvetica', 'italic');
  doc.text('Tanggal menjadi karyawan', midX, y + 4);
  doc.setFont('helvetica', 'bold');
  const joinDateStr = request.join_date
    ? format(new Date(request.join_date), 'dd MMMM yyyy', { locale: idLocale })
    : '-';
  doc.text(joinDateStr, midX + 35, y);
  drawDottedLine(doc, midX + 34, y + 1, 50);
  y += 14;

  // Row 2: Annual leave period
  doc.setFont('helvetica', 'normal');
  doc.text('Annual leave, from :', leftMargin, y);
  doc.setFont('helvetica', 'italic');
  doc.text('Cuti tahunan, dari', leftMargin, y + 4);
  doc.setFont('helvetica', 'bold');
  doc.text(String(request.leave_year || '-'), leftMargin + 45, y);
  drawDottedLine(doc, leftMargin + 44, y + 1, 35);

  doc.setFont('helvetica', 'normal');
  doc.text('To :', midX, y);
  doc.setFont('helvetica', 'italic');
  doc.text('s/d', midX, y + 4);
  doc.setFont('helvetica', 'bold');
  doc.text(String(request.leave_year || '-'), midX + 15, y);
  drawDottedLine(doc, midX + 14, y + 1, 70);
  y += 14;

  // Row 3: Total number of days
  doc.setFont('helvetica', 'normal');
  doc.text('Total number of days leave :', leftMargin, y);
  doc.setFont('helvetica', 'italic');
  doc.text('Jumlah hari cuti', leftMargin, y + 4);
  doc.setFont('helvetica', 'bold');
  doc.text(String(request.days_requested || '-'), leftMargin + 62, y);
  drawDottedLine(doc, leftMargin + 60, y + 1, 20);
  doc.setFont('helvetica', 'normal');
  doc.text('Days / hari', leftMargin + 85, y);
  y += 14;

  // Row 4: Last annual leave taken
  const usedDays = request.previous_year_balance != null 
    ? (12 - (request.remaining_balance || 0) - request.days_requested)
    : '-';
  doc.setFont('helvetica', 'normal');
  doc.text('The last annual leave had been taken :', leftMargin, y);
  doc.setFont('helvetica', 'italic');
  doc.text('Cuti terakhir telah diambil', leftMargin, y + 4);
  doc.setFont('helvetica', 'bold');
  doc.text(String(usedDays), leftMargin + 85, y);
  drawDottedLine(doc, leftMargin + 84, y + 1, contentWidth - 85);
  y += 18;

  // BALANCE RECORD
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('BALANCE RECORD', pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(11);
  doc.text('PERHITUNGAN CUTI', pageWidth / 2, y, { align: 'center' });
  y += 12;

  // Leave Requested details
  const leaveDates = Array.isArray(request.leave_dates) ? request.leave_dates.sort() : [];
  const firstDate = leaveDates.length > 0 ? leaveDates[0] : '-';
  const lastDate = leaveDates.length > 0 ? leaveDates[leaveDates.length - 1] : '-';

  const formatDateShort = (d: string) => {
    try { return format(new Date(d), 'dd-MM-yyyy'); } catch { return d; }
  };

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Leave Requested :', leftMargin, y);
  doc.setFont('helvetica', 'italic');
  doc.text('Permintaan cuti', leftMargin, y + 4);

  doc.setFont('helvetica', 'bold');
  doc.text(String(request.days_requested || '-'), leftMargin + 42, y);
  drawDottedLine(doc, leftMargin + 40, y + 1, 12);

  doc.setFont('helvetica', 'normal');
  doc.text('days, day off from :', leftMargin + 55, y);
  doc.setFont('helvetica', 'italic');
  doc.text('hari, dari tanggal', leftMargin + 55, y + 4);

  doc.setFont('helvetica', 'bold');
  doc.text(formatDateShort(firstDate), leftMargin + 100, y);
  drawDottedLine(doc, leftMargin + 98, y + 1, 30);

  doc.setFont('helvetica', 'normal');
  doc.text('to', leftMargin + 133, y);
  doc.setFont('helvetica', 'italic');
  doc.text('s/d', leftMargin + 133, y + 4);

  doc.setFont('helvetica', 'bold');
  doc.text(formatDateShort(lastDate), leftMargin + 143, y);
  drawDottedLine(doc, leftMargin + 141, y + 1, contentWidth - 143);
  y += 14;

  // New leave balance
  doc.setFont('helvetica', 'normal');
  doc.text('New leave balance :', leftMargin, y);
  doc.setFont('helvetica', 'italic');
  doc.text('Sisa cuti', leftMargin, y + 4);
  doc.setFont('helvetica', 'bold');
  doc.text(
    request.remaining_balance != null ? String(request.remaining_balance) : '-',
    leftMargin + 45, y
  );
  drawDottedLine(doc, leftMargin + 43, y + 1, 40);
  y += 22;

  // Signature Section
  const colWidth = contentWidth / 3;
  const col1 = leftMargin;
  const col2 = leftMargin + colWidth;
  const col3 = leftMargin + colWidth * 2;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Employee', col1, y);
  doc.text('Approved by', col2, y);
  doc.text('Acknowledge by', col3, y);
  y += 4;
  doc.setFont('helvetica', 'italic');
  doc.text('Pegawai', col1, y);
  doc.text('Disetujui oleh', col2, y);
  doc.text('Diketahui oleh', col3, y);
  y += 4;

  // Stamp areas
  const stampY = y + 12;

  // Employee stamp area (no stamp, just space for signature)
  if (request.supervisor_status === 'approved') {
    drawApprovedStamp(doc, col2 + 15, stampY, request.supervisor_approved_at);
  } else if (request.supervisor_status === 'rejected') {
    drawRejectedStamp(doc, col2 + 15, stampY);
  }

  if (request.hcga_status === 'approved') {
    drawApprovedStamp(doc, col3 + 15, stampY, request.hcga_approved_at);
  } else if (request.hcga_status === 'rejected') {
    drawRejectedStamp(doc, col3 + 15, stampY);
  }

  y = stampY + 14;

  // Names under signatures
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(request.staff_name || '-', col1, y);
  doc.text(approverNames.supervisorName || '-', col2, y);
  doc.text(approverNames.hcgaName || '-', col3, y);
  y += 3;
  drawDottedLine(doc, col1, y, colWidth - 10);
  drawDottedLine(doc, col2, y, colWidth - 10);
  drawDottedLine(doc, col3, y, colWidth - 10);
  y += 14;

  // Recommended by Supervisor
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Recommended by the Supervisor concerned :', leftMargin, y);
  drawDottedLine(doc, leftMargin + 90, y + 1, contentWidth - 92);
  y += 4;
  doc.setFont('helvetica', 'italic');
  doc.text('Dianjurkan oleh atasan yang bersangkutan', leftMargin, y);
  if (request.supervisor_recommendation) {
    doc.setFont('helvetica', 'normal');
    doc.text(request.supervisor_recommendation, leftMargin + 90, y - 4);
  }
  y += 10;

  // Other decision
  doc.setFont('helvetica', 'normal');
  doc.text('Other decision :', leftMargin, y);
  drawDottedLine(doc, leftMargin + 38, y + 1, contentWidth - 40);
  y += 4;
  doc.setFont('helvetica', 'italic');
  doc.text('Keputusan lainnya', leftMargin, y);
  if (request.other_decisions) {
    doc.setFont('helvetica', 'normal');
    doc.text(request.other_decisions, leftMargin + 38, y - 4);
  }

  // Footer
  y += 12;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120);
  doc.text(`Diajukan pada: ${request.created_at ? format(new Date(request.created_at), 'dd MMMM yyyy HH:mm', { locale: idLocale }) : '-'}`, leftMargin, y);
  doc.text(`No: ${request.request_number}`, rightMargin, y, { align: 'right' });
  doc.setTextColor(0);

  doc.save(`Cuti_${request.request_number.replace(/\//g, '-')}.pdf`);
};

export const generatePermissionRequestPDF = (request: any, approverNames: ApproverInfo) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const leftMargin = 15;
  const rightMargin = pageWidth - 15;
  const contentWidth = rightMargin - leftMargin;

  let y = drawHeader(doc);

  // Title
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('APPLICATION FOR PERMISSION', pageWidth / 2, y, { align: 'center' });
  y += 6;
  doc.setFontSize(13);
  doc.text('PERMOHONAN IJIN', pageWidth / 2, y, { align: 'center' });
  y += 12;

  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.line(leftMargin, y, rightMargin, y);
  y += 10;

  const midX = pageWidth / 2 + 5;

  // Name & Service Date
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Name :', leftMargin, y);
  doc.setFont('helvetica', 'italic');
  doc.text('Nama', leftMargin, y + 4);
  doc.setFont('helvetica', 'bold');
  doc.text(request.staff_name || '-', leftMargin + 25, y);
  drawDottedLine(doc, leftMargin + 24, y + 1, 55);

  doc.setFont('helvetica', 'normal');
  doc.text('Service Date :', midX, y);
  doc.setFont('helvetica', 'italic');
  doc.text('Tanggal menjadi karyawan', midX, y + 4);
  doc.setFont('helvetica', 'bold');
  const joinDateStr = request.join_date
    ? format(new Date(request.join_date), 'dd MMMM yyyy', { locale: idLocale })
    : '-';
  doc.text(joinDateStr, midX + 35, y);
  drawDottedLine(doc, midX + 34, y + 1, 50);
  y += 14;

  // Position & Department
  doc.setFont('helvetica', 'normal');
  doc.text('Position :', leftMargin, y);
  doc.setFont('helvetica', 'italic');
  doc.text('Jabatan', leftMargin, y + 4);
  doc.setFont('helvetica', 'bold');
  doc.text(request.position || '-', leftMargin + 25, y);
  drawDottedLine(doc, leftMargin + 24, y + 1, 55);

  doc.setFont('helvetica', 'normal');
  doc.text('Department :', midX, y);
  doc.setFont('helvetica', 'italic');
  doc.text('Departemen', midX, y + 4);
  doc.setFont('helvetica', 'bold');
  doc.text(request.department || '-', midX + 30, y);
  drawDottedLine(doc, midX + 29, y + 1, 55);
  y += 14;

  // Phone
  doc.setFont('helvetica', 'normal');
  doc.text('Phone Number :', leftMargin, y);
  doc.setFont('helvetica', 'italic');
  doc.text('Nomor Telepon', leftMargin, y + 4);
  doc.setFont('helvetica', 'bold');
  doc.text(request.phone_number || '-', leftMargin + 38, y);
  drawDottedLine(doc, leftMargin + 37, y + 1, contentWidth - 38);
  y += 18;

  // Permission Details
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('PERMISSION DETAILS', pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(11);
  doc.text('DETAIL PERMOHONAN IJIN', pageWidth / 2, y, { align: 'center' });
  y += 12;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Permission Duration :', leftMargin, y);
  doc.setFont('helvetica', 'italic');
  doc.text('Durasi ijin', leftMargin, y + 4);
  doc.setFont('helvetica', 'bold');
  doc.text(request.permission_duration || '-', leftMargin + 48, y);
  drawDottedLine(doc, leftMargin + 47, y + 1, contentWidth - 48);
  y += 14;

  doc.setFont('helvetica', 'normal');
  doc.text('Permission Date :', leftMargin, y);
  doc.setFont('helvetica', 'italic');
  doc.text('Tanggal ijin', leftMargin, y + 4);
  doc.setFont('helvetica', 'bold');
  const permDateStr = request.permission_date
    ? format(new Date(request.permission_date), 'dd MMMM yyyy', { locale: idLocale })
    : '-';
  doc.text(permDateStr, leftMargin + 42, y);
  drawDottedLine(doc, leftMargin + 41, y + 1, contentWidth - 42);
  y += 14;

  doc.setFont('helvetica', 'normal');
  doc.text('Reason :', leftMargin, y);
  doc.setFont('helvetica', 'italic');
  doc.text('Alasan', leftMargin, y + 4);
  doc.setFont('helvetica', 'bold');
  const reasonLines = doc.splitTextToSize(request.reason || '-', contentWidth - 25);
  doc.text(reasonLines, leftMargin + 22, y);
  drawDottedLine(doc, leftMargin + 21, y + 1, contentWidth - 22);
  y += Math.max(14, reasonLines.length * 5 + 8);

  // Signature section
  y += 8;
  const colWidth = contentWidth / 3;
  const col1 = leftMargin;
  const col2 = leftMargin + colWidth;
  const col3 = leftMargin + colWidth * 2;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Employee', col1, y);
  doc.text('Approved by', col2, y);
  doc.text('Acknowledge by', col3, y);
  y += 4;
  doc.setFont('helvetica', 'italic');
  doc.text('Pegawai', col1, y);
  doc.text('Disetujui oleh', col2, y);
  doc.text('Diketahui oleh', col3, y);
  y += 4;

  const stampY = y + 12;

  if (request.supervisor_status === 'approved') {
    drawApprovedStamp(doc, col2 + 15, stampY, request.supervisor_approved_at);
  } else if (request.supervisor_status === 'rejected') {
    drawRejectedStamp(doc, col2 + 15, stampY);
  }

  if (request.hcga_status === 'approved') {
    drawApprovedStamp(doc, col3 + 15, stampY, request.hcga_approved_at);
  } else if (request.hcga_status === 'rejected') {
    drawRejectedStamp(doc, col3 + 15, stampY);
  }

  y = stampY + 14;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(request.staff_name || '-', col1, y);
  doc.text(approverNames.supervisorName || '-', col2, y);
  doc.text(approverNames.hcgaName || '-', col3, y);
  y += 3;
  drawDottedLine(doc, col1, y, colWidth - 10);
  drawDottedLine(doc, col2, y, colWidth - 10);
  drawDottedLine(doc, col3, y, colWidth - 10);
  y += 14;

  // Notes
  if (request.supervisor_notes || request.hcga_notes) {
    doc.setFont('helvetica', 'normal');
    doc.text('Notes :', leftMargin, y);
    doc.setFont('helvetica', 'italic');
    doc.text('Catatan', leftMargin, y + 4);
    y += 8;
    if (request.supervisor_notes) {
      doc.setFont('helvetica', 'normal');
      doc.text(`Atasan: ${request.supervisor_notes}`, leftMargin + 5, y);
      y += 6;
    }
    if (request.hcga_notes) {
      doc.setFont('helvetica', 'normal');
      doc.text(`HC&GA: ${request.hcga_notes}`, leftMargin + 5, y);
      y += 6;
    }
  }

  // Footer
  y += 6;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120);
  doc.text(`Diajukan pada: ${request.created_at ? format(new Date(request.created_at), 'dd MMMM yyyy HH:mm', { locale: idLocale }) : '-'}`, leftMargin, y);
  doc.text(`No: ${request.request_number}`, rightMargin, y, { align: 'right' });
  doc.setTextColor(0);

  doc.save(`Ijin_${request.request_number.replace(/\//g, '-')}.pdf`);
};

function drawApprovedStamp(doc: jsPDF, x: number, y: number, approvedAt?: string) {
  doc.setDrawColor(34, 197, 94);
  doc.setLineWidth(0.8);
  doc.roundedRect(x - 18, y - 6, 40, 16, 2, 2);

  doc.setTextColor(34, 197, 94);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('APPROVED', x + 2, y + 2, { align: 'center' });

  if (approvedAt) {
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    try {
      doc.text(format(new Date(approvedAt), 'dd MMM yyyy HH:mm', { locale: idLocale }), x + 2, y + 7, { align: 'center' });
    } catch {}
  }

  doc.setTextColor(0);
}

function drawRejectedStamp(doc: jsPDF, x: number, y: number) {
  doc.setDrawColor(239, 68, 68);
  doc.setLineWidth(0.8);
  doc.roundedRect(x - 18, y - 6, 40, 16, 2, 2);

  doc.setTextColor(239, 68, 68);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('REJECTED', x + 2, y + 2, { align: 'center' });

  doc.setTextColor(0);
}
