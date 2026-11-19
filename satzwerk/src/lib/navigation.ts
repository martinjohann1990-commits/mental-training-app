import { type Href, router } from 'expo-router';

/** Zurück navigieren – oder zum Fallback, falls es keinen Verlauf gibt (z. B. nach Deep-Link). */
export function goBack(fallback: Href) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
