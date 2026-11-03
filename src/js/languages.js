// Supported languages and the countries that "speak" them on the globe.
// Country names match the Natural Earth names used by world-atlas (src/data/countries-110m.json).
//
//   code    ISO 639-1 code used in the UI and the phrasebook
//   chrome  BCP-47 tag handed to Chrome's on-device Translator / LanguageDetector
//   mm      code sent to MyMemory
//   speech  BCP-47 tag used to pick a speechSynthesis voice
//   home    the country the globe flies to when you pick the language from a menu

export const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English', speech: 'en-US', home: 'United Kingdom',
    countries: ['United States of America', 'United Kingdom', 'Ireland', 'Canada', 'Australia', 'New Zealand', 'Jamaica', 'Bahamas', 'Belize', 'Guyana', 'Trinidad and Tobago', 'Ghana', 'Nigeria', 'Liberia', 'Sierra Leone', 'South Africa'] },
  { code: 'es', name: 'Spanish', native: 'Español', speech: 'es-ES', home: 'Spain',
    countries: ['Spain', 'Mexico', 'Guatemala', 'Honduras', 'El Salvador', 'Nicaragua', 'Costa Rica', 'Panama', 'Cuba', 'Dominican Rep.', 'Puerto Rico', 'Colombia', 'Venezuela', 'Ecuador', 'Peru', 'Bolivia', 'Chile', 'Argentina', 'Paraguay', 'Uruguay', 'Eq. Guinea'] },
  { code: 'fr', name: 'French', native: 'Français', speech: 'fr-FR', home: 'France',
    countries: ['France', 'Belgium', 'Luxembourg', 'Haiti', 'Senegal', 'Mali', 'Niger', 'Burkina Faso', "Côte d'Ivoire", 'Guinea', 'Benin', 'Togo', 'Cameroon', 'Gabon', 'Congo', 'Dem. Rep. Congo', 'Central African Rep.', 'Chad', 'Madagascar', 'Burundi', 'Djibouti', 'New Caledonia'] },
  { code: 'de', name: 'German', native: 'Deutsch', speech: 'de-DE', home: 'Germany',
    countries: ['Germany', 'Austria', 'Switzerland'] },
  { code: 'it', name: 'Italian', native: 'Italiano', speech: 'it-IT', home: 'Italy',
    countries: ['Italy'] },
  { code: 'pt', name: 'Portuguese', native: 'Português', speech: 'pt-BR', home: 'Brazil',
    countries: ['Brazil', 'Portugal', 'Angola', 'Mozambique', 'Guinea-Bissau'] },
  { code: 'nl', name: 'Dutch', native: 'Nederlands', speech: 'nl-NL', home: 'Netherlands',
    countries: ['Netherlands', 'Suriname'] },
  { code: 'sv', name: 'Swedish', native: 'Svenska', speech: 'sv-SE', home: 'Sweden',
    countries: ['Sweden'] },
  { code: 'da', name: 'Danish', native: 'Dansk', speech: 'da-DK', home: 'Denmark',
    countries: ['Denmark'] },
  { code: 'no', name: 'Norwegian', native: 'Norsk', speech: 'nb-NO', mm: 'nb', home: 'Norway',
    countries: ['Norway'] },
  { code: 'fi', name: 'Finnish', native: 'Suomi', speech: 'fi-FI', home: 'Finland',
    countries: ['Finland'] },
  { code: 'pl', name: 'Polish', native: 'Polski', speech: 'pl-PL', home: 'Poland',
    countries: ['Poland'] },
  { code: 'cs', name: 'Czech', native: 'Čeština', speech: 'cs-CZ', home: 'Czechia',
    countries: ['Czechia'] },
  { code: 'ro', name: 'Romanian', native: 'Română', speech: 'ro-RO', home: 'Romania',
    countries: ['Romania', 'Moldova'] },
  { code: 'hu', name: 'Hungarian', native: 'Magyar', speech: 'hu-HU', home: 'Hungary',
    countries: ['Hungary'] },
  { code: 'ru', name: 'Russian', native: 'Русский', speech: 'ru-RU', home: 'Russia',
    countries: ['Russia', 'Belarus', 'Kazakhstan', 'Kyrgyzstan'] },
  { code: 'uk', name: 'Ukrainian', native: 'Українська', speech: 'uk-UA', home: 'Ukraine',
    countries: ['Ukraine'] },
  { code: 'tr', name: 'Turkish', native: 'Türkçe', speech: 'tr-TR', home: 'Turkey',
    countries: ['Turkey', 'N. Cyprus'] },
  { code: 'el', name: 'Greek', native: 'Ελληνικά', speech: 'el-GR', home: 'Greece',
    countries: ['Greece', 'Cyprus'] },
  { code: 'ar', name: 'Arabic', native: 'العربية', speech: 'ar-SA', home: 'Egypt', rtl: true,
    countries: ['Egypt', 'Saudi Arabia', 'Iraq', 'Syria', 'Jordan', 'Lebanon', 'Kuwait', 'United Arab Emirates', 'Qatar', 'Oman', 'Yemen', 'Libya', 'Tunisia', 'Algeria', 'Morocco', 'W. Sahara', 'Sudan', 'Mauritania', 'Palestine'] },
  { code: 'he', name: 'Hebrew', native: 'עברית', speech: 'he-IL', home: 'Israel', rtl: true,
    countries: ['Israel'] },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', speech: 'hi-IN', home: 'India',
    countries: ['India'] },
  { code: 'zh', name: 'Chinese', native: '中文', speech: 'zh-CN', mm: 'zh-CN', home: 'China',
    countries: ['China', 'Taiwan'] },
  { code: 'ja', name: 'Japanese', native: '日本語', speech: 'ja-JP', home: 'Japan',
    countries: ['Japan'] },
  { code: 'ko', name: 'Korean', native: '한국어', speech: 'ko-KR', home: 'South Korea',
    countries: ['South Korea', 'North Korea'] },
  { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt', speech: 'vi-VN', home: 'Vietnam',
    countries: ['Vietnam'] },
  { code: 'th', name: 'Thai', native: 'ไทย', speech: 'th-TH', home: 'Thailand',
    countries: ['Thailand'] },
  { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia', speech: 'id-ID', home: 'Indonesia',
    countries: ['Indonesia'] },
  { code: 'sw', name: 'Swahili', native: 'Kiswahili', speech: 'sw-KE', home: 'Tanzania',
    countries: ['Tanzania', 'Kenya'] },
].map((l) => ({ chrome: l.code, mm: l.code, rtl: false, ...l }));

export const BY_CODE = Object.fromEntries(LANGUAGES.map((l) => [l.code, l]));

/** country name -> language code */
export const COUNTRY_LANG = (() => {
  const m = new Map();
  for (const l of LANGUAGES) for (const c of l.countries) if (!m.has(c)) m.set(c, l.code);
  return m;
})();

export const langName = (code) => BY_CODE[code]?.name ?? code.toUpperCase();
