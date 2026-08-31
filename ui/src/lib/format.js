export function formatDate(value) {
    return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(new Date(value));
}
export function statusLabel(status) {
    const labels = {
        active: 'Aktif',
        inactive: 'Tidak Aktif',
        new: 'Baru',
        pending: 'Pending',
        progress: 'Dalam Proses',
        ready_to_print: 'Siap Print',
        technician_completed: 'Selesai Teknisi',
        validated: 'Tervalidasi',
        warehouse_validated: 'Validasi Warehouse',
        solved: 'Selesai',
        cancelled: 'Dibatalkan',
    };
    return labels[status] ?? status;
}
export function newId(prefix) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}
export function padSequence(value) {
    return String(value).padStart(4, '0');
}
