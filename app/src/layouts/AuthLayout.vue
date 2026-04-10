<template>
  <q-layout view="lHh lpr lFf">
    <q-page-container>
      <q-page class="auth-page">
        <div class="auth-shell">
          <div class="auth-story">
            <div class="text-overline text-primary">Track.now</div>
            <div class="text-h3 text-weight-bold q-mt-sm">Focused growth, without noise</div>
            <div class="text-body1 text-grey-7 q-mt-md">
              Build daily discipline through clear missions, calmer reminders, and progress that feels grounded instead of exhausting.
            </div>

            <div class="story-stack q-mt-xl">
              <div class="story-card">
                <div class="text-subtitle1 text-weight-bold">Mission-based habits</div>
                <div class="text-body2 text-grey-7 q-mt-xs">Every habit has a finish line: 21, 45, or 90 days.</div>
              </div>
              <div class="story-card">
                <div class="text-subtitle1 text-weight-bold">Action-first Today view</div>
                <div class="text-body2 text-grey-7 q-mt-xs">Open the app and instantly know what matters now.</div>
              </div>
              <div class="story-card">
                <div class="text-subtitle1 text-weight-bold">Optional accountability</div>
                <div class="text-body2 text-grey-7 q-mt-xs">Bring in friends, groups, or family only when it helps.</div>
              </div>
            </div>
          </div>

          <div class="auth-panel">
            <div class="auth-header text-center q-mb-lg">
              <div class="app-logo q-mb-md">
                <span class="brand-mark" />
              </div>
              <div class="text-h5 text-weight-bold">Welcome to Track.now</div>
              <div class="text-body2 text-grey-7 q-mt-sm">A calmer habit system for people who want consistency to feel sustainable.</div>
            </div>
            <router-view />
          </div>
        </div>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<style scoped lang="scss">
.auth-page {
  min-height: 100vh;
  padding: 24px;
  background:
    radial-gradient(circle at top left, rgba(36, 92, 104, 0.12), transparent 38%),
    linear-gradient(180deg, #f4f6f7 0%, #f8fafb 100%);
}

.auth-shell {
  max-width: 1120px;
  margin: 0 auto;
  min-height: calc(100vh - 48px);
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 420px);
  gap: 24px;
  align-items: center;
}

.auth-story,
.auth-panel {
  border-radius: 28px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(18px);
}

.auth-story {
  padding: 40px;
}

.auth-panel {
  padding: 32px 24px;
}

.story-stack {
  display: grid;
  gap: 14px;
}

.story-card {
  padding: 18px;
  border-radius: 20px;
  background: #fbfcfd;
  border: 1px solid rgba(148, 163, 184, 0.12);
}

.app-logo {
  display: flex;
  justify-content: center;
}

.brand-mark {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: inline-block;
  background: linear-gradient(135deg, #245c68, #d17a3c);
  box-shadow: 0 0 0 10px rgba(36, 92, 104, 0.08);
}

@media (max-width: 960px) {
  .auth-shell {
    grid-template-columns: 1fr;
  }

  .auth-story {
    display: none;
  }
}
</style>
