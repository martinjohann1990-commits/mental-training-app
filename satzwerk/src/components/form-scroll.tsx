import { type ReactNode, type Ref, useEffect, useImperativeHandle, useRef } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  ScrollView,
  type ScrollViewInstance,
  type ScrollViewProps,
  TextInput,
} from 'react-native';

/**
 * Seit Android 15 laufen Apps „edge-to-edge“: Android schiebt die Ansicht nicht mehr
 * automatisch über die Tastatur. Diese Bausteine lösen das für alle Formulare:
 * - `KeyboardScreen` macht der Tastatur Platz (beide Plattformen),
 * - `FormScrollView` scrollt das fokussierte Feld in den sichtbaren Bereich.
 */

type Listener = () => void;
const focusListeners = new Set<Listener>();

/** Von Eingabefeldern beim Fokussieren aufrufen (auch wenn die Tastatur schon offen ist). */
export function notifyInputFocus(): void {
  focusListeners.forEach((l) => l());
}

export function KeyboardScreen({ children }: { children: ReactNode }) {
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      {children}
    </KeyboardAvoidingView>
  );
}

const MARGIN = 24;

export function FormScrollView({ ref, onScroll, onLayout, ...props }: ScrollViewProps & { ref?: Ref<ScrollViewInstance | null> }) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const offset = useRef(0);
  const height = useRef(0);
  useImperativeHandle(ref, () => scrollRef.current as ScrollViewInstance);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const reveal = () => {
      if (timer) clearTimeout(timer);
      // Warten, bis die Tastatur das Layout verkleinert hat.
      timer = setTimeout(() => {
        const scroll = scrollRef.current;
        // Auf dem Web scrollt der Browser selbst; die API existiert dort nicht.
        const input = TextInput.State?.currentlyFocusedInput?.();
        const inner = scroll?.getInnerViewRef();
        if (!scroll || !input || !inner) return;
        try {
          input.measureLayout(
            inner as unknown as number,
            (_x, y, _w, h) => {
              const top = offset.current;
              const bottom = top + height.current;
              if (y + h + MARGIN > bottom) scroll.scrollTo({ y: Math.max(0, y + h + MARGIN - height.current), animated: true });
              else if (y - MARGIN < top) scroll.scrollTo({ y: Math.max(0, y - MARGIN), animated: true });
            },
            () => {},
          );
        } catch {
          // Feld liegt nicht in dieser ScrollView – ignorieren.
        }
      }, 150);
    };
    focusListeners.add(reveal);
    const sub = Keyboard.addListener('keyboardDidShow', reveal);
    return () => {
      focusListeners.delete(reveal);
      sub.remove();
      if (timer) clearTimeout(timer);
    };
  }, []);

  return (
    <ScrollView
      ref={scrollRef}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={32}
      onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
        offset.current = e.nativeEvent.contentOffset.y;
        onScroll?.(e);
      }}
      onLayout={(e) => {
        height.current = e.nativeEvent.layout.height;
        onLayout?.(e);
      }}
      {...props}
    />
  );
}
