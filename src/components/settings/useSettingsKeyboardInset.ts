import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

export function useSettingsKeyboardInset(params: {
  visible: boolean;
  bottomInset: number;
}) {
  const { visible, bottomInset } = params;
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    if (!visible) {
      setKeyboardInset(0);
      return;
    }

    const updateInset = (height: number) => {
      setKeyboardInset(Math.max(height - bottomInset, 0));
    };

    const handleKeyboardShow = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (event) => updateInset(event.endCoordinates.height),
    );
    const handleKeyboardHide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => updateInset(0),
    );
    const handleKeyboardFrameChange =
      Platform.OS === "ios"
        ? Keyboard.addListener("keyboardWillChangeFrame", (event) =>
            updateInset(event.endCoordinates.height),
          )
        : null;

    return () => {
      handleKeyboardShow.remove();
      handleKeyboardHide.remove();
      handleKeyboardFrameChange?.remove();
    };
  }, [bottomInset, visible]);

  return keyboardInset;
}
