<script setup>
import { computed, reactive, ref, watchEffect } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { useRoute, useRouter } from 'vue-router';
import { CheckCircle, Plus } from 'lucide-vue-next';
import DataTable, {} from '@/components/ui/DataTable.vue';
import FormField from '@/components/ui/FormField.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import SelectField from '@/components/ui/SelectField.vue';
import Tabs from '@/components/ui/Tabs.vue';
import { useComplaint, useComplaintMutations } from '@/composables/useComplaints';
import { useCustomers, useUsers } from '@/composables/useLookups';
import { useSuratTugasByComplaint } from '@/composables/useSuratTugas';
import { useAuth } from '@/composables/useAuth';
import { api } from '@/services/api';
const route = useRoute();
const router = useRouter();
const auth = useAuth();
const canWrite = computed(() => auth.can('complaint', isNew.value ? 'create' : 'update'));
const canCreateAssignment = computed(() => auth.can('assignment', 'create'));
const activeTab = ref('general');
const complaintId = computed(() => String(route.params.id ?? 'new'));
const isNew = computed(() => complaintId.value === 'new');
const { data: complaint } = useComplaint(complaintId);
const { data: customers } = useCustomers();
const { data: users } = useUsers();
const { data: assignments } = useSuratTugasByComplaint(complaintId);
const { createComplaint, updateComplaint, resolveComplaint } = useComplaintMutations();
const formError = ref('');
const auditQuery = useQuery({
    queryKey: computed(() => ['audit-trail', 'complaint', complaintId.value]),
    queryFn: () => api.auditTrail.list({ complaintId: complaintId.value, pageSize: 50 }),
    enabled: computed(() => !isNew.value && activeTab.value === 'audit' && auth.can('audit-trail', 'view')),
});
function toDatetimeLocal(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime()))
        return toDatetimeLocal(new Date());
    const offsetMs = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}
const form = reactive({
    complaintDate: toDatetimeLocal(),
    mpNo: '',
    description: '',
    customerId: '',
    customerBranchId: '',
    salesId: '',
    status: 'new',
    note: '',
});
watchEffect(() => {
    if (!complaint.value)
        return;
    form.mpNo = complaint.value.mpNo;
    form.description = complaint.value.description;
    form.customerId = complaint.value.customerId;
    form.customerBranchId = complaint.value.customerBranchId ?? '';
    form.salesId = users.value?.find((user) => user.id === complaint.value?.salesId || user.name === complaint.value?.salesId)?.id ?? complaint.value.salesId;
    form.status = complaint.value.status;
    form.note = complaint.value.note;
    form.complaintDate = toDatetimeLocal(complaint.value.complaintDate ?? complaint.value.createdAt);
});
const customerOptions = computed(() => (customers.value ?? []).map((item) => ({ label: item.name, value: item.id })));
const selectedCustomer = computed(() => customers.value?.find((item) => item.id === form.customerId));
const branchOptions = computed(() => (selectedCustomer.value?.branches ?? [])
    .filter((branch) => branch.active !== false)
    .map((branch) => ({ label: branch.name, value: branch.id })));
const branchRequired = computed(() => selectedCustomer.value?.type === 'account');
const salesOptions = computed(() => (users.value ?? []).filter((item) => ['sales', 'sales-admin'].includes(item.role)).map((item) => ({ label: item.name, value: item.id })));
const statusOptions = [
    { label: 'New', value: 'new' },
    { label: 'Pending', value: 'pending' },
    { label: 'On Progress', value: 'progress' },
    { label: 'Solved', value: 'solved' },
    { label: 'Cancelled', value: 'cancelled' },
];
const allAssignmentsSolved = computed(() => (assignments.value ?? []).every((item) => item.status === 'solved'));
const canResolveComplaint = computed(() => auth.can('complaint', 'resolve') && !isNew.value && form.status !== 'solved' && allAssignmentsSolved.value);
const resolveBlockedMessage = computed(() => {
    if (isNew.value || form.status === 'solved' || allAssignmentsSolved.value)
        return '';
    return 'Komplain belum bisa di-resolve karena masih ada surat tugas yang belum selesai.';
});
const assignmentColumns = [
    { key: 'assignmentNo', label: 'ID Surat Tugas' },
    { key: 'customer', label: 'Customer' },
    { key: 'pic', label: 'PIC' },
    { key: 'status', label: 'Status' },
];
const assignmentRows = computed(() => (assignments.value ?? []).map((item) => ({
    id: item.id,
    assignmentNo: item.assignmentNo,
    customer: customers.value?.find((customer) => customer.id === item.customerId)?.name ?? '-',
    pic: users.value?.find((user) => user.id === item.picId)?.name ?? '-',
    status: item.status,
})));
function setFormValue(key, event) {
    form[key] = event.target.value;
}
function setCustomer(value) {
    form.customerId = value;
    form.customerBranchId = '';
}
function validateComplaintForm() {
    const required = [
        ['mpNo', 'MP. No'],
        ['description', 'Deskripsi'],
        ['customerId', 'Customer'],
        ['salesId', 'Sales'],
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
    if (form.status === 'solved') {
        formError.value = 'Gunakan tombol Resolve Komplain untuk menyelesaikan komplain.';
        return false;
    }
    return true;
}
async function saveComplaint() {
    formError.value = '';
    if (!validateComplaintForm())
        return;
    if (isNew.value) {
        const created = await createComplaint.mutateAsync({ ...form });
        await router.push(`/komplain/${encodeURIComponent(created.id)}`);
        return;
    }
    await updateComplaint.mutateAsync({ id: complaintId.value, payload: { ...form } });
}
async function resolveCurrentComplaint() {
    formError.value = '';
    if (!window.confirm(`Resolve komplain ${complaintId.value}?`))
        return;
    const resolved = await resolveComplaint.mutateAsync(complaintId.value);
    form.status = resolved.status;
}
function createSuratTugasFromComplaint() {
    const query = new URLSearchParams({
        complaintId: complaintId.value,
        customerId: form.customerId,
        customerBranchId: form.customerBranchId,
        mpNo: form.mpNo,
        fromComplaint: '1',
    });
    router.push(`/surat-tugas/new?${query.toString()}`);
}
function openAssignment(row) {
    router.push(`/surat-tugas/${encodeURIComponent(String(row.id))}`);
}
function formatAuditDate(value) {
    if (!value)
        return '-';
    return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(value));
}
</script>

<template>
  <PageHeader title="Detail Komplain" />

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
        :class="activeTab === 'assignments' ? 'bg-slate-700 text-white' : 'text-slate-100 hover:bg-ink-850'"
        @click="activeTab = 'assignments'"
      >
        Surat Tugas
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
        <h2 class="text-xl font-bold text-white">General Komplain</h2>
        <p class="mt-1 text-sm text-muted">Isi informasi umum komplain.</p>
      </div>

      <form class="space-y-6" @submit.prevent="saveComplaint">
        <p v-if="formError" class="rounded-md border border-rose-400/30 bg-rose-500/10 p-3 text-sm font-semibold text-rose-200">
          {{ formError }}
        </p>
        <FormField id="complaintNo" label="No. Komplain">
          <input id="complaintNo" class="field-control" :value="complaint?.complaintNo ?? 'Generate otomatis'" disabled />
        </FormField>
        <FormField id="complaintDate" label="Tanggal Komplain">
          <input id="complaintDate" :value="form.complaintDate" class="field-control" type="datetime-local" required @input="setFormValue('complaintDate', $event)" />
        </FormField>
        <FormField id="mpNo" label="MP. No">
          <input id="mpNo" :value="form.mpNo" class="field-control" placeholder="No. MP" required @input="setFormValue('mpNo', $event)" />
        </FormField>
        <FormField id="description" label="Deskripsi">
          <input id="description" :value="form.description" class="field-control" placeholder="Deskripsi komplain" required @input="setFormValue('description', $event)" />
        </FormField>
        <SelectField id="customer" :model-value="form.customerId" label="Customer" :options="customerOptions" @update:model-value="setCustomer" />
        <SelectField v-if="branchRequired" id="customerBranch" v-model="form.customerBranchId" label="Branch Customer" :options="branchOptions" />
        <SelectField id="sales" v-model="form.salesId" label="Sales" :options="salesOptions" />
        <SelectField id="status" v-model="form.status" label="Status" :options="statusOptions" />
        <FormField id="note" label="Note">
          <textarea id="note" :value="form.note" class="field-control min-h-24" placeholder="Notes..." @input="setFormValue('note', $event)" />
        </FormField>
        <div class="flex flex-wrap items-center gap-2">
          <button v-if="canWrite" type="submit" class="btn-primary" :disabled="createComplaint.isPending.value || updateComplaint.isPending.value">
            {{ isNew ? 'Buat Komplain' : 'Update Komplain' }}
          </button>
          <button v-if="canResolveComplaint" type="button" class="btn-primary" :disabled="resolveComplaint.isPending.value" @click="resolveCurrentComplaint">
            <CheckCircle class="h-4 w-4" />
            Resolve Komplain
          </button>
        </div>
        <p v-if="resolveBlockedMessage" class="rounded-md border border-amber-400/30 bg-amber-500/10 p-3 text-sm font-semibold text-amber-100">
          {{ resolveBlockedMessage }}
        </p>
      </form>
    </section>

    <section v-else-if="activeTab === 'assignments'">
      <div class="mb-4 flex justify-end">
        <button v-if="canCreateAssignment" type="button" class="btn-primary" :disabled="isNew" @click="createSuratTugasFromComplaint">
          Buat
          <Plus class="h-4 w-4" />
        </button>
      </div>
      <DataTable
        :rows="assignmentRows"
        :columns="assignmentColumns"
        :enable-actions="false"
        @row-click="openAssignment"
      />
    </section>

    <section v-else>
      <div class="mb-5 border-b border-line pb-5">
        <h2 class="text-xl font-bold text-white">Audit Trail Komplain</h2>
        <p class="mt-1 text-sm text-muted">Riwayat perubahan untuk {{ complaintId }}.</p>
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
</template>
