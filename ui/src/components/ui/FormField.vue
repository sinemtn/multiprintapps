<script setup>
defineProps({
    id: { type: String, required: true },
    label: { type: String, required: true },
});
</script>

<template>
  <label :for="id" class="block">
    <span class="mb-2 block text-sm font-semibold text-white">{{ label }}</span>
    <slot />
  </label>
</template>
