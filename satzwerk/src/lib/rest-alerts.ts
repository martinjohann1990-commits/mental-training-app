import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { Platform, Vibration } from 'react-native';

const CHANNEL_ID = 'rest-timer';
let initialised = false;
let permissionAsked = false;

/** Einmalig: Anzeige-Verhalten und Android-Kanal für den Pausentimer. */
export async function initRestAlerts(): Promise<void> {
  if (initialised || Platform.OS === 'web') return;
  initialised = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Pausentimer',
      // Re-Export über `export *` – der Import-Linter erkennt ihn nicht, TypeScript schon.
      // eslint-disable-next-line import/namespace
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 400, 200, 400],
      sound: 'default',
    });
  }
}

async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (permissionAsked && !current.canAskAgain) return false;
  permissionAsked = true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

/** Plant die „Pause vorbei“-Benachrichtigung. Liefert die ID zum Abbrechen (oder null). */
export async function scheduleRestEnd(seconds: number, nextExerciseName?: string): Promise<string | null> {
  if (Platform.OS === 'web' || seconds < 1) return null;
  try {
    await initRestAlerts();
    if (!(await ensurePermission())) return null;
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Pause vorbei 💪',
        body: nextExerciseName ? `Weiter mit: ${nextExerciseName}` : 'Weiter geht’s mit dem nächsten Satz.',
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.round(seconds),
        channelId: CHANNEL_ID,
      },
    });
  } catch {
    return null;
  }
}

export async function cancelRestEnd(id: string | null | undefined): Promise<void> {
  if (!id || Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // ignorieren – Benachrichtigung war evtl. schon zugestellt
  }
}

/** Haptisches Feedback im Vordergrund (Pause vorbei / Phasenwechsel im Intervall). */
export function buzz(kind: 'end' | 'tick' | 'phase' = 'end'): void {
  if (Platform.OS === 'web') return;
  if (kind === 'tick') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    return;
  }
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  Vibration.vibrate(kind === 'end' ? [0, 400, 200, 400] : [0, 250]);
}
