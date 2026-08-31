const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '');
function errorMessage(error) {
    if (typeof error === 'string')
        return error;
    if (error && typeof error === 'object' && 'message' in error)
        return String(error.message);
    return 'Request failed';
}
async function request(method, path, body) {
    const headers = {};
    if (body !== undefined)
        headers['Content-Type'] = 'application/json';
    if (method !== 'GET') {
        const csrf = document.cookie.split('; ').find((entry) => entry.startsWith('multiprint_csrf='))?.split('=')[1];
        if (csrf)
            headers['X-XSRF-TOKEN'] = decodeURIComponent(csrf);
    }
    const response = await fetch(`${API_BASE_URL}${path}`, {
        method,
        credentials: 'include',
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const responseText = await response.text();
    let envelope;
    try {
        envelope = responseText ? JSON.parse(responseText) : { statusCode: response.status, ok: response.ok, data: null };
    }
    catch {
        envelope = { statusCode: response.status, ok: false, data: null, error: `Request failed with status ${response.status}` };
    }
    if (!response.ok || !envelope.ok) {
        if (response.status === 401 && path !== '/auth/login')
            window.dispatchEvent(new CustomEvent('multiprint:unauthorized'));
        throw new Error(errorMessage(envelope.error) || `Request failed with status ${response.status}`);
    }
    return envelope.data;
}
const get = (path) => request('GET', path);
const post = (path, body) => request('POST', path, body);
const put = (path, body) => request('PUT', path, body);
const patch = (path, body = {}) => request('PATCH', path, body);
const del = (path) => request('DELETE', path);
function listPath(path) {
    return `${path}?page=1&pageSize=1000`;
}
function normalizeStatus(status) {
    if (status === 'new' || status === 'pending' || status === 'progress' || status === 'ready_to_print' || status === 'technician_completed' || status === 'validated' || status === 'warehouse_validated' || status === 'solved' || status === 'cancelled')
        return status;
    if (status === 'ready-to-print' || status === 'ready to print')
        return 'ready_to_print';
    if (status === 'technician-completed' || status === 'technician completed' || status === 'selesai-teknisi' || status === 'selesai teknisi')
        return 'technician_completed';
    if (status === 'warehouse-validated' || status === 'warehouse validated')
        return 'warehouse_validated';
    if (status === 'in progress')
        return 'progress';
    if (status === 'resolved' || status === 'completed')
        return 'solved';
    return 'pending';
}
function mapCustomer(customer) {
    const type = customer.type === 'multisite' ? 'account' : (customer.type ?? 'single');
    return {
        id: customer.customerId,
        name: customer.name ?? customer.customerId,
        address: customer.address ?? '',
        phone: customer.billingAccount == null ? '' : String(customer.billingAccount),
        type,
        parentCustomerId: customer.parentCustomerId ?? '',
        parentCustomerName: customer.parentCustomerName ?? '',
        children: customer.children ?? [],
        branches: (customer.branches ?? []).map((branch) => ({
            id: branch.id,
            customerId: branch.customerId ?? customer.customerId,
            name: branch.name,
            address: branch.address ?? '',
            active: branch.active ?? true,
        })),
        active: customer.active ?? true,
    };
}
function mapUser(user) {
    const normalizedRole = String(user.role ?? '').toLowerCase().replace(/[_\s]+/g, '-');
    const role = normalizedRole === 'sales' || normalizedRole === 'sls'
        ? 'sales'
        : normalizedRole === 'admin' || normalizedRole === 'adm'
            ? 'admin'
            : normalizedRole === 'sales-admin' || normalizedRole === 'sa'
                ? 'sales-admin'
                : normalizedRole === 'kepala-teknisi' || normalizedRole === 'ktech'
                    ? 'kepala-teknisi'
                    : normalizedRole === 'warehouse' || normalizedRole === 'wh'
                        ? 'warehouse'
                        : 'teknisi';
    return {
        id: user.id,
        name: user.name,
        role,
        email: user.email,
        active: user.active,
        permissions: user.permissions ?? {},
    };
}
function mapComplaint(complaint) {
    const now = new Date().toISOString();
    return {
        id: complaint.complaintNo,
        complaintNo: complaint.complaintNo,
        mpNo: complaint.mpNo,
        description: complaint.description,
        customerId: complaint.customer?.customerId ?? '',
        customerBranchId: complaint.customerBranchId ?? complaint.customerBranch?.id ?? '',
        salesId: complaint.sales,
        status: normalizeStatus(complaint.status),
        note: '',
        complaintDate: complaint.complaintDate ?? complaint.createdAt ?? now,
        createdAt: complaint.createdAt ?? now,
        updatedAt: complaint.updatedAt ?? complaint.createdAt ?? now,
    };
}
function toComplaintRequest(payload) {
    return {
        mpNo: payload.mpNo ?? '',
        description: payload.description ?? '',
        customer: payload.customerId ?? '',
        customerBranchId: payload.customerBranchId || null,
        sales: payload.salesId ?? '',
        status: payload.status ?? 'new',
        complaintDate: payload.complaintDate || null,
    };
}
function mapAssignmentItem(item) {
    return {
        id: String(item.id ?? item.itemId),
        type: item.type,
        stockItemId: item.itemId,
        name: item.description ?? item.itemId,
        serialNumber: item.serialNumber ?? '',
        quantity: item.quantity,
        note: item.note ?? '',
    };
}
function mapAssignment(assignment) {
    const now = new Date().toISOString();
    const assignmentNo = assignment.assignmentNo ?? '';
    return {
        id: assignmentNo,
        assignmentNo,
        complaintId: assignment.complaintNo ?? '',
        mpNo: assignment.mpNo,
        customerId: assignment.customer?.customerId ?? '',
        customerBranchId: assignment.customerBranchId ?? assignment.customerBranch?.id ?? '',
        picId: assignment.pic,
        type: assignment.task,
        status: normalizeStatus(assignment.status),
        items: (assignment.items ?? []).map(mapAssignmentItem),
        createdAt: assignment.createdAt ?? now,
        updatedAt: assignment.updatedAt ?? assignment.createdAt ?? now,
        validatedAt: assignment.validatedAt ?? undefined,
        validatedBy: assignment.validatedBy ?? undefined,
        authorizedAt: assignment.authorizedAt ?? undefined,
        authorizedBy: assignment.authorizedBy ?? undefined,
    };
}
function toAssignmentRequest(payload) {
    const complaintNo = String(payload.complaintId ?? '').trim();
    return {
        mpNo: payload.mpNo ?? '',
        status: payload.status ?? 'pending',
        customer: payload.customerId ?? '',
        customerBranchId: payload.customerBranchId || null,
        task: payload.type ?? 'support',
        assignmentNo: payload.assignmentNo,
        pic: payload.picId ?? '',
        complaintNo: complaintNo || null,
        items: (payload.items ?? []).map(toAssignmentItemRequest),
    };
}
function toAssignmentItemRequest(item) {
    return {
        type: item.type ?? 'stock',
        itemId: item.stockItemId,
        description: item.name,
        serialNumber: item.serialNumber ?? '',
        qty: item.quantity,
        note: item.note,
    };
}
function mapAuditTrail(row) {
    return {
        id: row.id,
        actorUserId: row.actorUserId,
        actorName: row.actorName,
        actorRole: row.actorRole,
        entityType: row.entityType,
        entityId: row.entityId,
        action: row.action,
        assignmentNo: row.assignmentNo,
        complaintNo: row.complaintNo,
        customerId: row.customerId,
        customerBranchId: row.customerBranchId,
        beforeData: row.beforeData,
        afterData: row.afterData,
        diffData: row.diffData,
        description: row.description,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
        createdAt: row.createdAt,
    };
}
function mapActiveStatus(active) {
    return active ? 'active' : 'inactive';
}
function mapPrinterCrud(item) {
    return {
        id: item.id,
        code: item.id,
        name: item.name,
        description: [item.manufacture, item.category, item.toner].filter(Boolean).join(' / '),
        status: mapActiveStatus(item.active),
        updatedAt: new Date().toISOString(),
        manufacture: item.manufacture ?? '',
        category: item.category ?? '',
        toner: item.toner ?? '',
        supplier: item.supplier ?? '',
    };
}
function mapSupplierCrud(item) {
    return {
        id: item.id,
        code: item.id,
        name: item.name,
        description: item.address ?? '',
        status: mapActiveStatus(item.active),
        updatedAt: new Date().toISOString(),
        address: item.address ?? '',
    };
}
function mapCustomerCrud(item) {
    const id = item.id ?? item.customerId ?? item.customer_id;
    const type = item.type === 'multisite' ? 'account' : (item.type ?? 'single');
    return {
        id,
        code: id,
        name: item.name,
        description: item.address ?? '',
        status: mapActiveStatus(item.active ?? true),
        updatedAt: new Date().toISOString(),
        address: item.address ?? '',
        billingAccount: item.billingAccount ?? item.billing_account ?? '',
        quota: item.quota ?? 0,
        periode: item.periode ? String(item.periode).slice(0, 10) : '',
        type,
        parentCustomerId: item.parentCustomerId ?? item.parent_customer_id ?? '',
        parentCustomerName: item.parentCustomerName ?? item.parent_customer_name ?? '',
        children: item.children ?? [],
        branches: item.branches ?? [],
    };
}
function mapTonerCrud(item) {
    return {
        id: item.id,
        code: item.id,
        name: item.name,
        description: item.category ?? '',
        status: mapActiveStatus(item.active),
        updatedAt: new Date().toISOString(),
        category: item.category ?? '',
    };
}
function mapSparepartCrud(item) {
    return {
        id: item.id,
        code: item.id,
        name: item.name,
        description: '',
        status: mapActiveStatus(item.active),
        updatedAt: new Date().toISOString(),
    };
}
function mapUserCrud(user) {
    return {
        id: user.id,
        code: user.id,
        name: user.name,
        fullName: user.name,
        description: user.email,
        status: mapActiveStatus(user.active),
        updatedAt: new Date().toISOString(),
        role: user.role,
        email: user.email,
        password: user.password ?? '',
    };
}
function mapStockPrinterCrud(item) {
    return {
        id: item.mpNo,
        code: item.mpNo,
        name: item.printer,
        description: [item.serialNo, item.location, item.branch, item.note].filter(Boolean).join(' / '),
        status: mapActiveStatus(item.active),
        updatedAt: item.buyDate ?? new Date().toISOString(),
        printer: item.printer,
        serialNo: item.serialNo,
        feature: item.feature ?? '',
        buyDate: item.buyDate ?? '',
        location: item.location ?? '',
        branch: item.branch ?? '',
        note: item.note ?? '',
    };
}
function mapStockTonerCrud(item) {
    const id = String(item.id ?? item.toner);
    return {
        id,
        code: item.toner,
        name: item.toner,
        description: [item.location, item.branch, item.customer, item.note].filter(Boolean).join(' / '),
        status: item.qty > 0 ? 'active' : 'inactive',
        updatedAt: item.createdAt ?? new Date().toISOString(),
        toner: item.toner,
        location: item.location ?? '',
        branch: item.branch ?? '',
        qty: item.qty,
        customer: item.customer ?? '',
        note: item.note ?? '',
    };
}
function mapStockSparepartCrud(item) {
    const id = String(item.id ?? item.sparepart);
    return {
        id,
        code: item.sparepart,
        name: item.sparepart,
        description: [item.location, item.branch, item.customer, item.note ?? item.notes].filter(Boolean).join(' / '),
        status: item.qty > 0 ? 'active' : 'inactive',
        updatedAt: item.createdAt ?? new Date().toISOString(),
        sparepart: item.sparepart,
        location: item.location ?? '',
        branch: item.branch ?? '',
        qty: item.qty,
        customer: item.customer ?? '',
        note: item.note ?? item.notes ?? '',
    };
}
function toMasterPayload(key, payload) {
    const code = payload.code ?? '';
    const active = (payload.status ?? 'active') === 'active';
    if (key === 'printer') {
        return {
            id: code,
            name: payload.name ?? '',
            manufacture: payload.manufacture ?? '',
            category: payload.category ?? '',
            toner: payload.toner ?? '',
            supplier: payload.supplier ?? '',
            active,
        };
    }
    if (key === 'toner')
        return { id: code, name: payload.name ?? '', category: payload.category ?? payload.description ?? '', active };
    if (key === 'sparepart')
        return { id: code, name: payload.name ?? '', active };
    if (key === 'supplier')
        return { id: code, name: payload.name ?? '', address: payload.address ?? payload.description ?? '', active };
    if (key === 'customer')
        return {
            id: code,
            name: payload.name ?? '',
            address: payload.address ?? payload.description ?? '',
            billingAccount: payload.billingAccount || null,
            quota: Number(payload.quota ?? 0),
            periode: payload.periode || null,
            type: payload.type ?? 'single',
            parentCustomerId: payload.parentCustomerId || null,
            active,
        };
    if (key === 'user') {
        return {
            id: code,
            name: payload.fullName ?? payload.name ?? '',
            role: payload.role ?? 'teknisi',
            email: payload.email ?? payload.description ?? '',
            password: payload.password || 'Password123!',
            active,
        };
    }
    if (key === 'stock-printer') {
        return {
            mpNo: code,
            printer: payload.printer ?? payload.name ?? '',
            serialNo: payload.serialNo ?? '',
            feature: payload.feature ?? '',
            buyDate: payload.buyDate || new Date().toISOString(),
            location: payload.location ?? '',
            branch: payload.branch ?? '',
            status: payload.status ?? 'active',
            active,
            note: payload.note ?? payload.description ?? '',
        };
    }
    if (key === 'stock-toner') {
        return {
            toner: payload.toner ?? code,
            location: payload.location ?? '',
            branch: payload.branch ?? '',
            qty: Number(payload.qty ?? 0),
            customer: payload.customer || null,
            note: payload.note ?? payload.description ?? '',
        };
    }
    if (key === 'stock-sparepart') {
        return {
            sparepart: payload.sparepart ?? code,
            location: payload.location ?? '',
            branch: payload.branch ?? '',
            qty: Number(payload.qty ?? 0),
            customer: payload.customer || null,
            note: payload.note ?? payload.description ?? '',
        };
    }
    throw new Error(`Unsupported CRUD key: ${key}`);
}
function crudEndpoint(key) {
    const endpoints = {
        printer: '/printer',
        toner: '/toner',
        sparepart: '/sparepart',
        supplier: '/supplier',
        customer: '/customer',
        user: '/user',
        'stock-printer': '/stock/printer',
        'stock-toner': '/stock/toner',
        'stock-sparepart': '/stock/sparepart',
    };
    const endpoint = endpoints[key];
    if (!endpoint)
        throw new Error(`Unsupported CRUD key: ${key}`);
    return endpoint;
}
export const api = {
    auth: {
        login: async (identifier, password) => mapUser(await post('/auth/login', { identifier, password })),
        me: async () => mapUser(await get('/auth/me')),
        logout: async () => {
            await post('/auth/logout', {});
            return true;
        },
    },
    settings: {
        get: async () => get('/settings'),
        update: async (payload) => put('/settings', payload),
    },
    permissions: {
        get: async () => get('/permissions'),
        update: async (permissions) => put('/permissions', { permissions }),
    },
    customers: {
        list: async () => (await get('/lookups/customers')).map(mapCustomer),
        addBranch: async (customerId, payload) => post(`/customer/${encodeURIComponent(customerId)}/branches`, payload),
        updateBranch: async (customerId, branchId, payload) => put(`/customer/${encodeURIComponent(customerId)}/branches/${encodeURIComponent(branchId)}`, payload),
        removeBranch: async (customerId, branchId) => {
            await del(`/customer/${encodeURIComponent(customerId)}/branches/${encodeURIComponent(branchId)}`);
            return true;
        },
    },
    users: {
        list: async () => (await get('/lookups/users')).map(mapUser),
    },
    inventory: {
        list: async () => {
            const [printers, toners, spareparts] = await Promise.all([
                get(listPath('/stock/printer')),
                get('/stock/toner'),
                get('/stock/sparepart'),
            ]);
            return [
                ...printers.map((item) => ({
                    id: item.mpNo,
                    code: item.mpNo,
                    name: item.printer,
                    category: 'printer',
                    stock: item.active ? 1 : 0,
                    unit: 'unit',
                    minStock: 1,
                })),
                ...toners.map((item) => ({
                    id: String(item.id ?? item.toner),
                    code: item.toner,
                    name: item.toner,
                    category: 'toner',
                    stock: item.qty,
                    unit: 'pcs',
                    minStock: 1,
                })),
                ...spareparts.map((item) => ({
                    id: String(item.id ?? item.sparepart),
                    code: item.sparepart,
                    name: item.sparepart,
                    category: 'sparepart',
                    stock: item.qty,
                    unit: 'pcs',
                    minStock: 1,
                })),
            ];
        },
    },
    dashboard: {
        get: async (params = {}) => {
            const query = new URLSearchParams();
            if (params.from)
                query.set('from', params.from);
            if (params.to)
                query.set('to', params.to);
            return get(`/dashboard${query.toString() ? `?${query.toString()}` : ''}`);
        },
    },
    auditTrail: {
        list: async (params = {}) => {
            const query = new URLSearchParams();
            for (const [key, value] of Object.entries(params)) {
                if (value !== undefined && value !== null && String(value).trim() !== '')
                    query.set(key, String(value));
            }
            return (await get(`/audit-trail${query.toString() ? `?${query.toString()}` : ''}`)).map(mapAuditTrail);
        },
        get: async (id) => mapAuditTrail(await get(`/audit-trail/${encodeURIComponent(id)}`)),
    },
    complaints: {
        list: async () => (await get(listPath('/complaint'))).map(mapComplaint),
        get: async (id) => mapComplaint(await get(`/complaint/${encodeURIComponent(id)}`)),
        create: async (payload) => mapComplaint(await post('/complaint', toComplaintRequest(payload))),
        update: async (id, payload) => mapComplaint(await put(`/complaint/${encodeURIComponent(id)}`, toComplaintRequest(payload))),
        resolve: async (id) => mapComplaint(await patch(`/complaint/${encodeURIComponent(id)}/resolve`)),
        remove: async (id) => {
            await del(`/complaint/${encodeURIComponent(id)}`);
            return true;
        },
    },
    suratTugas: {
        list: async () => (await get(listPath('/assignment'))).map(mapAssignment),
        get: async (id) => mapAssignment(await get(`/assignment/${encodeURIComponent(id)}`)),
        byComplaint: async (complaintId) => (await api.suratTugas.list()).filter((item) => item.complaintId === complaintId),
        create: async (payload) => mapAssignment(await post('/assignment', toAssignmentRequest(payload))),
        update: async (id, payload) => mapAssignment(await put(`/assignment/${encodeURIComponent(id)}`, toAssignmentRequest(payload))),
        start: async (id) => mapAssignment(await patch(`/assignment/${encodeURIComponent(id)}/start`)),
        readyToPrint: async (id) => mapAssignment(await patch(`/assignment/${encodeURIComponent(id)}/ready-to-print`)),
        technicianComplete: async (id) => mapAssignment(await patch(`/assignment/${encodeURIComponent(id)}/technician-complete`)),
        warehouseValidate: async (id) => mapAssignment(await patch(`/assignment/${encodeURIComponent(id)}/warehouse-validate`)),
        resolve: async (id) => mapAssignment(await patch(`/assignment/${encodeURIComponent(id)}/resolve`)),
        remove: async (id) => {
            await del(`/assignment/${encodeURIComponent(id)}`);
            return true;
        },
        addItem: async (assignmentId, item) => mapAssignmentItem(await post(`/assignment/${encodeURIComponent(assignmentId)}/items`, toAssignmentItemRequest(item))),
        removeItem: async (assignmentId, itemId) => {
            await del(`/assignment/${encodeURIComponent(assignmentId)}/items/${encodeURIComponent(itemId)}`);
            return true;
        },
    },
    crud: {
        list: async (key) => {
            if (key === 'printer')
                return (await get('/printer')).map(mapPrinterCrud);
            if (key === 'toner')
                return (await get('/toner')).map(mapTonerCrud);
            if (key === 'sparepart')
                return (await get('/sparepart')).map(mapSparepartCrud);
            if (key === 'supplier')
                return (await get('/supplier')).map(mapSupplierCrud);
            if (key === 'customer')
                return (await get('/customer')).map(mapCustomerCrud);
            if (key === 'user')
                return (await get('/user')).map(mapUserCrud);
            if (key === 'stock-printer')
                return (await get(listPath('/stock/printer'))).map(mapStockPrinterCrud);
            if (key === 'stock-toner')
                return (await get('/stock/toner')).map(mapStockTonerCrud);
            if (key === 'stock-sparepart')
                return (await get('/stock/sparepart')).map(mapStockSparepartCrud);
            return [];
        },
        create: async (key, payload) => {
            const endpoint = crudEndpoint(key);
            const created = await post(endpoint, toMasterPayload(key, payload));
            if (key === 'printer')
                return mapPrinterCrud(created);
            if (key === 'toner')
                return mapTonerCrud(created);
            if (key === 'sparepart')
                return mapSparepartCrud(created);
            if (key === 'supplier')
                return mapSupplierCrud(created);
            if (key === 'customer')
                return mapCustomerCrud(created);
            if (key === 'user')
                return mapUserCrud(created);
            if (key === 'stock-printer')
                return mapStockPrinterCrud(created);
            if (key === 'stock-toner')
                return mapStockTonerCrud(created);
            if (key === 'stock-sparepart')
                return mapStockSparepartCrud(created);
            return { ...payload, id: payload.code, updatedAt: new Date().toISOString() };
        },
        update: async (key, id, payload) => {
            const endpoint = crudEndpoint(key);
            const updated = await put(`${endpoint}/${encodeURIComponent(id)}`, toMasterPayload(key, { ...payload, code: payload.code ?? id }));
            if (key === 'printer')
                return mapPrinterCrud(updated);
            if (key === 'toner')
                return mapTonerCrud(updated);
            if (key === 'sparepart')
                return mapSparepartCrud(updated);
            if (key === 'supplier')
                return mapSupplierCrud(updated);
            if (key === 'customer')
                return mapCustomerCrud(updated);
            if (key === 'user')
                return mapUserCrud(updated);
            if (key === 'stock-printer')
                return mapStockPrinterCrud(updated);
            if (key === 'stock-toner')
                return mapStockTonerCrud(updated);
            if (key === 'stock-sparepart')
                return mapStockSparepartCrud(updated);
            return { id, code: payload.code ?? id, name: payload.name ?? '', description: payload.description ?? '', status: payload.status ?? 'active', updatedAt: new Date().toISOString() };
        },
        remove: async (key, id) => {
            if (key === 'stock-printer') {
                await request('PATCH', `${crudEndpoint(key)}/${encodeURIComponent(id)}`);
                return true;
            }
            await del(`${crudEndpoint(key)}/${encodeURIComponent(id)}`);
            return true;
        },
    },
};
