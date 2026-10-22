import React, { useId, useMemo } from 'react';
import { Keyboard, Platform, TextInput, type StyleProp, type TextStyle } from 'react-native';
import { KeyboardDoneBar } from '@/components/KeyboardDoneBar';
import { MAX_NUMERIC_INPUT_LENGTH, roundToTwoDecimalPlaces, sanitiseDecimalInput } from '@/lib/numberFormatting';
import type { getPalette } from '@/theme/theme';

type RoundedNumericInputProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  placeholderTextColor?: string;
  inputStyle?: StyleProp<TextStyle>;
  keyboardAppearance?: 'light' | 'dark';
  keyboardTypeOverrideIOS?: string;
  palette: ReturnType<typeof getPalette>;
};

export function RoundedNumericInput({
  value,
  onChangeText,
  placeholder,
  placeholderTextColor,
  inputStyle,
  keyboardAppearance,
  keyboardTypeOverrideIOS,
  palette
}: RoundedNumericInputProps) {
  const keyboardType = useMemo(() => {
    if (Platform.OS === 'ios') {
      return keyboardTypeOverrideIOS ?? 'decimal-pad';
    }
    return 'numeric';
  }, [keyboardTypeOverrideIOS]);

  const doneBarId = `done-bar-${useId()}`;

  const handleChangeText = (text: string) => {
    onChangeText(sanitiseDecimalInput(text));
  };

  return (
    <>
      <TextInput
        style={inputStyle}
        keyboardType={keyboardType as any}
        value={value}
        onChangeText={handleChangeText}
        onBlur={() => {
          const rounded = roundToTwoDecimalPlaces(value);
          if (rounded !== value) {
            onChangeText(rounded);
          }
        }}
        maxLength={MAX_NUMERIC_INPUT_LENGTH}
        inputAccessoryViewID={Platform.OS === 'ios' ? doneBarId : undefined}
        returnKeyType="done"
        onSubmitEditing={() => Keyboard.dismiss()}
        keyboardAppearance={keyboardAppearance}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
      />
      <KeyboardDoneBar id={doneBarId} palette={palette} />
    </>
  );
}

