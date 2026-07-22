'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Languages offered in the top-of-site selector. English is the default.
export const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
] as const;

export type LangCode = (typeof LANGUAGES)[number]['code'];

// Translation dictionary. Keys map to strings per language; missing keys fall
// back to English. Covers the primary user-facing UI.
type Dict = Record<string, string>;
const T: Record<string, Dict> = {
  en: {
    'nav.myCare': 'My Care', 'nav.myPatients': 'My Patients', 'nav.callReviews': 'Call Reviews',
    'nav.analytics': 'Analytics', 'nav.signIn': 'Sign in', 'nav.signOut': 'Sign out',
    'landing.tag': 'Multilingual Voice AI · HIPAA-minded',
    'landing.title': 'The clinical companion that listens, translates, and calls back.',
    'landing.subtitle': 'Arya scribes consultations, triages patient calls in your language, and reaches patients even without internet — sub-second.',
    'landing.google': 'Sign in with Google', 'landing.start': 'Get started',
    'patient.greeting': 'Namaste', 'patient.subtitle': 'Arya is here whenever you need her.',
    'patient.call': 'Call Arya', 'patient.callHint': 'Talk about your medicines, diet & appointments',
    'patient.chat': 'Chat with Arya', 'patient.ask': 'Ask in your language…',
    'patient.upload': 'Upload report', 'patient.medicines': 'Your medicines',
    'patient.book': 'Book an appointment', 'patient.pickDay': 'Pick a day, then an open time with your doctor.',
    'patient.nextAppt': 'Next appointment', 'patient.documents': 'Your documents',
    'patient.noSlots': 'No open slots that day — try another.',
    'call.onCall': 'On call', 'call.connecting': 'Connecting…', 'call.mute': 'Mute',
    'call.unmute': 'Unmute', 'call.speaker': 'Speaker', 'common.send': 'Send', 'common.loading': 'Loading…',
  },
  hi: {
    'nav.myCare': 'मेरी देखभाल', 'nav.signOut': 'साइन आउट', 'nav.signIn': 'साइन इन',
    'patient.greeting': 'नमस्ते', 'patient.subtitle': 'आर्या हमेशा आपकी मदद के लिए यहाँ है।',
    'patient.call': 'आर्या को कॉल करें', 'patient.callHint': 'दवाइयों, आहार और अपॉइंटमेंट के बारे में बात करें',
    'patient.chat': 'आर्या से चैट करें', 'patient.ask': 'अपनी भाषा में पूछें…',
    'patient.upload': 'रिपोर्ट अपलोड करें', 'patient.medicines': 'आपकी दवाइयाँ',
    'patient.book': 'अपॉइंटमेंट बुक करें', 'patient.pickDay': 'दिन चुनें, फिर डॉक्टर के साथ खाली समय।',
    'patient.nextAppt': 'अगली अपॉइंटमेंट', 'patient.documents': 'आपके दस्तावेज़',
    'call.onCall': 'कॉल पर', 'call.connecting': 'जोड़ा जा रहा है…', 'common.send': 'भेजें',
  },
  kn: {
    'nav.myCare': 'ನನ್ನ ಆರೈಕೆ', 'nav.signOut': 'ಸೈನ್ ಔಟ್',
    'patient.greeting': 'ನಮಸ್ಕಾರ', 'patient.subtitle': 'ಆರ್ಯಾ ಯಾವಾಗಲೂ ನಿಮ್ಮ ಸಹಾಯಕ್ಕೆ ಇದ್ದಾಳೆ.',
    'patient.call': 'ಆರ್ಯಾಗೆ ಕರೆ ಮಾಡಿ', 'patient.callHint': 'ಔಷಧಿ, ಆಹಾರ ಮತ್ತು ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಬಗ್ಗೆ ಮಾತನಾಡಿ',
    'patient.chat': 'ಆರ್ಯಾ ಜೊತೆ ಚಾಟ್', 'patient.ask': 'ನಿಮ್ಮ ಭಾಷೆಯಲ್ಲಿ ಕೇಳಿ…',
    'patient.upload': 'ವರದಿ ಅಪ್‌ಲೋಡ್', 'patient.medicines': 'ನಿಮ್ಮ ಔಷಧಿಗಳು',
    'patient.book': 'ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಬುಕ್ ಮಾಡಿ', 'patient.nextAppt': 'ಮುಂದಿನ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್',
    'patient.documents': 'ನಿಮ್ಮ ದಾಖಲೆಗಳು', 'call.onCall': 'ಕರೆಯಲ್ಲಿ', 'common.send': 'ಕಳುಹಿಸಿ',
  },
  ta: {
    'nav.myCare': 'என் பராமரிப்பு', 'nav.signOut': 'வெளியேறு',
    'patient.greeting': 'வணக்கம்', 'patient.subtitle': 'ஆர்யா எப்போதும் உங்களுக்கு உதவ இங்கே இருக்கிறாள்.',
    'patient.call': 'ஆர்யாவை அழைக்கவும்', 'patient.callHint': 'மருந்து, உணவு மற்றும் சந்திப்பு பற்றி பேசுங்கள்',
    'patient.chat': 'ஆர்யாவுடன் அரட்டை', 'patient.ask': 'உங்கள் மொழியில் கேளுங்கள்…',
    'patient.upload': 'அறிக்கையை பதிவேற்று', 'patient.medicines': 'உங்கள் மருந்துகள்',
    'patient.book': 'சந்திப்பை பதிவு செய்', 'patient.nextAppt': 'அடுத்த சந்திப்பு',
    'patient.documents': 'உங்கள் ஆவணங்கள்', 'call.onCall': 'அழைப்பில்', 'common.send': 'அனுப்பு',
  },
  te: {
    'nav.myCare': 'నా సంరక్షణ', 'patient.greeting': 'నమస్కారం',
    'patient.call': 'ఆర్యాకు కాల్ చేయండి', 'patient.chat': 'ఆర్యాతో చాట్',
    'patient.medicines': 'మీ మందులు', 'patient.documents': 'మీ పత్రాలు', 'common.send': 'పంపు',
  },
};

interface LangState {
  lang: LangCode;
  setLang: (l: LangCode) => void;
}

export const useLang = create<LangState>()(
  persist(
    (set) => ({ lang: 'en', setLang: (lang) => set({ lang }) }),
    { name: 'arya-lang' },
  ),
);

/** Translate a key for the current language, falling back to English then the key. */
export function useT() {
  const lang = useLang((s) => s.lang);
  return (key: string) => T[lang]?.[key] ?? T.en[key] ?? key;
}
