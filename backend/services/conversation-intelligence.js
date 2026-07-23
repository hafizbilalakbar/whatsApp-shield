class ConversationIntelligence {
  constructor({ aiProviders = [], aiCallFunction = null } = {}) {
    this.aiProviders = aiProviders;
    this.aiCall = aiCallFunction;
    this.suppressionList = new Map();
    this.conversationCache = new Map();
    this.cultureProfiles = ConversationIntelligence.CULTURE_PROFILES;
    this.intentKeywords = ConversationIntelligence.INTENT_KEYWORDS;
    this.sentimentLexicon = ConversationIntelligence.SENTIMENT_LEXICON;
  }

  static INTENT_KEYWORDS = {
    greeting: {
      en: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'howdy', 'greetings'],
      es: ['hola', 'buenos días', 'buenas tardes', 'buenas noches', 'saludos'],
      fr: ['bonjour', 'salut', 'bonsoir', 'coucou', 'allô'],
      de: ['hallo', 'guten tag', 'guten morgen', 'guten abend', 'grüß gott'],
      ar: ['مرحبا', 'أهلا', 'السلام عليكم', 'صباح الخير', 'مساء الخير'],
      pt: ['olá', 'bom dia', 'boa tarde', 'boa noite', 'saudações'],
      hi: ['नमस्ते', 'नमस्कार', 'प्रणाम'],
      tr: ['merhaba', 'selam', 'iyi günler', 'günaydın', 'iyi akşamlar'],
      zh: ['你好', '您好', '早上好', '下午好', '晚上好'],
      ja: ['こんにちは', 'おはよう', 'こんばんは', 'はじめまして'],
      ko: ['안녕하세요', '안녕', '반갑습니다'],
      id: ['halo', 'hai', 'selamat pagi', 'selamat siang', 'selamat sore'],
      ur: ['السلام علیکم', 'ہیلو', 'سلام'],
      th: ['สวัสดี', 'หวัดดี']
    },
    question: {
      en: ['how', 'what', 'when', 'where', 'why', 'which', 'who', 'can you', 'could you', 'would you', 'do you', 'is there', 'are there', 'tell me', 'explain'],
      es: ['cómo', 'qué', 'cuándo', 'dónde', 'por qué', 'cuál', 'quién', 'puedes', 'podrías', 'me puedes', 'explícame'],
      fr: ['comment', 'quoi', 'quand', 'où', 'pourquoi', 'quel', 'qui', 'pouvez-vous', 'pourriez-vous', 'expliquez'],
      de: ['wie', 'was', 'wann', 'wo', 'warum', 'welcher', 'wer', 'können sie', 'könnten sie', 'erklären sie'],
      ar: ['كيف', 'ماذا', 'متى', 'أين', 'لماذا', 'أي', 'من', 'هل يمكنك', 'أخبرني'],
      pt: ['como', 'o quê', 'quando', 'onde', 'por quê', 'qual', 'quem', 'você pode', 'explique'],
      hi: ['कैसे', 'क्या', 'कब', 'कहाँ', 'क्यों', 'कौन', 'क्या आप', 'मुझे बताओ'],
      tr: ['nasıl', 'ne', 'ne zaman', 'nerede', 'neden', 'hangi', 'kim', 'siz', 'anlatın'],
      zh: ['如何', '什么', '什么时候', '哪里', '为什么', '哪个', '谁', '你能', '告诉我'],
      ja: ['どう', '何', 'いつ', 'どこ', 'なぜ', 'どれ', '誰', '教えて', 'できますか'],
      ko: ['어떻게', '무엇', '언제', '어디', '왜', '어느', '누구', '알려주세요', '할 수 있나요'],
      id: ['bagaimana', 'apa', 'kapan', 'di mana', 'mengapa', 'yang mana', 'siapa', 'bisakah', 'tolong jelaskan'],
      ur: ['کیسے', 'کیا', 'کب', 'کہاں', 'کیوں', 'کون', 'کیا آپ', 'مجھے بتائیں'],
      th: ['อย่างไร', 'อะไร', 'เมื่อไหร่', 'ที่ไหน', 'ทำไม', 'อันไหน', 'ใคร', 'ช่วยบอก', 'อธิบาย']
    },
    objection: {
      en: ['too expensive', 'cost too much', 'not interested', 'no budget', 'can\'t afford', 'already have', 'not now', 'think about it', 'not convinced', 'skeptical', 'but', 'however', 'although', 'problem is', 'issue is', 'concern is'],
      es: ['demasiado caro', 'no estoy interesado', 'no tengo presupuesto', 'ya tengo', 'ahora no', 'lo pensaré', 'no estoy convencido', 'pero', 'sin embargo', 'el problema es'],
      fr: ['trop cher', 'pas intéressé', 'pas de budget', 'j\'en ai déjà', 'pas maintenant', 'je vais y réfléchir', 'pas convaincu', 'mais', 'cependant', 'le problème c\'est'],
      de: ['zu teuer', 'nicht interessiert', 'kein Budget', 'habe ich schon', 'jetzt nicht', 'werde darüber nachdenken', 'nicht überzeugt', 'aber', 'jedoch', 'das Problem ist'],
      ar: ['مكلف جداً', 'لست مهتماً', 'لا يوجد ميزانية', 'لدي بالفعل', 'ليس الآن', 'سأفكر', 'لست مقتنعاً', 'لكن', 'مع ذلك', 'المشكلة هي'],
      pt: ['muito caro', 'não interessado', 'sem orçamento', 'já tenho', 'agora não', 'vou pensar', 'não convencido', 'mas', 'porém', 'o problema é'],
      hi: ['बहुत महंगा', 'दिलचस्पी नहीं', 'बजट नहीं', 'पहले से है', 'अभी नहीं', 'सोचूंगा', 'संतुष्ट नहीं', 'लेकिन', 'हालांकि', 'समस्या ये है'],
      tr: ['çok pahalı', 'ilgilenmiyorum', 'bütçem yok', 'zaten var', 'şimdi değil', 'düşüneceğim', ' ikna olmadım', 'ama', 'fakat', 'sorun şu'],
      zh: ['太贵了', '不感兴趣', '没有预算', '已经有了', '现在不行', '让我想想', '不确定', '但是', '问题是'],
      ja: ['高すぎる', '興味ない', '予算がない', 'もう持っている', '今はだめ', '考えさせて', '信じられない', 'しかし', '問題は'],
      ko: ['너무 비싸요', '관심 없어요', '예산 없어요', '이미 있어요', '지금은 안 돼요', '생각해볼게요', '확신이 안 들어요', '하지만', '문제는'],
      id: ['terlalu mahal', 'tidak tertarik', 'tidak ada anggaran', 'sudah punya', 'bukan sekarang', 'saya pikir dulu', 'tidak yakin', 'tapi', 'masalahnya'],
      ur: ['بہت مہنگا', 'دلچسپی نہیں', 'بجٹ نہیں', 'پہلے سے ہے', 'ابھی نہیں', 'سوچوں گا', 'یقین نہیں', 'لیکن', '؍moseeq', 'مسئلہ یہ ہے'],
      th: ['แพงเกินไป', 'ไม่สนใจ', 'ไม่มีงบ', 'มีแล้ว', 'ตอนนี้ไม่ได้', 'คิดดูก่อน', 'ไม่แน่ใจ', 'แต่', 'ปัญหาคือ']
    },
    buying_signal: {
      en: ['price', 'pricing', 'how much', 'cost', 'plan', 'plans', 'trial', 'demo', 'free trial', 'get started', 'sign up', 'order', 'purchase', 'buy', 'invest', 'roi', 'discount', 'offer', 'deal', 'onboard', 'setup', 'implementation'],
      es: ['precio', 'cuánto cuesta', 'plan', 'prueba', 'demo', 'empezar', 'registrarse', 'ordenar', 'comprar', 'inversión', 'descuento', 'oferta', 'implementación'],
      fr: ['prix', 'coût', 'combien', 'plan', 'essai', 'démo', 'commencer', 's\'inscrire', 'commander', 'acheter', 'investir', 'réduction', 'offre', 'mise en place'],
      de: ['preis', 'kosten', 'wie viel', 'plan', 'testversion', 'demo', 'anfangen', 'registrieren', 'bestellen', 'kaufen', 'investition', 'rabatt', 'angebot', 'einrichtung'],
      ar: ['سعر', 'التكلفة', 'كم', 'خطة', 'تجربة', 'عرض توضيحي', 'ابدأ', 'اشترك', 'اطلب', 'شراء', 'استثمار', 'خصم', 'عرض'],
      pt: ['preço', 'custo', 'quanto', 'plano', 'teste', 'demo', 'começar', 'cadastrar', 'pedir', 'comprar', 'investimento', 'desconto', 'oferta'],
      hi: ['कीमत', 'कितना', 'प्लान', 'ट्रायल', 'डेमो', 'शुरू करें', 'साइन अप', 'ऑर्डर', 'खरीदना', 'निवेश', 'छूट', 'ऑफर', 'सेटअप'],
      tr: ['fiyat', 'maliyet', 'kaç para', 'plan', 'deneme', 'demo', 'başlamak', 'kayıt', 'sipariş', 'satın almak', 'yatırım', 'indirim', 'teklif'],
      zh: ['价格', '多少钱', '方案', '试用', '演示', '开始', '注册', '购买', '投资', '折扣', '优惠', '部署'],
      ja: ['価格', 'いくら', '料金', 'プラン', 'トライアル', 'デモ', '始める', '登録', '注文', '購入', '投資', '割引', 'オファー', '導入'],
      ko: ['가격', '얼마', '요금', '플랜', '체험', '데모', '시작', '등록', '주문', '구매', '투자', '할인', '오퍼', '도입'],
      id: ['harga', 'biaya', 'berapa', 'paket', 'coba', 'demo', 'mulai', 'daftar', 'pesan', 'beli', 'investasi', 'diskon', 'penawaran', 'implementasi'],
      ur: ['قیمت', 'کتنا', 'پلان', 'ٹرائل', 'ڈیمو', 'شروع', 'سائن اپ', 'آرڈر', 'خریداری', 'سرمایہ کاری', 'رعایت', 'آفر'],
      th: ['ราคา', 'เท่าไหร่', 'แพ็กเกจ', 'ทดลอง', 'สาธิต', 'เริ่มต้น', 'สมัคร', 'สั่งซื้อ', 'ซื้อ', 'ลงทุน', 'ส่วนลด', 'ข้อเสนอ', 'ติดตั้ง']
    },
    information_request: {
      en: ['details', 'information', 'tell me more', 'learn more', 'about', 'features', 'benefits', 'specifications', 'comparison', 'case study', 'testimonials', 'reviews', 'how does it work', 'what do you offer'],
      es: ['detalles', 'información', 'cuéntame más', 'más sobre', 'características', 'beneficios', 'especificaciones', 'caso de éxito', 'opiniones', 'cómo funciona'],
      fr: ['détails', 'informations', 'dites-moi plus', 'en savoir plus', 'caractéristiques', 'avantages', 'spécifications', 'étude de cas', 'avis', 'comment ça marche'],
      de: ['details', 'informationen', 'erzählen sie mehr', 'mehr darüber', 'funktionen', 'vorteile', 'spezifikationen', 'fallstudie', 'bewertungen', 'wie funktioniert es'],
      ar: ['تفاصيل', 'معلومات', 'أخبرني المزيد', 'عن', 'مميزات', 'فوائد', 'مواصفات', 'دراسة حالة', 'آراء', 'كيف يعمل'],
      pt: ['detalhes', 'informações', 'me conte mais', 'sobre', 'recursos', 'benefícios', 'especificações', 'estudo de caso', 'avaliações', 'como funciona'],
      hi: ['विवरण', 'जानकारी', 'और बताओ', 'के बारे में', 'सुविधाएं', 'लाभ', 'विनिर्देश', 'केस स्टडी', 'समीक्षा', 'यह कैसे काम करता है'],
      tr: ['detaylar', 'bilgi', 'daha fazla', 'hakkında', 'özellikler', 'faydalar', 'spesifikasyonlar', 'vaka çalışması', 'yorumlar', 'nasıl çalışır'],
      zh: ['详情', '信息', '告诉我更多', '关于', '功能', '优势', '规格', '案例', '评价', '如何运作'],
      ja: ['詳細', '情報', 'もっと教えて', 'について', '機能', '利点', '仕様', '事例', 'レビュー', 'どうやって機能する'],
      ko: ['세부정보', '정보', '더 알려주세요', '에 대해', '기능', '이점', '사양', '사례', '후기', '어떻게 작동하나요'],
      id: ['detail', 'informasi', 'ceritakan lebih lanjut', 'tentang', 'fitur', 'manfaat', 'spesifikasi', 'studi kasus', 'ulasan', 'bagaimana cara kerjanya'],
      ur: ['تفصیلات', 'معلومات', 'مزید بتائیں', 'کے بارے میں', 'خصوصیات', 'فوائد', 'تفصیلات', 'کیس اسٹڈی', 'جائزے', 'یہ کیسے کام کرتا ہے'],
      th: ['รายละเอียด', 'ข้อมูล', 'บอกเพิ่มเติม', 'เกี่ยวกับ', 'คุณสมบัติ', 'ประโยชน์', 'ข้อมูลจำเพาะ', 'กรณีศึกษา', 'รีวิว', 'มันทำงานอย่างไร']
    },
    complaint: {
      en: ['complaint', 'issue', 'problem', 'broken', 'not working', 'terrible', 'worst', 'angry', 'frustrated', 'disappointed', 'unacceptable', 'refund', 'cancel', 'escalate', 'supervisor', 'manager'],
      es: ['queja', 'problema', 'roto', 'no funciona', 'terrible', 'peor', 'enojado', 'frustrado', 'decepcionado', 'inaceptable', 'reembolso', 'cancelar', 'escalación'],
      fr: ['plainte', 'problème', 'cassé', 'ne fonctionne pas', 'terrible', 'pire', 'en colère', 'frustré', 'déçu', 'inacceptable', 'remboursement', 'annuler', 'escalade'],
      de: ['beschwerde', 'problem', 'kaputt', 'funktioniert nicht', 'schrecklich', 'schlimmste', 'wütend', 'frustriert', 'enttäuscht', 'inakzeptabel', 'erstattung', 'kündigen', 'eskalation'],
      ar: ['شكوى', 'مشكلة', 'معطل', 'لا يعمل', 'سيء', 'أسوأ', 'غاضب', 'محبط', 'خيبة أمل', 'غير مقبول', 'استرداد', 'إلغاء', 'تصعيد'],
      pt: ['reclamação', 'problema', 'quebrado', 'não funciona', 'terrível', 'pior', 'bravo', 'frustrado', 'decepcionado', 'inaceitável', 'reembolso', 'cancelar', 'escalação'],
      hi: ['शिकायत', 'समस्या', 'टूटा', 'काम नहीं कर रहा', 'बहुत बुरा', 'सबसे बुरा', 'गुस्सा', 'निराश', 'हताश', 'अस्वीकार्य', 'रिफंड', 'रद्द', 'एस्केलेट'],
      tr: ['şikayet', 'sorun', 'kırık', 'çalışmıyor', 'berbat', 'en kötü', 'kızgın', 'sinirli', 'hayal kırıklığı', 'kabul edilemez', 'iade', 'iptal', 'yukarı aktar'],
      zh: ['投诉', '问题', '坏了', '不工作', '糟糕', '最差', '生气', '沮丧', '失望', '无法接受', '退款', '取消', '升级'],
      ja: ['苦情', '問題', '壊れている', '動かない', 'ひどい', '最悪', '怒り', 'がっかり', '失望', '受け入れられない', '返金', 'キャンセル', 'エスカレーション'],
      ko: ['불만', '문제', '고장', '작동 안 함', '최악', '화남', '실망', '좌절', '接受不能', '환불', '취소', '에스컬레이션'],
      id: ['keluhan', 'masalah', 'rusak', 'tidak berfungsi', 'sangat buruk', 'paling buruk', 'marah', 'kecewa', 'kecewa', 'tidak dapat diterima', 'pengembalian', 'batalkan', 'eskalasi'],
      ur: ['شکایت', 'مسئلہ', 'ٹوٹا', 'کام نہیں کر رہا', 'بہت برا', 'سب سےبرا', 'ناراض', 'مایوس', 'نامقبول', 'واپسی', 'منسوخ', 'اعلیٰ'],
      th: ['ร้องเรียน', 'ปัญหา', 'พัง', 'ใช้งานไม่ได้', 'แย่มาก', 'แย่ที่สุด', 'โกรธ', 'ผิดหวัง', 'ผิดหวัง', 'ไม่ยอมรับ', 'คืนเงิน', 'ยกเลิก', 'escalation']
    },
    farewell: {
      en: ['bye', 'goodbye', 'see you', 'take care', 'talk later', 'gotta go', 'chat later', 'see ya', 'cya', 'later'],
      es: ['adiós', 'hasta luego', 'nos vemos', 'cuídate', 'hablamos', 'me voy', 'hasta pronto', 'chao'],
      fr: ['au revoir', 'à bientôt', 'à plus', 'take care', 'on se parle', 'je dois y aller', 'salut', 'ciao'],
      de: ['auf wiedersehen', 'tschüss', 'bis bald', 'pass auf dich auf', 'bis später', 'ciao', 'bye'],
      ar: ['مع السلامة', 'وداعا', 'إلى اللقاء', 'اعتنِ بنفسك', 'نتحدث لاحقا', 'باي'],
      pt: ['adeus', 'tchau', 'até logo', 'se cuida', 'falamos depois', 'até mais', 'até breve'],
      hi: ['अलविदा', 'फिर मिलेंगे', 'अपना ख्याल रखिए', 'बाद में बात करते हैं', 'चलता हूं'],
      tr: ['görüşürüz', 'hoşça kal', 'bay bay', 'kendine iyi bak', 'sonra görüşürüz', 'hadi görüşürüz'],
      zh: ['再见', '拜拜', '保重', '下次见', '回头聊', '走了'],
      ja: ['さようなら', 'じゃあね', 'またね', '気をつけて', '後でまた', 'また明日'],
      ko: ['안녕히 가세요', '잘 지내세요', '나중에 봐요', '또 만나요', '갈게요'],
      id: ['selamat tinggal', 'sampai jumpa', 'dadah', 'hati-hati', 'nanti kita bicara lagi', 'aku harus pergi'],
      ur: ['خدا حافظ', 'اللہ حافظ', 'پھر ملیں گے', 'اپنا خیال رکھیں', 'بعد میں بات کرتے ہیں'],
      th: ['ลาก่อน', 'บาย', 'ดูแลตัวด้วย', 'ค่อยคุยกัน', 'ไปก่อนนะ']
    },
    opt_out: {
      en: ['unsubscribe', 'opt out', 'stop', 'remove me', 'don\'t contact', 'no more messages', 'leave me alone', 'block', 'do not disturb', 'dnd', 'stop messaging', 'take me off'],
      es: ['cancelar suscripción', 'darse de baja', 'para', 'elimíname', 'no contactes', 'sin más mensajes', 'déjame en paz', 'bloquear', 'no molestar', 'no me escribas'],
      fr: ['se désinscrire', 'se désabonner', 'arrêter', 'enlevez-moi', 'ne pas contacter', 'plus de messages', 'laissez-moi tranquille', 'bloquer', 'ne pas déranger', 'arrêtez'],
      de: ['abmelden', 'abbestellen', 'stopp', 'entfernen sie mich', 'nicht kontaktieren', 'keine nachrichten', 'lassen sie mich in ruhe', 'blockieren', 'nicht stören'],
      ar: ['إلغاء الاشتراك', 'توقف', 'امسحني', 'لا تتواصل', 'بدون رسائل', 'اتركني وحدي', 'حظر', 'لا تزعجني', 'العدم إزعاج'],
      pt: ['cancelar inscrição', 'descadastrar', 'parar', 'me remova', 'não entre em contato', 'sem mais mensagens', 'me deixe em paz', 'bloquear', 'não perturbe'],
      hi: ['अनसब्सक्राइब', 'ऑप्ट आउट', 'रुको', 'मुझे हटाओ', 'संपर्क मत करो', 'और मैसेज मत भेजो', 'मुझे अकेला छोड़ो', 'ब्लॉक', 'डू नॉट डिस्टर्ब'],
      tr: ['abonelikten çık', 'iptal et', 'dur', 'beni çıkar', 'iletişim kurma', 'daha fazla mesaj yok', 'bırak beni', 'engelle', 'rahatsız etme'],
      zh: ['退订', '取消订阅', '停止', '把我移除', '不要再联系', '不要再发消息', '别烦我', '拉黑', '请勿打扰'],
      ja: ['解除', '退会', 'やめて', '外して', '連絡しないで', 'もうメッセージないで', '放っておいて', 'ブロック', '邪魔しないで'],
      ko: ['구독 취소', '탈퇴', '중지', '제거해주세요', '연락하지 마세요', '더 이상 메시지 없음', '내버려 두세요', '차단', '방해하지 마세요'],
      id: ['berhenti berlangganan', 'keluar', 'stop', 'hapus saya', 'jangan hubungi', 'jangan kirim pesan', 'biarkan saya sendiri', 'blokir', 'jangan ganggu'],
      ur: ['ان سبسکرائب', 'روکیں', 'مجھے ہٹائیں', 'رابطہ نہ کریں', 'مزید پیغام نہ بھیجیں', 'مجھے چھوڑیں', 'بلاک', 'پریشان نہ کریں'],
      th: ['ยกเลิก', 'หยุด', 'ลบฉันออก', 'อย่าติดต่อ', 'ไม่ต้องส่งข้อความ', 'ปล่อยฉัน', 'บล็อก', 'อย่ารบกวน']
    }
  };

  static SENTIMENT_LEXICON = {
    positive: {
      en: ['great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'happy', 'pleased', 'thank', 'thanks', 'perfect', 'awesome', 'brilliant', 'good', 'nice', 'best', 'helpful', 'impressive', 'outstanding', 'superb'],
      es: ['genial', 'excelente', 'increíble', 'maravilloso', 'fantástico', 'amo', 'feliz', 'agradecido', 'gracias', 'perfecto', 'bueno', 'mejor', 'útil', 'impresionante'],
      fr: ['génial', 'excellent', 'incroyable', 'merveilleux', 'fantastique', 'adore', 'heureux', 'merci', 'parfait', 'bon', 'meilleur', 'utile', 'impressionnant'],
      de: ['großartig', 'ausgezeichnet', 'erstaunlich', 'wunderbar', 'fantastisch', 'liebe', 'glücklich', 'danke', 'perfekt', 'gut', 'beste', 'hilfreich', 'beeindruckend'],
      ar: ['رائع', 'ممتاز', 'مذهل', 'جميل', 'fantastik', 'أحب', 'سعيد', 'شكرا', 'مثالي', 'جيد', 'أفضل', 'مفيد'],
      pt: ['ótimo', 'excelente', 'incrível', 'maravilhoso', 'fantástico', 'amo', 'feliz', 'obrigado', 'perfeito', 'bom', 'melhor', 'útil'],
      hi: ['बहुत अच्छा', 'शानदार', 'अद्भुत', 'खुश', 'धन्यवाद', 'परफेक्ट', 'बेस्ट', 'मददगार', 'प्रभावशाली'],
      tr: ['harika', 'mükemmel', 'muhteşem', 'harika', 'fantastik', 'seviyorum', 'mutlu', 'teşekkürler', 'mükemmel', 'en iyi', 'faydalı'],
      zh: ['太棒了', '优秀', '惊人', '完美', '喜欢', '开心', '谢谢', '最好', '有帮助', '印象深刻'],
      ja: ['素晴らしい', '最高', '素敵', '完璧', '嬉しい', 'ありがとう', '良い', '最良', '役立つ', '印象的'],
      ko: ['훌륭해요', '최고', '대단해요', '완벽해요', '좋아요', '기뻐요', '감사합니다', '최고', '도움이 됩니다'],
      id: ['bagus', 'hebat', 'luar biasa', 'sempurna', 'senang', 'terima kasih', 'terbaik', 'membantu', 'mengesankan'],
      ur: ['بہت اچھا', 'شاندار', 'حیران کن', 'خوش', 'شکریہ', 'کمال', 'بہترین', 'مددگار'],
      th: ['ดีมาก', 'ยอดเยี่ยม', 'น่าทึ่ง', 'สมบูรณ์แบบ', 'ชอบ', 'มีความสุข', 'ขอบคุณ', 'ดีที่สุด', 'มีประโยชน์']
    },
    negative: {
      en: ['bad', 'terrible', 'awful', 'horrible', 'worst', 'hate', 'angry', 'upset', 'disappointed', 'frustrated', 'annoying', 'useless', 'waste', 'poor', 'pathetic', 'ridiculous', 'stupid', 'ugly'],
      es: ['malo', 'terrible', 'horrible', 'peor', 'odio', 'enojado', 'molesto', 'decepcionado', 'frustrado', 'molesto', 'inútil', 'desperdicio', 'pobre', 'patético'],
      fr: ['mauvais', 'terrible', 'affreux', 'horrible', 'pire', 'déteste', 'en colère', 'contrarié', 'déçu', 'frustré', 'ennuyeux', 'inutile', 'gâchis', 'pauvre'],
      de: ['schlecht', 'schrecklich', 'furchtbar', 'grausam', 'schlimmste', 'hasse', 'wütend', 'verärgert', 'enttäuscht', 'frustriert', 'ärgerlich', 'nutzlos', 'verschwendung'],
      ar: ['سيء', 'رائع', 'مروع', 'فظيع', 'أسوأ', 'أكره', 'غاضب', 'منزعج', 'خائب', 'محبط', 'مزعج', 'عديم الفائدة'],
      pt: ['ruim', 'terrível', 'horrível', 'horroroso', 'pior', 'odeio', 'bravo', 'chateado', 'decepcionado', 'frustrado', 'chato', 'inútil', 'desperdício'],
      hi: ['बुरा', 'भयानक', 'खराब', 'सबसे बुरा', 'नफरत', 'गुस्सा', 'परेशान', 'निराश', 'हताश', 'बेकार', 'बर्बादी'],
      tr: ['kötü', 'berbat', 'korkunç', 'en kötü', 'nefret', 'kızgın', 'kızgın', 'hayal kırıklığı', 'sinir bozucu', 'işe yaramaz', 'boşa harcanan'],
      zh: ['糟糕', '可怕', '糟糕', '最差', '讨厌', '生气', '难过', '失望', '沮丧', '烦人', '没用', '浪费'],
      ja: ['悪い', 'ひどい', '最悪', '嫌い', '怒り', 'がっかり', 'イライラ', '無意味', 'バカバカしい'],
      ko: ['나빠요', '최악', '끔찍해요', '화나요', '실망', '짜증', '무의미해요', '쓸모없어요'],
      id: ['buruk', 'mengerikan', 'terburuk', 'benci', 'marah', 'kecewa', 'frustrasi', 'menyebalkan', 'tidak berguna'],
      ur: ['برا', 'خوفناک', 'بدترین', 'نفرت', 'ناراض', 'پریشان', 'مایوس', 'بیکار', 'تباہ کاری'],
      th: ['แย่', 'น่ากลัว', 'แย่ที่สุด', 'เกลียด', 'โกรธ', 'ผิดหวัง', 'หงุดหงิด', 'ไม่มีประโยชน์', 'เสียเปล่า']
    }
  };

  static CULTURE_PROFILES = {
    US: { formality: 'casual', greetingStyle: 'direct', communicationPace: 'fast', timezone: 'America/New_York', holidays: { '01-01': 'New Year\'s Day', '07-04': 'Independence Day', '12-25': 'Christmas' }, businessHours: { start: 9, end: 17 }, responseExpectation: 'within 24h' },
    GB: { formality: 'polite', greetingStyle: 'reserved', communicationPace: 'moderate', timezone: 'Europe/London', holidays: { '01-01': 'New Year\'s Day', '12-25': 'Christmas', '12-26': 'Boxing Day' }, businessHours: { start: 9, end: 17 }, responseExpectation: 'within 24h' },
    DE: { formality: 'formal', greetingStyle: 'reserved', communicationPace: 'moderate', timezone: 'Europe/Berlin', holidays: { '01-01': 'New Year\'s Day', '10-03': 'German Unity Day', '12-25': 'Christmas' }, businessHours: { start: 8, end: 17 }, responseExpectation: 'within 48h' },
    FR: { formality: 'formal', greetingStyle: 'polite', communicationPace: 'moderate', timezone: 'Europe/Paris', holidays: { '01-01': 'New Year\'s Day', '07-14': 'Bastille Day', '12-25': 'Christmas' }, businessHours: { start: 9, end: 18 }, responseExpectation: 'within 48h' },
    JP: { formality: 'very_formal', greetingStyle: 'indirect', communicationPace: 'slow', timezone: 'Asia/Tokyo', holidays: { '01-01': 'New Year\'s Day', '05-05': 'Children\'s Day', '12-23': 'Emperor\'s Birthday' }, businessHours: { start: 9, end: 18 }, responseExpectation: 'within 24h' },
    CN: { formality: 'formal', greetingStyle: 'respectful', communicationPace: 'moderate', timezone: 'Asia/Shanghai', holidays: { '01-01': 'New Year\'s Day', '01-29': 'Chinese New Year', '10-01': 'National Day' }, businessHours: { start: 9, end: 18 }, responseExpectation: 'within 24h' },
    IN: { formality: 'polite', greetingStyle: 'warm', communicationPace: 'moderate', timezone: 'Asia/Kolkata', holidays: { '01-26': 'Republic Day', '08-15': 'Independence Day', '10-02': 'Gandhi Jayanti' }, businessHours: { start: 9, end: 18 }, responseExpectation: 'within 24h' },
    BR: { formality: 'casual', greetingStyle: 'warm', communicationPace: 'relaxed', timezone: 'America/Sao_Paulo', holidays: { '01-01': 'New Year\'s Day', '09-07': 'Independence Day', '12-25': 'Christmas' }, businessHours: { start: 9, end: 18 }, responseExpectation: 'within 24h' },
    TR: { formality: 'polite', greetingStyle: 'warm', communicationPace: 'moderate', timezone: 'Europe/Istanbul', holidays: { '01-01': 'New Year\'s Day', '04-23': 'National Sovereignty Day', '08-30': 'Victory Day' }, businessHours: { start: 9, end: 18 }, responseExpectation: 'within 24h' },
    AE: { formality: 'formal', greetingStyle: 'warm', communicationPace: 'moderate', timezone: 'Asia/Dubai', holidays: { '12-02': 'National Day', '06-15': 'Eid al-Fitr', '08-22': 'Eid al-Adha' }, businessHours: { start: 9, end: 17 }, responseExpectation: 'within 24h' },
    SA: { formality: 'very_formal', greetingStyle: 'warm', communicationPace: 'moderate', timezone: 'Asia/Riyadh', holidays: { '09-23': 'National Day', '06-15': 'Eid al-Fitr', '08-22': 'Eid al-Adha' }, businessHours: { start: 9, end: 17 }, responseExpectation: 'within 24h' },
    PK: { formality: 'formal', greetingStyle: 'warm', communicationPace: 'moderate', timezone: 'Asia/Karachi', holidays: { '03-23': 'Pakistan Day', '08-14': 'Independence Day', '12-25': 'Christmas' }, businessHours: { start: 9, end: 17 }, responseExpectation: 'within 24h' },
    NG: { formality: 'casual', greetingStyle: 'warm', communicationPace: 'relaxed', timezone: 'Africa/Lagos', holidays: { '10-01': 'Independence Day', '12-25': 'Christmas', '06-12': 'Democracy Day' }, businessHours: { start: 8, end: 17 }, responseExpectation: 'within 24h' },
    MX: { formality: 'casual', greetingStyle: 'warm', communicationPace: 'relaxed', timezone: 'America/Mexico_City', holidays: { '05-05': 'Cinco de Mayo', '09-16': 'Independence Day', '12-25': 'Christmas' }, businessHours: { start: 9, end: 18 }, responseExpectation: 'within 24h' },
    ZA: { formality: 'casual', greetingStyle: 'warm', communicationPace: 'moderate', timezone: 'Africa/Johannesburg', holidays: { '03-21': 'Human Rights Day', '04-27': 'Freedom Day', '12-25': 'Christmas' }, businessHours: { start: 8, end: 17 }, responseExpectation: 'within 24h' },
    KR: { formality: 'very_formal', greetingStyle: 'respectful', communicationPace: 'fast', timezone: 'Asia/Seoul', holidays: { '01-01': 'New Year\'s Day', '02-01': 'Korean New Year', '10-03': 'National Foundation Day' }, businessHours: { start: 9, end: 18 }, responseExpectation: 'within 24h' },
    ID: { formality: 'polite', greetingStyle: 'warm', communicationPace: 'moderate', timezone: 'Asia/Jakarta', holidays: { '08-17': 'Independence Day', '06-15': 'Eid al-Fitr', '08-22': 'Eid al-Adha' }, businessHours: { start: 8, end: 17 }, responseExpectation: 'within 24h' },
    EG: { formality: 'formal', greetingStyle: 'warm', communicationPace: 'moderate', timezone: 'Africa/Cairo', holidays: { '01-07': 'Coptic Christmas', '04-25': 'Sinai Liberation Day', '06-15': 'Eid al-Fitr' }, businessHours: { start: 9, end: 17 }, responseExpectation: 'within 24h' },
    default: { formality: 'polite', greetingStyle: 'neutral', communicationPace: 'moderate', timezone: 'UTC', holidays: {}, businessHours: { start: 9, end: 17 }, responseExpectation: 'within 24h' }
  };

  static PHONE_COUNTRY_MAP = {
    '1': 'US', '44': 'GB', '49': 'DE', '33': 'FR', '81': 'JP', '86': 'CN',
    '91': 'IN', '55': 'BR', '90': 'TR', '971': 'AE', '966': 'SA', '92': 'PK',
    '234': 'NG', '52': 'MX', '27': 'ZA', '82': 'KR', '62': 'ID', '20': 'EG'
  };

  static CONVERSATION_STAGES = {
    NEW: 'new',
    INTRODUCTION: 'introduction',
    ENGAGED: 'engaged',
    QUALIFYING: 'qualifying',
    PROPOSAL: 'proposal',
    NEGOTIATING: 'negotiating',
    CLOSING: 'closing',
    WON: 'won',
    LOST: 'lost',
    DORMANT: 'dormant',
    RE_ENGAGING: 're_engaging'
  };

  async analyzeMessage(text, context = {}) {
    const normalizedText = (text || '').toLowerCase().trim();
    if (!normalizedText) {
      return { sentiment: { label: 'neutral', score: 0.5 }, intent: 'neutral', urgency: 'low', engagement: 'cold', topics: [] };
    }

    const detectedLanguage = context.language || this._detectLanguage(normalizedText);
    const sentiment = this._analyzeSentiment(normalizedText, detectedLanguage);
    const intent = this._classifyIntent(normalizedText, detectedLanguage, context);
    const urgency = this._assessUrgency(normalizedText, detectedLanguage, intent);
    const engagement = this._assessEngagement(normalizedText, context);
    const topics = this._extractTopics(normalizedText, detectedLanguage);

    let aiEnhanced = null;
    if (this.aiCall) {
      try {
        aiEnhanced = await this._aiAnalyzeMessage(text, context);
      } catch (e) {
        aiEnhanced = null;
      }
    }

    return {
      sentiment: aiEnhanced?.sentiment || sentiment,
      intent: aiEnhanced?.intent || intent,
      urgency: aiEnhanced?.urgency || urgency,
      engagement: aiEnhanced?.engagement || engagement,
      topics: aiEnhanced?.topics || topics,
      language: detectedLanguage,
      metadata: {
        wordCount: normalizedText.split(/\s+/).length,
        charCount: normalizedText.length,
        hasQuestion: normalizedText.includes('?'),
        hasExclamation: normalizedText.includes('!'),
        hasEmoji: /[\p{Emoji}]/u.test(normalizedText),
        hasPhone: /\+?\d{7,15}/.test(normalizedText),
        hasEmail: /[\w.-]+@[\w.-]+\.\w+/.test(normalizedText),
        hasUrl: /https?:\/\/|www\./i.test(normalizedText)
      }
    };
  }

  _detectLanguage(text) {
    const langScores = {};
    for (const [lang, keywords] of Object.entries(ConversationIntelligence.INTENT_KEYWORDS.greeting)) {
      let score = 0;
      for (const kw of keywords) {
        if (text.includes(kw)) score++;
      }
      if (score > 0) langScores[lang] = (langScores[lang] || 0) + score;
    }
    if (/[\u0600-\u06FF]/.test(text)) return 'ar';
    if (/[\u0900-\u097F]/.test(text)) return 'hi';
    if (/[\u0400-\u04FF]/.test(text)) return 'ru';
    if (/[\u4E00-\u9FFF]/.test(text)) return 'zh';
    if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'ja';
    if (/[\uAC00-\uD7AF]/.test(text)) return 'ko';
    if (/[\u0E00-\u0E7F]/.test(text)) return 'th';
    const best = Object.entries(langScores).sort((a, b) => b[1] - a[1])[0];
    return best ? best[0] : 'en';
  }

  _analyzeSentiment(text, lang) {
    const posWords = ConversationIntelligence.SENTIMENT_LEXICON.positive[lang] || ConversationIntelligence.SENTIMENT_LEXICON.positive.en;
    const negWords = ConversationIntelligence.SENTIMENT_LEXICON.negative[lang] || ConversationIntelligence.SENTIMENT_LEXICON.negative.en;
    let posCount = 0;
    let negCount = 0;
    for (const w of posWords) { if (text.includes(w)) posCount++; }
    for (const w of negWords) { if (text.includes(w)) negCount++; }
    const total = posCount + negCount || 1;
    const score = posCount / total;
    if (score >= 0.6) return { label: 'positive', score: Math.min(1, 0.6 + (posCount / total) * 0.4) };
    if (score <= 0.4) return { label: 'negative', score: Math.max(0, 0.4 - (negCount / total) * 0.4) };
    return { label: 'neutral', score: 0.5 };
  }

  _classifyIntent(text, lang, context) {
    const scores = {};
    for (const [intent, langKeywords] of Object.entries(ConversationIntelligence.INTENT_KEYWORDS)) {
      const keywords = langKeywords[lang] || langKeywords.en || [];
      let count = 0;
      for (const kw of keywords) { if (text.includes(kw)) count++; }
      scores[intent] = count;
    }
    if (context.messageCount === 0 && (scores.greeting > 0 || text.length < 30)) return 'greeting';
    if (scores.opt_out > 0) return 'opt_out';
    if (scores.complaint > 0) return 'complaint';
    if (scores.farewell > 0) return 'farewell';
    if (scores.buying_signal > 0) return 'buying_signal';
    if (scores.objection > 0) return 'objection';
    if (scores.question > 0) return 'question';
    if (scores.information_request > 0) return 'information_request';
    if (scores.greeting > 0) return 'greeting';
    return 'neutral';
  }

  _assessUrgency(text, lang, intent) {
    const urgentPatterns = {
      en: ['urgent', 'asap', 'immediately', 'right now', 'emergency', 'critical', 'deadline', 'today', 'hurry', 'rush'],
      es: ['urgente', 'ahora', 'inmediatamente', 'emergencia', 'hoy', 'rápido'],
      fr: ['urgent', 'maintenant', 'immédiatement', 'urgence', 'aujourd\'hui', 'vite'],
      de: ['dringend', 'jetzt', 'sofort', 'Notfall', 'heute', 'schnell'],
      ar: ['عاجل', 'الآن', 'فورا', 'طارئ', 'اليوم', 'بسرعة'],
      pt: ['urgente', 'agora', 'imediatamente', 'emergência', 'hoje', 'rápido'],
      hi: ['जरूरी', 'अभी', 'तुरंत', 'आज', 'जल्दी'],
      tr: ['acil', 'şimdi', 'hemen', 'bugün', 'hızlı'],
      zh: ['紧急', '马上', '立刻', '今天', '快'],
      ja: ['緊急', '今すぐ', 'すぐに', '今日', '急いで'],
      ko: ['급해요', '지금', '바로', '오늘', '빨리'],
      id: ['mendesak', 'sekarang', 'segera', 'hari ini', 'cepat'],
      ur: ['فوری', 'ابھی', 'جلدی', 'آج', 'جaldi'],
      th: ['ด่วน', 'ตอนนี้', 'ทันที', 'วันนี้', 'เร็ว']
    };
    const patterns = urgentPatterns[lang] || urgentPatterns.en;
    let urgentCount = 0;
    for (const p of patterns) { if (text.includes(p)) urgentCount++; }
    if (intent === 'complaint') urgentCount += 2;
    if (intent === 'opt_out') urgentCount += 1;
    if (urgentCount >= 3) return 'critical';
    if (urgentCount >= 2) return 'high';
    if (urgentCount >= 1) return 'medium';
    return 'low';
  }

  _assessEngagement(text, context) {
    let score = 0;
    const wordCount = text.split(/\s+/).length;
    if (wordCount >= 20) score += 3;
    else if (wordCount >= 10) score += 2;
    else if (wordCount >= 5) score += 1;
    if (text.includes('?')) score += 2;
    if (/\+?\d{7,15}/.test(text)) score += 1;
    if (/[\w.-]+@[\w.-]+\.\w+/.test(text)) score += 1;
    if (/https?:\/\//i.test(text)) score += 1;
    if (context.responseTimeMinutes !== undefined) {
      if (context.responseTimeMinutes < 5) score += 3;
      else if (context.responseTimeMinutes < 30) score += 2;
      else if (context.responseTimeMinutes < 1440) score += 1;
    }
    if ((context.messageCount || 0) >= 5) score += 2;
    else if ((context.messageCount || 0) >= 2) score += 1;
    if (score >= 7) return 'hot';
    if (score >= 4) return 'warm';
    return 'cold';
  }

  _extractTopics(text, lang) {
    const topicMap = {
      en: { pricing: ['price', 'cost', 'pricing', 'budget', 'investment', 'discount', 'offer', 'deal', 'subscription', 'plan', 'fee', 'charge', 'rate'], product: ['product', 'feature', 'service', 'solution', 'platform', 'tool', 'software', 'app', 'system', 'capability'], support: ['support', 'help', 'issue', 'problem', 'trouble', 'error', 'bug', 'fix', 'ticket', 'assistance'], implementation: ['setup', 'install', 'implement', 'deploy', 'configure', 'integration', 'onboard', 'migrate', 'training', 'launch'], competition: ['competitor', 'alternative', 'compared', 'versus', 'vs', 'better', 'difference', 'switch', 'replace'], timeline: ['timeline', 'deadline', 'when', 'how long', 'start', 'begin', 'finish', 'complete', 'schedule', 'calendar'], decision: ['decide', 'approval', 'boss', 'manager', 'team', 'stakeholder', 'committee', 'board', 'ceo', 'cfo', 'authorize'] },
      es: { pricing: ['precio', 'costo', 'presupuesto', 'inversión', 'descuento', 'oferta', 'plan', 'tarifa'], product: ['producto', 'característica', 'servicio', 'solución', 'plataforma', 'herramienta'], support: ['soporte', 'ayuda', 'problema', 'error', 'asistencia'], implementation: ['configurar', 'instalar', 'implementar', 'integrar', 'capacitación'], competition: ['competidor', 'alternativa', 'comparar', 'vs', 'diferencia'], timeline: ['plazo', 'cuándo', 'cuánto tiempo', 'cronograma'], decision: ['decidir', 'aprobación', 'jefe', 'gerente', 'equipo'] },
      fr: { pricing: ['prix', 'coût', 'budget', 'investissement', 'réduction', 'offre', 'plan', 'tarif'], product: ['produit', 'fonctionnalité', 'service', 'solution', 'plateforme', 'outil'], support: ['support', 'aide', 'problème', 'erreur', 'assistance'], implementation: ['configurer', 'installer', 'implémenter', 'intégrer', 'formation'], competition: ['concurrent', 'alternatif', 'comparer', 'différence'], timeline: ['échéance', 'quand', 'combien de temps', 'calendrier'], decision: ['décider', 'approbation', 'chef', 'manager', 'équipe'] },
      de: { pricing: ['preis', 'kosten', 'budget', 'investition', 'rabatt', 'angebot', 'plan', 'gebühr'], product: ['produkt', 'funktion', 'dienst', 'lösung', 'plattform', 'werkzeug'], support: ['support', 'hilfe', 'problem', 'fehler', 'unterstützung'], implementation: ['einrichten', 'installieren', 'implementieren', 'integrieren', 'schulung'], competition: ['konkurrent', 'alternative', 'vergleich', 'unterschied'], timeline: ['frist', 'wann', 'wie lange', 'zeitplan'], decision: ['entscheiden', 'genehmigung', 'chef', 'manager', 'team'] },
      ar: { pricing: ['سعر', 'تكلفة', 'ميزانية', 'استثمار', 'خصم', 'عرض', 'خطة'], product: ['منتج', 'ميزة', 'خدمة', 'حل', 'منصة', 'أداة'], support: ['دعم', 'مساعدة', 'مشكلة', 'خطأ', 'مساعدة'], implementation: ['إعداد', 'تثبيت', 'تطبيق', 'تكامل', 'تدريب'], competition: ['منافس', 'بديل', 'مقارنة', 'فرق'], timeline: ['موعد', 'متى', 'كم من الوقت', 'جدول'], decision: ['قرار', 'موافقة', 'رئيس', 'مدير', 'فريق'] },
      pt: { pricing: ['preço', 'custo', 'orçamento', 'investimento', 'desconto', 'oferta', 'plano'], product: ['produto', 'recurso', 'serviço', 'solução', 'plataforma', 'ferramenta'], support: ['suporte', 'ajuda', 'problema', 'erro', 'assistência'], implementation: ['configurar', 'instalar', 'implementar', 'integrar', 'treinamento'], competition: ['concorrente', 'alternativa', 'comparar', 'diferença'], timeline: ['prazo', 'quando', 'quanto tempo', 'cronograma'], decision: ['decidir', 'aprovação', 'chefe', 'gerente', 'equipe'] },
      hi: { pricing: ['कीमत', 'लागत', 'बजट', 'निवेश', 'छूट', 'प्लान'], product: ['उत्पाद', 'सुविधा', 'सेवा', 'समाधान', 'प्लेटफ़ॉर्म', 'उपकरण'], support: ['सहायता', 'मदद', 'समस्या', 'त्रुटि', 'सहायता'], implementation: ['सेटअप', 'इंस्टॉल', 'कार्यान्वयन', 'एकीकरण', 'प्रशिक्षण'], competition: ['प्रतिस्पर्धी', 'विकल्प', 'तुलना', 'अंतर'], timeline: ['समय सीमा', 'कब', 'कितना समय', 'शेड्यूल'], decision: ['निर्णय', 'अनुमोदन', 'बॉस', 'प्रबंधक', 'टीम'] },
      tr: { pricing: ['fiyat', 'maliyet', 'bütçe', 'yatırım', 'indirim', 'teklif', 'plan'], product: ['ürün', 'özellik', 'hizmet', 'çözüm', 'platform', 'araç'], support: ['destek', 'yardım', 'sorun', 'hata', 'assistance'], implementation: ['kurulum', 'yükleme', 'uygulama', 'entegrasyon', 'eğitim'], competition: ['rakip', 'alternatif', 'karşılaştırma', 'fark'], timeline: ['tarih', 'ne zaman', 'ne kadar süre', 'takvim'], decision: ['karar', 'onay', 'şef', 'yönetici', 'ekip'] },
      zh: { pricing: ['价格', '成本', '预算', '投资', '折扣', '优惠', '方案'], product: ['产品', '功能', '服务', '解决方案', '平台', '工具'], support: ['支持', '帮助', '问题', '错误', '协助'], implementation: ['设置', '安装', '实施', '集成', '培训'], competition: ['竞争对手', '替代品', '比较', '区别'], timeline: ['截止日期', '什么时候', '多长时间', '时间表'], decision: ['决定', '批准', '老板', '经理', '团队'] },
      ja: { pricing: ['価格', 'コスト', '予算', '投資', '割引', 'オファー', 'プラン'], product: ['製品', '機能', 'サービス', 'ソリューション', 'プラットフォーム', 'ツール'], support: ['サポート', 'ヘルプ', '問題', 'エラー', '支援'], implementation: ['セットアップ', 'インストール', '導入', '統合', 'トレーニング'], competition: ['競合', '代替', '比較', '違い'], timeline: ['締め切り', 'いつ', 'どのくらい', 'スケジュール'], decision: ['決定', '承認', '上司', '管理者', 'チーム'] },
      ko: { pricing: ['가격', '비용', '예산', '투자', '할인', '오퍼', '플랜'], product: ['제품', '기능', '서비스', '솔루션', '플랫폼', '도구'], support: ['지원', '도움', '문제', '오류', '도움말'], implementation: ['설치', '구현', '통합', '교육', '도입'], competition: ['경쟁사', '대안', '비교', '차이'], timeline: ['마감', '언제', '얼마나', '일정'], decision: ['결정', '승인', '상사', '관리자', '팀'] },
      id: { pricing: ['harga', 'biaya', 'anggaran', 'investasi', 'diskon', 'penawaran', 'paket'], product: ['produk', 'fitur', 'layanan', 'solusi', 'platform', 'alat'], support: ['dukungan', 'bantuan', 'masalah', 'kesalahan', 'bantuan'], implementation: ['pengaturan', 'instalasi', 'implementasi', 'integrasi', 'pelatihan'], competition: ['kompetitor', 'alternatif', 'perbandingan', 'perbedaan'], timeline: ['deadline', 'kapan', 'berapa lama', 'jadwal'], decision: ['keputusan', 'persetujuan', 'bos', 'manajer', 'tim'] },
      ur: { pricing: ['قیمت', 'لاگت', 'بجٹ', 'سرمایہ کاری', 'رعایت', 'آفر', 'پلان'], product: ['مصنوعات', 'خصوصیات', 'خدمات', 'حل', 'پلیٹ فارم', 'ٹول'], support: ['سپورٹ', 'مدد', 'مسئلہ', 'خرابی', 'مدد'], implementation: ['ترتیب', 'انسٹال', 'نفاذ', 'انٹیگریشن', 'تربیت'], competition: ['مسابقت', 'متبادل', ' موازنہ', 'فرق'], timeline: ['آخری تاریخ', 'کب', 'کتنا وقت', 'شیڈول'], decision: ['فیصلہ', 'منظوری', 'بوس', 'مینجر', 'ٹیم'] },
      th: { pricing: ['ราคา', 'ต้นทุน', 'งบประมาณ', 'การลงทุน', 'ส่วนลด', 'ข้อเสนอ', 'แพ็กเกจ'], product: ['ผลิตภัณฑ์', 'คุณสมบัติ', 'บริการ', 'โซลูชัน', 'แพลตฟอร์ม', 'เครื่องมือ'], support: ['สนับสนุน', 'ช่วยเหลือ', 'ปัญหา', 'ข้อผิดพลาด', 'ความช่วยเหลือ'], implementation: ['ติดตั้ง', 'ตั้งค่า', 'ใช้งาน', 'รวมระบบ', 'การฝึกอบรม'], competition: ['คู่แข่ง', 'ทางเลือก', 'เปรียบเทียบ', 'ความแตกต่าง'], timeline: ['กำหนดเวลา', 'เมื่อไหร่', 'นานแค่ไหน', 'ตารางเวลา'], decision: ['ตัดสินใจ', 'อนุมัติ', 'หัวหน้า', 'ผู้จัดการ', 'ทีม'] }
    };
    const topics = {};
    const map = topicMap[lang] || topicMap.en;
    for (const [topic, keywords] of Object.entries(map)) {
      for (const kw of keywords) {
        if (text.includes(kw)) {
          if (!topics[topic]) topics[topic] = [];
          if (!topics[topic].includes(kw)) topics[topic].push(kw);
        }
      }
    }
    return Object.keys(topics);
  }

  async _aiAnalyzeMessage(text, context) {
    if (!this.aiCall) return null;
    const prompt = `Analyze this message and return JSON with: sentiment ({label, score}), intent (one of: greeting, question, objection, buying_signal, information_request, complaint, farewell, opt_out, neutral), urgency (low/medium/high/critical), engagement (cold/warm/hot), topics (array of strings). Message: "${text}"`;
    const result = await this.aiCall(prompt, { maxTokens: 200, temperature: 0.1 });
    if (typeof result === 'string') {
      try { return JSON.parse(result); } catch { return null; }
    }
    return result;
  }

  scoreLeadQuality(conversationHistory, contact = {}) {
    const messages = conversationHistory || [];
    const theirMessages = messages.filter(m => m.from === 'them');
    const ourMessages = messages.filter(m => m.from === 'me');

    const responseFrequency = this._calculateResponseFrequency(theirMessages);
    const messageDepth = this._calculateMessageDepth(theirMessages);
    const buyingSignals = this._detectBuyingSignals(theirMessages);
    const engagementDepth = this._calculateEngagementDepth(messages);
    const timelineSignals = this._detectTimelineSignals(theirMessages);
    const authoritySignals = this._detectAuthoritySignals(theirMessages);
    const sentimentTrend = this._calculateSentimentTrend(theirMessages);

    const rawScore =
      (responseFrequency * 20) +
      (messageDepth * 15) +
      (buyingSignals * 25) +
      (engagementDepth * 15) +
      (timelineSignals * 10) +
      (authoritySignals * 10) +
      (sentimentTrend * 5);

    const score = Math.min(100, Math.max(0, Math.round(rawScore)));

    let quality = 'cold';
    if (score >= 75) quality = 'hot';
    else if (score >= 50) quality = 'warm';
    else if (score >= 25) quality = 'interested';

    return {
      score,
      quality,
      breakdown: {
        responseFrequency: Math.round(responseFrequency * 100),
        messageDepth: Math.round(messageDepth * 100),
        buyingSignals: Math.round(buyingSignals * 100),
        engagementDepth: Math.round(engagementDepth * 100),
        timelineSignals: Math.round(timelineSignals * 100),
        authoritySignals: Math.round(authoritySignals * 100),
        sentimentTrend: Math.round(sentimentTrend * 100)
      },
      insights: this._generateLeadInsights(score, { responseFrequency, messageDepth, buyingSignals, engagementDepth, timelineSignals, authoritySignals, sentimentTrend })
    };
  }

  _calculateResponseFrequency(messages) {
    if (messages.length === 0) return 0;
    if (messages.length === 1) return 0.2;
    let totalResponseTime = 0;
    let responseCount = 0;
    for (let i = 1; i < messages.length; i++) {
      const prev = new Date(messages[i - 1].timestamp);
      const curr = new Date(messages[i].timestamp);
      const diffMin = (curr - prev) / 60000;
      if (diffMin > 0 && diffMin < 1440) {
        totalResponseTime += diffMin;
        responseCount++;
      }
    }
    if (responseCount === 0) return messages.length > 0 ? 0.3 : 0;
    const avgResponseMin = totalResponseTime / responseCount;
    if (avgResponseMin < 5) return 1;
    if (avgResponseMin < 30) return 0.8;
    if (avgResponseMin < 120) return 0.6;
    if (avgResponseMin < 1440) return 0.4;
    return 0.2;
  }

  _calculateMessageDepth(messages) {
    if (messages.length === 0) return 0;
    const avgLength = messages.reduce((sum, m) => sum + (m.text || '').length, 0) / messages.length;
    if (avgLength >= 200) return 1;
    if (avgLength >= 100) return 0.8;
    if (avgLength >= 50) return 0.6;
    if (avgLength >= 20) return 0.4;
    return 0.2;
  }

  _detectBuyingSignals(messages) {
    if (messages.length === 0) return 0;
    let signalCount = 0;
    for (const m of messages) {
      const text = (m.text || '').toLowerCase();
      const keywords = ConversationIntelligence.INTENT_KEYWORDS.buying_signal.en;
      for (const kw of keywords) {
        if (text.includes(kw)) signalCount++;
      }
      if (/\+?\d{7,15}/.test(text)) signalCount += 0.5;
      if (/[\w.-]+@[\w.-]+\.\w+/.test(text)) signalCount += 0.5;
    }
    if (signalCount >= 8) return 1;
    if (signalCount >= 5) return 0.8;
    if (signalCount >= 3) return 0.6;
    if (signalCount >= 1) return 0.4;
    return 0;
  }

  _calculateEngagementDepth(messages) {
    if (messages.length < 2) return 0.1;
    const exchanges = [];
    let currentExchange = [];
    for (const m of messages) {
      currentExchange.push(m);
      if (m.from === 'me' && currentExchange.length > 1) {
        exchanges.push([...currentExchange]);
        currentExchange = [];
      }
    }
    if (currentExchange.length > 0) exchanges.push(currentExchange);
    const avgExchangeLength = exchanges.length > 0
      ? exchanges.reduce((sum, e) => sum + e.length, 0) / exchanges.length
      : 0;
    const hasQuestions = messages.some(m => (m.text || '').includes('?'));
    const hasAttachments = messages.some(m => m.attachment);
    let score = 0;
    score += Math.min(0.5, messages.length / 20);
    score += Math.min(0.3, avgExchangeLength / 5);
    if (hasQuestions) score += 0.1;
    if (hasAttachments) score += 0.1;
    return Math.min(1, score);
  }

  _detectTimelineSignals(messages) {
    const timelinePatterns = ['asap', 'urgent', 'deadline', 'end of month', 'this week', 'next week', 'immediately', 'right away', 'before', 'hurry', 'quickly', 'today', 'now'];
    let count = 0;
    for (const m of messages) {
      const text = (m.text || '').toLowerCase();
      for (const p of timelinePatterns) {
        if (text.includes(p)) count++;
      }
    }
    if (count >= 3) return 1;
    if (count >= 2) return 0.7;
    if (count >= 1) return 0.4;
    return 0;
  }

  _detectAuthoritySignals(messages) {
    const authorityPatterns = ['my team', 'my boss', 'my manager', 'our company', 'we decided', 'i need to check', 'i have to approve', 'budget', 'final decision', 'board', 'ceo', 'cfo', 'cto', 'director', 'head of', 'i am the', 'i am responsible'];
    let count = 0;
    for (const m of messages) {
      const text = (m.text || '').toLowerCase();
      for (const p of authorityPatterns) {
        if (text.includes(p)) count++;
      }
    }
    if (count >= 3) return 1;
    if (count >= 2) return 0.7;
    if (count >= 1) return 0.4;
    return 0;
  }

  _calculateSentimentTrend(messages) {
    if (messages.length < 2) return 0.5;
    const sentiments = messages.map(m => {
      const result = this._analyzeSentiment((m.text || '').toLowerCase(), 'en');
      return result.label === 'positive' ? 1 : result.label === 'negative' ? 0 : 0.5;
    });
    const firstHalf = sentiments.slice(0, Math.ceil(sentiments.length / 2));
    const secondHalf = sentiments.slice(Math.ceil(sentiments.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.length > 0 ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length : firstAvg;
    if (secondAvg > firstAvg + 0.2) return 1;
    if (secondAvg > firstAvg) return 0.7;
    if (secondAvg === firstAvg) return 0.5;
    if (secondAvg > firstAvg - 0.2) return 0.3;
    return 0;
  }

  _generateLeadInsights(score, breakdown) {
    const insights = [];
    if (breakdown.responseFrequency >= 0.7) insights.push('Highly responsive lead - quick reply times');
    else if (breakdown.responseFrequency <= 0.3) insights.push('Low response frequency - may need re-engagement');
    if (breakdown.buyingSignals >= 0.6) insights.push('Strong buying signals detected - ready for proposal');
    else if (breakdown.buyingSignals <= 0.2) insights.push('No clear buying signals - needs nurturing');
    if (breakdown.messageDepth >= 0.7) insights.push('Providing detailed responses - highly engaged');
    else if (breakdown.messageDepth <= 0.3) insights.push('Short responses - may need better qualification questions');
    if (breakdown.authoritySignals >= 0.6) insights.push('Likely a decision maker');
    else if (breakdown.authoritySignals <= 0.2) insights.push('May need to reach decision maker');
    if (breakdown.sentimentTrend >= 0.7) insights.push('Sentiment improving - positive trajectory');
    else if (breakdown.sentimentTrend <= 0.3) insights.push('Sentiment declining - address concerns');
    if (breakdown.timelineSignals >= 0.6) insights.push('Urgency detected - time-sensitive opportunity');
    return insights;
  }

  recommendNextAction(conversationState) {
    const { stage, leadQuality, lastIntent, sentiment, urgency, engagement, contact, messageCount, lastMessageFrom } = conversationState;
    const country = this._getCountryFromPhone(contact?.phone || '');
    const cultureProfile = this.adaptForCulture(country, contact?.language);
    const actions = [];

    const timeSinceLastMessage = conversationState.lastMessageTimestamp
      ? (Date.now() - new Date(conversationState.lastMessageTimestamp).getTime()) / 60000
      : Infinity;

    if (lastIntent === 'opt_out') {
      return {
        primaryAction: 'suppress_contact',
        reason: 'Contact has opted out',
        actions: [
          { type: 'suppress', priority: 'critical', reason: 'Opt-out detected' },
          { type: 'log', priority: 'low', reason: 'Record opt-out for compliance' }
        ],
        timing: 'immediate',
        channel: 'none'
      };
    }

    if (lastIntent === 'complaint') {
      actions.push({ type: 'acknowledge', priority: 'critical', message: 'Acknowledge the complaint empathetically', template: this._getComplaintResponseTemplate(cultureProfile) });
      actions.push({ type: 'escalate', priority: 'high', reason: 'Customer complaint requires attention' });
      actions.push({ type: 'follow_up', priority: 'medium', timing: 'within 2 hours' });
    }

    if (urgency === 'critical' || urgency === 'high') {
      actions.push({ type: 'respond_immediately', priority: 'critical', reason: 'High urgency message' });
    }

    switch (stage) {
      case ConversationIntelligence.CONVERSATION_STAGES.NEW:
      case ConversationIntelligence.CONVERSATION_STAGES.INTRODUCTION:
        actions.push({ type: 'introduction', priority: 'high', message: 'Send personalized introduction', template: this._getIntroductionTemplate(cultureProfile) });
        actions.push({ type: 'value_proposition', priority: 'medium', message: 'Share key value proposition' });
        actions.push({ type: 'case_study', priority: 'low', message: 'Share relevant case study or social proof' });
        break;

      case ConversationIntelligence.CONVERSATION_STAGES.ENGAGED:
      case ConversationIntelligence.CONVERSATION_STAGES.QUALIFYING:
        actions.push({ type: 'qualify_needs', priority: 'high', message: 'Ask qualifying questions to understand needs' });
        actions.push({ type: 'share_proposal', priority: 'medium', message: 'Prepare and share proposal when ready' });
        actions.push({ type: 'schedule_call', priority: 'medium', message: 'Schedule a call for deeper discussion' });
        if (lastIntent === 'question' || lastIntent === 'information_request') {
          actions.push({ type: 'answer_question', priority: 'high', message: 'Provide detailed answer to their question' });
        }
        break;

      case ConversationIntelligence.CONVERSATION_STAGES.PROPOSAL:
      case ConversationIntelligence.CONVERSATION_STAGES.NEGOTIATING:
        actions.push({ type: 'address_objections', priority: 'high', message: 'Address any objections or concerns' });
        actions.push({ type: 'offer_incentive', priority: 'medium', message: 'Consider offering incentives or discounts' });
        actions.push({ type: 'follow_up', priority: 'high', timing: 'within 24 hours', message: 'Follow up on proposal status' });
        if (lastIntent === 'objection') {
          actions.push({ type: 'handle_objection', priority: 'critical', message: 'Respond to objection with empathy and solutions' });
        }
        if (lastIntent === 'buying_signal') {
          actions.push({ type: 'close_deal', priority: 'critical', message: 'Move to close - present final offer or contract' });
        }
        break;

      case ConversationIntelligence.CONVERSATION_STAGES.CLOSING:
        actions.push({ type: 'close_deal', priority: 'critical', message: 'Present final offer and close the deal' });
        actions.push({ type: 'create_urgency', priority: 'high', message: 'Create urgency with limited-time offer or deadline' });
        break;

      case ConversationIntelligence.CONVERSATION_STAGES.DORMANT:
      case ConversationIntelligence.CONVERSATION_STAGES.RE_ENGAGING:
        if (timeSinceLastMessage > 1440) {
          actions.push({ type: 're_engagement', priority: 'high', message: 'Send re-engagement message with new value' });
          actions.push({ type: 'educational_content', priority: 'medium', message: 'Share educational content or industry insights' });
        } else if (timeSinceLastMessage > 4320) {
          actions.push({ type: 'final_attempt', priority: 'medium', message: 'Final re-engagement attempt' });
        }
        break;

      default:
        actions.push({ type: 'follow_up', priority: 'medium', timing: this._getFollowUpTiming(engagement, cultureProfile) });
    }

    if (timeSinceLastMessage > 1440 && stage !== ConversationIntelligence.CONVERSATION_STAGES.DORMANT) {
      actions.push({ type: 'follow_up', priority: 'medium', message: 'Follow up - no response received', timing: this._getFollowUpTiming(engagement, cultureProfile) });
    }

    if (engagement === 'hot') {
      actions.push({ type: 'prioritize', priority: 'high', reason: 'Hot lead - prioritize response' });
    }

    const primaryAction = actions.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3);
    })[0] || { type: 'follow_up', priority: 'medium' };

    return {
      primaryAction: primaryAction.type,
      reason: primaryAction.reason || primaryAction.message || 'Recommended based on conversation analysis',
      actions,
      timing: primaryAction.timing || this._getFollowUpTiming(engagement, cultureProfile),
      channel: this._getPreferredChannel(cultureProfile, engagement),
      culturalNotes: cultureProfile ? {
        formality: cultureProfile.formality,
        responseExpectation: cultureProfile.responseExpectation
      } : null
    };
  }

  _getIntroductionTemplate(cultureProfile) {
    const formality = cultureProfile?.formality || 'polite';
    if (formality === 'very_formal') return { greeting: 'Dear', tone: 'respectful', style: 'formal introduction with credentials' };
    if (formality === 'formal') return { greeting: 'Hello', tone: 'professional', style: 'formal introduction with value proposition' };
    return { greeting: 'Hi', tone: 'friendly', style: 'casual introduction with key benefits' };
  }

  _getComplaintResponseTemplate(cultureProfile) {
    const formality = cultureProfile?.formality || 'polite';
    if (formality === 'very_formal') return { tone: 'very apologetic', style: 'formal acknowledgment with immediate escalation', empathy: 'high' };
    if (formality === 'formal') return { tone: 'apologetic', style: 'professional acknowledgment with solution focus', empathy: 'high' };
    return { tone: 'empathetic', style: 'friendly acknowledgment with quick resolution', empathy: 'medium' };
  }

  _getFollowUpTiming(engagement, cultureProfile) {
    const pace = cultureProfile?.communicationPace || 'moderate';
    const timingMap = {
      hot: { fast: '2 hours', moderate: '6 hours', slow: '12 hours', relaxed: '24 hours' },
      warm: { fast: '6 hours', moderate: '12 hours', slow: '24 hours', relaxed: '48 hours' },
      cold: { fast: '24 hours', moderate: '48 hours', slow: '72 hours', relaxed: '7 days' }
    };
    return timingMap[engagement || 'cold']?.[pace] || '24 hours';
  }

  _getPreferredChannel(cultureProfile, engagement) {
    if (engagement === 'hot') return 'whatsapp_direct';
    if (engagement === 'warm') return 'whatsapp';
    return 'whatsapp';
  }

  generateSummary(conversationHistory) {
    const messages = conversationHistory || [];
    if (messages.length === 0) {
      return { keyPoints: [], decisions: [], commitments: [], openQuestions: [], actionItems: [], messageCount: 0, sentiment: 'neutral', duration: null };
    }

    const theirMessages = messages.filter(m => m.from === 'them');
    const ourMessages = messages.filter(m => m.from === 'me');

    const keyPoints = this._extractKeyPoints(theirMessages);
    const decisions = this._extractDecisions(messages);
    const commitments = this._extractCommitments(messages);
    const openQuestions = this._extractOpenQuestions(theirMessages);
    const actionItems = this._extractActionItems(messages);

    const allText = messages.map(m => m.text || ' ').join(' ');
    const sentiment = this._analyzeSentiment(allText.toLowerCase(), 'en');

    const firstTimestamp = messages[0]?.timestamp ? new Date(messages[0].timestamp) : null;
    const lastTimestamp = messages[messages.length - 1]?.timestamp ? new Date(messages[messages.length - 1].timestamp) : null;
    const duration = firstTimestamp && lastTimestamp ? this._formatDuration(lastTimestamp - firstTimestamp) : null;

    return {
      keyPoints,
      decisions,
      commitments,
      openQuestions,
      actionItems,
      messageCount: messages.length,
      theirMessageCount: theirMessages.length,
      ourMessageCount: ourMessages.length,
      sentiment: sentiment.label,
      sentimentScore: sentiment.score,
      duration,
      firstMessage: firstTimestamp?.toISOString(),
      lastMessage: lastTimestamp?.toISOString()
    };
  }

  _extractKeyPoints(messages) {
    const points = [];
    const importantPatterns = [
      { pattern: /(?:want|need|looking for|interested in|require|desire)\s+(.{10,60})/gi, type: 'need' },
      { pattern: /(?:problem|issue|challenge|struggle|difficulty)\s+(.{10,60})/gi, type: 'problem' },
      { pattern: /(?:goal|objective|target|aim)\s+(.{10,60})/gi, type: 'goal' },
      { pattern: /(?:budget|spend|invest|price|cost|pay)\s+(.{5,40})/gi, type: 'budget' },
      { pattern: /(?:team|company|organization|business)\s+(.{5,60})/gi, type: 'context' }
    ];
    for (const m of messages) {
      const text = m.text || '';
      for (const { pattern, type } of importantPatterns) {
        const regex = new RegExp(pattern.source, pattern.flags);
        let match;
        while ((match = regex.exec(text)) !== null) {
          points.push({ type, text: match[0].trim(), timestamp: m.timestamp });
        }
      }
    }
    return points.slice(0, 10);
  }

  _extractDecisions(messages) {
    const decisions = [];
    const patterns = [
      /(?:decided|decision|agreed|confirmed|approved|accepted|chosen)\s+(.{5,80})/gi,
      /(?:we (?:will|shall|are going to|plan to))\s+(.{5,80})/gi,
      /(?:i (?:will|shall|am going to|plan to))\s+(.{5,80})/gi
    ];
    for (const m of messages) {
      const text = m.text || '';
      for (const pattern of patterns) {
        const regex = new RegExp(pattern.source, pattern.flags);
        let match;
        while ((match = regex.exec(text)) !== null) {
          decisions.push({ text: match[0].trim(), timestamp: m.timestamp, from: m.from });
        }
      }
    }
    return decisions.slice(0, 5);
  }

  _extractCommitments(messages) {
    const commitments = [];
    const patterns = [
      /(?:i(?:'ll| will| shall|'m going to)|we(?:'ll| will| shall|'re going to))\s+(.{5,80})/gi,
      /(?:promise|guarantee|swear|commit)\s+(?:to\s+)?(.{5,80})/gi,
      /(?:send|share|provide|deliver|prepare)\s+(.{5,60})\s+(?:by|before|until|on)\s+(.{5,30})/gi
    ];
    for (const m of messages) {
      const text = m.text || '';
      for (const pattern of patterns) {
        const regex = new RegExp(pattern.source, pattern.flags);
        let match;
        while ((match = regex.exec(text)) !== null) {
          commitments.push({ text: match[0].trim(), timestamp: m.timestamp, from: m.from });
        }
      }
    }
    return commitments.slice(0, 5);
  }

  _extractOpenQuestions(messages) {
    const questions = [];
    for (const m of messages) {
      const text = m.text || '';
      const questionSentences = text.split(/[.!?]+/).filter(s => s.trim().endsWith('?') || /\b(?:how|what|when|where|why|which|who|can|could|would|do|does|is|are|will|shall)\b/i.test(s));
      for (const q of questionSentences) {
        if (q.trim().length > 5) {
          questions.push({ text: q.trim(), timestamp: m.timestamp, from: m.from });
        }
      }
    }
    return questions.slice(0, 10);
  }

  _extractActionItems(messages) {
    const actions = [];
    const patterns = [
      /(?:todo|action item|task|to do|need to|must|should|have to|required to)\s+(.{5,80})/gi,
      /(?:please|kindly|make sure|ensure|don'?t forget)\s+(.{5,80})/gi,
      /(?:schedule|book|arrange|set up|organize|plan)\s+(.{5,60})/gi
    ];
    for (const m of messages) {
      const text = m.text || '';
      for (const pattern of patterns) {
        const regex = new RegExp(pattern.source, pattern.flags);
        let match;
        while ((match = regex.exec(text)) !== null) {
          actions.push({ text: match[0].trim(), timestamp: m.timestamp, from: m.from, status: 'pending' });
        }
      }
    }
    return actions.slice(0, 10);
  }

  _formatDuration(ms) {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  }

  adaptForCulture(country, language) {
    const code = (country || '').toUpperCase();
    const profile = ConversationIntelligence.CULTURE_PROFILES[code] || ConversationIntelligence.CULTURE_PROFILES.default;
    const now = new Date();
    let timezoneDate;
    try {
      timezoneDate = new Date(now.toLocaleString('en-US', { timeZone: profile.timezone }));
    } catch {
      timezoneDate = now;
    }
    const month = String(timezoneDate.getMonth() + 1).padStart(2, '0');
    const day = String(timezoneDate.getDate()).padStart(2, '0');
    const dateKey = `${month}-${day}`;
    const isHoliday = !!profile.holidays[dateKey];
    const hour = timezoneDate.getHours();
    const isBusinessHours = hour >= profile.businessHours.start && hour < profile.businessHours.end;
    const greetingStyle = profile.greetingStyle;
    const formalityLevel = profile.formality;
    const recommendedTone = formalityLevel === 'very_formal' ? 'highly professional and respectful'
      : formalityLevel === 'formal' ? 'professional and courteous'
      : formalityLevel === 'polite' ? 'friendly and polite'
      : 'casual and friendly';

    return {
      country: code,
      language: language || this._languageFromCountry(code),
      formality: formalityLevel,
      greetingStyle,
      communicationPace: profile.communicationPace,
      timezone: profile.timezone,
      timezoneDate: timezoneDate.toISOString(),
      isBusinessHours,
      isHoliday,
      holidayName: isHoliday ? profile.holidays[dateKey] : null,
      businessHours: profile.businessHours,
      responseExpectation: profile.responseExpectation,
      recommendedTone,
      greeting: this._getGreetingForTime(hour, greetingStyle, formalityLevel, language || this._languageFromCountry(code)),
      avoidContact: isHoliday || !isBusinessHours,
      bestTimeToContact: `${profile.businessHours.start}:00 - ${profile.businessHours.end}:00 ${profile.timezone}`
    };
  }

  _languageFromCountry(code) {
    const map = { US: 'en', GB: 'en', DE: 'de', FR: 'fr', JP: 'ja', CN: 'zh', IN: 'hi', BR: 'pt', TR: 'tr', AE: 'ar', SA: 'ar', PK: 'ur', NG: 'en', MX: 'es', ZA: 'en', KR: 'ko', ID: 'id', EG: 'ar' };
    return map[code] || 'en';
  }

  _getGreetingForTime(hour, style, formality, lang) {
    const greetings = {
      en: { formal: { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening' }, casual: { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening' }, reserved: { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening' } },
      de: { formal: { morning: 'Guten Morgen', afternoon: 'Guten Tag', evening: 'Guten Abend' }, casual: { morning: 'Guten Morgen', afternoon: 'Hallo', evening: 'Guten Abend' }, reserved: { morning: 'Guten Morgen', afternoon: 'Guten Tag', evening: 'Guten Abend' } },
      fr: { formal: { morning: 'Bonjour', afternoon: 'Bonjour', evening: 'Bonsoir' }, casual: { morning: 'Salut', afternoon: 'Salut', evening: 'Bonsoir' }, polite: { morning: 'Bonjour', afternoon: 'Bonjour', evening: 'Bonsoir' } },
      es: { formal: { morning: 'Buenos días', afternoon: 'Buenas tardes', evening: 'Buenas noches' }, casual: { morning: 'Hola', afternoon: 'Hola', evening: 'Hola' } },
      ar: { formal: { morning: 'صباح الخير', afternoon: 'مساء الخير', evening: 'مساء الخير' }, warm: { morning: 'أهلاً وسهلاً', afternoon: 'أهلاً وسهلاً', evening: 'أهلاً وسهلاً' } },
      pt: { formal: { morning: 'Bom dia', afternoon: 'Boa tarde', evening: 'Boa noite' }, casual: { morning: 'Oi', afternoon: 'Oi', evening: 'Oi' } },
      hi: { formal: { morning: 'नमस्ते', afternoon: 'नमस्ते', evening: 'नमस्ते' }, polite: { morning: 'नमस्ते', afternoon: 'नमस्ते', evening: 'नमस्ते' } },
      tr: { formal: { morning: 'Günaydın', afternoon: 'İyi günler', evening: 'İyi akşamlar' }, casual: { morning: 'Merhaba', afternoon: 'Merhaba', evening: 'Merhaba' } },
      ja: { very_formal: { morning: 'おはようございます', afternoon: 'こんにちは', evening: 'こんばんは' }, formal: { morning: 'おはようございます', afternoon: 'こんにちは', evening: 'こんばんは' } },
      zh: { formal: { morning: '早上好', afternoon: '下午好', evening: '晚上好' }, respectful: { morning: '您好', afternoon: '您好', evening: '您好' } },
      ko: { very_formal: { morning: '안녕하세요', afternoon: '안녕하세요', evening: '안녕하세요' }, formal: { morning: '안녕하세요', afternoon: '안녕하세요', evening: '안녕하세요' } },
      id: { formal: { morning: 'Selamat pagi', afternoon: 'Selamat siang', evening: 'Selamat malam' }, polite: { morning: 'Selamat pagi', afternoon: 'Selamat siang', evening: 'Selamat malam' } },
      ur: { formal: { morning: 'السلام علیکم', afternoon: 'السلام علیکم', evening: 'السلام علیکم' }, warm: { morning: 'السلام علیکم', afternoon: 'السلام علیکم', evening: 'السلام علیکم' } },
      th: { formal: { morning: 'สวัสดีครับ/ค่ะ', afternoon: 'สวัสดีครับ/ค่ะ', evening: 'สวัสดีครับ/ค่ะ' }, polite: { morning: 'สวัสดี', afternoon: 'สวัสดี', evening: 'สวัสดี' } }
    };
    const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    const langGreetings = greetings[lang] || greetings.en;
    const styleGreetings = langGreetings[formality] || langGreetings.formal || langGreetings.casual || langGreetings.polite || langGreetings.reserved || langGreetings.warm || Object.values(langGreetings)[0];
    return styleGreetings?.[timeOfDay] || 'Hello';
  }

  checkOptOut(message) {
    if (!message) return { isOptOut: false, confidence: 0, patterns: [] };
    const text = (message.text || message || '').toLowerCase().trim();
    const detectedPatterns = [];
    for (const [lang, keywords] of Object.entries(ConversationIntelligence.INTENT_KEYWORDS.opt_out)) {
      for (const kw of keywords) {
        if (text.includes(kw)) {
          detectedPatterns.push({ keyword: kw, language: lang });
        }
      }
    }
    const additionalPatterns = [
      { pattern: /\b(stop|quit|end|leave|remove|delete|erase)\b.*\b(msg|message|sms|chat|notification|alert|email|contact|list)\b/i, type: 'stop_command' },
      { pattern: /\b(msg|message|sms|chat|notification|alert|email|contact|list)\b.*\b(stop|quit|end|leave|remove|delete|erase)\b/i, type: 'stop_command' },
      { pattern: /\b(don'?t|do\s+not|never)\s+(call|contact|message|text|email|reach|write)\b/i, type: 'explicit_request' },
      { pattern: /\b(no\s+more|stop\s+all|cancel\s+all|unsubscribe\s+from\s+all)\b/i, type: 'bulk_optout' },
      { pattern: /\b(block|ban|blacklist|whitelist)\b/i, type: 'block_request' },
      { pattern: /\b(leave\s+me\s+alone|go\s+away|f\s*off|f\s*ck\s+off)\b/i, type: 'aggressive_optout' }
    ];
    for (const { pattern, type } of additionalPatterns) {
      if (pattern.test(text)) {
        detectedPatterns.push({ pattern: type, language: 'universal' });
      }
    }
    const isOptOut = detectedPatterns.length > 0;
    const confidence = isOptOut ? Math.min(1, 0.5 + detectedPatterns.length * 0.2) : 0;
    const contact = message.phone || message.number || null;
    if (isOptOut && contact) {
      this.suppressionList.set(contact, {
        reason: detectedPatterns[0]?.keyword || detectedPatterns[0]?.pattern || 'opt_out_detected',
        timestamp: new Date().toISOString(),
        source: 'auto_detected',
        patterns: detectedPatterns
      });
    }
    return {
      isOptOut,
      confidence,
      patterns: detectedPatterns,
      suppressedContact: isOptOut ? contact : null,
      shouldSuppress: isOptOut && confidence >= 0.6
    };
  }

  addToSuppressionList(contact, reason = 'manual', metadata = {}) {
    if (!contact) return false;
    const entry = {
      reason,
      timestamp: new Date().toISOString(),
      source: 'manual',
      ...metadata
    };
    this.suppressionList.set(contact, entry);
    return true;
  }

  removeFromSuppressionList(contact) {
    return this.suppressionList.delete(contact);
  }

  isSuppressed(contact) {
    return this.suppressionList.has(contact);
  }

  getSuppressionList() {
    const list = [];
    for (const [contact, entry] of this.suppressionList) {
      list.push({ contact, ...entry });
    }
    return list;
  }

  bulkCheckAndSuppress(messages) {
    const results = [];
    for (const msg of messages) {
      const check = this.checkOptOut(msg);
      results.push({ message: msg, ...check });
    }
    return results;
  }

  getConversationState(conversationHistory) {
    const messages = conversationHistory || [];
    const theirMessages = messages.filter(m => m.from === 'them');
    const ourMessages = messages.filter(m => m.from === 'me');
    const lastMessage = messages[messages.length - 1];
    const lastTheirMessage = theirMessages[theirMessages.length - 1];
    const lastOurMessage = ourMessages[ourMessages.length - 1];

    let stage = ConversationIntelligence.CONVERSATION_STAGES.NEW;
    if (messages.length === 0) stage = ConversationIntelligence.CONVERSATION_STAGES.NEW;
    else if (messages.length <= 2) stage = ConversationIntelligence.CONVERSATION_STAGES.INTRODUCTION;
    else if (theirMessages.length >= 3 && this._hasBuyingSignals(theirMessages)) stage = ConversationIntelligence.CONVERSATION_STAGES.NEGOTIATING;
    else if (theirMessages.length >= 2 && this._hasBuyingSignals(theirMessages)) stage = ConversationIntelligence.CONVERSATION_STAGES.PROPOSAL;
    else if (theirMessages.length >= 2) stage = ConversationIntelligence.CONVERSATION_STAGES.QUALIFYING;
    else if (theirMessages.length >= 1) stage = ConversationIntelligence.CONVERSATION_STAGES.ENGAGED;

    const timeSinceLastMessage = lastMessage?.timestamp
      ? (Date.now() - new Date(lastMessage.timestamp).getTime()) / 60000
      : Infinity;
    if (timeSinceLastMessage > 10080) stage = ConversationIntelligence.CONVERSATION_STAGES.DORMANT;
    else if (timeSinceLastMessage > 4320 && stage !== ConversationIntelligence.CONVERSATION_STAGES.NEW) stage = ConversationIntelligence.CONVERSATION_STAGES.RE_ENGAGING;

    const lastIntent = lastTheirMessage
      ? this._classifyIntent((lastTheirMessage.text || '').toLowerCase(), 'en', { messageCount: theirMessages.length })
      : 'neutral';

    const lastSentiment = lastTheirMessage
      ? this._analyzeSentiment((lastTheirMessage.text || '').toLowerCase(), 'en')
      : { label: 'neutral', score: 0.5 };

    const engagement = this._assessEngagement(lastTheirMessage?.text || '', {
      messageCount: theirMessages.length,
      responseTimeMinutes: this._calculateLastResponseTime(messages)
    });

    return {
      stage,
      messageCount: messages.length,
      theirMessageCount: theirMessages.length,
      ourMessageCount: ourMessages.length,
      lastMessageFrom: lastMessage?.from || null,
      lastMessageTimestamp: lastMessage?.timestamp || null,
      lastIntent,
      lastSentiment: lastSentiment.label,
      lastSentimentScore: lastSentiment.score,
      engagement,
      timeSinceLastMessage: Math.round(timeSinceLastMessage),
      hasBuyingSignals: this._hasBuyingSignals(theirMessages),
      hasObjections: this._hasObjections(theirMessages),
      responseRate: theirMessages.length > 0 ? Math.min(1, ourMessages.length / theirMessages.length) : 0
    };
  }

  _hasBuyingSignals(messages) {
    for (const m of messages) {
      const text = (m.text || '').toLowerCase();
      const keywords = ConversationIntelligence.INTENT_KEYWORDS.buying_signal.en;
      for (const kw of keywords) {
        if (text.includes(kw)) return true;
      }
    }
    return false;
  }

  _hasObjections(messages) {
    for (const m of messages) {
      const text = (m.text || '').toLowerCase();
      const keywords = ConversationIntelligence.INTENT_KEYWORDS.objection.en;
      for (const kw of keywords) {
        if (text.includes(kw)) return true;
      }
    }
    return false;
  }

  _calculateLastResponseTime(messages) {
    if (messages.length < 2) return undefined;
    for (let i = messages.length - 1; i >= 1; i--) {
      if (messages[i].from === 'me' && messages[i - 1].from === 'them') {
        const sent = new Date(messages[i].timestamp);
        const received = new Date(messages[i - 1].timestamp);
        return (sent - received) / 60000;
      }
    }
    return undefined;
  }

  _getCountryFromPhone(phone) {
    const digits = (phone || '').replace(/\D/g, '');
    for (const [code, country] of Object.entries(ConversationIntelligence.PHONE_COUNTRY_MAP)) {
      if (digits.startsWith(code)) return country;
    }
    return 'default';
  }
}

module.exports = ConversationIntelligence;
