<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import DataTable from '@/components/ui/DataTable.vue';
import DialogModal from '@/components/ui/DialogModal.vue';
import FormField from '@/components/ui/FormField.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import SelectField from '@/components/ui/SelectField.vue';
import { statusOptions, useEntityCrudPage } from '@/pages/crud/useEntityCrudPage';

const route = useRoute();
const customerMode = computed(() => route.meta.customerType === 'account' ? 'account' : 'single');
const isAccountPage = computed(() => customerMode.value === 'account');
const pageTitle = computed(() => isAccountPage.value ? 'Akun Customer' : 'Customer Tunggal');
const pageSubtitle = computed(() => isAccountPage.value
    ? 'Kelola akun induk yang menaungi beberapa customer tunggal.'
    : 'Kelola customer operasional untuk komplain, surat tugas, dan stok.');
const page = useEntityCrudPage({
    crudKey: 'customer',
    title: 'Master Customer',
    subtitle: 'Kelola customer untuk komplain, surat tugas, dan stok.',
    writeRoles: ['admin', 'sales-admin'],
    emptyForm: { code: '', name: '', address: '', billingAccount: '', quota: 0, periode: '', type: 'single', parentCustomerId: '', status: 'active' },
    columns: [
        { key: 'code', label: 'Customer ID' },
        { key: 'name', label: 'Nama' },
        { key: 'type', label: 'Tipe' },
        { key: 'parentCustomerName', label: 'Akun' },
        { key: 'address', label: 'Alamat' },
        { key: 'billingAccount', label: 'Billing' },
        { key: 'quota', label: 'Quota' },
        { key: 'status', label: 'Status' },
    ],
    searchKeys: ['code', 'name', 'address', 'billingAccount'],
    requiredFields: [
        { key: 'code', label: 'Customer ID' },
        { key: 'name', label: 'Nama Customer' },
    ],
});
const typeOptions = [
    { label: 'Customer Tunggal', value: 'single' },
    { label: 'Akun Customer', value: 'account' },
];
const accountOptions = computed(() => [
    { label: 'Tanpa Akun', value: '' },
    ...(page.records.data.value ?? [])
        .filter((item) => item.type === 'account' && item.status !== 'inactive')
        .map((item) => ({ label: `${item.code} - ${item.name}`, value: item.id })),
]);
const tableColumns = computed(() => {
    const common = [
        { key: 'code', label: 'Customer ID' },
        { key: 'name', label: 'Nama' },
        { key: 'address', label: 'Alamat' },
        { key: 'status', label: 'Status' },
        { key: 'updatedAt', label: 'Diupdate' },
    ];
    if (isAccountPage.value)
        return [...common.slice(0, 3), { key: 'childrenCount', label: 'Customer Tunggal' }, ...common.slice(3)];
    return [...common.slice(0, 2), { key: 'parentCustomerName', label: 'Akun' }, ...common.slice(2)];
});
const filteredRows = computed(() => page.rows.value
    .filter((row) => row.type === customerMode.value)
    .map((row) => ({
        ...row,
        parentCustomerName: row.parentCustomerName || '-',
        childrenCount: page.records.data.value?.find((item) => item.id === row.id)?.children?.length ?? 0,
    })));
const activeCustomer = computed(() => page.records.data.value?.find((item) => item.id === page.form.code));
function openCreateCustomer() {
    page.openCreateModal();
    page.form.type = customerMode.value;
    page.form.parentCustomerId = '';
}
function openEdit(row) {
    page.editRecord(row);
    page.form.type = customerMode.value;
}
</script>

<template>
  <PageHeader :title="pageTitle" :subtitle="pageSubtitle">
    <template #actions><button v-if="page.canCreate.value" type="button" class="btn-primary" @click="openCreateCustomer">Tambah Data</button></template>
  </PageHeader>
  <section>
    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <input v-model="page.search.value" class="field-control max-w-sm" :placeholder="`Cari ${pageTitle.toLowerCase()}...`" />
      <label class="inline-flex items-center gap-2 text-sm font-semibold text-muted"><input v-model="page.showInactive.value" type="checkbox" class="h-4 w-4 rounded border-line bg-ink-850" />Tampilkan tidak aktif</label>
    </div>
    <div v-if="page.records.isLoading.value" class="mb-4 rounded-md border border-line bg-ink-900 p-4 text-sm font-semibold text-muted">Memuat data...</div>
    <div v-if="page.formError.value" class="mb-4 rounded-md border border-rose-400/30 bg-rose-500/10 p-4 text-sm font-semibold text-rose-200">{{ page.formError.value }}</div>
    <DataTable :rows="filteredRows" :columns="tableColumns" empty-text="Data belum tersedia." :enable-actions="page.canWrite.value" :can-edit="page.canUpdate.value" :can-delete="page.canDelete.value" @row-click="page.canUpdate.value && openEdit($event)" @edit="openEdit" @delete="page.deleteRecord" />
  </section>
  <DialogModal :open="page.modalOpen.value" :title="`${page.isEditing.value ? 'Edit' : 'Tambah'} ${pageTitle}`" description="Isi data master customer." :submit-label="page.submitLabel.value" :submitting="page.isSubmitting.value" @close="page.closeModal" @submit="page.saveRecord">
    <p v-if="page.formError.value" class="rounded-md border border-rose-400/30 bg-rose-500/10 p-3 text-sm font-semibold text-rose-200">{{ page.formError.value }}</p>
    <FormField id="customer-code" label="Customer ID"><input id="customer-code" :value="page.form.code" class="field-control" placeholder="Customer ID" :disabled="page.isEditing.value" required @input="page.setField('code', $event)" /></FormField>
    <FormField id="customer-name" label="Nama Customer"><input id="customer-name" :value="page.form.name" class="field-control" placeholder="Nama Customer" required @input="page.setField('name', $event)" /></FormField>
    <SelectField id="customer-type" v-model="page.form.type" label="Jenis Customer" :options="typeOptions" disabled />
    <SelectField v-if="!isAccountPage" id="customer-account" v-model="page.form.parentCustomerId" label="Akun Customer" :options="accountOptions" />
    <FormField id="customer-address" label="Alamat"><textarea id="customer-address" :value="page.form.address" class="field-control min-h-24" placeholder="Alamat" @input="page.setField('address', $event)" /></FormField>
    <template v-if="!isAccountPage">
      <FormField id="customer-billing" label="Billing Account"><input id="customer-billing" :value="page.form.billingAccount" class="field-control" type="number" placeholder="Billing Account" @input="page.setNumberField('billingAccount', $event)" /></FormField>
      <FormField id="customer-quota" label="Quota"><input id="customer-quota" :value="page.form.quota" class="field-control" type="number" placeholder="Quota" @input="page.setNumberField('quota', $event)" /></FormField>
      <FormField id="customer-periode" label="Periode"><input id="customer-periode" :value="page.form.periode" class="field-control" type="date" @input="page.setField('periode', $event)" /></FormField>
    </template>
    <SelectField id="customer-status" v-model="page.form.status" label="Status" :options="statusOptions" />
    <div v-if="page.isEditing.value" class="rounded-lg border border-line bg-ink-900 p-4">
      <h3 class="text-base font-bold text-white">Audit Trail Customer</h3>
      <p class="mt-1 text-sm text-muted">Lihat riwayat perubahan customer.</p>
      <RouterLink class="btn-secondary mt-3 inline-flex" :to="`/audit-trail?customerId=${encodeURIComponent(page.form.code)}`">Buka Audit Trail</RouterLink>
    </div>
    <div v-if="isAccountPage && page.isEditing.value" class="rounded-lg border border-line bg-ink-900 p-4">
      <h3 class="text-base font-bold text-white">Customer Tunggal</h3>
      <p class="mt-1 text-sm text-muted">Customer tunggal yang terhubung ke akun ini.</p>
      <div class="mt-3 overflow-hidden rounded-md border border-line">
        <table class="w-full text-left text-sm">
          <thead class="bg-ink-850 text-muted"><tr><th class="px-3 py-2">Customer ID</th><th class="px-3 py-2">Nama</th><th class="px-3 py-2">Status</th></tr></thead>
          <tbody>
            <tr v-if="!activeCustomer?.children?.length"><td colspan="3" class="px-3 py-3 text-muted">Belum ada customer tunggal yang terhubung.</td></tr>
            <tr v-for="child in activeCustomer?.children ?? []" :key="child.id" class="border-t border-line">
              <td class="px-3 py-2 font-semibold text-white">{{ child.id }}</td>
              <td class="px-3 py-2">{{ child.name }}</td>
              <td class="px-3 py-2">{{ child.active === false ? 'inactive' : 'active' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </DialogModal>
</template>
