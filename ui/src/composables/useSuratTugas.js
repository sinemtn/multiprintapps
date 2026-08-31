import { computed } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { api } from '@/services/api';
export function useSuratTugasList() {
    return useQuery({ queryKey: ['surat-tugas'], queryFn: api.suratTugas.list });
}
export function useSuratTugas(id) {
    return useQuery({
        queryKey: computed(() => ['surat-tugas', id.value]),
        queryFn: () => api.suratTugas.get(id.value),
        enabled: computed(() => Boolean(id.value && id.value !== 'new')),
    });
}
export function useSuratTugasByComplaint(complaintId) {
    return useQuery({
        queryKey: computed(() => ['surat-tugas', 'complaint', complaintId.value]),
        queryFn: () => api.suratTugas.byComplaint(complaintId.value),
        enabled: computed(() => Boolean(complaintId.value)),
    });
}
export function useSuratTugasMutations() {
    const queryClient = useQueryClient();
    const invalidate = (assignment) => {
        queryClient.invalidateQueries({ queryKey: ['surat-tugas'] });
        queryClient.invalidateQueries({ queryKey: ['surat-tugas', 'complaint'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['complaints'] });
        if (assignment?.id)
            queryClient.invalidateQueries({ queryKey: ['surat-tugas', assignment.id] });
        if (assignment?.complaintId)
            queryClient.invalidateQueries({ queryKey: ['surat-tugas', 'complaint', assignment.complaintId] });
    };
    const createSuratTugas = useMutation({
        mutationFn: (payload) => api.suratTugas.create(payload),
        onSuccess: invalidate,
    });
    const updateSuratTugas = useMutation({
        mutationFn: ({ id, payload }) => api.suratTugas.update(id, payload),
        onSuccess: invalidate,
    });
    const startSuratTugas = useMutation({
        mutationFn: (id) => api.suratTugas.start(id),
        onSuccess: invalidate,
    });
    const readyToPrintSuratTugas = useMutation({
        mutationFn: (id) => api.suratTugas.readyToPrint(id),
        onSuccess: invalidate,
    });
    const technicianCompleteSuratTugas = useMutation({
        mutationFn: (id) => api.suratTugas.technicianComplete(id),
        onSuccess: invalidate,
    });
    const warehouseValidateSuratTugas = useMutation({
        mutationFn: (id) => api.suratTugas.warehouseValidate(id),
        onSuccess: invalidate,
    });
    const resolveSuratTugas = useMutation({
        mutationFn: (id) => api.suratTugas.resolve(id),
        onSuccess: invalidate,
    });
    const removeSuratTugas = useMutation({
        mutationFn: (id) => api.suratTugas.remove(id),
        onSuccess: () => invalidate(),
    });
    const addItem = useMutation({
        mutationFn: ({ assignmentId, item }) => api.suratTugas.addItem(assignmentId, item),
        onSuccess: (_item, variables) => {
            queryClient.invalidateQueries({ queryKey: ['surat-tugas'] });
            queryClient.invalidateQueries({ queryKey: ['surat-tugas', variables.assignmentId] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        },
    });
    const removeItem = useMutation({
        mutationFn: ({ assignmentId, itemId }) => api.suratTugas.removeItem(assignmentId, itemId),
        onSuccess: (_item, variables) => {
            queryClient.invalidateQueries({ queryKey: ['surat-tugas'] });
            queryClient.invalidateQueries({ queryKey: ['surat-tugas', variables.assignmentId] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        },
    });
    return {
        createSuratTugas,
        updateSuratTugas,
        startSuratTugas,
        readyToPrintSuratTugas,
        technicianCompleteSuratTugas,
        warehouseValidateSuratTugas,
        resolveSuratTugas,
        removeSuratTugas,
        addItem,
        removeItem,
    };
}
