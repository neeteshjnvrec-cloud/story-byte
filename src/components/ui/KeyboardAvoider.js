// Keyboard handling primitives. Two exports, and which one you want depends on
// the shape of the surface:
//
//   KeyboardAwareScroll — a scrollable form. Pads the content AND scrolls the
//     focused field into view, so no field needs its own onFocus handler.
//   KeyboardAvoider — a sheet or absolutely-positioned panel that has to move as
//     a whole (e.g. a bottom sheet with a pinned input row, where the input row
//     is a sibling of the scroll view and therefore can't be scrolled).
//
// Both come from react-native-keyboard-controller rather than react-native.
// The reason is Android-specific:
//
// React Native's own KeyboardAvoidingView derives its inset from the JS
// `keyboardDidShow` event, and the usual `Platform.OS === 'ios' ? 'padding' :
// undefined` idiom disables it outright on Android — leaning entirely on the
// window shrinking under `windowSoftInputMode="adjustResize"`. Expo SDK 54+
// forces edge-to-edge, so the activity draws behind the system bars, the root
// view keeps its full height, and that shrink never happens. Nothing moves and
// the keyboard sits on top of the field.
//
// keyboard-controller reads the height from Android's native
// WindowInsetsAnimationCallback instead, so it gets every frame of the keyboard
// animation, works under edge-to-edge, and is driven by the same values on both
// platforms. Requires <KeyboardProvider> at the app root — see App.js.
//
// One caveat for React Native Modals: a Modal is a separate Android window, so
// it must be given `statusBarTranslucent` and `navigationBarTranslucent` for its
// window to be edge-to-edge and report IME insets. CommentSheet and FilterModal
// both do.
import React from 'react';
import {
  KeyboardAvoidingView,
  KeyboardAwareScrollView,
} from 'react-native-keyboard-controller';

export function KeyboardAvoider({ children, style, offset = 0, ...rest }) {
  return (
    <KeyboardAvoidingView
      style={style}
      behavior="padding"
      keyboardVerticalOffset={offset}
      {...rest}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

// forwardRef because callers also drive the scroll imperatively for unrelated
// reasons (CreateStoryScreen resets to the top after publishing).
export const KeyboardAwareScroll = React.forwardRef(function KeyboardAwareScroll(
  // bottomOffset is the gap left between the focused field and the top of the
  // keyboard; without it the field lands flush against the keys.
  // persistTaps: otherwise the first tap on a button while the keyboard is open
  // only dismisses the keyboard and the press is swallowed.
  { children, bottomOffset = 24, keyboardShouldPersistTaps = 'handled', ...rest },
  ref
) {
  return (
    <KeyboardAwareScrollView
      ref={ref}
      bottomOffset={bottomOffset}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      {...rest}
    >
      {children}
    </KeyboardAwareScrollView>
  );
});

export default KeyboardAvoider;
