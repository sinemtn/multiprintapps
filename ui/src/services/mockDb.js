const now = new Date().toISOString();
export const customers = [
    { id: 'cust-1', name: 'PT SYSMEX INDONESIA', address: 'Jakarta Selatan', phone: '021-555-1100' },
    { id: 'cust-2', name: 'PT. Maju Mundur', address: 'Bekasi', phone: '021-555-2200' },
    { id: 'cust-3', name: 'CV. Cahaya Abadi', address: 'Tangerang', phone: '021-555-3300' },
];
export const users = [
    { id: 'user-1', name: 'Tony Stark', role: 'technician', email: 'tony@multiprint.test', active: true },
    { id: 'user-2', name: 'Budi Setiawan', role: 'technician', email: 'budi@multiprint.test', active: true },
    { id: 'user-3', name: 'Siti Aminah', role: 'sales', email: 'siti@multiprint.test', active: true },
];
export const complaints = [
    {
        id: 'complaint-1',
        complaintNo: 'C2025060001',
        mpNo: 'MP-PRN-2201',
        description: 'Printer hasil cetak bergaris dan toner cepat habis.',
        customerId: 'cust-1',
        salesId: 'user-3',
        status: 'progress',
        note: 'Customer meminta kunjungan teknisi minggu ini.',
        createdAt: '2026-06-02T04:00:00.000Z',
        updatedAt: now,
    },
    {
        id: 'complaint-2',
        complaintNo: 'C2025060002',
        mpNo: 'MP-PRN-1140',
        description: 'Paper jam berulang pada tray dua.',
        customerId: 'cust-2',
        salesId: 'user-3',
        status: 'pending',
        note: 'Menunggu konfirmasi jadwal.',
        createdAt: '2026-06-03T04:00:00.000Z',
        updatedAt: now,
    },
];
export const inventory = [
    { id: 'stock-1', code: 'PRN0001', name: 'FUJI XEROX DOCUPRINT', category: 'printer', stock: 7, unit: 'unit', minStock: 2 },
    { id: 'stock-2', code: 'TNR0001', name: 'TONER BLACK CT202', category: 'toner', stock: 14, unit: 'pcs', minStock: 5 },
    { id: 'stock-3', code: 'SPRT0001', name: 'FUSER UNIT 220V', category: 'sparepart', stock: 9, unit: 'pcs', minStock: 3 },
    { id: 'stock-4', code: 'SPRT0002', name: 'PICKUP ROLLER ASSEMBLY', category: 'sparepart', stock: 5, unit: 'pcs', minStock: 4 },
];
export const suratTugas = [
    {
        id: 'assignment-1',
        assignmentNo: 'SJ/2025/06/0001',
        complaintId: 'complaint-1',
        mpNo: 'MP-PRN-2201',
        customerId: 'cust-1',
        picId: 'user-1',
        type: 'maintenance',
        status: 'solved',
        items: [
            { id: 'item-1', stockItemId: 'stock-3', name: 'FUSER UNIT 220V', quantity: 9, note: 'Penggantian unit' },
            { id: 'item-2', stockItemId: 'stock-4', name: 'PICKUP ROLLER ASSEMBLY', quantity: 5, note: 'Preventive maintenance' },
        ],
        createdAt: '2026-06-04T04:00:00.000Z',
        updatedAt: now,
    },
    {
        id: 'assignment-2',
        assignmentNo: 'ST/2026/04/001',
        complaintId: 'complaint-2',
        mpNo: 'MP-PRN-1140',
        customerId: 'cust-2',
        picId: 'user-2',
        type: 'support',
        status: 'pending',
        items: [],
        createdAt: '2026-06-05T04:00:00.000Z',
        updatedAt: now,
    },
];
export const masterRecords = {
    'stock-printer': [
        { id: 'stock-printer-1', code: 'PRN0001', name: 'DocuPrint M455', description: 'Printer stock utama', status: 'active', updatedAt: now },
    ],
    'stock-toner': [
        { id: 'stock-toner-1', code: 'TNR0001', name: 'Toner Black CT202', description: 'Toner hitam', status: 'active', updatedAt: now },
    ],
    printer: [
        { id: 'printer-1', code: 'MPRN-001', name: 'Fuji Xerox', description: 'Master printer', status: 'active', updatedAt: now },
    ],
    toner: [
        { id: 'toner-1', code: 'MTNR-001', name: 'Toner Black', description: 'Master toner', status: 'active', updatedAt: now },
    ],
    sparepart: [
        { id: 'sparepart-1', code: 'SPRT0001', name: 'Fuser Unit', description: 'Master sparepart', status: 'active', updatedAt: now },
    ],
    user: users.map((user) => ({
        id: user.id,
        code: user.role.toUpperCase(),
        name: user.name,
        description: user.email,
        status: user.active ? 'active' : 'inactive',
        updatedAt: now,
    })),
};
