// Offline travel phrasebook.
//
// Rules for this file:
//  * Every entry is a standard, widely used travel phrase. If a phrase could not be
//    given with confidence in a language, it is `null` rather than a guess.
//  * Where a language marks the speaker's gender or politeness level, a neutral or
//    polite form is used, with the conventional "(a)" / "/" notation where needed.
//  * Index i in every array lines up with PHRASE_IDS[i].

export const PHRASE_IDS = [
  'hello', 'morning', 'goodbye', 'please', 'thanks', 'welcome', 'yes', 'no', 'excuse', 'sorry',
  'dontunderstand', 'english', 'price', 'toilet', 'station', 'water', 'bill', 'help', 'doctor', 'canhelp',
];

const TABLE = {
  en: ['Hello', 'Good morning', 'Goodbye', 'Please', 'Thank you', "You're welcome", 'Yes', 'No', 'Excuse me', "I'm sorry",
    "I don't understand", 'Do you speak English?', 'How much is this?', 'Where is the bathroom?', 'Where is the train station?',
    'Water, please.', 'The bill, please.', 'Help!', 'I need a doctor.', 'Can you help me?'],

  es: ['Hola', 'Buenos días', 'Adiós', 'Por favor', 'Gracias', 'De nada', 'Sí', 'No', 'Disculpe', 'Lo siento',
    'No entiendo', '¿Habla inglés?', '¿Cuánto cuesta esto?', '¿Dónde está el baño?', '¿Dónde está la estación de tren?',
    'Agua, por favor.', 'La cuenta, por favor.', '¡Ayuda!', 'Necesito un médico.', '¿Puede ayudarme?'],

  fr: ['Bonjour', 'Bonjour', 'Au revoir', "S'il vous plaît", 'Merci', 'De rien', 'Oui', 'Non', 'Excusez-moi', 'Je suis désolé(e).',
    'Je ne comprends pas.', 'Parlez-vous anglais ?', "C'est combien ?", 'Où sont les toilettes ?', 'Où est la gare ?',
    "De l'eau, s'il vous plaît.", "L'addition, s'il vous plaît.", "À l'aide !", "J'ai besoin d'un médecin.", "Pouvez-vous m'aider ?"],

  de: ['Hallo', 'Guten Morgen', 'Auf Wiedersehen', 'Bitte', 'Danke', 'Gern geschehen', 'Ja', 'Nein', 'Entschuldigung', 'Es tut mir leid.',
    'Ich verstehe nicht.', 'Sprechen Sie Englisch?', 'Wie viel kostet das?', 'Wo ist die Toilette?', 'Wo ist der Bahnhof?',
    'Wasser, bitte.', 'Die Rechnung, bitte.', 'Hilfe!', 'Ich brauche einen Arzt.', 'Können Sie mir helfen?'],

  it: ['Ciao', 'Buongiorno', 'Arrivederci', 'Per favore', 'Grazie', 'Prego', 'Sì', 'No', 'Mi scusi', 'Mi dispiace.',
    'Non capisco.', 'Parla inglese?', 'Quanto costa questo?', "Dov'è il bagno?", "Dov'è la stazione ferroviaria?",
    'Acqua, per favore.', 'Il conto, per favore.', 'Aiuto!', 'Ho bisogno di un medico.', 'Può aiutarmi?'],

  pt: ['Olá', 'Bom dia', 'Tchau', 'Por favor', 'Obrigado(a)', 'De nada', 'Sim', 'Não', 'Com licença', 'Desculpe.',
    'Não entendo.', 'Você fala inglês?', 'Quanto custa isto?', 'Onde fica o banheiro?', 'Onde fica a estação de trem?',
    'Água, por favor.', 'A conta, por favor.', 'Socorro!', 'Preciso de um médico.', 'Pode me ajudar?'],

  nl: ['Hallo', 'Goedemorgen', 'Tot ziens', 'Alstublieft', 'Dank u wel', 'Graag gedaan', 'Ja', 'Nee', 'Pardon', 'Het spijt me.',
    'Ik begrijp het niet.', 'Spreekt u Engels?', 'Hoeveel kost dit?', 'Waar is het toilet?', 'Waar is het treinstation?',
    'Water, alstublieft.', 'De rekening, alstublieft.', 'Help!', 'Ik heb een dokter nodig.', 'Kunt u mij helpen?'],

  sv: ['Hej', 'God morgon', 'Hej då', 'Snälla', 'Tack', 'Varsågod', 'Ja', 'Nej', 'Ursäkta', 'Förlåt.',
    'Jag förstår inte.', 'Talar du engelska?', 'Hur mycket kostar det här?', 'Var är toaletten?', 'Var är tågstationen?',
    'Vatten, tack.', 'Notan, tack.', 'Hjälp!', 'Jag behöver en läkare.', 'Kan du hjälpa mig?'],

  da: ['Hej', 'Godmorgen', 'Farvel', 'Vær så venlig', 'Tak', 'Det var så lidt', 'Ja', 'Nej', 'Undskyld', 'Beklager.',
    'Jeg forstår ikke.', 'Taler du engelsk?', 'Hvor meget koster det?', 'Hvor er toilettet?', 'Hvor er banegården?',
    'Vand, tak.', 'Regningen, tak.', 'Hjælp!', 'Jeg har brug for en læge.', 'Kan du hjælpe mig?'],

  no: ['Hei', 'God morgen', 'Ha det bra', 'Vær så snill', 'Takk', 'Ingen årsak', 'Ja', 'Nei', 'Unnskyld', 'Beklager.',
    'Jeg forstår ikke.', 'Snakker du engelsk?', 'Hvor mye koster dette?', 'Hvor er toalettet?', 'Hvor er togstasjonen?',
    'Vann, takk.', 'Regningen, takk.', 'Hjelp!', 'Jeg trenger en lege.', 'Kan du hjelpe meg?'],

  fi: ['Hei', 'Hyvää huomenta', 'Näkemiin', 'Ole hyvä', 'Kiitos', 'Eipä kestä', 'Kyllä', 'Ei', 'Anteeksi', 'Olen pahoillani.',
    'En ymmärrä.', 'Puhutko englantia?', 'Paljonko tämä maksaa?', 'Missä on vessa?', 'Missä on rautatieasema?',
    'Vettä, kiitos.', 'Lasku, kiitos.', 'Apua!', 'Tarvitsen lääkärin.', 'Voitko auttaa minua?'],

  pl: ['Cześć', 'Dzień dobry', 'Do widzenia', 'Proszę', 'Dziękuję', 'Nie ma za co', 'Tak', 'Nie', 'Przepraszam', 'Przykro mi.',
    'Nie rozumiem.', 'Czy mówisz po angielsku?', 'Ile to kosztuje?', 'Gdzie jest toaleta?', 'Gdzie jest dworzec kolejowy?',
    'Wodę, poproszę.', 'Rachunek, poproszę.', 'Pomocy!', 'Potrzebuję lekarza.', 'Czy możesz mi pomóc?'],

  cs: ['Dobrý den', 'Dobré ráno', 'Na shledanou', 'Prosím', 'Děkuji', 'Není zač', 'Ano', 'Ne', 'Promiňte', 'Omlouvám se.',
    'Nerozumím.', 'Mluvíte anglicky?', 'Kolik to stojí?', 'Kde jsou toalety?', 'Kde je nádraží?',
    'Vodu, prosím.', 'Účet, prosím.', 'Pomoc!', 'Potřebuji lékaře.', 'Můžete mi pomoci?'],

  ro: ['Bună ziua', 'Bună dimineața', 'La revedere', 'Vă rog', 'Mulțumesc', 'Cu plăcere', 'Da', 'Nu', 'Scuzați-mă', 'Îmi pare rău.',
    'Nu înțeleg.', 'Vorbiți engleză?', 'Cât costă asta?', 'Unde este toaleta?', 'Unde este gara?',
    'Apă, vă rog.', 'Nota de plată, vă rog.', 'Ajutor!', 'Am nevoie de un medic.', 'Mă puteți ajuta?'],

  hu: ['Szia', 'Jó reggelt', 'Viszontlátásra', 'Kérem', 'Köszönöm', 'Szívesen', 'Igen', 'Nem', 'Elnézést', 'Sajnálom.',
    'Nem értem.', 'Beszél angolul?', 'Mennyibe kerül ez?', 'Hol van a mosdó?', 'Hol van a vasútállomás?',
    'Vizet kérek.', 'A számlát kérem.', 'Segítség!', 'Orvosra van szükségem.', 'Tudna nekem segíteni?'],

  ru: ['Здравствуйте', 'Доброе утро', 'До свидания', 'Пожалуйста', 'Спасибо', 'Не за что', 'Да', 'Нет', 'Извините', 'Простите.',
    'Я не понимаю.', 'Вы говорите по-английски?', 'Сколько это стоит?', 'Где туалет?', 'Где вокзал?',
    'Воды, пожалуйста.', 'Счёт, пожалуйста.', 'Помогите!', 'Мне нужен врач.', 'Вы можете мне помочь?'],

  uk: ['Добрий день', 'Доброго ранку', 'До побачення', 'Будь ласка', 'Дякую', 'Нема за що', 'Так', 'Ні', 'Вибачте', 'Мені шкода.',
    'Я не розумію.', 'Ви говорите англійською?', 'Скільки це коштує?', 'Де туалет?', 'Де вокзал?',
    'Води, будь ласка.', 'Рахунок, будь ласка.', 'Допоможіть!', 'Мені потрібен лікар.', 'Ви можете мені допомогти?'],

  tr: ['Merhaba', 'Günaydın', 'Hoşça kalın', 'Lütfen', 'Teşekkür ederim', 'Rica ederim', 'Evet', 'Hayır', 'Affedersiniz', 'Özür dilerim.',
    'Anlamıyorum.', 'İngilizce biliyor musunuz?', 'Bu ne kadar?', 'Tuvalet nerede?', 'Tren istasyonu nerede?',
    'Su, lütfen.', 'Hesap, lütfen.', 'Yardım edin!', 'Bir doktora ihtiyacım var.', 'Bana yardım edebilir misiniz?'],

  el: ['Γεια σας', 'Καλημέρα', 'Αντίο', 'Παρακαλώ', 'Ευχαριστώ', 'Παρακαλώ', 'Ναι', 'Όχι', 'Με συγχωρείτε', 'Συγγνώμη.',
    'Δεν καταλαβαίνω.', 'Μιλάτε αγγλικά;', 'Πόσο κοστίζει αυτό;', 'Πού είναι η τουαλέτα;', 'Πού είναι ο σιδηροδρομικός σταθμός;',
    'Νερό, παρακαλώ.', 'Τον λογαριασμό, παρακαλώ.', 'Βοήθεια!', 'Χρειάζομαι γιατρό.', 'Μπορείτε να με βοηθήσετε;'],

  ar: ['مرحبًا', 'صباح الخير', 'مع السلامة', 'من فضلك', 'شكرًا', 'عفوًا', 'نعم', 'لا', 'المعذرة', 'أعتذر.',
    'أنا لا أفهم.', 'هل تتحدث الإنجليزية؟', 'كم سعر هذا؟', 'أين دورة المياه؟', 'أين محطة القطار؟',
    'ماء، من فضلك.', 'الحساب، من فضلك.', 'النجدة!', 'أحتاج إلى طبيب.', 'هل يمكنك مساعدتي؟'],

  he: ['שלום', 'בוקר טוב', 'להתראות', 'בבקשה', 'תודה', 'על לא דבר', 'כן', 'לא', 'סליחה', 'אני מצטער/ת.',
    'אני לא מבין/ה.', 'אתם מדברים אנגלית?', 'כמה זה עולה?', 'איפה השירותים?', 'איפה תחנת הרכבת?',
    'מים, בבקשה.', 'החשבון, בבקשה.', 'הצילו!', 'אני צריך/ה רופא.', 'אתם יכולים לעזור לי?'],

  hi: ['नमस्ते', 'सुप्रभात', 'अलविदा', 'कृपया', 'धन्यवाद', 'आपका स्वागत है', 'हाँ', 'नहीं', 'माफ़ कीजिए', 'मुझे खेद है।',
    'मुझे समझ नहीं आ रहा है।', 'क्या आप अंग्रेज़ी बोलते हैं?', 'यह कितने का है?', 'शौचालय कहाँ है?', 'रेलवे स्टेशन कहाँ है?',
    'कृपया पानी दीजिए।', 'कृपया बिल दीजिए।', 'मदद कीजिए!', 'मुझे डॉक्टर की ज़रूरत है।', 'क्या आप मेरी मदद कर सकते हैं?'],

  zh: ['你好', '早上好', '再见', '请', '谢谢', '不客气', '是的', '不是', '打扰一下', '对不起。',
    '我不明白。', '你会说英语吗？', '这个多少钱？', '洗手间在哪里？', '火车站在哪里？',
    '请给我水。', '请结账。', '救命！', '我需要医生。', '你能帮我吗？'],

  ja: ['こんにちは', 'おはようございます', 'さようなら', 'お願いします', 'ありがとうございます', 'どういたしまして', 'はい', 'いいえ', 'すみません', 'ごめんなさい。',
    'わかりません。', '英語を話せますか？', 'これはいくらですか？', 'トイレはどこですか？', '駅はどこですか？',
    'お水をください。', 'お会計をお願いします。', '助けて！', '医者が必要です。', '手伝っていただけますか？'],

  ko: ['안녕하세요', '좋은 아침이에요', '안녕히 계세요', '부탁드립니다', '감사합니다', '천만에요', '네', '아니요', '실례합니다', '죄송합니다.',
    '이해하지 못했어요.', '영어 하실 수 있으세요?', '이거 얼마예요?', '화장실이 어디예요?', '기차역이 어디예요?',
    '물 좀 주세요.', '계산서 주세요.', '도와주세요!', '의사가 필요해요.', '저를 도와주시겠어요?'],

  vi: ['Xin chào', 'Chào buổi sáng', 'Tạm biệt', 'Làm ơn', 'Cảm ơn', 'Không có gì', 'Vâng', 'Không', 'Xin lỗi', 'Tôi xin lỗi.',
    'Tôi không hiểu.', 'Bạn có nói tiếng Anh không?', 'Cái này giá bao nhiêu?', 'Nhà vệ sinh ở đâu?', 'Ga tàu ở đâu?',
    'Làm ơn cho tôi nước.', 'Làm ơn tính tiền.', 'Cứu với!', 'Tôi cần bác sĩ.', 'Bạn có thể giúp tôi không?'],

  th: ['สวัสดีครับ/ค่ะ', 'อรุณสวัสดิ์', 'ลาก่อน', 'กรุณา', 'ขอบคุณครับ/ค่ะ', 'ยินดีครับ/ค่ะ', 'ใช่', 'ไม่', 'ขอโทษครับ/ค่ะ', 'ขออภัยครับ/ค่ะ',
    'ไม่เข้าใจครับ/ค่ะ', 'คุณพูดภาษาอังกฤษได้ไหม', 'อันนี้ราคาเท่าไหร่', 'ห้องน้ำอยู่ที่ไหน', 'สถานีรถไฟอยู่ที่ไหน',
    'ขอน้ำหน่อยครับ/ค่ะ', 'เช็คบิลด้วยครับ/ค่ะ', 'ช่วยด้วย!', 'ต้องการหมอครับ/ค่ะ', 'ช่วยหน่อยได้ไหมครับ/คะ'],

  id: ['Halo', 'Selamat pagi', 'Sampai jumpa', 'Tolong', 'Terima kasih', 'Sama-sama', 'Ya', 'Tidak', 'Permisi', 'Maaf.',
    'Saya tidak mengerti.', 'Apakah Anda bisa berbahasa Inggris?', 'Berapa harganya?', 'Di mana toilet?', 'Di mana stasiun kereta?',
    'Minta air putih, tolong.', 'Minta bonnya, tolong.', 'Tolong!', 'Saya butuh dokter.', 'Bisakah Anda membantu saya?'],

  sw: ['Hujambo', 'Habari za asubuhi', 'Kwaheri', 'Tafadhali', 'Asante', 'Karibu', 'Ndiyo', 'Hapana', 'Samahani', 'Nisamehe.',
    'Sielewi.', 'Unazungumza Kiingereza?', 'Hii ni bei gani?', 'Choo kiko wapi?', 'Kituo cha treni kiko wapi?',
    'Naomba maji, tafadhali.', 'Naomba bili, tafadhali.', 'Msaada!', 'Ninahitaji daktari.', 'Unaweza kunisaidia?'],
};

// French typography: a no-break space before ? ! ; : so punctuation never wraps alone.
TABLE.fr = TABLE.fr.map((s) => s.replace(/ ([?!;:])/g, ' $1'));

export const PHRASEBOOK = TABLE;
