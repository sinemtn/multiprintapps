<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { SlidersHorizontal } from 'lucide-vue-next';
import DataTable, {} from '@/components/ui/DataTable.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import { useComplaints, useComplaintMutations } from '@/composables/useComplaints';
import { useCustomers, useUsers } from '@/composables/useLookups';
import { useAuth } from '@/composables/useAuth';
const router = useRouter();
const auth = useAuth();
const canCreate = computed(() => auth.can('complaint', 'create'));
const canEdit = computed(() => auth.can('complaint', 'update'));
const canDelete = computed(() => auth.can('complaint', 'delete'));
const hasActions = computed(() => canEdit.value || canDelete.value);
const search = ref('');
const status = ref('');
const { data: complaints } = useComplaints();
const { data: customers } = useCustomers();
const { data: users } = useUsers();
const { removeComplaint } = useComplaintMutations();
const columns = [
    { key: 'complaintNo', label: 'No. Komplain' },
    { key: 'mpNo', label: 'MP. No' },
    { key: 'description', label: 'Deskripsi' },
    { key: 'customer', label: 'Customer' },
    { key: 'sales', label: 'Sales' },
    { key: 'status', label: 'Status' },
];
const rows = computed(() => {
    const term = search.value.toLowerCase();
    return (complaints.value ?? [])
        .filter((item) => (status.value ? item.status === status.value : true))
        .filter((item) => {
        const customer = customers.value?.find((customer) => customer.id === item.customerId)?.name ?? '';
        const sales = users.value?.find((user) => user.id === item.salesId)?.name ?? item.salesId ?? '';
        return `${item.complaintNo} ${item.mpNo} ${item.description} ${customer} ${sales} ${item.status}`.toLowerCase().includes(term);
    })
        .map((item) => ({
        id: item.id,
        complaintNo: item.complaintNo,
        mpNo: item.mpNo,
        description: item.description,
        customer: customers.value?.find((customer) => customer.id === item.customerId)?.name ?? '-',
        sales: users.value?.find((user) => user.id === item.salesId)?.name ?? item.salesId ?? '-',
        status: item.status,
    }));
});
function openDetail(row) {
    router.push(`/komplain/${encodeURIComponent(String(row.id))}`);
}
function confirmDelete(row) {
    const label = String(row.complaintNo ?? row.id ?? 'komplain ini');
    if (!window.confirm(`Hapus komplain ${label}?`))
        return;
    removeComplaint.mutate(String(row.id));
}
</script>

<template>
  <PageHeader title="Komplain" subtitle="Daftar komplain dan status operasional.">
    <template #actions>
      <RouterLink v-if="canCreate" to="/komplain/new" class="btn-primary">Buat Komplain</RouterLink>
    </template>
  </PageHeader>

  <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div class="flex flex-col gap-2 sm:flex-row">
      <input v-model="search" class="field-control sm:w-72" placeholder="Cari komplain..." />
      <select v-model="status" class="field-control sm:w-40">
        <option value="">Status</option>
        <option value="new">Baru</option>
        <option value="pending">Pending</option>
        <option value="progress">Progress</option>
        <option value="solved">Selesai</option>
        <option value="cancelled">Dibatalkan</option>
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
    :enable-actions="hasActions"
    :can-edit="canEdit"
    :can-delete="canDelete"
    @row-click="openDetail"
    @edit="openDetail"
    @delete="confirmDelete"
  />
</template>
