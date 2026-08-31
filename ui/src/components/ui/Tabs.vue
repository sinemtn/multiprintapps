<script setup>
defineProps({
    tabs: { type: Array, required: true },
    modelValue: { type: String, required: true },
});
defineEmits(['update:modelValue']);
</script>

<template>
  <div class="inline-flex rounded-lg bg-ink-700 p-1">
    <button
      v-for="tab in tabs"
      :key="tab.value"
      type="button"
      class="rounded-md px-3 py-1.5 text-sm font-semibold transition"
      :class="modelValue === tab.value ? 'bg-slate-700 text-white shadow-sm' : 'text-muted hover:text-white'"
      @click="$emit('update:modelValue', tab.value)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>
