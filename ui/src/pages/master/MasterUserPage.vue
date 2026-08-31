<script setup>
import DataTable from '@/components/ui/DataTable.vue';
import DialogModal from '@/components/ui/DialogModal.vue';
import FormField from '@/components/ui/FormField.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import SelectField from '@/components/ui/SelectField.vue';
import { roleOptions, statusOptions, useEntityCrudPage } from '@/pages/crud/useEntityCrudPage';

const page = useEntityCrudPage({
    crudKey: 'user',
    title: 'Master User',
    subtitle: 'Kelola user aplikasi, role, dan status.',
    writeRoles: ['admin'],
    emptyForm: { code: '', fullName: '', role: 'teknisi', email: '', password: 'Password123!', status: 'active' },
    columns: [
        { key: 'code', label: 'Kode' },
        { key: 'fullName', label: 'Nama' },
        { key: 'role', label: 'Role' },
        { key: 'email', label: 'Email' },
        { key: 'status', label: 'Status' },
    ],
    searchKeys: ['code', 'fullName', 'role', 'email'],
    requiredFields: [
        { key: 'code', label: 'Kode User' },
        { key: 'fullName', label: 'Nama' },
        { key: 'role', label: 'Role' },
        { key: 'email', label: 'Email' },
        { key: 'password', label: 'Password', createOnly: true },
    ],
});
</script>

<template>
  <PageHeader title="Master User" subtitle="Kelola user aplikasi, role, dan status.">
    <template #actions><button v-if="page.canCreate.value" type="button" class="btn-primary" @click="page.openCreateModal">Tambah Data</button></template>
  </PageHeader>
  <section>
    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <input v-model="page.search.value" class="field-control max-w-sm" placeholder="Cari master user..." />
      <label class="inline-flex items-center gap-2 text-sm font-semibold text-muted"><input v-model="page.showInactive.value" type="checkbox" class="h-4 w-4 rounded border-line bg-ink-850" />Tampilkan tidak aktif</label>
    </div>
    <div v-if="page.records.isLoading.value" class="mb-4 rounded-md border border-line bg-ink-900 p-4 text-sm font-semibold text-muted">Memuat data...</div>
    <div v-if="page.formError.value" class="mb-4 rounded-md border border-rose-400/30 bg-rose-500/10 p-4 text-sm font-semibold text-rose-200">{{ page.formError.value }}</div>
    <DataTable :rows="page.rows.value" :columns="page.allColumns.value" empty-text="Data belum tersedia." :enable-actions="page.canWrite.value" :can-edit="page.canUpdate.value" :can-delete="page.canDelete.value" @row-click="page.canUpdate.value && page.editRecord($event)" @edit="page.editRecord" @delete="page.deleteRecord" />
  </section>
  <DialogModal :open="page.modalOpen.value" :title="page.modalTitle.value" description="Isi data master user." :submit-label="page.submitLabel.value" :submitting="page.isSubmitting.value" @close="page.closeModal" @submit="page.saveRecord">
    <p v-if="page.formError.value" class="rounded-md border border-rose-400/30 bg-rose-500/10 p-3 text-sm font-semibold text-rose-200">{{ page.formError.value }}</p>
    <FormField id="user-code" label="Kode User"><input id="user-code" :value="page.form.code" class="field-control" placeholder="Kode User" :disabled="page.isEditing.value" required @input="page.setField('code', $event)" /></FormField>
    <FormField id="user-name" label="Nama"><input id="user-name" :value="page.form.fullName" class="field-control" placeholder="Nama" required @input="page.setField('fullName', $event)" /></FormField>
    <SelectField id="user-role" v-model="page.form.role" label="Role" :options="roleOptions" />
    <FormField id="user-email" label="Email"><input id="user-email" :value="page.form.email" class="field-control" type="email" placeholder="Email" required @input="page.setField('email', $event)" /></FormField>
    <FormField id="user-password" label="Password"><input id="user-password" :value="page.form.password" class="field-control" type="password" placeholder="Password" :required="!page.isEditing.value" @input="page.setField('password', $event)" /></FormField>
    <SelectField id="user-status" v-model="page.form.status" label="Status" :options="statusOptions" />
  </DialogModal>
</template>
