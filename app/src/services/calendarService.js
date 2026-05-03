const GOOGLE_DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/calendar.events'

let tokenClient = null
let gapiInited = false
let gisInited = false

export const calendarService = {
  async init() {
    if (gapiInited && gisInited) return

    await Promise.all([
      this.loadScript('https://apis.google.com/js/api.js'),
      this.loadScript('https://accounts.google.com/gsi/client')
    ])

    await new Promise((resolve) => {
      window.gapi.load('client', async () => {
        await window.gapi.client.init({
          apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
          discoveryDocs: [GOOGLE_DISCOVERY_DOC],
        })
        gapiInited = true
        resolve()
      })
    })

    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      scope: GOOGLE_SCOPES,
      callback: '', // defined at request time
    })
    gisInited = true
  },

  loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve()
        return
      }
      const script = document.createElement('script')
      script.src = src
      script.async = true
      script.defer = true
      script.onload = resolve
      script.onerror = reject
      document.head.appendChild(script)
    })
  },

  async requestToken() {
    return new Promise((resolve, reject) => {
      tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
          reject(resp)
        }
        resolve(resp)
      }

      if (window.gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({ prompt: 'consent' })
      } else {
        tokenClient.requestAccessToken({ prompt: '' })
      }
    })
  },

  async createEvent(taskOrHabit) {
    await this.init()
    await this.requestToken()

    const event = {
      summary: `${taskOrHabit.emoji || '📅'} ${taskOrHabit.name}`,
      description: 'Created via Track.now',
      start: {
        dateTime: this.getDateTime(taskOrHabit.date, taskOrHabit.time),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: this.getDateTime(taskOrHabit.date, taskOrHabit.time, 30), // 30 min duration
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    }

    try {
      const response = await window.gapi.client.calendar.events.insert({
        calendarId: 'primary',
        resource: event,
      })
      return response.result
    } catch (err) {
      console.error('Error creating calendar event', err)
      throw err
    }
  },

  getDateTime(date, time, offsetMinutes = 0) {
    const d = date ? new Date(date) : new Date()
    const [h, m] = (time || '09:00').split(':').map(Number)
    d.setHours(h, m + offsetMinutes, 0, 0)
    return d.toISOString()
  }
}
