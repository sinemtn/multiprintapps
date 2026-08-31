<script setup>
import { X } from 'lucide-vue-next';
defineProps({
    open: { type: Boolean, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    submitLabel: { type: String, default: 'Simpan' },
    submitting: { type: Boolean, default: false },
});
defineEmits(['close', 'submit']);
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button
          type="button"
          class="absolute inset-0 z-0 cursor-default bg-black/60 backdrop-blur-sm"
          aria-label="Tutup dialog"
          @click="$emit('close')"
        />

        <section
          class="relative z-10 w-full max-w-xl rounded-lg border border-line bg-ink-950 p-5 shadow-panel sm:p-6"
          @click.stop
          @mousedown.stop
        >
          <div class="mb-5 flex items-start justify-between gap-4 border-b border-line pb-4">
            <div>
              <h2 class="text-xl font-bold text-white">{{ title }}</h2>
              <p v-if="description" class="mt-1 text-sm text-muted">{{ description }}</p>
            </div>
            <button type="button" class="btn-secondary h-9 w-9 shrink-0 px-0" @click="$emit('close')">
              <X class="h-4 w-4" />
            </button>
          </div>

          <form class="space-y-5" @submit.stop.prevent="$emit('submit')">
            <slot />

            <div class="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <button type="button" class="btn-secondary" @click="$emit('close')">Batal</button>
              <button type="submit" class="btn-primary" :disabled="submitting">
                {{ submitLabel ?? 'Simpan' }}
              </button>
            </div>
          </form>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
