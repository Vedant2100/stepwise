import { Capacitor } from '@capacitor/core'

export const canRemind = Capacitor.isNativePlatform()
export const REMINDER_KEY = 'stepwise.reminder'

export async function setReminder(time) {
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  await LocalNotifications.cancel({ notifications: [{ id: 1 }] })
  if (!time) return true
  if ((await LocalNotifications.requestPermissions()).display !== 'granted') return false
  const [hour, minute] = time.split(':').map(Number)
  await LocalNotifications.schedule({
    notifications: [{ id: 1, title: 'Stepwise', body: 'Today’s climb is ready. About five minutes.', schedule: { on: { hour, minute }, allowWhileIdle: true } }],
  })
  return true
}
