<script setup>
import { computed } from 'vue';
import { statusLabel } from '@/lib/format';
const props = defineProps({
    status: { type: String, required: true },
});
const classes = computed(() => {
    const palette = {
        active: 'bg-emerald-500/15 text-emerald-300',
        inactive: 'bg-slate-500/15 text-slate-300',
        new: 'bg-sky-500/15 text-sky-300',
        pending: 'bg-amber-500/15 text-amber-300',
        progress: 'bg-blue-500/15 text-blue-300',
        ready_to_print: 'bg-violet-500/15 text-violet-300',
        validated: 'bg-cyan-500/15 text-cyan-300',
        warehouse_validated: 'bg-cyan-500/15 text-cyan-300',
        solved: 'bg-emerald-500/15 text-emerald-300',
        cancelled: 'bg-rose-500/15 text-rose-300',
    };
    return palette[props.status] ?? palette.inactive;
});
</script>

<template>
  <span class="inline-flex rounded-md px-2 py-1 text-xs font-semibold" :class="classes">
    {{ statusLabel(status) }}
  </span>
</template>
