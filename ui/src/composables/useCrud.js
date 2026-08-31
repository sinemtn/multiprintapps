import { computed } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { api } from '@/services/api';
export function useCrud(key) {
    const queryClient = useQueryClient();
    const queryKey = computed(() => ['crud', key.value]);
    const records = useQuery({
        queryKey,
        queryFn: () => api.crud.list(key.value),
    });
    const createRecord = useMutation({
        mutationFn: (payload) => api.crud.create(key.value, payload),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKey.value }),
    });
    const updateRecord = useMutation({
        mutationFn: ({ id, payload }) => api.crud.update(key.value, id, payload),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKey.value }),
    });
    const removeRecord = useMutation({
        mutationFn: (id) => api.crud.remove(key.value, id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKey.value }),
    });
    return { records, createRecord, updateRecord, removeRecord };
}
