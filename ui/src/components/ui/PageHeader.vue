<script setup>
defineProps({
    title: { type: String, required: true },
    subtitle: { type: String, default: '' },
});
</script>

<template>
  <div class="mb-6 flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-start sm:justify-between">
    <div>
      <h1 class="text-2xl font-bold tracking-normal text-white sm:text-3xl">{{ title }}</h1>
      <p v-if="subtitle" class="mt-1 text-sm text-muted sm:text-base">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="flex shrink-0 flex-wrap gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
