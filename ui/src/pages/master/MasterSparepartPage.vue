<script setup>
import DataTable from '@/components/ui/DataTable.vue';
import DialogModal from '@/components/ui/DialogModal.vue';
import FormField from '@/components/ui/FormField.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import SelectField from '@/components/ui/SelectField.vue';
import { statusOptions, useEntityCrudPage } from '@/pages/crud/useEntityCrudPage';

const page = useEntityCrudPage({
    crudKey: 'sparepart',
    title: 'Master Sparepart',
    subtitle: 'Kelola master sparepart untuk item surat tugas.',
    writeRoles: ['admin'],
    emptyForm: { code: '', name: '', status: 'active' },
    columns: [
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Nama' },
        { key: 'status', label: 'Status' },
    ],
    searchKeys: ['code', 'name'],
    requiredFields: [
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Nama' },
    ],
});
</script>

<template>
  <PageHeader title="Master Sparepart" subtitle="Kelola master sparepart untuk item surat tugas.">
    <template #actions><button v-if="page.canCreate.value" type="button" class="btn-primary" @click="page.openCreateModal">Tambah Data</button></template>
  </PageHeader>
  <section>
    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <input v-model="page.search.value" class="field-control max-w-sm" placeholder="Cari master sparepart..." />
      <label class="inline-flex items-center gap-2 text-sm font-semibold text-muted"><input v-model="page.showInactive.value" type="checkbox" class="h-4 w-4 rounded border-line bg-ink-850" />Tampilkan tidak aktif</label>
    </div>
    <div v-if="page.records.isLoading.value" class="mb-4 rounded-md border border-line bg-ink-900 p-4 text-sm font-semibold text-muted">Memuat data...</div>
    <div v-if="page.formError.value" class="mb-4 rounded-md border border-rose-400/30 bg-rose-500/10 p-4 text-sm font-semibold text-rose-200">{{ page.formError.value }}</div>
    <DataTable :rows="page.rows.value" :columns="page.allColumns.value" empty-text="Data belum tersedia." :enable-actions="page.canWrite.value" :can-edit="page.canUpdate.value" :can-delete="page.canDelete.value" @row-click="page.canUpdate.value && page.editRecord($event)" @edit="page.editRecord" @delete="page.deleteRecord" />
  </section>
  <DialogModal :open="page.modalOpen.value" :title="page.modalTitle.value" description="Isi data master sparepart." :submit-label="page.submitLabel.value" :submitting="page.isSubmitting.value" @close="page.closeModal" @submit="page.saveRecord">
    <p v-if="page.formError.value" class="rounded-md border border-rose-400/30 bg-rose-500/10 p-3 text-sm font-semibold text-rose-200">{{ page.formError.value }}</p>
    <FormField id="sparepart-code" label="Code"><input id="sparepart-code" :value="page.form.code" class="field-control" placeholder="Code" :disabled="page.isEditing.value" required @input="page.setField('code', $event)" /></FormField>
    <FormField id="sparepart-name" label="Name"><input id="sparepart-name" :value="page.form.name" class="field-control" placeholder="Name" required @input="page.setField('name', $event)" /></FormField>
    <SelectField id="sparepart-status" v-model="page.form.status" label="Status" :options="statusOptions" />
  </DialogModal>
</template>
