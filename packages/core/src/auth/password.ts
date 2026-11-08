/** Minimum the server accepts (Supabase default). */
export const MIN_PASSWORD_LENGTH = 6
/** Length from which a password is considered strong. */
export const GOOD_PASSWORD_LENGTH = 12
/** Seconds between password-reset emails (the server's email rate limit). */
export const RESET_EMAIL_COOLDOWN_SECONDS = 60

export type PasswordStrength = 'too_short' | 'weak' | 'fair' | 'strong'

export interface PasswordCheck {
  strength: PasswordStrength
  /** 0 (too short) … 3 (strong), for a meter. */
  score: 0 | 1 | 2 | 3
  label: string
  /** One practical tip, or null when the password is strong. */
  tip: string | null
}

const COMMON = /^(?:0123456789|123456789|12345678|1234567|123456|abcdef|qwerty|password|letmein|iloveyou|welcome|admin)/i

/**
 * A simple, honest strength check: length matters most, variety second. It never blocks a
 * password the server would accept (6+ characters); it only guides.
 */
export function checkPassword(password: string): PasswordCheck {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { strength: 'too_short', score: 0, label: 'Too short', tip: `Use at least ${MIN_PASSWORD_LENGTH} characters.` }
  }
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length
  const guessable = /^(.)\1+$/.test(password) || COMMON.test(password)
  if (guessable || (password.length < 8 && classes < 3)) {
    return { strength: 'weak', score: 1, label: 'Weak', tip: 'Easy to guess. Try a longer phrase with a number or symbol.' }
  }
  if (password.length >= GOOD_PASSWORD_LENGTH && classes >= 3) {
    return { strength: 'strong', score: 3, label: 'Strong', tip: null }
  }
  return {
    strength: 'fair',
    score: 2,
    label: 'Fair',
    tip:
      password.length < GOOD_PASSWORD_LENGTH
        ? `${GOOD_PASSWORD_LENGTH}+ characters would make it strong.`
        : 'Mix letters, numbers and symbols to make it strong.',
  }
}
