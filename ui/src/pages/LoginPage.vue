<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Eye, EyeOff, LogIn } from 'lucide-vue-next';
import { useAuth } from '@/composables/useAuth';
import logoUrl from '@/assets/logo.png';
const route = useRoute();
const router = useRouter();
const auth = useAuth();
const identifier = ref('');
const password = ref('');
const showPassword = ref(false);
const error = ref('');
async function submit() {
    error.value = '';
    try {
        await auth.login(identifier.value.trim(), password.value);
        const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/')
            ? route.query.redirect
            : '/dashboard';
        await router.replace(redirect);
    }
    catch (reason) {
        error.value = reason instanceof Error ? reason.message : 'Login failed';
    }
}
</script>

<template>
  <main class="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-950 px-4 py-10 text-slate-950">
    <div
      class="absolute inset-0"
      style="background-image: linear-gradient(135deg, rgba(2, 6, 23, 0.98), rgba(15, 23, 42, 0.98) 62%, rgba(2, 6, 23, 0.98));"
    />
    <div
      class="absolute inset-0 opacity-[0.08]"
      style="background-image: linear-gradient(rgba(148, 163, 184, 0.45) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.45) 1px, transparent 1px); background-size: 56px 56px;"
    />
    <section class="relative w-full max-w-md rounded-lg border border-white/70 bg-slate-50/95 p-6 shadow-2xl shadow-blue-950/50 backdrop-blur sm:p-8">
      <div class="mb-8 border-b border-slate-200 pb-6 text-center">
        <img :src="logoUrl" alt="Multiprint" class="mx-auto h-auto w-72 max-w-full object-contain" />
        <p class="mt-4 text-sm font-bold tracking-wide text-slate-600">Sistem Manajemen Multiprint</p>
      </div>

      <form class="space-y-5" @submit.prevent="submit">
        <div>
          <label for="identifier" class="mb-2 block text-sm font-bold text-slate-700">User ID</label>
          <input id="identifier" v-model="identifier" class="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100" autocomplete="username" required autofocus />
        </div>
        <div>
          <label for="password" class="mb-2 block text-sm font-bold text-slate-700">Password</label>
          <div class="relative">
            <input
              id="password"
              v-model="password"
              class="h-11 w-full rounded-md border border-slate-300 bg-white px-3 pr-11 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              required
            />
            <button
              type="button"
              class="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500 hover:text-blue-700"
              :title="showPassword ? 'Hide password' : 'Show password'"
              @click="showPassword = !showPassword"
            >
              <EyeOff v-if="showPassword" class="h-4 w-4" />
              <Eye v-else class="h-4 w-4" />
            </button>
          </div>
        </div>
        <p v-if="error" class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {{ error }}
        </p>
        <button type="submit" class="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-blue-700 px-4 text-sm font-black text-white shadow-lg shadow-blue-700/20 transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60" :disabled="auth.state.loading">
          <LogIn class="h-4 w-4" />
          {{ auth.state.loading ? 'Processing...' : 'Login' }}
        </button>
      </form>
    </section>
  </main>
</template>
