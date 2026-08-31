<script setup>
import { computed, ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import { Box, Briefcase, ChevronDown, ChevronRight, ClipboardList, Database, History, LayoutDashboard, LogOut, Menu, Moon, Package, Printer, Search, Settings, User, Wrench, X, } from 'lucide-vue-next';
import { useAuth } from '@/composables/useAuth';
import { api } from '@/services/api';
import logoUrl from '@/assets/logo.png';
const route = useRoute();
const router = useRouter();
const auth = useAuth();
const mobileOpen = ref(false);
const stockOpen = ref(true);
const masterOpen = ref(true);
const customerOpen = ref(true);
const searchTerm = ref('');
const searchOpen = ref(false);
const searchLoading = ref(false);
const searchError = ref('');
const searchResults = ref([]);
let searchTimer = null;
const topItems = [
    { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, module: 'dashboard' },
    { label: 'Komplain', to: '/komplain', icon: ClipboardList, module: 'complaint' },
    { label: 'Surat Tugas', to: '/surat-tugas', icon: Briefcase, module: 'assignment' },
];
const stockGroup = {
    label: 'Data Stok',
    icon: Package,
    items: [
        { label: 'Printer', to: '/stock/printer', icon: Printer, module: 'stock-printer' },
        { label: 'Toner', to: '/stock/toner', icon: Wrench, module: 'stock-toner' },
        { label: 'Sparepart', to: '/stock/sparepart', icon: Box, module: 'stock-sparepart' },
    ],
};
const masterGroup = {
    label: 'Master Data',
    icon: Database,
    items: [
        { label: 'Printer', to: '/master/printer', icon: Printer, module: 'master-printer' },
        { label: 'Toner', to: '/master/toner', icon: Wrench, module: 'master-toner' },
        { label: 'Sparepart', to: '/master/sparepart', icon: Box, module: 'master-sparepart' },
        { label: 'Supplier', to: '/master/supplier', icon: Package, module: 'master-supplier' },
        { label: 'User', to: '/master/user', icon: User, module: 'master-user' },
    ],
};
const customerGroup = {
    label: 'Customer',
    icon: Briefcase,
    module: 'master-customer',
    items: [
        { label: 'Akun Customer', to: '/master/customer/accounts', icon: Briefcase, module: 'master-customer' },
        { label: 'Customer Tunggal', to: '/master/customer/singles', icon: User, module: 'master-customer' },
    ],
};
const title = computed(() => String(route.meta.title ?? 'Multiprint'));
const canViewItem = (item) => !item.module || auth.can(item.module, 'view');
const visibleTopItems = computed(() => topItems.filter(canViewItem));
const visibleStockItems = computed(() => stockGroup.items.filter(canViewItem));
const visibleMasterItems = computed(() => masterGroup.items.filter(canViewItem));
const visibleCustomerItems = computed(() => customerGroup.items.filter(canViewItem));
const canViewStock = computed(() => visibleStockItems.value.length > 0);
const canViewCustomer = computed(() => visibleCustomerItems.value.length > 0);
const canViewMaster = computed(() => visibleMasterItems.value.length > 0 || canViewCustomer.value);
const canViewSystem = computed(() => auth.can('settings', 'view') || auth.can('audit-trail', 'view'));
const breadcrumbs = computed(() => {
    if (route.path.startsWith('/stock')) return ['Data Stok', title.value];
    if (route.path.startsWith('/master')) return ['Master Data', title.value];
    if (route.path.startsWith('/komplain/') && route.path !== '/komplain') return ['Komplain', title.value];
    if (route.path.startsWith('/surat-tugas/') && route.path !== '/surat-tugas') return ['Surat Tugas', title.value];
    if (route.path === '/settings' || route.path === '/audit-trail') return ['Sistem', title.value];
    return [title.value];
});
function isRouteActive(path) {
    return route.path === path || (path !== '/dashboard' && route.path.startsWith(`${path}/`));
}
function isGroupActive(group) {
    const items = group.label === masterGroup.label
        ? [...visibleMasterItems.value, ...visibleCustomerItems.value]
        : group.label === customerGroup.label
            ? visibleCustomerItems.value
            : visibleStockItems.value;
    return items.some((item) => isRouteActive(item.to));
}
function resultRoute(result) {
    if (result.kind === 'complaint') return `/komplain/${encodeURIComponent(result.id)}`;
    if (result.kind === 'assignment') return `/surat-tugas/${encodeURIComponent(result.id)}`;
    return '';
}
function clearSearch() {
    searchTerm.value = '';
    searchResults.value = [];
    searchError.value = '';
    searchOpen.value = false;
}
async function runSearch() {
    const term = searchTerm.value.trim().toLowerCase();
    searchError.value = '';
    searchResults.value = [];
    if (term.length < 2) {
        searchLoading.value = false;
        return;
    }
    searchLoading.value = true;
    try {
        const [complaintsResult, assignmentsResult, customersResult] = await Promise.allSettled([
            api.complaints.list(),
            api.suratTugas.list(),
            api.customers.list(),
        ]);
        const complaints = complaintsResult.status === 'fulfilled' ? complaintsResult.value : [];
        const assignments = assignmentsResult.status === 'fulfilled' ? assignmentsResult.value : [];
        const customers = customersResult.status === 'fulfilled' ? customersResult.value : [];
        const customerName = (id) => customers.find((customer) => customer.id === id)?.name ?? id ?? '';
        const complaintResults = complaints
            .filter((item) => `${item.complaintNo} ${item.mpNo} ${item.description} ${customerName(item.customerId)} ${item.status}`.toLowerCase().includes(term))
            .slice(0, 5)
            .map((item) => ({
            id: item.id,
            kind: 'complaint',
            label: item.complaintNo,
            description: `${customerName(item.customerId)} - ${item.description}`,
        }));
        const assignmentResults = assignments
            .filter((item) => `${item.assignmentNo} ${item.complaintId} ${item.mpNo} ${item.type} ${customerName(item.customerId)} ${item.status}`.toLowerCase().includes(term))
            .slice(0, 5)
            .map((item) => ({
            id: item.id,
            kind: 'assignment',
            label: item.assignmentNo,
            description: `${customerName(item.customerId)} - ${item.type}`,
        }));
        searchResults.value = [...complaintResults, ...assignmentResults].slice(0, 8);
        searchOpen.value = true;
    }
    catch (error) {
        searchError.value = error instanceof Error ? error.message : 'Pencarian gagal dimuat';
    }
    finally {
        searchLoading.value = false;
    }
}
function scheduleSearch() {
    searchOpen.value = true;
    if (searchTimer)
        window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(runSearch, 250);
}
async function openSearchResult(result) {
    const to = resultRoute(result);
    if (!to)
        return;
    clearSearch();
    await router.push(to);
}
async function submitSearch() {
    if (!searchResults.value.length) {
        await runSearch();
    }
    if (searchResults.value[0]) {
        await openSearchResult(searchResults.value[0]);
    }
}
function closeMobile() {
    mobileOpen.value = false;
}
async function logout() {
    await auth.logout();
    await router.replace('/login');
}
watch(() => route.path, () => {
    if (isGroupActive(stockGroup))
        stockOpen.value = true;
    if (isGroupActive(masterGroup))
        masterOpen.value = true;
    if (isGroupActive(customerGroup))
        customerOpen.value = true;
    searchOpen.value = false;
}, { immediate: true });
</script>

<template>
  <div class="min-h-screen bg-ink-950 text-white">
    <aside
      class="fixed inset-y-0 left-0 z-40 w-64 border-r border-line bg-ink-950 transition-transform duration-200 lg:translate-x-0"
      :class="mobileOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="flex h-full flex-col">
        <div class="flex h-20 items-center justify-between px-6">
          <RouterLink to="/dashboard" class="block min-w-0" aria-label="Multiprint Dashboard" @click="closeMobile">
            <img :src="logoUrl" alt="Multiprint" class="h-auto w-44 max-w-full object-contain" />
          </RouterLink>
          <button type="button" class="btn-secondary h-9 w-9 px-0 lg:hidden" @click="mobileOpen = false">
            <X class="h-4 w-4" />
          </button>
        </div>

        <nav class="flex-1 space-y-7 overflow-y-auto px-4 pb-6">
          <div class="space-y-1">
            <RouterLink
              v-for="item in visibleTopItems"
              :key="item.to"
              :to="item.to"
              class="flex h-9 items-center gap-3 rounded-md px-3 text-sm font-semibold transition"
              :class="isRouteActive(item.to) ? 'bg-slate-700 text-white' : 'text-slate-100 hover:bg-ink-850'"
              @click="closeMobile"
            >
              <component :is="item.icon" class="h-4 w-4" />
              {{ item.label }}
            </RouterLink>
          </div>

          <div v-if="canViewStock">
            <p class="mb-2 px-3 text-xs font-semibold text-muted">Data Stok</p>
            <button
              type="button"
              class="flex h-9 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold hover:bg-ink-850"
              :class="isGroupActive(stockGroup) ? 'bg-ink-850 text-white' : 'text-slate-100'"
              @click="stockOpen = !stockOpen"
            >
              <component :is="stockGroup.icon" class="h-4 w-4" />
              <span class="flex-1 text-left">{{ stockGroup.label }}</span>
              <ChevronDown v-if="stockOpen" class="h-4 w-4" />
              <ChevronRight v-else class="h-4 w-4" />
            </button>
            <div v-if="stockOpen" class="ml-4 border-l border-line pl-3">
              <RouterLink
                v-for="item in visibleStockItems"
                :key="item.to"
                :to="item.to"
                class="mt-1 flex h-8 items-center gap-3 rounded-md px-3 text-sm font-semibold transition"
                :class="isRouteActive(item.to) ? 'bg-slate-700 text-white' : 'text-slate-100 hover:bg-ink-850'"
                @click="closeMobile"
              >
                <component :is="item.icon" class="h-4 w-4" />
                {{ item.label }}
              </RouterLink>
            </div>
          </div>

          <div v-if="canViewMaster">
            <button
              type="button"
              class="flex h-9 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold hover:bg-ink-850"
              :class="isGroupActive(masterGroup) ? 'bg-ink-850 text-white' : 'text-slate-100'"
              @click="masterOpen = !masterOpen"
            >
              <component :is="masterGroup.icon" class="h-4 w-4" />
              <span class="flex-1 text-left">{{ masterGroup.label }}</span>
              <ChevronDown v-if="masterOpen" class="h-4 w-4" />
              <ChevronRight v-else class="h-4 w-4" />
            </button>
            <div v-if="masterOpen" class="ml-4 border-l border-line pl-3">
              <RouterLink
                v-for="item in visibleMasterItems"
                :key="item.to"
                :to="item.to"
                class="mt-1 flex h-8 items-center gap-3 rounded-md px-3 text-sm font-semibold transition"
                :class="isRouteActive(item.to) ? 'bg-slate-700 text-white' : 'text-slate-100 hover:bg-ink-850'"
                @click="closeMobile"
              >
                <component :is="item.icon" class="h-4 w-4" />
                {{ item.label }}
              </RouterLink>
              <div v-if="canViewCustomer" class="mt-1">
                <button
                  type="button"
                  class="flex h-8 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold hover:bg-ink-850"
                  :class="isGroupActive(customerGroup) ? 'bg-ink-850 text-white' : 'text-slate-100'"
                  @click="customerOpen = !customerOpen"
                >
                  <component :is="customerGroup.icon" class="h-4 w-4" />
                  <span class="flex-1 text-left">{{ customerGroup.label }}</span>
                  <ChevronDown v-if="customerOpen" class="h-4 w-4" />
                  <ChevronRight v-else class="h-4 w-4" />
                </button>
                <div v-if="customerOpen" class="ml-4 border-l border-line pl-3">
                  <RouterLink
                    v-for="item in visibleCustomerItems"
                    :key="item.to"
                    :to="item.to"
                    class="mt-1 flex h-8 items-center gap-3 rounded-md px-3 text-sm font-semibold transition"
                    :class="isRouteActive(item.to) ? 'bg-slate-700 text-white' : 'text-slate-100 hover:bg-ink-850'"
                    @click="closeMobile"
                  >
                    <component :is="item.icon" class="h-4 w-4" />
                    {{ item.label }}
                  </RouterLink>
                </div>
              </div>
            </div>
          </div>

          <div v-if="canViewSystem">
            <p class="mb-2 px-3 text-xs font-semibold text-muted">Sistem</p>
            <RouterLink
              v-if="auth.can('audit-trail', 'view')"
              to="/audit-trail"
              class="flex h-9 items-center gap-3 rounded-md px-3 text-sm font-semibold transition"
              :class="route.path === '/audit-trail' ? 'bg-slate-700 text-white' : 'text-slate-100 hover:bg-ink-850'"
              @click="closeMobile"
            >
              <History class="h-4 w-4" />
              Audit Trail
            </RouterLink>
            <RouterLink
              v-if="auth.can('settings', 'view')"
              to="/settings"
              class="flex h-9 items-center gap-3 rounded-md px-3 text-sm font-semibold transition"
              :class="route.path === '/settings' ? 'bg-slate-700 text-white' : 'text-slate-100 hover:bg-ink-850'"
              @click="closeMobile"
            >
              <Settings class="h-4 w-4" />
              Pengaturan
            </RouterLink>
          </div>
        </nav>
      </div>
    </aside>

    <div v-if="mobileOpen" class="fixed inset-0 z-30 bg-black/60 lg:hidden" @click="mobileOpen = false" />

    <div class="lg:pl-64">
      <header class="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-line bg-ink-950/95 px-4 backdrop-blur sm:px-8">
        <div class="flex min-w-0 items-center gap-4">
          <button type="button" class="btn-secondary h-9 w-9 px-0 lg:hidden" @click="mobileOpen = true">
            <Menu class="h-4 w-4" />
          </button>
          <div class="hidden h-8 w-px bg-line sm:block" />
          <div class="relative hidden md:block">
            <form
              class="flex h-10 w-80 items-center gap-2 rounded-md border border-line bg-ink-850 px-3 text-muted"
              @submit.prevent="submitSearch"
            >
              <Search class="h-4 w-4 shrink-0" />
              <input
                v-model="searchTerm"
                class="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-muted"
                placeholder="Cari komplain / surat tugas"
                @focus="searchOpen = true"
                @input="scheduleSearch"
              />
              <button v-if="searchTerm" type="button" class="rounded p-1 hover:bg-ink-700" @click="clearSearch">
                <X class="h-3.5 w-3.5" />
              </button>
            </form>
            <div
              v-if="searchOpen && searchTerm.trim().length >= 2"
              class="absolute left-0 top-12 z-50 w-96 overflow-hidden rounded-lg border border-line bg-ink-950 shadow-panel"
            >
              <div v-if="searchLoading" class="px-4 py-3 text-sm font-semibold text-muted">Mencari data...</div>
              <div v-else-if="searchError" class="px-4 py-3 text-sm font-semibold text-rose-200">{{ searchError }}</div>
              <div v-else-if="searchResults.length === 0" class="px-4 py-3 text-sm font-semibold text-muted">Data tidak ditemukan.</div>
              <template v-else>
                <button
                  v-for="result in searchResults"
                  :key="`${result.kind}-${result.id}`"
                  type="button"
                  class="block w-full border-b border-line px-4 py-3 text-left last:border-b-0 hover:bg-ink-850"
                  @mousedown.prevent="openSearchResult(result)"
                >
                  <div class="flex items-center justify-between gap-3">
                    <span class="text-sm font-bold text-white">{{ result.label }}</span>
                    <span class="rounded bg-slate-700 px-2 py-0.5 text-[11px] font-semibold capitalize text-slate-100">{{ result.kind }}</span>
                  </div>
                  <p class="mt-1 truncate text-xs text-muted">{{ result.description }}</p>
                </button>
              </template>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <button type="button" class="rounded-md p-2 text-slate-100 hover:bg-ink-850">
            <Moon class="h-4 w-4" />
          </button>
          <RouterLink v-if="auth.can('settings', 'view')" to="/settings" class="hidden rounded-md p-2 text-slate-100 hover:bg-ink-850 sm:block">
            <Settings class="h-4 w-4" />
          </RouterLink>
          <div class="hidden text-right sm:block">
            <p class="text-sm font-semibold text-white">{{ auth.state.user?.name }}</p>
            <p class="text-xs capitalize text-muted">{{ auth.state.user?.role }}</p>
          </div>
          <div class="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-sm font-bold">
            {{ auth.state.user?.name?.slice(0, 2).toUpperCase() }}
          </div>
          <button type="button" class="rounded-md p-2 text-slate-100 hover:bg-ink-850" title="Logout" @click="logout">
            <LogOut class="h-4 w-4" />
          </button>
        </div>
      </header>

      <main class="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 lg:py-10">
        <nav class="mb-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
          <template v-for="(item, index) in breadcrumbs" :key="`${item}-${index}`">
            <ChevronRight v-if="index > 0" class="h-3.5 w-3.5 text-slate-600" />
            <span :class="index === breadcrumbs.length - 1 ? 'text-slate-100' : ''">{{ item }}</span>
          </template>
        </nav>
        <RouterView />
      </main>
    </div>
  </div>
</template>
