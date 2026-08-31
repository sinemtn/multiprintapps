import { computed } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { api } from '@/services/api';
export function useComplaints() {
    return useQuery({ queryKey: ['complaints'], queryFn: api.complaints.list });
}
export function useComplaint(id) {
    return useQuery({
        queryKey: computed(() => ['complaints', id.value]),
        queryFn: () => api.complaints.get(id.value),
        enabled: computed(() => Boolean(id.value && id.value !== 'new')),
    });
}
export function useComplaintMutations() {
    const queryClient = useQueryClient();
    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['complaints'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    };
    const createComplaint = useMutation({
        mutationFn: (payload) => api.complaints.create(payload),
        onSuccess: invalidate,
    });
    const updateComplaint = useMutation({
        mutationFn: ({ id, payload }) => api.complaints.update(id, payload),
        onSuccess: invalidate,
    });
    const resolveComplaint = useMutation({
        mutationFn: (id) => api.complaints.resolve(id),
        onSuccess: invalidate,
    });
    const removeComplaint = useMutation({
        mutationFn: (id) => api.complaints.remove(id),
        onSuccess: invalidate,
    });
    return { createComplaint, updateComplaint, resolveComplaint, removeComplaint };
}
