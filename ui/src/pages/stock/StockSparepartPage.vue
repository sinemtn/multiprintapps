<script setup>
import { computed } from 'vue';
import DataTable from '@/components/ui/DataTable.vue';
import DialogModal from '@/components/ui/DialogModal.vue';
import FormField from '@/components/ui/FormField.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import SelectField from '@/components/ui/SelectField.vue';
import { useCustomers } from '@/composables/useLookups';
import { useEntityCrudPage } from '@/pages/crud/useEntityCrudPage';

const { data: customers } = useCustomers();
const page = useEntityCrudPage({
    crudKey: 'stock-sparepart',
    title: 'Stok Sparepart',
    subtitle: 'Kelola stok sparepart, lokasi, customer, dan kuantitas.',
    writeRoles: ['admin', 'warehouse'],
    emptyForm: { code: '', location: '', branch: '', qty: 0, customer: '', note: '' },
    columns: [
        { key: 'code', label: 'Sparepart' },
        { key: 'location', label: 'Lokasi' },
        { key: 'branch', label: 'Cabang' },
        { key: 'qty', label: 'Kuantitas' },
        { key: 'customer', label: 'Customer' },
    ],
    searchKeys: ['code', 'location', 'branch', 'customer'],
    requiredFields: [
        { key: 'code', label: 'Sparepart' },
        { key: 'qty', label: 'Kuantitas' },
    ],
    validate(form, _editingId, error) {
        if (Number(form.qty) < 0) {
            error.value = 'Kuantitas tidak boleh kurang dari 0.';
            return false;
        }
        const customer = customers.value?.find((item) => item.id === form.customer);
        if (customer?.type === 'account' && !String(form.branch ?? '').trim()) {
            error.value = 'Cabang wajib dipilih untuk akun customer.';
            return false;
        }
        return true;
    },
});
const customerOptions = computed(() => (customers.value ?? []).map((item) => ({ label: item.name, value: item.id })));
const selectedCustomer = computed(() => customers.value?.find((item) => item.id === page.form.customer));
const branchRequired = computed(() => selectedCustomer.value?.type === 'account');
const branchOptions = computed(() => (selectedCustomer.value?.branches ?? [])
    .filter((branch) => branch.active !== false)
    .map((branch) => ({ label: branch.name, value: branch.id })));
function setCustomer(value) {
    page.form.customer = value;
    page.form.branch = '';
}
</script>

<template>
  <PageHeader title="Stok Sparepart" subtitle="Kelola stok sparepart, lokasi, customer, dan kuantitas.">
    <template #actions><button v-if="page.canCreate.value" type="button" class="btn-primary" @click="page.openCreateModal">Tambah Data</button></template>
  </PageHeader>
  <section>
    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <input v-model="page.search.value" class="field-control max-w-sm" placeholder="Cari stok sparepart..." />
      <label class="inline-flex items-center gap-2 text-sm font-semibold text-muted"><input v-model="page.showInactive.value" type="checkbox" class="h-4 w-4 rounded border-line bg-ink-850" />Tampilkan tidak aktif</label>
    </div>
    <div v-if="page.records.isLoading.value" class="mb-4 rounded-md border border-line bg-ink-900 p-4 text-sm font-semibold text-muted">Memuat data...</div>
    <div v-if="page.formError.value" class="mb-4 rounded-md border border-rose-400/30 bg-rose-500/10 p-4 text-sm font-semibold text-rose-200">{{ page.formError.value }}</div>
    <DataTable :rows="page.rows.value" :columns="page.allColumns.value" empty-text="Data belum tersedia." :enable-actions="page.canWrite.value" :can-edit="page.canUpdate.value" :can-delete="page.canDelete.value" @row-click="page.canUpdate.value && page.editRecord($event)" @edit="page.editRecord" @delete="page.deleteRecord" />
  </section>
  <DialogModal :open="page.modalOpen.value" :title="page.modalTitle.value" description="Isi data stok sparepart." :submit-label="page.submitLabel.value" :submitting="page.isSubmitting.value" @close="page.closeModal" @submit="page.saveRecord">
    <p v-if="page.formError.value" class="rounded-md border border-rose-400/30 bg-rose-500/10 p-3 text-sm font-semibold text-rose-200">{{ page.formError.value }}</p>
    <FormField id="stock-sparepart-code" label="Sparepart"><input id="stock-sparepart-code" :value="page.form.code" class="field-control" placeholder="Sparepart" required @input="page.setField('code', $event)" /></FormField>
    <FormField id="stock-sparepart-location" label="Lokasi"><input id="stock-sparepart-location" :value="page.form.location" class="field-control" placeholder="Lokasi" @input="page.setField('location', $event)" /></FormField>
    <SelectField v-if="branchRequired" id="stock-sparepart-branch" v-model="page.form.branch" label="Cabang" :options="branchOptions" />
    <FormField v-else id="stock-sparepart-branch" label="Cabang"><input id="stock-sparepart-branch" :value="page.form.branch" class="field-control" placeholder="Cabang" @input="page.setField('branch', $event)" /></FormField>
    <FormField id="stock-sparepart-qty" label="Kuantitas"><input id="stock-sparepart-qty" :value="page.form.qty" class="field-control" type="number" min="0" placeholder="Kuantitas" required @input="page.setNumberField('qty', $event)" /></FormField>
    <SelectField id="stock-sparepart-customer" :model-value="page.form.customer" label="Customer" :options="customerOptions" @update:model-value="setCustomer" />
    <FormField id="stock-sparepart-note" label="Catatan"><textarea id="stock-sparepart-note" :value="page.form.note" class="field-control min-h-24" placeholder="Catatan" @input="page.setField('note', $event)" /></FormField>
  </DialogModal>
</template>
