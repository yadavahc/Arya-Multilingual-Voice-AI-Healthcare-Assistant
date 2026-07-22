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

type Dict = Record<string, string>;

// English is the complete source of truth; other languages fall back to it.
const EN: Dict = {
  'nav.myCare': 'My Care', 'nav.myPatients': 'My Patients', 'nav.callReviews': 'Call Reviews',
  'nav.analytics': 'Analytics', 'nav.signIn': 'Sign in', 'nav.signOut': 'Sign out',
  'landing.tag': 'Multilingual Voice AI · HIPAA-minded',
  'landing.title': 'The clinical companion that listens, translates, and calls back.',
  'landing.subtitle': 'Arya scribes consultations, triages patient calls in your language, and reaches patients even without internet — sub-second.',
  'landing.google': 'Sign in with Google', 'landing.start': 'Get started',
  'landing.builtFor': 'Built for real clinics',
  'login.welcome': 'Welcome to Arya', 'login.subtitle': 'Sign in — patients talk to Arya, clinicians manage care.',
  'login.google': 'Continue with Google', 'login.orPhone': 'or use the demo phone login',
  'login.patient': 'Patient', 'login.clinician': 'Clinician',
  'login.patientSignin': 'Patient sign in', 'login.clinicianSignin': 'Clinician sign in',
  'login.phone': 'Phone number', 'login.sendCode': 'Send code', 'login.enterCode': 'Enter the 6-digit code',
  'login.verify': 'Verify & continue', 'login.differentNumber': 'Use a different number', 'login.demoCode': 'Demo code: 123456',
  'onboard.title': 'Complete your profile', 'onboard.iam': 'I am a', 'onboard.patient': 'Patient', 'onboard.doctor': 'Doctor',
  'onboard.name': 'Full name', 'onboard.phone': 'Phone number', 'onboard.hospital': 'Hospital',
  'onboard.language': 'Preferred language', 'onboard.continue': 'Continue',
  'onboard.hint': 'Patients and doctors in the same hospital are connected automatically.',
  'patient.greeting': 'Namaste', 'patient.subtitle': 'Arya is here whenever you need her.',
  'patient.call': 'Call Arya', 'patient.callHint': 'Talk about your medicines, diet & appointments',
  'patient.chat': 'Chat with Arya', 'patient.ask': 'Ask in your language…', 'patient.upload': 'Upload report',
  'patient.medicines': 'Your medicines', 'patient.noMeds': 'No active medicines on file.',
  'patient.book': 'Book an appointment', 'patient.pickDay': 'Pick a day, then an open time with your doctor.',
  'patient.nextAppt': 'Next appointment', 'patient.documents': 'Your documents', 'patient.history': 'Chat history',
  'patient.noSlots': 'No open slots that day — try another.', 'patient.checking': 'Checking availability…',
  'patient.bookedFor': 'Booked for', 'patient.tellArya': 'Tip: you can also just tell Arya “book me for next Monday morning”.',
  'call.onCall': 'On call', 'call.connecting': 'Connecting…', 'call.calling': 'Calling', 'call.demo': 'Demo mode',
  'call.mute': 'Mute', 'call.unmute': 'Unmute', 'call.speaker': 'Speaker', 'call.tapEnd': 'On call with Arya — tap to end',
  'doctor.patients': 'Patients', 'doctor.schedule': 'Upcoming appointments', 'doctor.noPatients': 'No patients yet.',
  'doctor.noAppts': 'No upcoming appointments.', 'doctor.allPatients': 'All patients', 'doctor.dashboard': 'Dashboard',
  'doctor.prescription': 'Prescription', 'doctor.conversations': 'Conversations with Arya', 'doctor.appointments': 'Appointments',
  'doctor.history': 'History & care plan', 'doctor.callReviews': 'Call & chat reviews',
  'doctor.reviewSub': 'Every Arya conversation — summary, transcript, insights, and your feedback.',
  'doctor.respondedCorrectly': 'Did Arya respond correctly?', 'doctor.yes': 'Yes', 'doctor.needsFixing': 'Needs fixing',
  'doctor.saveFeedback': 'Save feedback', 'doctor.genInsights': 'Generate AI insights',
  'common.send': 'Send', 'common.loading': 'Loading…', 'common.reading': 'Reading…',
};

const T: Record<string, Dict> = {
  en: EN,
  hi: {
    'nav.myCare': 'मेरी देखभाल', 'nav.myPatients': 'मेरे मरीज़', 'nav.callReviews': 'कॉल समीक्षा',
    'nav.analytics': 'विश्लेषण', 'nav.signIn': 'साइन इन', 'nav.signOut': 'साइन आउट',
    'landing.title': 'सुनने, अनुवाद करने और वापस कॉल करने वाला क्लिनिकल साथी।',
    'landing.subtitle': 'आर्या परामर्श लिखती है, आपकी भाषा में मरीज़ों की कॉल संभालती है, और इंटरनेट के बिना भी पहुँचती है।',
    'landing.google': 'Google से साइन इन करें', 'landing.start': 'शुरू करें', 'landing.builtFor': 'असली क्लीनिक के लिए बनाया गया',
    'login.welcome': 'आर्या में आपका स्वागत है', 'login.google': 'Google से जारी रखें', 'login.orPhone': 'या डेमो फ़ोन लॉगिन उपयोग करें',
    'login.patient': 'मरीज़', 'login.clinician': 'डॉक्टर', 'login.patientSignin': 'मरीज़ साइन इन', 'login.clinicianSignin': 'डॉक्टर साइन इन',
    'login.phone': 'फ़ोन नंबर', 'login.sendCode': 'कोड भेजें', 'login.enterCode': '6-अंकों का कोड डालें', 'login.verify': 'सत्यापित करें',
    'login.differentNumber': 'दूसरा नंबर उपयोग करें', 'login.demoCode': 'डेमो कोड: 123456',
    'onboard.title': 'अपनी प्रोफ़ाइल पूरी करें', 'onboard.iam': 'मैं हूँ', 'onboard.patient': 'मरीज़', 'onboard.doctor': 'डॉक्टर',
    'onboard.name': 'पूरा नाम', 'onboard.phone': 'फ़ोन नंबर', 'onboard.hospital': 'अस्पताल', 'onboard.language': 'पसंदीदा भाषा',
    'onboard.continue': 'जारी रखें', 'onboard.hint': 'एक ही अस्पताल के मरीज़ और डॉक्टर स्वतः जुड़ जाते हैं।',
    'patient.greeting': 'नमस्ते', 'patient.subtitle': 'आर्या हमेशा आपकी मदद के लिए यहाँ है।',
    'patient.call': 'आर्या को कॉल करें', 'patient.callHint': 'दवाइयों, आहार और अपॉइंटमेंट के बारे में बात करें',
    'patient.chat': 'आर्या से चैट करें', 'patient.ask': 'अपनी भाषा में पूछें…', 'patient.upload': 'रिपोर्ट अपलोड करें',
    'patient.medicines': 'आपकी दवाइयाँ', 'patient.book': 'अपॉइंटमेंट बुक करें', 'patient.pickDay': 'दिन चुनें, फिर खाली समय।',
    'patient.nextAppt': 'अगली अपॉइंटमेंट', 'patient.documents': 'आपके दस्तावेज़', 'patient.history': 'चैट इतिहास',
    'call.mute': 'म्यूट', 'call.unmute': 'अनम्यूट', 'call.speaker': 'स्पीकर', 'call.connecting': 'जोड़ा जा रहा है…',
    'doctor.patients': 'मरीज़', 'doctor.schedule': 'आगामी अपॉइंटमेंट', 'doctor.prescription': 'प्रिस्क्रिप्शन',
    'doctor.conversations': 'आर्या से बातचीत', 'doctor.appointments': 'अपॉइंटमेंट', 'doctor.callReviews': 'कॉल और चैट समीक्षा',
    'doctor.respondedCorrectly': 'क्या आर्या ने सही जवाब दिया?', 'doctor.yes': 'हाँ', 'doctor.needsFixing': 'सुधार चाहिए',
    'doctor.saveFeedback': 'फ़ीडबैक सहेजें', 'common.send': 'भेजें', 'common.loading': 'लोड हो रहा है…',
  },
  kn: {
    'nav.myCare': 'ನನ್ನ ಆರೈಕೆ', 'nav.myPatients': 'ನನ್ನ ರೋಗಿಗಳು', 'nav.callReviews': 'ಕರೆ ವಿಮರ್ಶೆ',
    'nav.analytics': 'ವಿಶ್ಲೇಷಣೆ', 'nav.signIn': 'ಸೈನ್ ಇನ್', 'nav.signOut': 'ಸೈನ್ ಔಟ್',
    'landing.title': 'ಆಲಿಸುವ, ಅನುವಾದಿಸುವ ಮತ್ತು ಮರಳಿ ಕರೆ ಮಾಡುವ ವೈದ್ಯಕೀಯ ಸಹಾಯಕಿ.',
    'landing.subtitle': 'ಆರ್ಯಾ ಸಮಾಲೋಚನೆಗಳನ್ನು ಬರೆಯುತ್ತಾಳೆ, ನಿಮ್ಮ ಭಾಷೆಯಲ್ಲಿ ರೋಗಿಗಳ ಕರೆಗಳನ್ನು ನಿರ್ವಹಿಸುತ್ತಾಳೆ.',
    'landing.google': 'Google ನೊಂದಿಗೆ ಸೈನ್ ಇನ್', 'landing.start': 'ಪ್ರಾರಂಭಿಸಿ', 'landing.builtFor': 'ನೈಜ ಚಿಕಿತ್ಸಾಲಯಗಳಿಗಾಗಿ',
    'login.welcome': 'ಆರ್ಯಾಗೆ ಸ್ವಾಗತ', 'login.google': 'Google ನೊಂದಿಗೆ ಮುಂದುವರಿಯಿರಿ', 'login.orPhone': 'ಅಥವಾ ಡೆಮೊ ಫೋನ್ ಲಾಗಿನ್',
    'login.patient': 'ರೋಗಿ', 'login.clinician': 'ವೈದ್ಯ', 'login.patientSignin': 'ರೋಗಿ ಸೈನ್ ಇನ್', 'login.clinicianSignin': 'ವೈದ್ಯ ಸೈನ್ ಇನ್',
    'login.phone': 'ಫೋನ್ ಸಂಖ್ಯೆ', 'login.sendCode': 'ಕೋಡ್ ಕಳುಹಿಸಿ', 'login.enterCode': '6-ಅಂಕಿಯ ಕೋಡ್ ನಮೂದಿಸಿ', 'login.verify': 'ಪರಿಶೀಲಿಸಿ',
    'login.differentNumber': 'ಬೇರೆ ಸಂಖ್ಯೆ ಬಳಸಿ', 'login.demoCode': 'ಡೆಮೊ ಕೋಡ್: 123456',
    'onboard.title': 'ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ಪೂರ್ಣಗೊಳಿಸಿ', 'onboard.iam': 'ನಾನು', 'onboard.patient': 'ರೋಗಿ', 'onboard.doctor': 'ವೈದ್ಯ',
    'onboard.name': 'ಪೂರ್ಣ ಹೆಸರು', 'onboard.phone': 'ಫೋನ್ ಸಂಖ್ಯೆ', 'onboard.hospital': 'ಆಸ್ಪತ್ರೆ', 'onboard.language': 'ಇಷ್ಟದ ಭಾಷೆ',
    'onboard.continue': 'ಮುಂದುವರಿಯಿರಿ', 'onboard.hint': 'ಒಂದೇ ಆಸ್ಪತ್ರೆಯ ರೋಗಿಗಳು ಮತ್ತು ವೈದ್ಯರು ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಸಂಪರ್ಕಗೊಳ್ಳುತ್ತಾರೆ.',
    'patient.greeting': 'ನಮಸ್ಕಾರ', 'patient.subtitle': 'ಆರ್ಯಾ ಯಾವಾಗಲೂ ನಿಮ್ಮ ಸಹಾಯಕ್ಕೆ ಇದ್ದಾಳೆ.',
    'patient.call': 'ಆರ್ಯಾಗೆ ಕರೆ ಮಾಡಿ', 'patient.callHint': 'ಔಷಧಿ, ಆಹಾರ ಮತ್ತು ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಬಗ್ಗೆ ಮಾತನಾಡಿ',
    'patient.chat': 'ಆರ್ಯಾ ಜೊತೆ ಚಾಟ್', 'patient.ask': 'ನಿಮ್ಮ ಭಾಷೆಯಲ್ಲಿ ಕೇಳಿ…', 'patient.upload': 'ವರದಿ ಅಪ್‌ಲೋಡ್',
    'patient.medicines': 'ನಿಮ್ಮ ಔಷಧಿಗಳು', 'patient.book': 'ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಬುಕ್ ಮಾಡಿ', 'patient.pickDay': 'ದಿನ ಆಯ್ಕೆಮಾಡಿ, ನಂತರ ಸಮಯ.',
    'patient.nextAppt': 'ಮುಂದಿನ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್', 'patient.documents': 'ನಿಮ್ಮ ದಾಖಲೆಗಳು', 'patient.history': 'ಚಾಟ್ ಇತಿಹಾಸ',
    'call.mute': 'ಮ್ಯೂಟ್', 'call.unmute': 'ಅನ್‌ಮ್ಯೂಟ್', 'call.speaker': 'ಸ್ಪೀಕರ್', 'call.connecting': 'ಸಂಪರ್ಕಿಸಲಾಗುತ್ತಿದೆ…',
    'doctor.patients': 'ರೋಗಿಗಳು', 'doctor.schedule': 'ಮುಂಬರುವ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್', 'doctor.prescription': 'ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್',
    'doctor.conversations': 'ಆರ್ಯಾ ಜೊತೆ ಸಂಭಾಷಣೆ', 'doctor.appointments': 'ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್‌ಗಳು', 'doctor.callReviews': 'ಕರೆ ಮತ್ತು ಚಾಟ್ ವಿಮರ್ಶೆ',
    'doctor.respondedCorrectly': 'ಆರ್ಯಾ ಸರಿಯಾಗಿ ಉತ್ತರಿಸಿದಳೆ?', 'doctor.yes': 'ಹೌದು', 'doctor.needsFixing': 'ಸರಿಪಡಿಸಬೇಕು',
    'doctor.saveFeedback': 'ಪ್ರತಿಕ್ರಿಯೆ ಉಳಿಸಿ', 'common.send': 'ಕಳುಹಿಸಿ', 'common.loading': 'ಲೋಡ್ ಆಗುತ್ತಿದೆ…',
  },
  ta: {
    'nav.myCare': 'என் பராமரிப்பு', 'nav.myPatients': 'என் நோயாளிகள்', 'nav.callReviews': 'அழைப்பு மதிப்பாய்வு',
    'nav.analytics': 'பகுப்பாய்வு', 'nav.signIn': 'உள்நுழை', 'nav.signOut': 'வெளியேறு',
    'landing.google': 'Google உடன் உள்நுழையவும்', 'landing.start': 'தொடங்கு',
    'login.welcome': 'ஆர்யாவிற்கு வரவேற்பு', 'login.google': 'Google உடன் தொடரவும்',
    'login.patient': 'நோயாளி', 'login.clinician': 'மருத்துவர்', 'login.phone': 'தொலைபேசி எண்',
    'login.sendCode': 'குறியீட்டை அனுப்பு', 'login.verify': 'சரிபார்க்கவும்', 'login.demoCode': 'டெமோ குறியீடு: 123456',
    'onboard.title': 'உங்கள் சுயவிவரத்தை நிறைவு செய்யவும்', 'onboard.name': 'முழு பெயர்', 'onboard.phone': 'தொலைபேசி எண்',
    'onboard.hospital': 'மருத்துவமனை', 'onboard.language': 'விருப்ப மொழி', 'onboard.continue': 'தொடரவும்',
    'patient.greeting': 'வணக்கம்', 'patient.subtitle': 'ஆர்யா எப்போதும் உங்களுக்கு உதவ இங்கே இருக்கிறாள்.',
    'patient.call': 'ஆர்யாவை அழைக்கவும்', 'patient.chat': 'ஆர்யாவுடன் அரட்டை', 'patient.ask': 'உங்கள் மொழியில் கேளுங்கள்…',
    'patient.upload': 'அறிக்கையை பதிவேற்று', 'patient.medicines': 'உங்கள் மருந்துகள்', 'patient.book': 'சந்திப்பை பதிவு செய்',
    'patient.nextAppt': 'அடுத்த சந்திப்பு', 'patient.documents': 'உங்கள் ஆவணங்கள்', 'patient.history': 'அரட்டை வரலாறு',
    'doctor.patients': 'நோயாளிகள்', 'doctor.prescription': 'மருந்துச்சீட்டு', 'doctor.appointments': 'சந்திப்புகள்',
    'common.send': 'அனுப்பு', 'call.mute': 'முடக்கு', 'call.speaker': 'ஸ்பீக்கர்',
  },
  te: {
    'nav.myCare': 'నా సంరక్షణ', 'nav.signOut': 'సైన్ అవుట్', 'patient.greeting': 'నమస్కారం',
    'patient.call': 'ఆర్యాకు కాల్ చేయండి', 'patient.chat': 'ఆర్యాతో చాట్', 'patient.medicines': 'మీ మందులు',
    'patient.documents': 'మీ పత్రాలు', 'patient.upload': 'నివేదికను అప్‌లోడ్ చేయండి', 'common.send': 'పంపు',
    'login.google': 'Googleతో కొనసాగించండి', 'onboard.continue': 'కొనసాగించు',
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
  return (key: string) => T[lang]?.[key] ?? EN[key] ?? key;
}
