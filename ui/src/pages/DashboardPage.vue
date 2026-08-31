<script setup>
import { computed, ref } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { Bar, Doughnut, Line } from 'vue-chartjs';
import {
    ArcElement,
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    Title,
    Tooltip,
} from 'chart.js';
import { ClipboardList, Printer, ShieldCheck, Wrench } from 'lucide-vue-next';
import MetricCard from '@/components/ui/MetricCard.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import { statusLabel } from '@/lib/format';
import { api } from '@/services/api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend);

function toDateInput(date) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
}

const today = new Date();
const thirtyDaysAgo = new Date(today);
thirtyDaysAgo.setDate(today.getDate() - 29);

const draftFrom = ref(toDateInput(thirtyDaysAgo));
const draftTo = ref(toDateInput(today));
const appliedFrom = ref(draftFrom.value);
const appliedTo = ref(draftTo.value);

const dashboardQuery = useQuery({
    queryKey: computed(() => ['dashboard', appliedFrom.value, appliedTo.value]),
    queryFn: () => api.dashboard.get({ from: appliedFrom.value, to: appliedTo.value }),
});
const data = dashboardQuery.data;

const statusColors = {
    pending: '#94a3b8',
    new: '#38bdf8',
    progress: '#f59e0b',
    ready_to_print: '#8b5cf6',
    technician_completed: '#14b8a6',
    validated: '#06b6d4',
    warehouse_validated: '#06b6d4',
    solved: '#22c55e',
    cancelled: '#ef4444',
};

const cards = computed(() => [
    { title: 'Komplain Terbuka', value: data.value?.summary.pendingComplaints + data.value?.summary.progressComplaints || 0, icon: ClipboardList },
    { title: 'Surat Tugas Terbuka', value: data.value?.summary.openAssignments ?? 0, icon: Wrench },
    { title: 'Siap Print', value: data.value?.summary.readyToPrint ?? 0, icon: Printer },
    { title: 'Antrian Warehouse', value: data.value?.summary.warehouseQueue ?? 0, icon: ShieldCheck },
]);

const trendData = computed(() => ({
    labels: data.value?.complaintTrend.map((item) => item.period ?? item.month) ?? [],
    datasets: [
        {
            label: 'Komplain',
            data: data.value?.complaintTrend.map((item) => item.total) ?? [],
            borderColor: '#38bdf8',
            backgroundColor: '#38bdf8',
            tension: 0.3,
        },
        {
            label: 'Surat Tugas',
            data: data.value?.assignmentTrend.map((item) => item.total) ?? [],
            borderColor: '#f59e0b',
            backgroundColor: '#f59e0b',
            tension: 0.3,
        },
    ],
}));

const complaintStatusData = computed(() => ({
    labels: data.value?.complaintStatus.map((item) => statusLabel(item.status)) ?? [],
    datasets: [{
        data: data.value?.complaintStatus.map((item) => item.count) ?? [],
        backgroundColor: data.value?.complaintStatus.map((item) => statusColors[item.status] ?? '#38bdf8') ?? [],
        borderWidth: 0,
    }],
}));

const assignmentStatusData = computed(() => ({
    labels: data.value?.assignmentStatus.map((item) => statusLabel(item.status)) ?? [],
    datasets: [{
        data: data.value?.assignmentStatus.map((item) => item.count) ?? [],
        backgroundColor: data.value?.assignmentStatus.map((item) => statusColors[item.status] ?? '#38bdf8') ?? [],
        borderWidth: 0,
    }],
}));

const workloadData = computed(() => ({
    labels: data.value?.technicianWorkload.map((item) => item.name) ?? [],
    datasets: [
        { label: 'Aktif', data: data.value?.technicianWorkload.map((item) => item.active) ?? [], backgroundColor: '#f59e0b' },
        { label: 'Solved', data: data.value?.technicianWorkload.map((item) => item.solved) ?? [], backgroundColor: '#22c55e' },
    ],
}));

const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#cbd5e1' } } },
    scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
        y: { beginAtZero: true, ticks: { color: '#94a3b8', precision: 0 }, grid: { color: '#1e293b' } },
    },
};
const doughnutOptions = { responsive: true, maintainAspectRatio: false, plugins: baseOptions.plugins };

function applyRange() {
    appliedFrom.value = draftFrom.value;
    appliedTo.value = draftTo.value;
}

function formatDate(value) {
    if (!value) return '-';
    return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(value));
}
</script>

<template>
  <PageHeader title="Dashboard" subtitle="KPI operasional untuk komplain, surat tugas, warehouse, dan stok.">
    <template #actions>
      <form class="flex flex-col gap-2 sm:flex-row sm:items-center" @submit.prevent="applyRange">
        <input v-model="draftFrom" type="date" class="field-control h-10 sm:w-40" aria-label="Tanggal mulai" />
        <input v-model="draftTo" type="date" class="field-control h-10 sm:w-40" aria-label="Tanggal akhir" />
        <button type="submit" class="btn-primary h-10">Apply</button>
      </form>
    </template>
  </PageHeader>

  <div v-if="dashboardQuery.isPending.value" class="py-16 text-center text-sm font-semibold text-muted">Memuat dashboard...</div>
  <div v-else-if="dashboardQuery.isError.value" class="rounded-md border border-red-400/30 bg-red-500/10 p-4 text-sm font-semibold text-red-200">
    {{ dashboardQuery.error.value instanceof Error ? dashboardQuery.error.value.message : 'Dashboard gagal dimuat' }}
  </div>

  <template v-else>
    <div class="mb-4 rounded-lg border border-line bg-ink-950 px-4 py-3 text-sm font-semibold text-muted">
      Periode: <span class="text-white">{{ appliedFrom }}</span> sampai <span class="text-white">{{ appliedTo }}</span>
      <span class="ml-2 text-slate-500">({{ data?.period.mode === 'weekly' ? 'tren mingguan' : 'tren harian' }})</span>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard v-for="card in cards" :key="card.title" :title="card.title" :value="String(card.value)" :icon="card.icon" />
    </div>

    <div class="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr_1fr]">
      <section class="rounded-lg border border-line bg-ink-950 p-5">
        <h2 class="text-base font-bold text-white">Tren Komplain vs Surat Tugas</h2>
        <div class="mt-4 h-72"><Line :data="trendData" :options="baseOptions" /></div>
      </section>
      <section class="rounded-lg border border-line bg-ink-950 p-5">
        <h2 class="text-base font-bold text-white">Status Komplain</h2>
        <div v-if="complaintStatusData.labels.length" class="mt-4 h-72"><Doughnut :data="complaintStatusData" :options="doughnutOptions" /></div>
        <p v-else class="py-24 text-center text-sm text-muted">Belum ada data pada rentang tanggal ini.</p>
      </section>
      <section class="rounded-lg border border-line bg-ink-950 p-5">
        <h2 class="text-base font-bold text-white">Status Surat Tugas</h2>
        <div v-if="assignmentStatusData.labels.length" class="mt-4 h-72"><Doughnut :data="assignmentStatusData" :options="doughnutOptions" /></div>
        <p v-else class="py-24 text-center text-sm text-muted">Belum ada data pada rentang tanggal ini.</p>
      </section>
    </div>

    <div class="mt-6 grid gap-6 xl:grid-cols-2">
      <section class="rounded-lg border border-line bg-ink-950 p-5">
        <h2 class="text-base font-bold text-white">Beban Kerja Teknisi</h2>
        <div v-if="workloadData.labels.length" class="mt-4 h-72"><Bar :data="workloadData" :options="{ ...baseOptions, indexAxis: 'y' }" /></div>
        <p v-else class="py-24 text-center text-sm text-muted">Belum ada beban kerja teknisi pada rentang tanggal ini.</p>
      </section>
      <section class="overflow-hidden rounded-lg border border-line bg-ink-950">
        <div class="border-b border-line px-5 py-4"><h2 class="text-base font-bold text-white">Perlu Ditindaklanjuti</h2></div>
        <div class="overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead class="border-b border-line text-muted">
              <tr><th class="px-5 py-3">ID</th><th class="px-5 py-3">Aksi</th><th class="px-5 py-3">Deskripsi</th><th class="px-5 py-3">Status</th><th class="px-5 py-3">Waktu</th></tr>
            </thead>
            <tbody class="divide-y divide-line text-slate-100">
              <tr v-for="item in data?.pendingActions.items" :key="`${item.kind}-${item.id}-${item.action}`">
                <td class="whitespace-nowrap px-5 py-3 font-semibold">{{ item.id }}</td>
                <td class="whitespace-nowrap px-5 py-3">{{ item.action }}</td>
                <td class="max-w-xs truncate px-5 py-3">{{ item.description }}</td>
                <td class="whitespace-nowrap px-5 py-3">{{ statusLabel(item.status) }}</td>
                <td class="whitespace-nowrap px-5 py-3 text-muted">{{ formatDate(item.createdAt) }}</td>
              </tr>
              <tr v-if="!data?.pendingActions.items.length"><td colspan="5" class="px-5 py-12 text-center text-muted">Belum ada data pada rentang tanggal ini.</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <div class="mt-6 grid gap-6 xl:grid-cols-4">
      <section class="overflow-hidden rounded-lg border border-line bg-ink-950">
        <div class="border-b border-line px-5 py-4"><h2 class="text-base font-bold text-white">Antrian Warehouse</h2></div>
        <div class="divide-y divide-line">
          <div v-for="item in data?.warehouseQueue" :key="item.id" class="px-5 py-4">
            <div class="flex items-center justify-between gap-3">
              <p class="font-bold text-white">{{ item.id }}</p>
              <span class="text-xs font-semibold text-cyan-300">{{ item.itemCount }} item</span>
            </div>
            <p class="mt-1 text-sm text-muted">{{ item.customer }} - {{ item.pic }}</p>
          </div>
          <p v-if="!data?.warehouseQueue.length" class="px-5 py-12 text-center text-sm text-muted">Tidak ada antrian warehouse.</p>
        </div>
      </section>
      <section class="overflow-hidden rounded-lg border border-line bg-ink-950">
        <div class="border-b border-line px-5 py-4"><h2 class="text-base font-bold text-white">Komplain Siap Resolve</h2></div>
        <div class="divide-y divide-line">
          <div v-for="item in data?.complaintReadyResolve" :key="item.id" class="px-5 py-4">
            <p class="font-bold text-white">{{ item.id }} - {{ item.mpNo }}</p>
            <p class="mt-1 truncate text-sm text-muted">{{ item.description }}</p>
          </div>
          <p v-if="!data?.complaintReadyResolve.length" class="px-5 py-12 text-center text-sm text-muted">Tidak ada komplain yang siap di-resolve.</p>
        </div>
      </section>

      <section class="overflow-hidden rounded-lg border border-line bg-ink-950">
        <div class="border-b border-line px-5 py-4"><h2 class="text-base font-bold text-white">Stok Menipis</h2></div>
        <div class="divide-y divide-line">
          <div v-for="item in data?.lowStockItems" :key="`${item.category}-${item.id}`" class="px-5 py-4">
            <div class="flex items-center justify-between gap-3">
              <p class="font-bold text-white">{{ item.id }}</p>
              <span class="text-xs font-semibold text-amber-300">Qty {{ item.quantity }}</span>
            </div>
            <p class="mt-1 truncate text-sm text-muted">{{ item.name }} - {{ item.category }}</p>
          </div>
          <p v-if="!data?.lowStockItems?.length" class="px-5 py-12 text-center text-sm text-muted">Tidak ada stok menipis.</p>
        </div>
      </section>

      <section class="overflow-hidden rounded-lg border border-line bg-ink-950">
        <div class="border-b border-line px-5 py-4"><h2 class="text-base font-bold text-white">Aktivitas Terbaru</h2></div>
        <div class="overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead class="border-b border-line text-muted"><tr><th class="px-5 py-3">ID</th><th class="px-5 py-3">Tipe</th><th class="px-5 py-3">Status</th><th class="px-5 py-3">Waktu</th></tr></thead>
            <tbody class="divide-y divide-line text-slate-100">
              <tr v-for="item in data?.recentActivities" :key="`${item.kind}-${item.id}`">
                <td class="whitespace-nowrap px-5 py-3 font-semibold">{{ item.id }}</td>
                <td class="px-5 py-3 capitalize">{{ item.kind }}</td>
                <td class="px-5 py-3">{{ statusLabel(item.status) }}</td>
                <td class="whitespace-nowrap px-5 py-3 text-muted">{{ formatDate(item.createdAt) }}</td>
              </tr>
              <tr v-if="!data?.recentActivities.length"><td colspan="4" class="px-5 py-12 text-center text-muted">Belum ada aktivitas.</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </template>
</template>
