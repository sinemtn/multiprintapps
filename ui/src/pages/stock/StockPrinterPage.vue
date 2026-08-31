<script setup>
import DataTable from '@/components/ui/DataTable.vue';
import DialogModal from '@/components/ui/DialogModal.vue';
import FormField from '@/components/ui/FormField.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import SelectField from '@/components/ui/SelectField.vue';
import { statusOptions, useEntityCrudPage } from '@/pages/crud/useEntityCrudPage';

const page = useEntityCrudPage({
    crudKey: 'stock-printer',
    title: 'Stok Printer',
    subtitle: 'Kelola unit stok printer dan status ketersediaannya.',
    writeRoles: ['admin', 'warehouse'],
    emptyForm: {
        code: '',
        printer: '',
        serialNo: '',
        feature: '',
        buyDate: '',
        location: '',
        branch: '',
        status: 'active',
        note: '',
    },
    columns: [
        { key: 'code', label: 'MP No' },
        { key: 'printer', label: 'Printer' },
        { key: 'serialNo', label: 'Serial No' },
        { key: 'location', label: 'Lokasi' },
        { key: 'branch', label: 'Cabang' },
        { key: 'status', label: 'Status' },
    ],
    searchKeys: ['code', 'printer', 'serialNo', 'location', 'branch'],
    requiredFields: [
        { key: 'code', label: 'MP No' },
        { key: 'printer', label: 'Printer' },
        { key: 'serialNo', label: 'Serial No' },
        { key: 'buyDate', label: 'Buy Date' },
        { key: 'location', label: 'Lokasi' },
        { key: 'branch', label: 'Cabang' },
    ],
});
</script>

<template>
  <PageHeader title="Stok Printer" subtitle="Kelola unit stok printer dan status ketersediaannya.">
    <template #actions><button v-if="page.canCreate.value" type="button" class="btn-primary" @click="page.openCreateModal">Tambah Data</button></template>
  </PageHeader>
  <section>
    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <input v-model="page.search.value" class="field-control max-w-sm" placeholder="Cari stok printer..." />
      <label class="inline-flex items-center gap-2 text-sm font-semibold text-muted"><input v-model="page.showInactive.value" type="checkbox" class="h-4 w-4 rounded border-line bg-ink-850" />Tampilkan tidak aktif</label>
    </div>
    <div v-if="page.records.isLoading.value" class="mb-4 rounded-md border border-line bg-ink-900 p-4 text-sm font-semibold text-muted">Memuat data...</div>
    <div v-if="page.formError.value" class="mb-4 rounded-md border border-rose-400/30 bg-rose-500/10 p-4 text-sm font-semibold text-rose-200">{{ page.formError.value }}</div>
    <DataTable :rows="page.rows.value" :columns="page.allColumns.value" empty-text="Data belum tersedia." :enable-actions="page.canWrite.value" :can-edit="page.canUpdate.value" :can-delete="page.canDelete.value" @row-click="page.canUpdate.value && page.editRecord($event)" @edit="page.editRecord" @delete="page.deleteRecord" />
  </section>
  <DialogModal :open="page.modalOpen.value" :title="page.modalTitle.value" description="Isi data stok printer." :submit-label="page.submitLabel.value" :submitting="page.isSubmitting.value" @close="page.closeModal" @submit="page.saveRecord">
    <p v-if="page.formError.value" class="rounded-md border border-rose-400/30 bg-rose-500/10 p-3 text-sm font-semibold text-rose-200">{{ page.formError.value }}</p>
    <FormField id="stock-printer-code" label="MP No"><input id="stock-printer-code" :value="page.form.code" class="field-control" placeholder="MP No" :disabled="page.isEditing.value" required @input="page.setField('code', $event)" /></FormField>
    <FormField id="stock-printer-printer" label="Printer"><input id="stock-printer-printer" :value="page.form.printer" class="field-control" placeholder="Printer" required @input="page.setField('printer', $event)" /></FormField>
    <FormField id="stock-printer-serial" label="Serial No"><input id="stock-printer-serial" :value="page.form.serialNo" class="field-control" placeholder="Serial No" required @input="page.setField('serialNo', $event)" /></FormField>
    <FormField id="stock-printer-feature" label="Fitur"><input id="stock-printer-feature" :value="page.form.feature" class="field-control" placeholder="Fitur" @input="page.setField('feature', $event)" /></FormField>
    <FormField id="stock-printer-buydate" label="Tanggal Beli"><input id="stock-printer-buydate" :value="page.form.buyDate" class="field-control" type="date" required @input="page.setField('buyDate', $event)" /></FormField>
    <FormField id="stock-printer-location" label="Lokasi"><input id="stock-printer-location" :value="page.form.location" class="field-control" placeholder="Lokasi" required @input="page.setField('location', $event)" /></FormField>
    <FormField id="stock-printer-branch" label="Cabang"><input id="stock-printer-branch" :value="page.form.branch" class="field-control" placeholder="Cabang" required @input="page.setField('branch', $event)" /></FormField>
    <SelectField id="stock-printer-status" v-model="page.form.status" label="Status" :options="statusOptions" />
    <FormField id="stock-printer-note" label="Catatan"><textarea id="stock-printer-note" :value="page.form.note" class="field-control min-h-24" placeholder="Catatan" @input="page.setField('note', $event)" /></FormField>
  </DialogModal>
</template>
