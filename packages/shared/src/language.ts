/**
 * Supported languages for Arya. `code` is BCP-47-ish; `nativeName` is used for
 * the language picker with native-script labels. `mixed` entries model
 * code-switched registers (Hinglish, Tanglish, ...).
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English', script: 'Latn' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', script: 'Deva' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', script: 'Beng' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', script: 'Telu' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', script: 'Deva' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', script: 'Taml' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', script: 'Gujr' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', script: 'Knda' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', script: 'Mlym' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', script: 'Guru' },
  { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', script: 'Orya' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', script: 'Arab' },
  { code: 'hi-en', name: 'Hinglish', nativeName: 'Hinglish', script: 'Latn', mixed: true },
  { code: 'ta-en', name: 'Tanglish', nativeName: 'Tanglish', script: 'Latn', mixed: true },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

export const LANGUAGE_BY_CODE: Record<string, (typeof SUPPORTED_LANGUAGES)[number]> =
  Object.fromEntries(SUPPORTED_LANGUAGES.map((l) => [l.code, l]));
