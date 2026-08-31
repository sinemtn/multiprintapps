<script setup>
import { computed, ref, watchEffect } from 'vue';
import { FlexRender, createColumnHelper, getCoreRowModel, getPaginationRowModel, getSortedRowModel, useVueTable, } from '@tanstack/vue-table';
import { ArrowDownUp, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-vue-next';
import ActionMenu from './ActionMenu.vue';
const props = defineProps({
    rows: { type: Array, required: true },
    columns: { type: Array, required: true },
    emptyText: { type: String, default: 'Tidak ada hasil.' },
    enableActions: { type: Boolean, default: true },
    enablePreviewAction: { type: Boolean, default: false },
    canEdit: { type: Boolean, default: true },
    canDelete: { type: Boolean, default: true },
});
const emit = defineEmits(['rowClick', 'edit', 'delete', 'preview']);
const sorting = ref([]);
const columnHelper = createColumnHelper();
const tableColumns = computed(() => props.columns.map((column) => columnHelper.accessor(column.key, {
    header: column.label,
    cell: (info) => String(info.getValue() ?? ''),
})));
const table = useVueTable({
    get data() {
        return props.rows;
    },
    get columns() {
        return tableColumns.value;
    },
    state: {
        get sorting() {
            return sorting.value;
        },
    },
    onSortingChange: (updater) => {
        sorting.value = typeof updater === 'function' ? updater(sorting.value) : updater;
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
});
watchEffect(() => {
    table.setPageSize(10);
});
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-line bg-ink-950">
    <div class="overflow-x-auto">
      <table class="min-w-full text-left text-sm">
        <thead class="border-b border-line text-white">
          <tr v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
            <th
              v-for="header in headerGroup.headers"
              :key="header.id"
              class="whitespace-nowrap px-4 py-3 font-semibold"
            >
              <button
                v-if="!header.isPlaceholder"
                type="button"
                class="inline-flex items-center gap-2"
                @click="header.column.getToggleSortingHandler()?.($event)"
              >
                <FlexRender :render="header.column.columnDef.header" :props="header.getContext()" />
                <ArrowDownUp class="h-3.5 w-3.5 text-muted" />
              </button>
            </th>
            <th v-if="enableActions" class="w-36 px-4 py-3 text-right font-semibold">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line text-slate-100">
          <tr v-if="table.getRowModel().rows.length === 0">
            <td :colspan="columns.length + (enableActions ? 1 : 0)" class="px-4 py-12 text-center font-semibold text-white">
              {{ emptyText }}
            </td>
          </tr>
          <tr
            v-for="row in table.getRowModel().rows"
            :key="row.id"
            class="transition hover:bg-ink-850"
            @click="$emit('rowClick', row.original)"
          >
            <td v-for="cell in row.getVisibleCells()" :key="cell.id" class="whitespace-nowrap px-4 py-4">
              <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
            </td>
            <td v-if="enableActions" class="px-4 py-4">
              <ActionMenu
                :can-edit="canEdit"
                :can-delete="canDelete"
                :can-preview="enablePreviewAction"
                @preview="emit('preview', row.original)"
                @edit="emit('edit', row.original)"
                @delete="emit('delete', row.original)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="flex flex-col gap-3 border-t border-line px-4 py-3 text-sm font-semibold text-white sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-center gap-3">
        <select
          class="rounded-md border border-line bg-ink-850 px-3 py-2 text-sm"
          :value="table.getState().pagination.pageSize"
          @change="table.setPageSize(Number($event.target.value))"
        >
          <option :value="10">10</option>
          <option :value="20">20</option>
          <option :value="50">50</option>
        </select>
        <span>Baris per halaman</span>
      </div>
      <div class="flex items-center gap-2">
        <span>Halaman {{ table.getState().pagination.pageIndex + 1 }} dari {{ Math.max(table.getPageCount(), 1) }}</span>
        <button class="btn-secondary h-9 w-9 px-0" type="button" :disabled="!table.getCanPreviousPage()" @click="table.setPageIndex(0)">
          <ChevronsLeft class="h-4 w-4" />
        </button>
        <button class="btn-secondary h-9 w-9 px-0" type="button" :disabled="!table.getCanPreviousPage()" @click="table.previousPage()">
          <ChevronLeft class="h-4 w-4" />
        </button>
        <button class="btn-secondary h-9 w-9 px-0" type="button" :disabled="!table.getCanNextPage()" @click="table.nextPage()">
          <ChevronRight class="h-4 w-4" />
        </button>
        <button class="btn-secondary h-9 w-9 px-0" type="button" :disabled="!table.getCanNextPage()" @click="table.setPageIndex(table.getPageCount() - 1)">
          <ChevronsRight class="h-4 w-4" />
        </button>
      </div>
    </div>
  </div>
</template>
