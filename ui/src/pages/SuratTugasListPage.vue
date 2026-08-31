<script setup>
import { computed, onBeforeUnmount, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Download, SlidersHorizontal, X } from 'lucide-vue-next';
import DataTable, {} from '@/components/ui/DataTable.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import { useComplaints } from '@/composables/useComplaints';
import { useCustomers, useUsers } from '@/composables/useLookups';
import { useSuratTugasList, useSuratTugasMutations } from '@/composables/useSuratTugas';
import { api } from '@/services/api';
import { createSuratTugasPdfBlobUrl, downloadSuratTugasPdf } from '@/services/pdf';
import { useAuth } from '@/composables/useAuth';
const router = useRouter();
const auth = useAuth();
const canCreate = computed(() => auth.can('assignment', 'create'));
const canEdit = computed(() => auth.can('assignment', 'update'));
const canDelete = computed(() => auth.can('assignment', 'delete'));
const search = ref('');
const status = ref('');
const previewOpen = ref(false);
const previewLoading = ref(false);
const previewError = ref('');
const previewUrl = ref('');
const previewAssignment = ref(null);
const { data: assignments } = useSuratTugasList();
const { data: complaints } = useComplaints();
const { data: customers } = useCustomers();
const { data: users } = useUsers();
const { removeSuratTugas } = useSuratTugasMutations();
const columns = [
    { key: 'assignmentNo', label: 'ID' },
    { key: 'complaintNo', label: 'No. Komplain' },
    { key: 'customer', label: 'Nama Customer' },
    { key: 'pic', label: 'Nama PIC' },
    { key: 'type', label: 'Tipe' },
    { key: 'status', label: 'Status' },
];
const rows = computed(() => {
    const term = search.value.toLowerCase();
    return (assignments.value ?? [])
        .filter((item) => (status.value ? item.status === status.value : true))
        .filter((item) => {
        const complaintNo = complaints.value?.find((complaint) => complaint.id === item.complaintId)?.complaintNo ?? item.complaintId ?? '';
        const customer = customers.value?.find((customer) => customer.id === item.customerId)?.name ?? '';
        const pic = users.value?.find((user) => user.id === item.picId)?.name ?? item.picId ?? '';
        return `${item.assignmentNo} ${complaintNo} ${item.mpNo} ${customer} ${pic} ${item.type} ${item.status}`.toLowerCase().includes(term);
    })
        .map((item) => ({
        id: item.id,
        assignmentNo: item.assignmentNo,
        complaintNo: complaints.value?.find((complaint) => complaint.id === item.complaintId)?.complaintNo ?? item.complaintId ?? '-',
        customer: customers.value?.find((customer) => customer.id === item.customerId)?.name ?? '-',
        pic: users.value?.find((user) => user.id === item.picId)?.name ?? '-',
        type: item.type,
        status: item.status,
    }));
});
function openDetail(row) {
    router.push(`/surat-tugas/${encodeURIComponent(String(row.id))}`);
}
function confirmDelete(row) {
    const label = String(row.assignmentNo ?? row.id ?? 'surat tugas ini');
    if (!window.confirm(`Hapus surat tugas ${label}?`))
        return;
    removeSuratTugas.mutate(String(row.id));
}
const previewCustomer = computed(() => customers.value?.find((customer) => customer.id === previewAssignment.value?.customerId));
const previewPic = computed(() => users.value?.find((user) => user.id === previewAssignment.value?.picId));
function clearPreviewUrl() {
    if (!previewUrl.value)
        return;
    URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = '';
}
async function openPreview(row) {
    if (!['ready_to_print', 'technician_completed', 'warehouse_validated', 'solved'].includes(String(row.status))) {
        window.alert('PDF tersedia setelah surat tugas mencapai status Ready to Print.');
        return;
    }
    previewOpen.value = true;
    previewLoading.value = true;
    previewError.value = '';
    previewAssignment.value = null;
    clearPreviewUrl();
    try {
        const detail = await api.suratTugas.get(String(row.id));
        previewAssignment.value = detail;
        previewUrl.value = createSuratTugasPdfBlobUrl(detail, previewCustomer.value, previewPic.value);
    }
    catch (error) {
        previewError.value = error instanceof Error ? error.message : 'Preview PDF gagal dimuat';
    }
    finally {
        previewLoading.value = false;
    }
}
function closePreview() {
    previewOpen.value = false;
    previewLoading.value = false;
    previewError.value = '';
    previewAssignment.value = null;
    clearPreviewUrl();
}
function downloadPreview() {
    if (!previewAssignment.value)
        return;
    downloadSuratTugasPdf(previewAssignment.value, previewCustomer.value, previewPic.value);
}
onBeforeUnmount(clearPreviewUrl);
</script>

<template>
  <PageHeader title="Surat Tugas" subtitle="Daftar surat tugas dan status operasional.">
    <template #actions>
      <RouterLink v-if="canCreate" to="/surat-tugas/new" class="btn-primary">Buat Surat Tugas</RouterLink>
    </template>
  </PageHeader>

  <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div class="flex flex-col gap-2 sm:flex-row">
      <input v-model="search" class="field-control sm:w-72" placeholder="Cari surat tugas..." />
      <select v-model="status" class="field-control sm:w-40">
        <option value="">Status</option>
        <option value="pending">Pending</option>
        <option value="progress">Progress</option>
        <option value="ready_to_print">Ready to Print</option>
        <option value="technician_completed">Technician Completed</option>
        <option value="warehouse_validated">Warehouse Validated</option>
        <option value="solved">Solved</option>
        <option value="cancelled">Cancelled</option>
      </select>
    </div>
    <button type="button" class="btn-secondary">
      <SlidersHorizontal class="h-4 w-4" />
      Tampilan
    </button>
  </div>

  <DataTable
    :rows="rows"
    :columns="columns"
    enable-preview-action
    :can-edit="canEdit"
    :can-delete="canDelete"
    @row-click="openDetail"
    @preview="openPreview"
    @edit="openDetail"
    @delete="confirmDelete"
  />

  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="previewOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button
          type="button"
          class="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm"
          aria-label="Close preview"
          @click="closePreview"
        />

        <section class="relative flex h-[85vh] w-full max-w-5xl flex-col rounded-lg border border-line bg-ink-950 shadow-panel">
          <div class="flex items-start justify-between gap-4 border-b border-line p-4">
            <div>
              <h2 class="text-xl font-bold text-white">Preview PDF Surat Tugas</h2>
              <p class="mt-1 text-sm text-muted">{{ previewAssignment?.assignmentNo ?? 'Memuat surat tugas...' }}</p>
            </div>
            <div class="flex items-center gap-2">
              <button type="button" class="btn-primary" :disabled="!previewAssignment" @click="downloadPreview">
                <Download class="h-4 w-4" />
                Download PDF
              </button>
              <button type="button" class="btn-secondary h-9 w-9 shrink-0 px-0" @click="closePreview">
                <X class="h-4 w-4" />
              </button>
            </div>
          </div>

          <div class="min-h-0 flex-1 p-4">
            <div v-if="previewLoading" class="flex h-full items-center justify-center rounded-md border border-line text-sm font-semibold text-white">
              Memuat preview PDF...
            </div>
            <div v-else-if="previewError" class="rounded-md border border-red-400/30 bg-red-500/10 p-4 text-sm font-semibold text-red-200">
              {{ previewError }}
            </div>
            <iframe
              v-else-if="previewUrl"
              :src="previewUrl"
              title="Preview PDF Surat Tugas"
              class="h-full w-full rounded-md border border-line bg-white"
            />
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
