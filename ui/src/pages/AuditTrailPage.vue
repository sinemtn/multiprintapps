<script setup>
import { computed, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useQuery } from '@tanstack/vue-query';
import { Search, X } from 'lucide-vue-next';
import DialogModal from '@/components/ui/DialogModal.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import { api } from '@/services/api';

const route = useRoute();

const tabs = [
    { id: 'user', label: 'User', field: 'userId', placeholder: 'User ID' },
    { id: 'assignment', label: 'Surat Tugas', field: 'assignmentId', placeholder: 'No. Surat Tugas' },
    { id: 'complaint', label: 'Komplain', field: 'complaintId', placeholder: 'No. Komplain' },
    { id: 'customer', label: 'Customer', field: 'customerId', placeholder: 'Customer ID' },
    { id: 'system', label: 'Sistem', field: 'entityType', placeholder: 'Tipe Entity' },
];

function initialTab() {
    if (route.query.assignmentId)
        return 'assignment';
    if (route.query.complaintId)
        return 'complaint';
    if (route.query.customerId)
        return 'customer';
    if (route.query.entityType || route.query.action)
        return 'system';
    return 'user';
}

const activeTab = ref(initialTab());
const filters = reactive({
    assignmentId: String(route.query.assignmentId ?? ''),
    userId: String(route.query.userId ?? ''),
    customerId: String(route.query.customerId ?? ''),
    complaintId: String(route.query.complaintId ?? ''),
    entityType: String(route.query.entityType ?? ''),
    action: String(route.query.action ?? ''),
    from: String(route.query.from ?? ''),
    to: String(route.query.to ?? ''),
});
const applied = ref({ ...filters, page: 1, pageSize: 50 });
const selectedAudit = ref(null);

const auditQuery = useQuery({
    queryKey: computed(() => ['audit-trail', applied.value]),
    queryFn: () => api.auditTrail.list(applied.value),
});

const rows = computed(() => auditQuery.data.value ?? []);
const currentTab = computed(() => tabs.find((tab) => tab.id === activeTab.value) ?? tabs[0]);

const entityOptions = [
    { label: 'Semua Entity', value: '' },
    { label: 'Auth', value: 'auth' },
    { label: 'Komplain', value: 'complaint' },
    { label: 'Surat Tugas', value: 'assignment' },
    { label: 'Item Surat Tugas', value: 'assignment-item' },
    { label: 'Customer', value: 'customer' },
    { label: 'Cabang Customer', value: 'customer-branch' },
    { label: 'Master Printer', value: 'master-printer' },
    { label: 'Master Toner', value: 'master-toner' },
    { label: 'Master Sparepart', value: 'master-sparepart' },
    { label: 'Master Supplier', value: 'master-supplier' },
    { label: 'Master User', value: 'user' },
    { label: 'Stok Printer', value: 'stock-printer' },
    { label: 'Stok Toner', value: 'stock-toner' },
    { label: 'Stok Sparepart', value: 'stock-sparepart' },
    { label: 'Pengaturan', value: 'settings' },
];

const actionOptions = [
    '', 'login', 'login-failed', 'logout', 'create', 'update', 'delete', 'resolve', 'start',
    'ready-to-print', 'technician-complete', 'warehouse-validate',
];

const actionLabels = {
    login: 'LOGIN',
    'login-failed': 'LOGIN FAILED',
    logout: 'LOGOUT',
    create: 'CREATE',
    update: 'UPDATE',
    delete: 'DELETE',
    resolve: 'RESOLVE',
    start: 'START',
    'ready-to-print': 'READY TO PRINT',
    'technician-complete': 'TECHNICIAN COMPLETE',
    'warehouse-validate': 'WAREHOUSE VALIDATE',
};

function formatDateTime(value) {
    if (!value)
        return '-';
    return new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Bangkok',
    }).format(new Date(value));
}

function clearScopedFilters() {
    filters.assignmentId = '';
    filters.userId = '';
    filters.customerId = '';
    filters.complaintId = '';
    if (activeTab.value !== 'system')
        filters.entityType = '';
}

function setTab(tabId) {
    activeTab.value = tabId;
    clearScopedFilters();
    if (tabId === 'system')
        filters.entityType = '';
}

function paramsForActiveTab() {
    const params = {
        from: filters.from,
        to: filters.to,
        action: filters.action,
        page: 1,
        pageSize: 50,
    };
    if (activeTab.value === 'user')
        params.userId = filters.userId;
    if (activeTab.value === 'assignment')
        params.assignmentId = filters.assignmentId;
    if (activeTab.value === 'complaint')
        params.complaintId = filters.complaintId;
    if (activeTab.value === 'customer')
        params.customerId = filters.customerId;
    if (activeTab.value === 'system')
        params.entityType = filters.entityType;
    return params;
}

function applyFilters() {
    applied.value = paramsForActiveTab();
}

function resetFilters() {
    for (const key of Object.keys(filters))
        filters[key] = '';
    applied.value = { page: 1, pageSize: 50 };
}

function prettyJson(value) {
    if (value == null)
        return '-';
    return JSON.stringify(value, null, 2);
}

function trxId(row) {
    return row.assignmentNo || row.complaintNo || row.customerId || row.entityId || '-';
}

function eventLabel(row) {
    const action = actionLabels[row.action] ?? String(row.action ?? '-').toUpperCase();
    if (row.entityType === 'auth')
        return action;
    return `${action} ${String(row.entityType ?? '').replace(/-/g, ' ').toUpperCase()}`.trim();
}

function userLabel(row) {
    const name = row.actorName || 'SYSTEM';
    const userId = row.actorUserId ? ` [${row.actorUserId}]` : '';
    return `${name}${userId}`;
}

function detailSummary(row) {
    if (row.description)
        return row.description;
    const changed = row.diffData && typeof row.diffData === 'object' ? Object.keys(row.diffData) : [];
    if (changed.length)
        return `Berubah: ${changed.join(', ')}`;
    return '-';
}
</script>

<template>
  <PageHeader title="Audit Trail" subtitle="Lacak aktivitas berdasarkan user, surat tugas, komplain, customer, dan sistem." />

  <section class="mb-5 overflow-hidden rounded-lg border border-line bg-ink-950">
    <div class="border-b border-line px-4 pt-4">
      <div class="flex gap-2 overflow-x-auto">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          class="border-b-2 px-5 py-3 text-sm font-bold transition"
          :class="activeTab === tab.id ? 'border-sky-300 text-white' : 'border-transparent text-muted hover:text-white'"
          @click="setTab(tab.id)"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <form class="grid gap-3 p-4 lg:grid-cols-[260px_220px_220px_180px_180px]" @submit.prevent="applyFilters">
      <label v-if="activeTab !== 'system'" class="block">
        <span class="mb-2 block text-sm font-semibold text-white">{{ currentTab.placeholder }}</span>
        <input v-model="filters[currentTab.field]" class="field-control" :placeholder="currentTab.placeholder" />
      </label>

      <label v-else class="block">
        <span class="mb-2 block text-sm font-semibold text-white">Entity</span>
        <select v-model="filters.entityType" class="field-control">
          <option v-for="option in entityOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
      </label>

      <label class="block">
        <span class="mb-2 block text-sm font-semibold text-white">Aksi</span>
        <select v-model="filters.action" class="field-control">
          <option v-for="action in actionOptions" :key="action" :value="action">
            {{ action ? (actionLabels[action] ?? action) : 'Semua Aksi' }}
          </option>
        </select>
      </label>

      <label class="block">
        <span class="mb-2 block text-sm font-semibold text-white">Dari</span>
        <input v-model="filters.from" class="field-control" type="date" />
      </label>

      <label class="block">
        <span class="mb-2 block text-sm font-semibold text-white">Sampai</span>
        <input v-model="filters.to" class="field-control" type="date" />
      </label>

      <div class="flex items-end gap-2">
        <button type="submit" class="btn-primary">
          <Search class="h-4 w-4" />
          Cari
        </button>
        <button type="button" class="btn-secondary" @click="resetFilters">
          <X class="h-4 w-4" />
          Reset
        </button>
      </div>
    </form>
  </section>

  <section class="overflow-hidden rounded-lg border border-line bg-ink-950">
    <div v-if="auditQuery.isPending.value" class="p-5 text-sm font-semibold text-muted">Memuat audit trail...</div>
    <div v-else-if="auditQuery.isError.value" class="m-4 rounded-md border border-rose-400/30 bg-rose-500/10 p-4 text-sm font-semibold text-rose-200">
      {{ auditQuery.error.value instanceof Error ? auditQuery.error.value.message : 'Audit trail gagal dimuat' }}
    </div>
    <div v-else class="overflow-x-auto">
      <table class="min-w-full text-left text-sm">
        <thead class="border-b border-line bg-ink-900 text-muted">
          <tr>
            <th class="px-4 py-3">Event</th>
            <th class="px-4 py-3">Detail</th>
            <th class="px-4 py-3">Trx ID</th>
            <th class="whitespace-nowrap px-4 py-3">Tanggal/Jam</th>
            <th class="px-4 py-3">User</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          <tr
            v-for="row in rows"
            :key="row.id"
            class="cursor-pointer hover:bg-ink-900"
            @click="selectedAudit = row"
          >
            <td class="whitespace-nowrap px-4 py-3 font-semibold text-sky-100">{{ eventLabel(row) }}</td>
            <td class="max-w-xl px-4 py-3 text-slate-100">{{ detailSummary(row) }}</td>
            <td class="whitespace-nowrap px-4 py-3 text-muted">{{ trxId(row) }}</td>
            <td class="whitespace-nowrap px-4 py-3 text-muted">{{ formatDateTime(row.createdAt) }}</td>
            <td class="whitespace-nowrap px-4 py-3">
              <div class="font-semibold text-white">{{ userLabel(row) }}</div>
              <div class="text-xs capitalize text-muted">{{ row.actorRole || '-' }}</div>
            </td>
          </tr>
          <tr v-if="rows.length === 0">
            <td colspan="5" class="px-4 py-12 text-center text-muted">Tidak ada audit trail untuk filter ini.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <DialogModal
    :open="Boolean(selectedAudit)"
    title="Detail Audit Trail"
    description="Before, after, dan field yang berubah."
    submit-label="Close"
    @close="selectedAudit = null"
    @submit="selectedAudit = null"
  >
    <div v-if="selectedAudit" class="space-y-4">
      <div class="grid gap-3 rounded-md border border-line bg-ink-900 p-3 text-sm md:grid-cols-3">
        <div>
          <div class="text-xs font-bold uppercase text-muted">Event</div>
          <div class="font-semibold text-white">{{ eventLabel(selectedAudit) }}</div>
        </div>
        <div>
          <div class="text-xs font-bold uppercase text-muted">Trx ID</div>
          <div class="font-semibold text-white">{{ trxId(selectedAudit) }}</div>
        </div>
        <div>
          <div class="text-xs font-bold uppercase text-muted">User</div>
          <div class="font-semibold text-white">{{ userLabel(selectedAudit) }}</div>
        </div>
      </div>
      <div class="grid gap-4 lg:grid-cols-3">
        <div>
          <h3 class="mb-2 text-sm font-bold text-white">Diff</h3>
          <pre class="max-h-96 overflow-auto rounded-md border border-line bg-ink-900 p-3 text-xs text-slate-100">{{ prettyJson(selectedAudit.diffData) }}</pre>
        </div>
        <div>
          <h3 class="mb-2 text-sm font-bold text-white">Before</h3>
          <pre class="max-h-96 overflow-auto rounded-md border border-line bg-ink-900 p-3 text-xs text-slate-100">{{ prettyJson(selectedAudit.beforeData) }}</pre>
        </div>
        <div>
          <h3 class="mb-2 text-sm font-bold text-white">After</h3>
          <pre class="max-h-96 overflow-auto rounded-md border border-line bg-ink-900 p-3 text-xs text-slate-100">{{ prettyJson(selectedAudit.afterData) }}</pre>
        </div>
      </div>
    </div>
  </DialogModal>
</template>
