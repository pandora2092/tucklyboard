const TOPICS: Record<string, string[]> = {
  программирование: [
    'код',
    'code',
    'coding',
    'programming',
    'разработка',
    'программист',
    'javascript',
    'typescript',
    'react',
    'nestjs',
    'python',
    'frontend',
    'backend',
    'api',
    'debug',
    'git',
    'приложение',
  ],
  'искусственный интеллект': [
    'ии',
    'ai',
    'llm',
    'нейросеть',
    'нейросети',
    'агент',
    'агенты',
    'agent',
    'agents',
    'codex',
    'gpt',
    'prompt',
    'промпт',
    'chatgpt',
    'машинное обучение',
  ],
  обучение: [
    'учеба',
    'учиться',
    'обучение',
    'гайд',
    'guide',
    'tutorial',
    'курс',
    'course',
    'урок',
    'инструкция',
    'научиться',
    'разобраться',
    'how to',
  ],
  рецепты: [
    'рецепт',
    'recipe',
    'готовить',
    'приготовить',
    'еда',
    'food',
    'завтрак',
    'обед',
    'ужин',
    'dinner',
    'breakfast',
    'паста',
    'суп',
    'выпечка',
    'баклажан',
    'кулинария',
    'cooking',
    'готовка',
  ],
  интерьер: [
    'интерьер',
    'interior',
    'ремонт',
    'мебель',
    'furniture',
    'квартира',
    'комната',
    'освещение',
    'диван',
    'шкаф',
    'living room',
    'дизайн интерьера',
  ],
  дизайн: [
    'дизайн',
    'design',
    'типографика',
    'typography',
    'брендинг',
    'branding',
    'логотип',
    'logo',
    'макет',
    'figma',
    'референс',
    'reference',
    'плакат',
    'poster',
  ],
  путешествия: [
    'путешествие',
    'travel',
    'trip',
    'поездка',
    'отпуск',
    'отель',
    'hotel',
    'пляж',
    'beach',
    'маршрут',
    'туризм',
    'vacation',
  ],
  одежда: [
    'одежда',
    'fashion',
    'стиль',
    'outfit',
    'пальто',
    'обувь',
    'платье',
    'сумка',
    'гардероб',
    'clothes',
    'wear',
  ],
  спорт: [
    'спорт',
    'sport',
    'тренировка',
    'fitness',
    'workout',
    'бег',
    'running',
    'йога',
    'yoga',
    'упражнение',
  ],
  здоровье: ['здоровье', 'health', 'сон', 'sleep', 'самочувствие', 'медицина', 'medicine'],
  музыка: ['музыка', 'music', 'песня', 'song', 'альбом', 'гитара', 'guitar', 'концерт'],
  кино: ['кино', 'film', 'movie', 'сериал', 'series', 'cinema', 'посмотреть фильм'],
  книги: ['книга', 'book', 'чтение', 'reading', 'роман', 'литература'],
  работа: [
    'работа',
    'career',
    'карьера',
    'собеседование',
    'interview',
    'резюме',
    'cv',
    'вакансия',
    'job',
  ],
  финансы: ['финансы', 'finance', 'бюджет', 'budget', 'деньги', 'money', 'инвестиции', 'investing'],
  подарки: ['подарок', 'gift', 'день рождения', 'birthday', 'подарить', 'сюрприз'],
  фотография: [
    'фото',
    'photo',
    'photography',
    'съемка',
    'камера',
    'camera',
    'портрет',
    'portrait',
    'свет',
  ],
  природа: [
    'природа',
    'nature',
    'лес',
    'forest',
    'море',
    'sea',
    'горы',
    'mountain',
    'озеро',
    'lake',
  ],
};
const STOP = new Set(
  'и в на с по о об для из от до как что это тот та the a an of to for in on with and or как бы мне хочу найти'.split(
    ' ',
  ),
);
function stem(word: string) {
  return word
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(
      /(иями|ами|ого|ему|ому|ыми|ими|ая|яя|ое|ее|ые|ие|ой|ий|ый|ов|ев|ам|ям|ах|ях|ть|ться|ing|ed|es|ы|и|а|я|у|ю|е|о|s)$/u,
      '',
    );
}
function tokens(value: string) {
  return (value.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [])
    .filter(word => word.length > 1 && !STOP.has(word))
    .map(stem);
}
function concepts(value: string) {
  const words = new Set(tokens(value));
  return Object.entries(TOPICS)
    .filter(([_name, terms]) => terms.some(term => tokens(term).every(token => words.has(token))))
    .map(([name]) => name);
}
export function autoTags(value: string) {
  return concepts(value).slice(0, 5);
}
export function topicScore(query: string, document: string) {
  const q = tokens(query);
  if (!q.length) {
    return 0;
  }
  const d = new Set(tokens(document));
  const lexical = q.filter(word => d.has(word)).length / q.length;
  const qc = concepts(query);
  const dc = new Set(concepts(document));
  const semantic = qc.length ? qc.filter(topic => dc.has(topic)).length / qc.length : 0;
  return lexical * 0.65 + semantic * 0.35;
}
export function documentText(item: {
  title: string;
  text: string;
  sourceTitle?: string | null;
  sourceDescription?: string | null;
  tags: string[];
  autoTags: string[];
  dismissedAutoTags: string[];
}) {
  return [
    item.title,
    item.sourceTitle,
    item.sourceDescription,
    item.text,
    ...item.tags,
    ...item.autoTags.filter(tag => !item.dismissedAutoTags.includes(tag)),
  ]
    .filter(Boolean)
    .join('\n');
}
export function cosine(a: number[], b: number[]) {
  if (!a.length || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
}
