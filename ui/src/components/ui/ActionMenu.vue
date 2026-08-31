<script setup>
import { Eye } from 'lucide-vue-next';
defineProps({
    canEdit: { type: Boolean, default: true },
    canDelete: { type: Boolean, default: true },
    canPreview: { type: Boolean, default: false },
});
defineEmits(['edit', 'delete', 'preview']);
</script>

<template>
  <div class="flex items-center justify-end gap-1">
    <button
      v-if="canPreview"
      type="button"
      class="rounded-md p-1.5 text-muted hover:bg-ink-700 hover:text-white"
      title="Preview PDF"
      aria-label="Preview PDF"
      @click.stop="$emit('preview')"
    >
      <Eye class="h-4 w-4" />
    </button>
    <button
      v-if="canEdit"
      type="button"
      class="rounded-md px-2 py-1 text-xs font-semibold text-muted hover:bg-ink-700 hover:text-white"
      @click.stop="$emit('edit')"
    >
      Edit
    </button>
    <button
      v-if="canDelete"
      type="button"
      class="rounded-md px-2 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/10"
      @click.stop="$emit('delete')"
    >
      Hapus
    </button>
  </div>
</template>
