<template>
  <q-layout view="lHh lpr lFf">
    <q-page-container>
      <q-page class="auth-page flex flex-center bg-mesh">
        <div class="auth-shell">
          <!-- Left side: The Vision (Hidden on Mobile) -->
          <div class="auth-vision">
            <div class="column q-gutter-y-md">
              <div class="row items-center gap-2 q-mb-md">
                <div class="brand-dot"></div>
                <span class="text-h6 text-weight-bolder tracking-tight">Track.now</span>
              </div>
              <h1 class="text-h2 text-weight-bolder leading-tight tracking-tighter text-slate-900">
                Consistency <br/>is the only <br/><span class="text-primary italic">secret.</span>
              </h1>
              <p class="text-h6 text-slate-500 text-weight-medium max-w-md q-mt-lg">
                Join high-performers using mission-based tracking to reclaim their time and identity.
              </p>
              
              <div class="feature-list q-mt-xl">
                <div v-for="f in features" :key="f.title" class="feature-item row no-wrap items-start q-mb-lg">
                  <q-icon :name="f.icon" size="24px" color="primary" class="q-mr-md q-mt-xs" />
                  <div>
                    <div class="text-subtitle1 text-weight-bold text-slate-900">{{ f.title }}</div>
                    <div class="text-body2 text-slate-500">{{ f.desc }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right side: The Form -->
          <div class="auth-panel-container">
            <router-view />
          </div>
        </div>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup>
const features = [
  { icon: 'o_flag', title: 'Mission-Based', desc: 'Sprints of 21, 45, or 90 days.' },
  { icon: 'o_bolt', title: 'Action-First', desc: 'One clear task at a time.' },
  { icon: 'o_public', title: 'Shared Focus', desc: 'Optional social activity maps.' }
]
</script>

<style scoped lang="scss">
.auth-page {
  min-height: 100vh;
  padding: 40px 24px;
}

.bg-mesh {
  background-color: #f8fafc;
  background-image: 
    radial-gradient(at 0% 0%, rgba(79, 70, 229, 0.05) 0px, transparent 50%),
    radial-gradient(at 100% 0%, rgba(99, 102, 241, 0.05) 0px, transparent 50%);
}

.auth-shell {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 80px;
  width: 100%;
  max-width: 1100px;
  align-items: center;
}

.brand-dot {
  width: 12px;
  height: 12px;
  background: $primary;
  border-radius: 50%;
  box-shadow: 0 0 10px rgba($primary, 0.4);
}

.auth-vision {
  padding: 20px;
}

.auth-panel-container {
  width: 100%;
  max-width: 440px;
}

.text-slate-500 { color: #64748b; }
.text-slate-900 { color: #0f172a; }

@media (max-width: 1024px) {
  .auth-shell {
    grid-template-columns: 1fr;
    max-width: 440px;
  }
  .auth-vision {
    display: none;
  }
}
</style>
