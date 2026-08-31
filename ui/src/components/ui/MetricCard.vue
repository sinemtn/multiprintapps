<script setup>
defineProps({
    title: { type: String, required: true },
    value: { type: [String, Number], required: true },
    icon: { type: [Object, Function], required: true },
});
</script>

<template>
  <section class="rounded-lg border border-line bg-ink-950 p-6">
    <div class="flex items-start justify-between gap-4">
      <p class="text-sm font-semibold text-white">{{ title }}</p>
      <component :is="icon" class="h-4 w-4 text-muted" />
    </div>
    <p class="mt-8 text-2xl font-bold text-white">{{ value }}</p>
  </section>
</template>
