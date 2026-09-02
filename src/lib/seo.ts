export interface SeoPlace {
  state: string;
  city: string;
  locality: string | null;
  aliases?: readonly string[];
}

export interface ResolvedSeoPlace {
  state: string | null;
  city: string | null;
  locality: string | null;
  displayName: string;
  path: string;
  indexable: boolean;
}

export type SeoLanguage = 'en' | 'hi';

const ACRONYMS = new Set([
  'btm',
  'cbt',
  'hsr',
  'jp',
  'nh',
  'rk',
  'sec',
]);

export const INDEXABLE_PLACES: readonly SeoPlace[] = [
  { state: 'Andhra Pradesh', city: 'Visakhapatnam', locality: null, aliases: ['vizag'] },
  { state: 'Andhra Pradesh', city: 'Vijayawada', locality: null },
  { state: 'Assam', city: 'Guwahati', locality: null },
  { state: 'Bihar', city: 'Patna', locality: null },
  { state: 'Chhattisgarh', city: 'Raipur', locality: null },
  { state: 'Delhi', city: 'Delhi', locality: null, aliases: ['new delhi', 'ncr'] },
  { state: 'Delhi', city: 'Delhi', locality: 'Dwarka' },
  { state: 'Delhi', city: 'Delhi', locality: 'Rohini' },
  { state: 'Delhi', city: 'Delhi', locality: 'Saket' },
  { state: 'Delhi', city: 'Delhi', locality: 'Karol Bagh' },
  { state: 'Goa', city: 'Panaji', locality: null, aliases: ['panjim'] },
  { state: 'Gujarat', city: 'Ahmedabad', locality: null },
  { state: 'Gujarat', city: 'Surat', locality: null },
  { state: 'Gujarat', city: 'Vadodara', locality: null, aliases: ['baroda'] },
  { state: 'Haryana', city: 'Gurugram', locality: null, aliases: ['gurgaon'] },
  { state: 'Haryana', city: 'Faridabad', locality: null },
  { state: 'Himachal Pradesh', city: 'Shimla', locality: null },
  { state: 'Jammu and Kashmir', city: 'Srinagar', locality: null },
  { state: 'Jammu and Kashmir', city: 'Jammu', locality: null },
  { state: 'Jharkhand', city: 'Ranchi', locality: null },
  { state: 'Karnataka', city: 'Bengaluru', locality: null, aliases: ['bangalore'] },
  { state: 'Karnataka', city: 'Bengaluru', locality: 'HSR Layout' },
  { state: 'Karnataka', city: 'Bengaluru', locality: 'Koramangala' },
  { state: 'Karnataka', city: 'Bengaluru', locality: 'Indiranagar' },
  { state: 'Karnataka', city: 'Bengaluru', locality: 'Whitefield' },
  { state: 'Karnataka', city: 'Bengaluru', locality: 'Jayanagar' },
  { state: 'Karnataka', city: 'Bengaluru', locality: 'Malleswaram' },
  { state: 'Karnataka', city: 'Bengaluru', locality: 'Electronic City' },
  { state: 'Karnataka', city: 'Bengaluru', locality: 'Marathahalli' },
  { state: 'Karnataka', city: 'Bengaluru', locality: 'Bellandur' },
  { state: 'Karnataka', city: 'Bengaluru', locality: 'Hebbal' },
  { state: 'Karnataka', city: 'Bengaluru', locality: 'Yelahanka' },
  { state: 'Karnataka', city: 'Bengaluru', locality: 'Banashankari' },
  { state: 'Karnataka', city: 'Bengaluru', locality: 'JP Nagar' },
  { state: 'Karnataka', city: 'Bengaluru', locality: 'BTM Layout' },
  { state: 'Karnataka', city: 'Mysuru', locality: null, aliases: ['mysore'] },
  { state: 'Karnataka', city: 'Mangaluru', locality: null, aliases: ['mangalore'] },
  { state: 'Kerala', city: 'Kochi', locality: null, aliases: ['cochin', 'ernakulam'] },
  { state: 'Kerala', city: 'Thiruvananthapuram', locality: null, aliases: ['trivandrum'] },
  { state: 'Kerala', city: 'Kozhikode', locality: null, aliases: ['calicut'] },
  { state: 'Madhya Pradesh', city: 'Indore', locality: null },
  { state: 'Madhya Pradesh', city: 'Bhopal', locality: null },
  { state: 'Maharashtra', city: 'Mumbai', locality: null, aliases: ['bombay'] },
  { state: 'Maharashtra', city: 'Mumbai', locality: 'Andheri' },
  { state: 'Maharashtra', city: 'Mumbai', locality: 'Bandra' },
  { state: 'Maharashtra', city: 'Mumbai', locality: 'Powai' },
  { state: 'Maharashtra', city: 'Mumbai', locality: 'Borivali' },
  { state: 'Maharashtra', city: 'Pune', locality: null, aliases: ['poona'] },
  { state: 'Maharashtra', city: 'Pune', locality: 'Hinjewadi' },
  { state: 'Maharashtra', city: 'Pune', locality: 'Kothrud' },
  { state: 'Maharashtra', city: 'Pune', locality: 'Viman Nagar' },
  { state: 'Maharashtra', city: 'Pune', locality: 'Hadapsar' },
  { state: 'Maharashtra', city: 'Nagpur', locality: null },
  { state: 'Maharashtra', city: 'Thane', locality: null },
  { state: 'Maharashtra', city: 'Navi Mumbai', locality: null },
  { state: 'Odisha', city: 'Bhubaneswar', locality: null },
  { state: 'Punjab', city: 'Ludhiana', locality: null },
  { state: 'Punjab', city: 'Chandigarh', locality: null },
  { state: 'Rajasthan', city: 'Jaipur', locality: null },
  { state: 'Tamil Nadu', city: 'Chennai', locality: null, aliases: ['madras'] },
  { state: 'Tamil Nadu', city: 'Chennai', locality: 'T Nagar' },
  { state: 'Tamil Nadu', city: 'Chennai', locality: 'Adyar' },
  { state: 'Tamil Nadu', city: 'Chennai', locality: 'Velachery' },
  { state: 'Tamil Nadu', city: 'Chennai', locality: 'Anna Nagar' },
  { state: 'Tamil Nadu', city: 'Coimbatore', locality: null },
  { state: 'Tamil Nadu', city: 'Madurai', locality: null },
  { state: 'Telangana', city: 'Hyderabad', locality: null },
  { state: 'Telangana', city: 'Hyderabad', locality: 'Hitech City' },
  { state: 'Telangana', city: 'Hyderabad', locality: 'Gachibowli' },
  { state: 'Telangana', city: 'Hyderabad', locality: 'Banjara Hills' },
  { state: 'Telangana', city: 'Hyderabad', locality: 'Secunderabad' },
  { state: 'Uttar Pradesh', city: 'Lucknow', locality: null },
  { state: 'Uttar Pradesh', city: 'Noida', locality: null },
  { state: 'Uttar Pradesh', city: 'Ghaziabad', locality: null },
  { state: 'Uttar Pradesh', city: 'Kanpur', locality: null },
  { state: 'Uttar Pradesh', city: 'Varanasi', locality: null, aliases: ['benares'] },
  { state: 'Uttar Pradesh', city: 'Prayagraj', locality: null, aliases: ['allahabad'] },
  { state: 'Uttarakhand', city: 'Dehradun', locality: null },
  { state: 'West Bengal', city: 'Kolkata', locality: null, aliases: ['calcutta'] },
];

export function slugifyPlace(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['’]/gu, '')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

export function parsePlaceSlug(slug: string): string {
  return slug.trim().toLowerCase().replace(/-/gu, ' ');
}

export function displayNameFromSlug(slug: string): string {
  return slug
    .split('-')
    .filter((part) => part.length > 0)
    .map((part) => (ACRONYMS.has(part) ? part.toUpperCase() : `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`))
    .join(' ');
}

export function powercutPath(city: string, locality?: string | null): string {
  const citySlug = slugifyPlace(city);
  if (!locality) {
    return `/powercut/${citySlug}`;
  }
  return `/powercut/${citySlug}/${slugifyPlace(locality)}`;
}

export function statePath(state: string): string {
  return `/in/${slugifyPlace(state)}`;
}

interface SeoStrings {
  homeTitle: string;
  homeDescription: string;
  inLanguage: string;
  heading: (place: string) => string;
  locationTitleSuffix: string;
  locationDescriptionWithReports: (place: string, count: number) => string;
  locationDescriptionEmpty: (place: string) => string;
  faq: (place: string) => { question: string; answer: string }[];
}

const SEO_COPY: Record<SeoLanguage, SeoStrings> = {
  en: {
    homeTitle: 'Live power cuts in India | powercuts.fyi',
    homeDescription:
      'Live power cut, power outage, and electricity cut reports across India. Search your city or locality, see if the lights are out nearby, and report a cut with no signup.',
    inLanguage: 'en-IN',
    heading: (place) => `Power cut in ${place}`,
    locationTitleSuffix: '— live outage reports | powercuts.fyi',
    locationDescriptionWithReports: (place, count) =>
      `Power cut in ${place} right now. Live power outage, electricity cut, and load-shedding updates from people nearby. ${count} live power-cut ${count === 1 ? 'report' : 'reports'} right now.`,
    locationDescriptionEmpty: (place) =>
      `Power cut in ${place} right now. Live power outage, electricity cut, and load-shedding updates from people nearby. No live reports yet — check here or add one in under 10 seconds.`,
    faq: (place) => [
      {
        question: `Is there a power cut in ${place} right now?`,
        answer: `powercuts.fyi shows live, crowdsourced power-cut reports for ${place}. If neighbours mark power out, the area stays ongoing until recent reports agree the electricity is back.`,
      },
      {
        question: `Why is there no electricity in ${place}?`,
        answer: `Cuts are often unexpected local faults, planned maintenance, or load shedding. This site does not speak for the DISCOM — it shows what people in ${place} are reporting right now.`,
      },
      {
        question: `Power outage near me in ${place} — how do I check?`,
        answer: `Open the ${place} page on powercuts.fyi, scan live reports for your locality, or drop a report yourself. No signup, no app download.`,
      },
    ],
  },
  hi: {
    homeTitle: 'भारत में लाइव बिजली कटौती | powercuts.fyi',
    homeDescription:
      'पूरे भारत में लाइव बिजली कटौती, पावर आउटेज, और इलेक्ट्रिसिटी कट की रिपोर्ट्स। अपना शहर या इलाका खोजें, देखें कि आस-पास बिजली गई है या नहीं, और बिना साइनअप के रिपोर्ट करें।',
    inLanguage: 'hi-IN',
    heading: (place) => `${place} में बिजली कटौती`,
    locationTitleSuffix: '— लाइव आउटेज रिपोर्ट्स | powercuts.fyi',
    locationDescriptionWithReports: (place, count) =>
      `${place} में अभी बिजली कटौती। आस-पास के लोगों से लाइव पावर आउटेज, इलेक्ट्रिसिटी कट, और लोड-शेडिंग अपडेट। अभी ${count} लाइव बिजली-कटौती ${count === 1 ? 'रिपोर्ट' : 'रिपोर्ट्स'}।`,
    locationDescriptionEmpty: (place) =>
      `${place} में अभी बिजली कटौती। आस-पास के लोगों से लाइव पावर आउटेज, इलेक्ट्रिसिटी कट, और लोड-शेडिंग अपडेट। अभी कोई लाइव रिपोर्ट नहीं — यहां देखें या 10 सेकंड में एक जोड़ें।`,
    faq: (place) => [
      {
        question: `क्या ${place} में अभी बिजली कटौती है?`,
        answer: `powercuts.fyi ${place} के लिए लाइव, क्राउडसोर्स्ड बिजली-कटौती रिपोर्ट्स दिखाता है। यदि आस-पास के लोग बिजली गई हुई बताते हैं, तो क्षेत्र तब तक जारी दिखता है जब तक हाल की रिपोर्ट्स इस बात पर सहमत न हों कि बिजली वापस आ गई है।`,
      },
      {
        question: `${place} में बिजली क्यों नहीं है?`,
        answer: `कट अक्सर अचानक हुई स्थानीय ख़राबी, तय मेंटेनेंस, या लोड-शेडिंग की वजह से होते हैं। यह साइट DISCOM की तरफ़ से नहीं बोलती — यह बताती है कि ${place} में लोग अभी क्या रिपोर्ट कर रहे हैं।`,
      },
      {
        question: `${place} में मेरे पास बिजली कटौती — कैसे चेक करूं?`,
        answer: `powercuts.fyi पर ${place} का पेज खोलें, अपने इलाके के लिए लाइव रिपोर्ट्स देखें, या खुद एक रिपोर्ट डालें। कोई साइनअप नहीं, कोई ऐप डाउनलोड नहीं।`,
      },
    ],
  },
};

export function powercutHeading(place: string, language: SeoLanguage = 'en'): string {
  return SEO_COPY[language].heading(place);
}

export function locationDocumentTitle(place: string, language: SeoLanguage = 'en'): string {
  return `${powercutHeading(place, language)} ${SEO_COPY[language].locationTitleSuffix}`;
}

export function locationDescription(
  place: string,
  activeCount = 0,
  language: SeoLanguage = 'en',
): string {
  const copy = SEO_COPY[language];
  return activeCount > 0
    ? copy.locationDescriptionWithReports(place, activeCount)
    : copy.locationDescriptionEmpty(place);
}

export function homeDocumentTitle(language: SeoLanguage = 'en'): string {
  return SEO_COPY[language].homeTitle;
}

export function homeDescription(language: SeoLanguage = 'en'): string {
  return SEO_COPY[language].homeDescription;
}

export function resolveSeoPlace(
  citySlug: string,
  localitySlug?: string,
  extraPlaces: readonly SeoPlace[] = [],
): ResolvedSeoPlace {
  const catalog = [...INDEXABLE_PLACES, ...extraPlaces];
  const cityKey = slugifyPlace(citySlug);
  const localityKey = localitySlug ? slugifyPlace(localitySlug) : null;

  const cityMatches = catalog.filter((place) => {
    const keys = [slugifyPlace(place.city), ...(place.aliases ?? []).map(slugifyPlace)];
    return keys.includes(cityKey);
  });

  if (cityMatches.length > 0 && localityKey) {
    const match =
      cityMatches.find((place) => place.locality && slugifyPlace(place.locality) === localityKey) ??
      catalog.find(
        (place) =>
          slugifyPlace(place.city) === slugifyPlace(cityMatches[0]?.city ?? '') &&
          place.locality &&
          slugifyPlace(place.locality) === localityKey,
      );
    const city = cityMatches[0]?.city ?? displayNameFromSlug(cityKey);
    const locality = match?.locality ?? displayNameFromSlug(localityKey);
    return {
      state: match?.state ?? cityMatches[0]?.state ?? null,
      city,
      locality,
      displayName: `${locality}, ${city}`,
      path: powercutPath(city, locality),
      indexable: Boolean(match),
    };
  }

  if (cityMatches.length > 0 && !localityKey) {
    const cityPlace = cityMatches.find((place) => place.locality === null) ?? cityMatches[0];
    const city = cityPlace?.city ?? displayNameFromSlug(cityKey);
    return {
      state: cityPlace?.state ?? null,
      city,
      locality: null,
      displayName: city,
      path: powercutPath(city),
      indexable: true,
    };
  }

  const localityOnly = catalog.filter(
    (place) => place.locality && slugifyPlace(place.locality) === cityKey,
  );
  if (!localityKey && localityOnly.length === 1 && localityOnly[0]) {
    const match = localityOnly[0];
    return {
      state: match.state,
      city: match.city,
      locality: match.locality,
      displayName: `${match.locality}, ${match.city}`,
      path: powercutPath(match.city, match.locality),
      indexable: true,
    };
  }

  const stateMatch = catalog.find((place) => slugifyPlace(place.state) === cityKey);
  if (!localityKey && stateMatch) {
    return {
      state: stateMatch.state,
      city: null,
      locality: null,
      displayName: stateMatch.state,
      path: statePath(stateMatch.state),
      indexable: true,
    };
  }

  const city = displayNameFromSlug(cityKey);
  const locality = localityKey ? displayNameFromSlug(localityKey) : null;
  return {
    state: null,
    city,
    locality,
    displayName: locality ? `${locality}, ${city}` : city,
    path: powercutPath(city, locality),
    indexable: false,
  };
}

export function uniqueIndexablePaths(extraPlaces: readonly SeoPlace[] = []): string[] {
  const paths = new Set<string>(['/', '/report', '/vision', '/support']);
  for (const place of [...INDEXABLE_PLACES, ...extraPlaces]) {
    paths.add(statePath(place.state));
    paths.add(powercutPath(place.city));
    if (place.locality) {
      paths.add(powercutPath(place.city, place.locality));
    }
  }
  return [...paths].sort();
}

export function faqItems(
  place: string,
  language: SeoLanguage = 'en',
): { question: string; answer: string }[] {
  return SEO_COPY[language].faq(place);
}

export function websiteJsonLd(origin: string, language: SeoLanguage = 'en'): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'powercuts.fyi',
    url: origin,
    inLanguage: SEO_COPY[language].inLanguage,
    description: homeDescription(language),
    potentialAction: {
      '@type': 'SearchAction',
      target: `${origin}/powercut/{search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function locationJsonLd(
  origin: string,
  place: ResolvedSeoPlace,
  activeCount: number,
  language: SeoLanguage = 'en',
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      websiteJsonLd(origin, language),
      {
        '@type': 'WebPage',
        name: powercutHeading(place.displayName, language),
        url: `${origin}${place.path}`,
        description: locationDescription(place.displayName, activeCount, language),
        about: {
          '@type': 'Place',
          name: place.displayName,
          address: {
            '@type': 'PostalAddress',
            addressLocality: place.locality ?? place.city ?? place.displayName,
            addressCountry: 'IN',
            ...(place.state ? { addressRegion: place.state } : {}),
          },
        },
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqItems(place.displayName, language).map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      },
    ],
  };
}
