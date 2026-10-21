import React, { useMemo } from 'react';
import { Keyboard, Platform, TextInput, type StyleProp, type TextStyle } from 'react-native';
import { NUMERIC_ACCESSORY_ID } from '@/components/NumericDoneBar';
import { MAX_NUMERIC_INPUT_LENGTH, roundToTwoDecimalPlaces, sanitiseDecimalInput } from '@/lib/numberFormatting';

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
    onChangeText(sanitiseDecimalInput(text));
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
      maxLength={MAX_NUMERIC_INPUT_LENGTH}
      inputAccessoryViewID={Platform.OS === 'ios' ? NUMERIC_ACCESSORY_ID : undefined}
      returnKeyType="done"
      onSubmitEditing={() => Keyboard.dismiss()}
      keyboardAppearance={keyboardAppearance}
      placeholder={placeholder}
      placeholderTextColor={placeholderTextColor}
    />
  );
}

