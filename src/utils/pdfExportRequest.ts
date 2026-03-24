import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface ApproverInfo {
  supervisorName?: string;
  hcgaName?: string;
}

export const generateLeaveRequestPDF = (request: any, approverNames: ApproverInfo) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('FORMULIR PERMOHONAN CUTI', pageWidth / 2, y, { align: 'center' });
  y += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`No: ${request.request_number}`, pageWidth / 2, y, { align: 'center' });
  y += 12;

  // Data Pemohon
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('DATA PEMOHON', 15, y);
  y += 6;

  const pemohonData = [
    ['Nama', request.staff_name || '-'],
    ['UID/NIK', request.staff_uid || '-'],
    ['Jabatan', request.position || '-'],
    ['Departemen', request.department || '-'],
    ['Mulai Kerja', request.join_date ? format(new Date(request.join_date), 'dd MMMM yyyy', { locale: idLocale }) : '-'],
  ];

  autoTable(doc, {
    startY: y,
    body: pemohonData,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
    margin: { left: 15, right: 15 },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // Detail Cuti
  doc.setFont('helvetica', 'bold');
  doc.text('DETAIL PERMOHONAN CUTI', 15, y);
  y += 6;

  const leaveDatesStr = Array.isArray(request.leave_dates)
    ? request.leave_dates.map((d: string) => {
        try { return format(new Date(d), 'dd MMM yyyy', { locale: idLocale }); } catch { return d; }
      }).join(', ')
    : '-';

  const detailData = [
    ['Periode Cuti', `Tahun ${request.leave_year}`],
    ['Jumlah Hari', `${request.days_requested} hari`],
    ['Tanggal Cuti', leaveDatesStr],
    ['Sisa Cuti Setelah', request.remaining_balance != null ? `${request.remaining_balance} hari` : '-'],
    ['Sisa Tahun Sebelumnya', request.previous_year_balance != null ? `${request.previous_year_balance} hari` : '-'],
  ];

  autoTable(doc, {
    startY: y,
    body: detailData,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
    margin: { left: 15, right: 15 },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // Catatan
  if (request.supervisor_notes || request.hcga_notes || request.supervisor_recommendation || request.other_decisions) {
    doc.setFont('helvetica', 'bold');
    doc.text('CATATAN', 15, y);
    y += 6;

    const catatanData: string[][] = [];
    if (request.supervisor_notes) catatanData.push(['Catatan Atasan', request.supervisor_notes]);
    if (request.supervisor_recommendation) catatanData.push(['Rekomendasi Atasan', request.supervisor_recommendation]);
    if (request.hcga_notes) catatanData.push(['Catatan HC&GA', request.hcga_notes]);
    if (request.other_decisions) catatanData.push(['Keputusan Lain', request.other_decisions]);

    autoTable(doc, {
      startY: y,
      body: catatanData,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
      margin: { left: 15, right: 15 },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Approval Section
  y = drawApprovalSection(doc, y, request, approverNames);

  // Diajukan
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text(`Diajukan pada: ${request.created_at ? format(new Date(request.created_at), 'dd MMMM yyyy HH:mm', { locale: idLocale }) : '-'}`, 15, y + 6);

  doc.save(`Cuti_${request.request_number}.pdf`);
};

export const generatePermissionRequestPDF = (request: any, approverNames: ApproverInfo) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('FORMULIR PERMOHONAN IJIN', pageWidth / 2, y, { align: 'center' });
  y += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`No: ${request.request_number}`, pageWidth / 2, y, { align: 'center' });
  y += 12;

  // Data Pemohon
  doc.setFont('helvetica', 'bold');
  doc.text('DATA PEMOHON', 15, y);
  y += 6;

  const pemohonData = [
    ['Nama', request.staff_name || '-'],
    ['UID/NIK', request.staff_uid || '-'],
    ['Jabatan', request.position || '-'],
    ['Departemen', request.department || '-'],
    ['Mulai Kerja', request.join_date ? format(new Date(request.join_date), 'dd MMMM yyyy', { locale: idLocale }) : '-'],
    ['No. HP', request.phone_number || '-'],
  ];

  autoTable(doc, {
    startY: y,
    body: pemohonData,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
    margin: { left: 15, right: 15 },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // Detail Ijin
  doc.setFont('helvetica', 'bold');
  doc.text('DETAIL PERMOHONAN IJIN', 15, y);
  y += 6;

  const detailData = [
    ['Ijin yang Dimohon', request.permission_duration || '-'],
    ['Tanggal Ijin', request.permission_date ? format(new Date(request.permission_date), 'dd MMMM yyyy', { locale: idLocale }) : '-'],
    ['Alasan', request.reason || '-'],
  ];

  autoTable(doc, {
    startY: y,
    body: detailData,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
    margin: { left: 15, right: 15 },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // Catatan
  if (request.supervisor_notes || request.hcga_notes) {
    doc.setFont('helvetica', 'bold');
    doc.text('CATATAN', 15, y);
    y += 6;

    const catatanData: string[][] = [];
    if (request.supervisor_notes) catatanData.push(['Catatan Atasan', request.supervisor_notes]);
    if (request.hcga_notes) catatanData.push(['Catatan HC&GA', request.hcga_notes]);

    autoTable(doc, {
      startY: y,
      body: catatanData,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
      margin: { left: 15, right: 15 },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Approval Section
  y = drawApprovalSection(doc, y, request, approverNames);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text(`Diajukan pada: ${request.created_at ? format(new Date(request.created_at), 'dd MMMM yyyy HH:mm', { locale: idLocale }) : '-'}`, 15, y + 6);

  doc.save(`Ijin_${request.request_number}.pdf`);
};

function drawApprovalSection(doc: jsPDF, startY: number, request: any, approverNames: ApproverInfo): number {
  let y = startY;
  const pageWidth = doc.internal.pageSize.getWidth();
  const colWidth = (pageWidth - 30) / 2;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('PERSETUJUAN', 15, y);
  y += 8;

  // Two columns: Atasan | HC&GA
  const leftX = 15;
  const rightX = leftX + colWidth + 5;

  // Supervisor column
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Atasan Langsung', leftX, y);
  doc.text('HC&GA Site', rightX, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.text(approverNames.supervisorName || '-', leftX, y);
  doc.text(approverNames.hcgaName || '-', rightX, y);
  y += 10;

  // Approved stamps
  if (request.supervisor_status === 'approved') {
    drawApprovedStamp(doc, leftX + 20, y, request.supervisor_approved_at);
  } else if (request.supervisor_status === 'rejected') {
    drawRejectedStamp(doc, leftX + 20, y);
  } else {
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Menunggu', leftX + 20, y);
    doc.setTextColor(0);
  }

  if (request.hcga_status === 'approved') {
    drawApprovedStamp(doc, rightX + 20, y, request.hcga_approved_at);
  } else if (request.hcga_status === 'rejected') {
    drawRejectedStamp(doc, rightX + 20, y);
  } else {
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Menunggu', rightX + 20, y);
    doc.setTextColor(0);
  }

  return y + 20;
}

function drawApprovedStamp(doc: jsPDF, x: number, y: number, approvedAt?: string) {
  // Green border stamp
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
