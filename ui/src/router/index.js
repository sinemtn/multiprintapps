import { createRouter, createWebHistory } from 'vue-router';
import AppLayout from '@/layouts/AppLayout.vue';
import { useAuth } from '@/composables/useAuth';
const routes = [
    { path: '/login', name: 'login', component: () => import('@/pages/LoginPage.vue'), meta: { title: 'Login', public: true } },
    {
        path: '/',
        component: AppLayout,
        redirect: '/dashboard',
        children: [
            { path: 'dashboard', name: 'dashboard', component: () => import('@/pages/DashboardPage.vue'), meta: { title: 'Dashboard', module: 'dashboard', action: 'view' } },
            { path: 'komplain', name: 'complaints', component: () => import('@/pages/ComplaintListPage.vue'), meta: { title: 'Komplain', module: 'complaint', action: 'view' } },
            { path: 'komplain/new', name: 'complaint-new', component: () => import('@/pages/ComplaintDetailPage.vue'), meta: { title: 'Buat Komplain', module: 'complaint', action: 'create' } },
            { path: 'komplain/:id', name: 'complaint-detail', component: () => import('@/pages/ComplaintDetailPage.vue'), meta: { title: 'Detail Komplain', module: 'complaint', action: 'view' } },
            { path: 'surat-tugas', name: 'assignments', component: () => import('@/pages/SuratTugasListPage.vue'), meta: { title: 'Surat Tugas', module: 'assignment', action: 'view' } },
            { path: 'surat-tugas/new', name: 'assignment-new', component: () => import('@/pages/SuratTugasDetailPage.vue'), meta: { title: 'Buat Surat Tugas', module: 'assignment', action: 'create' } },
            { path: 'surat-tugas/:id', name: 'assignment-detail', component: () => import('@/pages/SuratTugasDetailPage.vue'), meta: { title: 'Detail Surat Tugas', module: 'assignment', action: 'view' } },
            { path: 'stock/printer', component: () => import('@/pages/stock/StockPrinterPage.vue'), meta: { title: 'Stok Printer', module: 'stock-printer', action: 'view' } },
            { path: 'stock/toner', component: () => import('@/pages/stock/StockTonerPage.vue'), meta: { title: 'Stok Toner', module: 'stock-toner', action: 'view' } },
            { path: 'stock/sparepart', component: () => import('@/pages/stock/StockSparepartPage.vue'), meta: { title: 'Stok Sparepart', module: 'stock-sparepart', action: 'view' } },
            { path: 'master/printer', component: () => import('@/pages/master/MasterPrinterPage.vue'), meta: { title: 'Master Printer', module: 'master-printer', action: 'view' } },
            { path: 'master/toner', component: () => import('@/pages/master/MasterTonerPage.vue'), meta: { title: 'Master Toner', module: 'master-toner', action: 'view' } },
            { path: 'master/sparepart', component: () => import('@/pages/master/MasterSparepartPage.vue'), meta: { title: 'Master Sparepart', module: 'master-sparepart', action: 'view' } },
            { path: 'master/supplier', component: () => import('@/pages/master/MasterSupplierPage.vue'), meta: { title: 'Master Supplier', module: 'master-supplier', action: 'view' } },
            { path: 'master/customer', redirect: '/master/customer/singles' },
            { path: 'master/customer/accounts', component: () => import('@/pages/master/MasterCustomerPage.vue'), meta: { title: 'Akun Customer', module: 'master-customer', action: 'view', customerType: 'account' } },
            { path: 'master/customer/singles', component: () => import('@/pages/master/MasterCustomerPage.vue'), meta: { title: 'Customer Tunggal', module: 'master-customer', action: 'view', customerType: 'single' } },
            { path: 'master/user', component: () => import('@/pages/master/MasterUserPage.vue'), meta: { title: 'Master User', module: 'master-user', action: 'view' } },
            { path: 'audit-trail', component: () => import('@/pages/AuditTrailPage.vue'), meta: { title: 'Audit Trail', module: 'audit-trail', action: 'view' } },
            { path: 'settings', component: () => import('@/pages/SettingsPage.vue'), meta: { title: 'Pengaturan', module: 'settings', action: 'view', roles: ['admin'] } },
        ],
    },
];
export const router = createRouter({
    history: createWebHistory(),
    routes,
});
router.beforeEach(async (to) => {
    const auth = useAuth();
    await auth.initialize();
    if (to.meta.public)
        return auth.isAuthenticated.value ? '/dashboard' : true;
    if (!auth.isAuthenticated.value)
        return { name: 'login', query: { redirect: to.fullPath } };
    const roles = to.meta.roles;
    if (roles && !roles.includes(auth.state.user.role))
        return '/dashboard';
    if (to.meta.module && !auth.can(to.meta.module, to.meta.action ?? 'view'))
        return '/dashboard';
    return true;
});
