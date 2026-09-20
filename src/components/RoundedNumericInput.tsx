import React, { useMemo } from 'react';
import { Keyboard, Platform, TextInput, type StyleProp, type TextStyle } from 'react-native';
import { roundToTwoDecimalPlaces } from '@/lib/numberFormatting';

type RoundedNumericInputProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  placeholderTextColor?: string;
  inputStyle?: StyleProp<TextStyle>;
  keyboardAppearance?: 'light' | 'dark';
  keyboardTypeOverrideIOS?: string;
};

export function RoundedNumericInput({
  value,
  onChangeText,
  placeholder,
  placeholderTextColor,
  inputStyle,
  keyboardAppearance,
  keyboardTypeOverrideIOS
}: RoundedNumericInputProps) {
  const keyboardType = useMemo(() => {
    if (Platform.OS === 'ios') {
      return keyboardTypeOverrideIOS ?? 'decimal-pad';
    }
    return 'numeric';
  }, [keyboardTypeOverrideIOS]);

  const handleChangeText = (text: string) => {
    const sanitised = text.replace(/[^0-9.]/g, '');
    const firstDot = sanitised.indexOf('.');
    const deduped =
      firstDot === -1
        ? sanitised
        : sanitised.slice(0, firstDot + 1) + sanitised.slice(firstDot + 1).replace(/\./g, '');
    onChangeText(deduped);
  };

  return (
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
      returnKeyType="done"
      onSubmitEditing={() => Keyboard.dismiss()}
      keyboardAppearance={keyboardAppearance}
      placeholder={placeholder}
      placeholderTextColor={placeholderTextColor}
    />
  );
}

