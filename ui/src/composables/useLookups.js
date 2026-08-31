import { useQuery } from '@tanstack/vue-query';
import { api } from '@/services/api';
export function useCustomers() {
    return useQuery({ queryKey: ['customers'], queryFn: api.customers.list });
}
export function useUsers() {
    return useQuery({ queryKey: ['users'], queryFn: api.users.list });
}
export function useInventory() {
    return useQuery({ queryKey: ['inventory'], queryFn: api.inventory.list });
}
