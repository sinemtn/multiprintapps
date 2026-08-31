import { jsPDF } from 'jspdf';
const COMPANY_NAME = 'PT. MULTI PRIMA MANDIRI SUKSES';
const COMPANY_ADDRESS = 'Jl. Hidup Baru Blok D No.6 Gunung Sahari DKI Jakarta 14420';
const COMPANY_PHONE = 'Telp.6415351/52 Fax. 6415263';
function safeText(value, fallback = '-') {
    const text = value == null ? '' : String(value).trim();
    return text || fallback;
}
function formatDateTime(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime()))
        return safeText(value);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    let hour = date.getHours();
    const minute = String(date.getMinutes()).padStart(2, '0');
    const suffix = hour >= 12 ? 'PM' : 'AM';
    hour %= 12;
    if (hour === 0)
        hour = 12;
    return `${day}/${month}/${year} ${hour}:${minute} ${suffix}`;
}
function taskLabel(task) {
    const labels = {
        maintenance: 'Service',
        installation: 'Instalasi',
        delivery: 'Kirim Barang',
        support: 'Service/Kirim Barang/Ambil Sparepart',
    };
    return labels[task] ?? task;
}
function drawTextCell(doc, text, x, y, width, height, options) {
    doc.rect(x, y, width, height);
    doc.setFont('helvetica', options?.bold ? 'bold' : 'normal');
    doc.text(text, x + 2, y + 4);
}
function drawItemHeader(doc, y) {
    drawTextCell(doc, 'Item ID', 8, y, 32, 5, { bold: true });
    drawTextCell(doc, 'Item Type', 40, y, 46, 5, { bold: true });
    drawTextCell(doc, 'Item Description', 86, y, 90, 5, { bold: true });
    drawTextCell(doc, 'Qty', 176, y, 16, 5, { bold: true });
    drawTextCell(doc, 'Serial No', 192, y, 78, 5, { bold: true });
}
function itemTypeLabel(type) {
    if (!type)
        return '-';
    if (type === 'stock')
        return 'Stock';
    return type.charAt(0).toUpperCase() + type.slice(1);
}
function drawSignatureBox(doc, assignment) {
    const tableX = 78;
    const tableY = 150;
    const colWidth = 64;
    const headerHeight = 6;
    const bodyHeight = 24;
    drawTextCell(doc, 'Validate by', tableX, tableY, colWidth, headerHeight);
    drawTextCell(doc, 'Authorized by', tableX + colWidth, tableY, colWidth, headerHeight);
    drawTextCell(doc, 'Customer', tableX + colWidth * 2, tableY, colWidth, headerHeight);
    doc.rect(tableX, tableY + headerHeight, colWidth, bodyHeight);
    doc.rect(tableX + colWidth, tableY + headerHeight, colWidth, bodyHeight);
    doc.rect(tableX + colWidth * 2, tableY + headerHeight, colWidth, bodyHeight);
    doc.setFont('helvetica', 'normal');
    doc.text(safeText(assignment.validatedBy, 'User ID'), tableX + 3, tableY + headerHeight + 15);
    doc.text(assignment.validatedAt ? formatDateTime(assignment.validatedAt) : 'Time Stamp', tableX + 3, tableY + headerHeight + 20);
    doc.text(safeText(assignment.authorizedBy, 'User ID'), tableX + colWidth + 3, tableY + headerHeight + 15);
    doc.text(assignment.authorizedAt ? formatDateTime(assignment.authorizedAt) : 'Time Stamp', tableX + colWidth + 3, tableY + headerHeight + 20);
}
function drawHeader(doc) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(COMPANY_NAME, 10, 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(COMPANY_ADDRESS, 10, 24);
    doc.text(COMPANY_PHONE, 10, 28);
}
function drawMetadata(doc, assignment, customer, pic) {
    const branch = customer?.branches?.find((item) => item.id === assignment.customerBranchId);
    const requestAddress = branch?.address || customer?.address;
    const leftLabelX = 10;
    const leftColonX = 54;
    const leftValueX = 61;
    const rightLabelX = 140;
    const rightColonX = 198;
    const rightValueX = 205;
    const rows = [
        {
            y: 45,
            leftLabel: 'Tanggal Surat Tugas',
            leftValue: formatDateTime(assignment.createdAt),
            rightLabel: 'Request By',
            rightValue: customer?.name ?? pic?.name ?? '-',
        },
        {
            y: 54,
            leftLabel: 'Nomor surat tugas',
            leftValue: safeText(assignment.assignmentNo),
            rightLabel: 'Request Address',
            rightValue: safeText(requestAddress),
        },
        {
            y: 64,
            leftLabel: 'Jenis tugas',
            leftValue: taskLabel(assignment.type),
            rightLabel: 'No. Komplain',
            rightValue: safeText(assignment.complaintId),
        },
    ];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    rows.forEach((row) => {
        doc.text(row.leftLabel, leftLabelX, row.y);
        doc.text(':', leftColonX, row.y);
        doc.text(row.leftValue, leftValueX, row.y, { maxWidth: 66 });
        if (row.rightLabel) {
            doc.text(row.rightLabel, rightLabelX, row.y);
            doc.text(':', rightColonX, row.y);
            doc.text(row.rightValue, rightValueX, row.y, { maxWidth: 60 });
        }
    });
}
function drawItems(doc, assignment) {
    let y = 83;
    const rowHeight = 5;
    const maxY = 103;
    doc.setFontSize(8);
    drawItemHeader(doc, y);
    y += rowHeight;
    if (assignment.items.length === 0) {
        drawTextCell(doc, '-', 8, y, 32, rowHeight);
        drawTextCell(doc, '-', 40, y, 46, rowHeight);
        drawTextCell(doc, 'No items', 86, y, 90, rowHeight);
        drawTextCell(doc, '-', 176, y, 16, rowHeight);
        drawTextCell(doc, 'No Serial', 192, y, 78, rowHeight);
        return;
    }
    assignment.items.forEach((item) => {
        if (y > maxY) {
            doc.addPage();
            drawHeader(doc);
            y = 38;
            drawItemHeader(doc, y);
            y += rowHeight;
        }
        drawTextCell(doc, safeText(item.stockItemId), 8, y, 32, rowHeight);
        drawTextCell(doc, itemTypeLabel(item.type), 40, y, 46, rowHeight);
        drawTextCell(doc, safeText(item.name), 86, y, 90, rowHeight);
        drawTextCell(doc, String(item.quantity), 176, y, 16, rowHeight);
        drawTextCell(doc, safeText(item.serialNumber, 'No Serial'), 192, y, 78, rowHeight);
        y += rowHeight;
    });
}
function drawNotes(doc, assignment) {
    const notes = assignment.items
        .map((item) => safeText(item.note, '').trim())
        .filter(Boolean)
        .join('\n');
    doc.rect(8, 110, 262, 22);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Notes :', 11, 115);
    if (notes)
        doc.text(notes, 11, 121, { maxWidth: 252 });
}
function createSuratTugasPdf(assignment, customer, pic) {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    drawHeader(doc);
    drawMetadata(doc, assignment, customer, pic);
    drawItems(doc, assignment);
    drawNotes(doc, assignment);
    drawSignatureBox(doc, assignment);
    return doc;
}
export function createSuratTugasPdfBlobUrl(assignment, customer, pic) {
    const doc = createSuratTugasPdf(assignment, customer, pic);
    return URL.createObjectURL(doc.output('blob'));
}
export function downloadSuratTugasPdf(assignment, customer, pic) {
    const doc = createSuratTugasPdf(assignment, customer, pic);
    const fileName = (assignment.assignmentNo || 'surat-tugas').replace(/[^\w.-]+/g, '-');
    doc.save(`${fileName}.pdf`);
}
