<script setup>
import { computed, reactive, ref, watch, watchEffect } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { useRoute } from 'vue-router';
import { CheckCircle, Download, Play, Plus, ShieldCheck } from 'lucide-vue-next';
import DataTable, {} from '@/components/ui/DataTable.vue';
import DialogModal from '@/components/ui/DialogModal.vue';
import FormField from '@/components/ui/FormField.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import SelectField from '@/components/ui/SelectField.vue';
import { useComplaints } from '@/composables/useComplaints';
import { useCustomers, useInventory, useUsers } from '@/composables/useLookups';
import { useSuratTugas, useSuratTugasMutations } from '@/composables/useSuratTugas';
import { downloadSuratTugasPdf } from '@/services/pdf';
import { api } from '@/services/api';
import { useAuth } from '@/composables/useAuth';
import { statusLabel } from '@/lib/format';
const route = useRoute();
const auth = useAuth();
const activeTab = ref('general');
const assignmentId = computed(() => String(route.params.id ?? 'new'));
const isNew = computed(() => assignmentId.value === 'new');
const fromComplaint = computed(() => String(route.query.fromComplaint ?? '') === '1');
const hasComplaintReference = computed(() => Boolean(String(form.complaintId ?? '').trim()));
const modeLabel = computed(() => hasComplaintReference.value ? 'Dibuat dari Komplain' : 'Surat Tugas Mandiri');
const modeDescription = computed(() => hasComplaintReference.value
    ? 'Relasi komplain akan tersimpan dan surat tugas tampil di tab detail komplain.'
    : 'Surat tugas ini tidak terhubung ke komplain. No. Komplain boleh dikosongkan.');
const canCreate = computed(() => auth.can('assignment', 'create'));
const currentStatus = computed(() => assignment.value?.status ?? form.status);
const isAssignedTechnician = computed(() => {
    const pic = String(assignment.value?.picId ?? form.picId ?? '').toLowerCase();
    return auth.hasRole('teknisi') && [auth.state.user?.id, auth.state.user?.name].map((value) => String(value ?? '').toLowerCase()).includes(pic);
});
const hasItems = computed(() => (assignment.value?.items ?? []).length > 0);
const canEditGeneral = computed(() => auth.can('assignment', 'update') && !['solved', 'cancelled'].includes(currentStatus.value));
const canSave = computed(() => isNew.value ? canCreate.value : canEditGeneral.value);
const canManageItems = computed(() => !isNew.value && ['pending', 'progress'].includes(currentStatus.value) && (auth.hasRole('admin') || isAssignedTechnician.value));
const canStart = computed(() => !isNew.value && currentStatus.value === 'pending' && auth.hasRole('admin', 'kepala-teknisi'));
const canReadyToPrint = computed(() => !isNew.value && ['pending', 'progress'].includes(currentStatus.value) && (auth.hasRole('admin') || isAssignedTechnician.value));
const canTechnicianComplete = computed(() => !isNew.value && currentStatus.value === 'ready_to_print' && (auth.hasRole('admin') || isAssignedTechnician.value));
const canWarehouseValidate = computed(() => !isNew.value && hasItems.value && currentStatus.value === 'technician_completed' && auth.hasRole('admin', 'warehouse'));
const canResolveAssignment = computed(() => {
    if (isNew.value || !auth.hasRole('admin', 'kepala-teknisi'))
        return false;
    if (hasItems.value)
        return currentStatus.value === 'warehouse_validated';
    return ['technician_completed', 'warehouse_validated'].includes(currentStatus.value);
});
const canDownloadPdf = computed(() => !isNew.value && ['ready_to_print', 'technician_completed', 'warehouse_validated', 'solved'].includes(currentStatus.value));
const itemModalOpen = ref(false);
const assignmentQuery = useSuratTugas(assignmentId);
const { data: assignment } = assignmentQuery;
const auditQuery = useQuery({
    queryKey: computed(() => ['audit-trail', 'assignment', assignmentId.value]),
    queryFn: () => api.auditTrail.list({ assignmentId: assignmentId.value, pageSize: 50 }),
    enabled: computed(() => !isNew.value && activeTab.value === 'audit' && auth.can('audit-trail', 'view')),
});
const { data: complaints } = useComplaints();
const { data: customers } = useCustomers();
const { data: users } = useUsers();
const { data: inventory } = useInventory();
const {
    createSuratTugas,
    updateSuratTugas,
    startSuratTugas,
    readyToPrintSuratTugas,
    technicianCompleteSuratTugas,
    warehouseValidateSuratTugas,
    resolveSuratTugas,
    addItem,
    removeItem,
} = useSuratTugasMutations();
const form = reactive({
    complaintId: String(route.query.complaintId ?? ''),
    mpNo: String(route.query.mpNo ?? ''),
    customerId: String(route.query.customerId ?? ''),
    customerBranchId: String(route.query.customerBranchId ?? ''),
    picId: '',
    type: 'maintenance',
    status: 'pending',
});
const itemForm = reactive({
    stockItemId: '',
    quantity: 1,
    note: '',
});
const formError = ref('');
const itemError = ref('');
const successMessage = ref('');
const lastCreatedAssignment = ref(null);
watchEffect(() => {
    if (!assignment.value)
        return;
    form.complaintId = assignment.value.complaintId;
    form.mpNo = assignment.value.mpNo;
    form.customerId = assignment.value.customerId;
    form.customerBranchId = assignment.value.customerBranchId ?? '';
    form.picId = assignment.value.picId;
    form.type = assignment.value.type;
    form.status = assignment.value.status;
});
watch([() => form.complaintId, complaints], ([complaintId]) => {
    if (!complaintId)
        return;
    const selected = complaints.value?.find((item) => item.id === complaintId);
    if (!selected)
        return;
    form.mpNo = selected.mpNo;
    form.customerId = selected.customerId;
    form.customerBranchId = selected.customerBranchId ?? '';
}, { immediate: true });
const complaintOptions = computed(() => (complaints.value ?? []).map((item) => ({ label: `${item.complaintNo} - ${item.mpNo}`, value: item.id })));
const customerOptions = computed(() => (customers.value ?? []).map((item) => ({ label: item.name, value: item.id })));
const selectedCustomer = computed(() => customers.value?.find((item) => item.id === form.customerId));
const branchOptions = computed(() => (selectedCustomer.value?.branches ?? [])
    .filter((branch) => branch.active !== false)
    .map((branch) => ({ label: branch.name, value: branch.id })));
const branchRequired = computed(() => selectedCustomer.value?.type === 'account');
const picOptions = computed(() => (users.value ?? []).filter((item) => item.role === 'teknisi').map((item) => ({ label: item.name, value: item.id })));
const itemOptions = computed(() => (inventory.value ?? []).map((item) => ({ label: `${item.code} - ${item.name}`, value: item.id })));
const typeOptions = [
    { label: 'Maintenance', value: 'maintenance' },
    { label: 'Installation', value: 'installation' },
    { label: 'Delivery', value: 'delivery' },
    { label: 'Support', value: 'support' },
];
const itemColumns = [
    { key: 'stockItemId', label: 'ID Items' },
    { key: 'name', label: 'Name' },
    { key: 'quantity', label: 'Quantity' },
];
const itemRows = computed(() => (assignment.value?.items ?? []).map((item) => ({
    id: item.id,
    stockItemId: item.stockItemId,
    name: item.name,
    quantity: item.quantity,
})));
function setItemValue(key, event) {
    const value = event.target.value;
    itemForm[key] = key === 'quantity' ? (value === '' ? '' : Number(value)) : value;
}
function setFormValue(key, event) {
    form[key] = event.target.value;
}
function setCustomer(value) {
    form.customerId = value;
    form.customerBranchId = '';
}
function resetAssignmentForm(keepComplaint = false) {
    const complaintId = keepComplaint ? form.complaintId : '';
    const mpNo = keepComplaint ? form.mpNo : '';
    const customerId = keepComplaint ? form.customerId : '';
    const customerBranchId = keepComplaint ? form.customerBranchId : '';
    form.complaintId = complaintId;
    form.mpNo = mpNo;
    form.customerId = customerId;
    form.customerBranchId = customerBranchId;
    form.picId = '';
    form.type = 'maintenance';
    form.status = 'pending';
}
function validateAssignmentForm() {
    const required = [
        ['mpNo', 'No. MP'],
        ['customerId', 'Customer'],
        ['picId', 'PIC'],
        ['type', 'Tipe'],
        ['status', 'Status'],
    ];
    const missing = required.find(([key]) => String(form[key] ?? '').trim() === '');
    if (missing) {
        formError.value = `${missing[1]} wajib diisi.`;
        return false;
    }
    if (branchRequired.value && !String(form.customerBranchId ?? '').trim()) {
        formError.value = 'Branch customer wajib dipilih untuk akun customer.';
        return false;
    }
    return true;
}
async function saveAssignment() {
    formError.value = '';
    successMessage.value = '';
    if (!validateAssignmentForm())
        return;
    if (isNew.value) {
        const created = await createSuratTugas.mutateAsync({ ...form, items: [] });
        lastCreatedAssignment.value = created;
        successMessage.value = `Surat Tugas ${created.assignmentNo || created.id} berhasil dibuat.`;
        resetAssignmentForm(fromComplaint.value);
        return;
    }
    await updateSuratTugas.mutateAsync({ id: assignmentId.value, payload: { ...form } });
    await assignmentQuery.refetch();
}
watch(() => route.query.tab, (tab) => {
    if (tab === 'items')
        activeTab.value = 'items';
}, { immediate: true });
function openItemModal() {
    itemError.value = '';
    itemForm.stockItemId = '';
    itemForm.quantity = 1;
    itemForm.note = '';
    itemModalOpen.value = true;
}
function closeItemModal() {
    itemModalOpen.value = false;
    itemError.value = '';
}
async function addAssignmentItem() {
    itemError.value = '';
    if (isNew.value) {
        itemError.value = 'Simpan surat tugas terlebih dahulu sebelum menambah item.';
        return;
    }
    if (!String(itemForm.stockItemId ?? '').trim()) {
        itemError.value = 'Item wajib diisi.';
        return;
    }
    if (!Number.isFinite(Number(itemForm.quantity)) || Number(itemForm.quantity) < 1) {
        itemError.value = 'Kuantitas minimal 1.';
        return;
    }
    const stock = inventory.value?.find((item) => item.id === itemForm.stockItemId);
    const payload = {
        stockItemId: stock?.code ?? itemForm.stockItemId,
        name: stock?.name ?? itemForm.stockItemId,
        quantity: Number(itemForm.quantity),
        note: itemForm.note,
    };
    try {
        await addItem.mutateAsync({ assignmentId: assignmentId.value, item: payload });
        await assignmentQuery.refetch();
        closeItemModal();
    }
    catch (error) {
        itemError.value = error instanceof Error ? error.message : 'Gagal menambah item';
    }
}
async function deleteAssignmentItem(row) {
    if (!String(row.id ?? '').trim()) {
        itemError.value = 'Item ini tidak punya ID valid dan tidak bisa dihapus dari UI.';
        return;
    }
    if (!window.confirm(`Hapus item ${row.stockItemId ?? row.name ?? 'item ini'}?`))
        return;
    await removeItem.mutateAsync({ assignmentId: assignmentId.value, itemId: String(row.id) });
    await assignmentQuery.refetch();
}
async function runWorkflowAction(label, mutation) {
    formError.value = '';
    if (!window.confirm(`${label} surat tugas ${assignmentId.value}?`))
        return;
    try {
        const updated = await mutation.mutateAsync(assignmentId.value);
        form.status = updated.status;
        await assignmentQuery.refetch();
    }
    catch (error) {
        formError.value = error instanceof Error ? error.message : `Gagal menjalankan ${label}`;
    }
}
function startAssignment() {
    runWorkflowAction('Mulai', startSuratTugas);
}
function readyToPrintAssignment() {
    runWorkflowAction('Siap Print', readyToPrintSuratTugas);
}
function technicianCompleteAssignment() {
    runWorkflowAction('Selesai Teknisi', technicianCompleteSuratTugas);
}
function warehouseValidateAssignment() {
    runWorkflowAction('Validasi Warehouse', warehouseValidateSuratTugas);
}
function resolveAssignment() {
    runWorkflowAction('Resolve', resolveSuratTugas);
}
function downloadPdf() {
    if (!assignment.value)
        return;
    const customer = customers.value?.find((entry) => entry.id === assignment.value?.customerId);
    const pic = users.value?.find((entry) => entry.id === assignment.value?.picId);
    downloadSuratTugasPdf(assignment.value, customer, pic);
}
function formatAuditDate(value) {
    if (!value)
        return '-';
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(value));
}
</script>

<template>
  <PageHeader title="Detail Surat Tugas">
    <template #actions>
      <button v-if="canDownloadPdf" type="button" class="btn-primary" @click="downloadPdf">
        <Download class="h-4 w-4" />
        PDF
      </button>
    </template>
  </PageHeader>

  <div class="grid gap-6 lg:grid-cols-[220px_1fr]">
    <div class="space-y-2">
      <button
        type="button"
        class="flex h-10 w-full items-center rounded-md px-4 text-left text-sm font-semibold"
        :class="activeTab === 'general' ? 'bg-slate-700 text-white' : 'text-slate-100 hover:bg-ink-850'"
        @click="activeTab = 'general'"
      >
        General
      </button>
      <button
        type="button"
        class="flex h-10 w-full items-center rounded-md px-4 text-left text-sm font-semibold"
        :class="activeTab === 'items' ? 'bg-slate-700 text-white' : 'text-slate-100 hover:bg-ink-850'"
        @click="activeTab = 'items'"
      >
        Item
      </button>
      <button
        v-if="!isNew && auth.can('audit-trail', 'view')"
        type="button"
        class="flex h-10 w-full items-center rounded-md px-4 text-left text-sm font-semibold"
        :class="activeTab === 'audit' ? 'bg-slate-700 text-white' : 'text-slate-100 hover:bg-ink-850'"
        @click="activeTab = 'audit'"
      >
        Audit Trail
      </button>
    </div>

    <section v-if="activeTab === 'general'" class="max-w-3xl">
      <div class="mb-5 border-b border-line pb-5">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 class="text-xl font-bold text-white">General Surat Tugas</h2>
            <p class="mt-1 text-sm text-muted">Isi informasi umum surat tugas.</p>
          </div>
          <div class="rounded-md border border-line bg-ink-900 px-3 py-2 text-sm font-semibold text-white">
            {{ modeLabel }}
          </div>
        </div>
        <p class="mt-3 text-sm text-muted">{{ modeDescription }}</p>
      </div>

      <form class="space-y-6" @submit.prevent="saveAssignment">
        <p v-if="formError" class="rounded-md border border-rose-400/30 bg-rose-500/10 p-3 text-sm font-semibold text-rose-200">
          {{ formError }}
        </p>
        <p v-if="successMessage" class="rounded-md border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-100">
          {{ successMessage }}
          <RouterLink v-if="lastCreatedAssignment" class="ml-2 underline" :to="`/surat-tugas/${encodeURIComponent(lastCreatedAssignment.id)}?tab=items`">
            Buka detail
          </RouterLink>
        </p>
        <FormField id="assignmentNo" label="ID Surat Tugas">
          <input id="assignmentNo" class="field-control" :value="assignment?.assignmentNo ?? 'Generate otomatis'" disabled />
        </FormField>
        <SelectField id="complaint" v-model="form.complaintId" label="No. Komplain (Opsional)" :options="complaintOptions" />
        <FormField id="mpNo" label="No. MP">
          <input id="mpNo" :value="form.mpNo" class="field-control" placeholder="No. MP" required @input="setFormValue('mpNo', $event)" />
        </FormField>
        <SelectField id="customer" :model-value="form.customerId" label="Customer" :options="customerOptions" @update:model-value="setCustomer" />
        <SelectField v-if="branchRequired" id="customerBranch" v-model="form.customerBranchId" label="Branch Customer" :options="branchOptions" />
        <SelectField id="pic" v-model="form.picId" label="PIC" :options="picOptions" />
        <SelectField id="type" v-model="form.type" label="Tipe" :options="typeOptions" />
        <FormField id="status" label="Status">
          <input id="status" class="field-control" :value="statusLabel(currentStatus)" disabled />
        </FormField>
        <button v-if="canSave" type="submit" class="btn-primary" :disabled="createSuratTugas.isPending.value || updateSuratTugas.isPending.value">
          {{ isNew ? 'Buat Surat Tugas' : 'Update Surat Tugas' }}
        </button>
      </form>

      <div v-if="!isNew" class="mt-6 rounded-lg border border-line bg-ink-950 p-4">
        <div class="mb-3 flex flex-col gap-1">
          <h3 class="text-base font-bold text-white">Workflow Surat Tugas</h3>
          <p class="text-sm text-muted">Aksi yang tersedia mengikuti role, status, dan aturan item.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button v-if="canStart" type="button" class="btn-secondary" :disabled="startSuratTugas.isPending.value" @click="startAssignment">
            <Play class="h-4 w-4" />
            Mulai
          </button>
          <button v-if="canReadyToPrint" type="button" class="btn-primary" :disabled="readyToPrintSuratTugas.isPending.value" @click="readyToPrintAssignment">
            <Download class="h-4 w-4" />
            Siap Print
          </button>
          <button v-if="canTechnicianComplete" type="button" class="btn-primary" :disabled="technicianCompleteSuratTugas.isPending.value" @click="technicianCompleteAssignment">
            <CheckCircle class="h-4 w-4" />
            Selesai Teknisi
          </button>
          <button v-if="canWarehouseValidate" type="button" class="btn-primary" :disabled="warehouseValidateSuratTugas.isPending.value" @click="warehouseValidateAssignment">
            <ShieldCheck class="h-4 w-4" />
            Validasi Warehouse
          </button>
          <button v-if="canResolveAssignment" type="button" class="btn-primary" :disabled="resolveSuratTugas.isPending.value" @click="resolveAssignment">
            <CheckCircle class="h-4 w-4" />
            Resolve Surat Tugas
          </button>
          <p v-if="!canStart && !canReadyToPrint && !canTechnicianComplete && !canWarehouseValidate && !canResolveAssignment" class="text-sm font-semibold text-muted">
            Tidak ada aksi workflow untuk role/status saat ini.
          </p>
        </div>
      </div>
    </section>

    <section v-else-if="activeTab === 'items'">
      <div class="mb-4 flex justify-end">
        <button v-if="canManageItems" type="button" class="btn-primary" :disabled="isNew" @click="openItemModal">
          <Plus class="h-4 w-4" />
          Tambah Item
        </button>
      </div>

      <DataTable
        :rows="itemRows"
        :columns="itemColumns"
        :enable-actions="canManageItems"
        :can-edit="false"
        :can-delete="canManageItems"
        @delete="deleteAssignmentItem"
      />
    </section>

    <section v-else>
      <div class="mb-5 border-b border-line pb-5">
        <h2 class="text-xl font-bold text-white">Audit Trail Surat Tugas</h2>
        <p class="mt-1 text-sm text-muted">Riwayat perubahan untuk {{ assignmentId }}.</p>
      </div>
      <div v-if="auditQuery.isPending.value" class="rounded-md border border-line bg-ink-900 p-4 text-sm font-semibold text-muted">Memuat audit...</div>
      <div v-else class="overflow-hidden rounded-lg border border-line">
        <table class="w-full text-left text-sm">
          <thead class="bg-ink-900 text-muted">
            <tr><th class="px-4 py-3">Waktu</th><th class="px-4 py-3">User</th><th class="px-4 py-3">Aksi</th><th class="px-4 py-3">Deskripsi</th></tr>
          </thead>
          <tbody class="divide-y divide-line">
            <tr v-for="audit in auditQuery.data.value ?? []" :key="audit.id">
              <td class="whitespace-nowrap px-4 py-3 text-muted">{{ formatAuditDate(audit.createdAt) }}</td>
              <td class="px-4 py-3">{{ audit.actorName || audit.actorUserId || '-' }}</td>
              <td class="px-4 py-3 font-semibold text-sky-100">{{ audit.action }}</td>
              <td class="px-4 py-3">{{ audit.description || '-' }}</td>
            </tr>
            <tr v-if="(auditQuery.data.value ?? []).length === 0"><td colspan="4" class="px-4 py-10 text-center text-muted">Belum ada audit trail.</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>

  <DialogModal
    :open="itemModalOpen"
    title="Tambah Item"
    description="Tambahkan item yang digunakan untuk surat tugas ini."
    submit-label="Tambah Item"
    :submitting="addItem.isPending.value"
    @close="closeItemModal"
    @submit="addAssignmentItem"
  >
    <FormField id="stockItem" label="Item">
      <select id="stockItem" v-model="itemForm.stockItemId" class="field-control" required>
        <option value="">Pilih Item</option>
        <option v-for="item in itemOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
      </select>
    </FormField>
    <FormField id="quantity" label="Kuantitas">
      <input id="quantity" v-model.number="itemForm.quantity" class="field-control" type="number" min="1" required />
    </FormField>
    <FormField id="note" label="Catatan">
      <textarea id="note" :value="itemForm.note" class="field-control min-h-24" placeholder="Catatan item" @input="setItemValue('note', $event)" />
    </FormField>
    <p v-if="itemError" class="text-sm font-semibold text-red-300">{{ itemError }}</p>
  </DialogModal>
</template>
