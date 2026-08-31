import { computed, reactive } from 'vue';
import { api } from '@/services/api';
const state = reactive({
    user: null,
    initialized: false,
    loading: false,
});
let initialization = null;
async function initialize() {
    if (state.initialized)
        return;
    if (initialization)
        return initialization;
    initialization = (async () => {
        state.loading = true;
        try {
            state.user = await api.auth.me();
        }
        catch {
            state.user = null;
        }
        finally {
            state.loading = false;
            state.initialized = true;
        }
    })();
    return initialization;
}
async function login(identifier, password) {
    state.loading = true;
    try {
        const user = await api.auth.login(identifier, password);
        state.user = user;
        state.initialized = true;
        return user;
    }
    finally {
        state.loading = false;
    }
}
async function logout() {
    try {
        await api.auth.logout();
    }
    finally {
        state.user = null;
        state.initialized = true;
    }
}
function clearSession() {
    state.user = null;
    state.initialized = true;
}
if (typeof window !== 'undefined')
    window.addEventListener('multiprint:unauthorized', clearSession);
export function useAuth() {
    const isAuthenticated = computed(() => Boolean(state.user));
    const role = computed(() => state.user?.role ?? null);
    const hasRole = (...roles) => Boolean(state.user && roles.includes(state.user.role));
    const can = (module, action = 'view') => {
        if (!state.user)
            return false;
        if (state.user.role === 'admin')
            return true;
        return Boolean(state.user.permissions?.[module]?.includes(action));
    };
    return { state, isAuthenticated, role, hasRole, can, initialize, login, logout, clearSession };
}
