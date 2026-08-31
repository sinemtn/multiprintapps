import { computed, reactive, ref } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { useCrud } from '@/composables/useCrud';
import { formatDate } from '@/lib/format';

export const statusOptions = [
    { label: 'Aktif', value: 'active' },
    { label: 'Tidak Aktif', value: 'inactive' },
];

export const roleOptions = [
    { label: 'Admin', value: 'admin' },
    { label: 'Sales', value: 'sales' },
    { label: 'Sales Admin', value: 'sales-admin' },
    { label: 'Kepala Teknisi', value: 'kepala-teknisi' },
    { label: 'Teknisi', value: 'teknisi' },
    { label: 'Warehouse', value: 'warehouse' },
];

function cleanText(value) {
    return String(value ?? '').trim();
}

function cloneForm(form) {
    return JSON.parse(JSON.stringify(form));
}

function defaultModule(crudKey) {
    if (crudKey.startsWith('stock-'))
        return crudKey;
    return `master-${crudKey}`;
}

export function useEntityCrudPage(options) {
    const auth = useAuth();
    const key = ref(options.crudKey);
    const search = ref('');
    const showInactive = ref(false);
    const editingId = ref('');
    const modalOpen = ref(false);
    const localError = ref('');
    const form = reactive(cloneForm(options.emptyForm));
    const { records, createRecord, updateRecord, removeRecord } = useCrud(key);

    const allColumns = computed(() => [...options.columns, { key: 'updatedAt', label: 'Diupdate' }]);
    const permissionModule = options.permissionModule ?? defaultModule(options.crudKey);
    const canCreate = computed(() => auth.can(permissionModule, 'create') || auth.hasRole(...options.writeRoles));
    const canUpdate = computed(() => auth.can(permissionModule, 'update') || auth.hasRole(...options.writeRoles));
    const canDelete = computed(() => auth.can(permissionModule, 'delete') || auth.hasRole(...options.writeRoles));
    const canWrite = computed(() => canCreate.value || canUpdate.value || canDelete.value);
    const isSubmitting = computed(() => createRecord.isPending.value || updateRecord.isPending.value);
    const isEditing = computed(() => Boolean(editingId.value));
    const modalTitle = computed(() => `${editingId.value ? 'Edit' : 'Tambah'} ${options.title}`);
    const submitLabel = computed(() => editingId.value ? 'Update' : 'Buat');
    const formError = computed(() => {
        if (localError.value)
            return localError.value;
        const error = createRecord.error.value ?? updateRecord.error.value ?? removeRecord.error.value ?? records.error.value;
        return error instanceof Error ? error.message : '';
    });

    const rows = computed(() => {
        const term = search.value.toLowerCase();
        return (records.data.value ?? [])
            .filter((item) => showInactive.value || item.status !== 'inactive')
            .filter((item) => options.searchKeys.map((field) => item[field] ?? '').join(' ').toLowerCase().includes(term))
            .map((item) => {
                const row = { id: item.id };
                for (const column of allColumns.value) {
                    row[column.key] = column.key === 'updatedAt' ? formatDate(item.updatedAt) : item[column.key] ?? '-';
                }
                return row;
            });
    });

    function resetForm() {
        localError.value = '';
        editingId.value = '';
        Object.assign(form, cloneForm(options.emptyForm));
    }

    function setField(field, event) {
        form[field] = event.target.value;
    }

    function setNumberField(field, event) {
        form[field] = event.target.value === '' ? 0 : Number(event.target.value);
    }

    function openCreateModal() {
        resetForm();
        modalOpen.value = true;
    }

    function closeModal() {
        modalOpen.value = false;
        resetForm();
    }

    function editRecord(row) {
        const source = records.data.value?.find((item) => item.id === row.id);
        if (!source)
            return;
        resetForm();
        editingId.value = source.id;
        for (const field of Object.keys(options.emptyForm)) {
            form[field] = source[field] ?? options.emptyForm[field];
        }
        modalOpen.value = true;
    }

    function validate() {
        for (const rule of options.requiredFields) {
            if (rule.createOnly && editingId.value)
                continue;
            if (cleanText(form[rule.key]) === '') {
                localError.value = `${rule.label} wajib diisi.`;
                return false;
            }
        }
        if (options.validate && !options.validate(form, editingId.value, localError))
            return false;
        return true;
    }

    async function saveRecord() {
        localError.value = '';
        if (!validate())
            return;
        const payload = options.toPayload ? options.toPayload(form, editingId.value) : { ...form };
        if (editingId.value)
            await updateRecord.mutateAsync({ id: editingId.value, payload });
        else
            await createRecord.mutateAsync(payload);
        await records.refetch();
        closeModal();
    }

    async function deleteRecord(row) {
        localError.value = '';
        const id = cleanText(row.id);
        if (!id) {
            localError.value = 'Data ini tidak memiliki ID valid dan tidak bisa dihapus.';
            return;
        }
        if (options.crudKey === 'user' && id === auth.state.user?.id) {
            window.alert('User yang sedang login tidak bisa dihapus dari sesi aktif ini.');
            return;
        }
        const label = cleanText(row.fullName) || cleanText(row.name) || cleanText(row.code) || id;
        if (!window.confirm(`Hapus ${label}?`))
            return;
        await removeRecord.mutateAsync(id);
        await records.refetch();
    }

    return {
        allColumns,
        canCreate,
        canDelete,
        canUpdate,
        canWrite,
        closeModal,
        deleteRecord,
        editRecord,
        form,
        formError,
        isEditing,
        isSubmitting,
        modalOpen,
        modalTitle,
        openCreateModal,
        records,
        rows,
        saveRecord,
        search,
        setField,
        setNumberField,
        showInactive,
        submitLabel,
    };
}
