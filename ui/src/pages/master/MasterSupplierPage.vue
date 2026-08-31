<script setup>
import DataTable from '@/components/ui/DataTable.vue';
import DialogModal from '@/components/ui/DialogModal.vue';
import FormField from '@/components/ui/FormField.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import SelectField from '@/components/ui/SelectField.vue';
import { statusOptions, useEntityCrudPage } from '@/pages/crud/useEntityCrudPage';

const page = useEntityCrudPage({
    crudKey: 'supplier',
    title: 'Master Supplier',
    subtitle: 'Kelola supplier perangkat, toner, dan sparepart.',
    writeRoles: ['admin'],
    emptyForm: { code: '', name: '', address: '', status: 'active' },
    columns: [
        { key: 'code', label: 'Supplier ID' },
        { key: 'name', label: 'Nama' },
        { key: 'address', label: 'Alamat' },
        { key: 'status', label: 'Status' },
    ],
    searchKeys: ['code', 'name', 'address'],
    requiredFields: [
        { key: 'code', label: 'Supplier ID' },
        { key: 'name', label: 'Nama Supplier' },
    ],
});
</script>

<template>
  <PageHeader title="Master Supplier" subtitle="Kelola supplier perangkat, toner, dan sparepart.">
    <template #actions><button v-if="page.canCreate.value" type="button" class="btn-primary" @click="page.openCreateModal">Tambah Data</button></template>
  </PageHeader>
  <section>
    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <input v-model="page.search.value" class="field-control max-w-sm" placeholder="Cari master supplier..." />
      <label class="inline-flex items-center gap-2 text-sm font-semibold text-muted"><input v-model="page.showInactive.value" type="checkbox" class="h-4 w-4 rounded border-line bg-ink-850" />Tampilkan tidak aktif</label>
    </div>
    <div v-if="page.records.isLoading.value" class="mb-4 rounded-md border border-line bg-ink-900 p-4 text-sm font-semibold text-muted">Memuat data...</div>
    <div v-if="page.formError.value" class="mb-4 rounded-md border border-rose-400/30 bg-rose-500/10 p-4 text-sm font-semibold text-rose-200">{{ page.formError.value }}</div>
    <DataTable :rows="page.rows.value" :columns="page.allColumns.value" empty-text="Data belum tersedia." :enable-actions="page.canWrite.value" :can-edit="page.canUpdate.value" :can-delete="page.canDelete.value" @row-click="page.canUpdate.value && page.editRecord($event)" @edit="page.editRecord" @delete="page.deleteRecord" />
  </section>
  <DialogModal :open="page.modalOpen.value" :title="page.modalTitle.value" description="Isi data master supplier." :submit-label="page.submitLabel.value" :submitting="page.isSubmitting.value" @close="page.closeModal" @submit="page.saveRecord">
    <p v-if="page.formError.value" class="rounded-md border border-rose-400/30 bg-rose-500/10 p-3 text-sm font-semibold text-rose-200">{{ page.formError.value }}</p>
    <FormField id="supplier-code" label="Supplier ID"><input id="supplier-code" :value="page.form.code" class="field-control" placeholder="Supplier ID" :disabled="page.isEditing.value" required @input="page.setField('code', $event)" /></FormField>
    <FormField id="supplier-name" label="Nama Supplier"><input id="supplier-name" :value="page.form.name" class="field-control" placeholder="Nama Supplier" required @input="page.setField('name', $event)" /></FormField>
    <FormField id="supplier-address" label="Alamat"><textarea id="supplier-address" :value="page.form.address" class="field-control min-h-24" placeholder="Alamat" @input="page.setField('address', $event)" /></FormField>
    <SelectField id="supplier-status" v-model="page.form.status" label="Status" :options="statusOptions" />
  </DialogModal>
</template>
