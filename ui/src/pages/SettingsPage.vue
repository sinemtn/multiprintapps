<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import { api } from '@/services/api';

const loading = ref(true);
const savingSettings = ref(false);
const savingPermissions = ref(false);
const error = ref('');
const settingsMessage = ref('');
const permissionMessage = ref('');
const settings = reactive({ complaintPendingAfterHours: 24 });
const permissionMeta = reactive({ roles: [], modules: [], actions: [] });
const permissionState = reactive({});
const selectedRole = ref('');
const selectedModule = ref('');

const moduleLabels = {
    dashboard: 'Dashboard',
    complaint: 'Komplain',
    assignment: 'Surat Tugas',
    'assignment-item': 'Item Surat Tugas',
    'stock-printer': 'Stok Printer',
    'stock-toner': 'Stok Toner',
    'stock-sparepart': 'Stok Sparepart',
    'master-printer': 'Master Printer',
    'master-toner': 'Master Toner',
    'master-sparepart': 'Master Sparepart',
    'master-supplier': 'Master Supplier',
    'master-customer': 'Master Customer',
    'master-user': 'Master User',
    'audit-trail': 'Audit Trail',
    settings: 'Pengaturan',
};

const actionLabels = {
    view: 'Lihat',
    create: 'Buat',
    update: 'Update',
    delete: 'Hapus',
    resolve: 'Resolve',
    workflow: 'Workflow',
};

const roleLabels = {
    admin: 'Admin',
    sales: 'Sales',
    'sales-admin': 'Sales Admin',
    'kepala-teknisi': 'Kepala Teknisi',
    teknisi: 'Teknisi',
    warehouse: 'Warehouse',
};

const roleOptions = computed(() => permissionMeta.roles.map((role) => ({
    value: role,
    label: roleLabels[role] ?? role,
})));

const moduleOptions = computed(() => [
    { value: '', label: 'Semua Modul' },
    ...permissionMeta.modules.map((module) => ({
        value: module,
        label: moduleLabels[module] ?? module,
    })),
]);

const visiblePermissionRows = computed(() => {
    if (!selectedRole.value)
        return [];
    return permissionMeta.modules
        .filter((module) => !selectedModule.value || module === selectedModule.value)
        .map((module) => ({ role: selectedRole.value, module }));
});

const selectedRoleLabel = computed(() => roleLabels[selectedRole.value] ?? selectedRole.value);

const enabledModules = computed(() => permissionMeta.modules
    .map((module) => {
        const actions = permissionMeta.actions.filter((action) => permissionState[key(selectedRole.value, module, action)]);
        return {
            module,
            label: moduleLabels[module] ?? module,
            actions,
        };
    })
    .filter((module) => module.actions.length > 0));

const accessSummary = computed(() => {
    if (!selectedRole.value)
        return 'Pilih role untuk melihat ringkasan akses.';
    if (selectedRole.value === 'admin')
        return 'Admin selalu memiliki akses penuh ke semua modul dan aksi.';
    if (enabledModules.value.length === 0)
        return 'Role ini belum memiliki akses modul.';
    return `${selectedRoleLabel.value} dapat mengakses ${enabledModules.value.length} modul.`;
});

function key(role, module, action) {
    return `${role}:${module}:${action}`;
}

function setPermissionRows(rows) {
    for (const role of permissionMeta.roles) {
        for (const module of permissionMeta.modules) {
            for (const action of permissionMeta.actions) {
                permissionState[key(role, module, action)] = role === 'admin';
            }
        }
    }
    for (const row of rows) {
        permissionState[key(row.role, row.module, row.action)] = Boolean(row.allowed);
    }
}

async function loadSettings() {
    loading.value = true;
    error.value = '';
    try {
        const [settingsResult, permissionsResult] = await Promise.all([
            api.settings.get(),
            api.permissions.get(),
        ]);
        settings.complaintPendingAfterHours = settingsResult.complaintPendingAfterHours ?? 24;
        permissionMeta.roles = permissionsResult.roles ?? [];
        permissionMeta.modules = permissionsResult.modules ?? [];
        permissionMeta.actions = permissionsResult.actions ?? [];
        setPermissionRows(permissionsResult.permissions ?? []);
        selectedRole.value = permissionMeta.roles.includes(selectedRole.value)
            ? selectedRole.value
            : permissionMeta.roles[0] ?? '';
    }
    catch (err) {
        error.value = err instanceof Error ? err.message : 'Pengaturan gagal dimuat';
    }
    finally {
        loading.value = false;
    }
}

async function saveSettings() {
    settingsMessage.value = '';
    error.value = '';
    savingSettings.value = true;
    try {
        const updated = await api.settings.update({
            complaintPendingAfterHours: Number(settings.complaintPendingAfterHours),
        });
        settings.complaintPendingAfterHours = updated.complaintPendingAfterHours;
        settingsMessage.value = 'Pengaturan SLA tersimpan.';
    }
    catch (err) {
        error.value = err instanceof Error ? err.message : 'Pengaturan gagal disimpan';
    }
    finally {
        savingSettings.value = false;
    }
}

async function savePermissions() {
    permissionMessage.value = '';
    error.value = '';
    savingPermissions.value = true;
    try {
        const role = selectedRole.value;
        const rows = [];
        for (const module of permissionMeta.modules) {
            for (const action of permissionMeta.actions) {
                rows.push({
                    role,
                    module,
                    action,
                    allowed: role === 'admin' ? true : Boolean(permissionState[key(role, module, action)]),
                });
            }
        }
        const updated = await api.permissions.update(rows);
        setPermissionRows(updated.permissions ?? []);
        permissionMessage.value = `Permission ${selectedRoleLabel.value} tersimpan.`;
    }
    catch (err) {
        error.value = err instanceof Error ? err.message : 'Permission gagal disimpan';
    }
    finally {
        savingPermissions.value = false;
    }
}

onMounted(loadSettings);
</script>

<template>
  <PageHeader title="Pengaturan" subtitle="Atur SLA komplain dan hak akses role." />

  <div v-if="loading" class="rounded-lg border border-line bg-ink-950 p-5 text-sm font-semibold text-muted">
    Memuat pengaturan...
  </div>
  <p v-else-if="error" class="rounded-md border border-rose-400/30 bg-rose-500/10 p-4 text-sm font-semibold text-rose-200">
    {{ error }}
  </p>

  <div v-else class="space-y-6">
    <section class="rounded-lg border border-line bg-ink-950 p-5">
      <div class="mb-4">
        <h2 class="text-lg font-bold text-white">SLA Pending Komplain</h2>
        <p class="mt-1 text-sm text-muted">Komplain dengan status New otomatis menjadi Pending setelah batas jam ini.</p>
      </div>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label class="block">
          <span class="mb-2 block text-sm font-semibold text-white">Pending setelah</span>
          <input v-model.number="settings.complaintPendingAfterHours" class="field-control w-52" type="number" min="1" />
        </label>
        <button type="button" class="btn-primary" :disabled="savingSettings" @click="saveSettings">
          Simpan SLA
        </button>
      </div>
      <p v-if="settingsMessage" class="mt-3 text-sm font-semibold text-emerald-200">{{ settingsMessage }}</p>
    </section>

    <section class="rounded-lg border border-line bg-ink-950 p-5">
      <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 class="text-lg font-bold text-white">Permission Role</h2>
          <p class="mt-1 text-sm text-muted">Pilih satu role, lalu atur modul dan aksi yang diizinkan.</p>
        </div>
        <button type="button" class="btn-primary" :disabled="savingPermissions" @click="savePermissions">
          Simpan Permission
        </button>
      </div>
      <p v-if="permissionMessage" class="mb-3 text-sm font-semibold text-emerald-200">{{ permissionMessage }}</p>

      <div class="mb-4 grid gap-3 lg:grid-cols-[240px_260px_1fr]">
        <label class="block">
          <span class="mb-2 block text-sm font-semibold text-white">Pilih Role</span>
          <select v-model="selectedRole" class="field-control">
            <option v-for="role in roleOptions" :key="role.value" :value="role.value">{{ role.label }}</option>
          </select>
        </label>
        <label class="block">
          <span class="mb-2 block text-sm font-semibold text-white">Filter Modul</span>
          <select v-model="selectedModule" class="field-control">
            <option v-for="module in moduleOptions" :key="module.value" :value="module.value">{{ module.label }}</option>
          </select>
        </label>
        <div class="rounded-md border border-line bg-ink-900 p-4">
          <div class="text-xs font-bold uppercase text-muted">Ringkasan Akses</div>
          <p class="mt-1 text-sm font-semibold text-white">{{ accessSummary }}</p>
          <p v-if="selectedRole !== 'admin' && enabledModules.length" class="mt-2 line-clamp-2 text-xs text-muted">
            {{ enabledModules.map((module) => module.label).join(', ') }}
          </p>
        </div>
      </div>

      <div class="overflow-auto rounded-md border border-line">
        <table class="min-w-[900px] w-full text-left text-sm">
          <thead class="bg-ink-850 text-muted">
            <tr>
              <th class="px-3 py-3">Modul</th>
              <th v-for="action in permissionMeta.actions" :key="action" class="px-3 py-3 text-center">
                {{ actionLabels[action] ?? action }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in visiblePermissionRows" :key="`${row.role}-${row.module}`" class="border-t border-line">
              <td class="px-3 py-2 text-slate-100">{{ moduleLabels[row.module] ?? row.module }}</td>
              <td v-for="action in permissionMeta.actions" :key="`${row.role}-${row.module}-${action}`" class="px-3 py-2 text-center">
                <input
                  :checked="permissionState[key(row.role, row.module, action)]"
                  type="checkbox"
                  class="h-4 w-4 accent-slate-200"
                  :disabled="row.role === 'admin'"
                  @change="permissionState[key(row.role, row.module, action)] = $event.target.checked"
                />
              </td>
            </tr>
            <tr v-if="visiblePermissionRows.length === 0">
              <td :colspan="permissionMeta.actions.length + 1" class="px-3 py-8 text-center text-muted">
                Tidak ada modul untuk filter ini.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
