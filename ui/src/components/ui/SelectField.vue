<script setup>
defineProps({
    id: { type: String, required: true },
    label: { type: String, required: true },
    modelValue: { type: [String, Number], default: '' },
    options: { type: Array, required: true },
    disabled: { type: Boolean, default: false },
});
defineEmits(['update:modelValue']);
</script>

<template>
  <label :for="id" class="block">
    <span class="mb-2 block text-sm font-semibold text-white">{{ label }}</span>
    <select
      :id="id"
      :value="modelValue"
      class="field-control max-w-xs"
      :disabled="disabled"
      @change="$emit('update:modelValue', $event.target.value)"
    >
      <option value="">Pilih {{ label }}</option>
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
  </label>
</template>
