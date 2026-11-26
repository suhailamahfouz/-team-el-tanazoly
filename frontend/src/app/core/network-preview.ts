import { Network } from './models';

// Display-only labels used when the live network list cannot be loaded.
export const NETWORK_PREVIEW: Network[] = [
  { _id: 'preview-vodafone', key: 'vodafone', nameAr: 'فودافون', nameEn: 'Vodafone', color: '#e60000', logoUrl: '', isActive: false, sortOrder: 1 },
  { _id: 'preview-etisalat', key: 'etisalat', nameAr: 'اتصالات', nameEn: 'Etisalat', color: '#5cb85c', logoUrl: '', isActive: false, sortOrder: 2 },
  { _id: 'preview-orange', key: 'orange', nameAr: 'أورنج', nameEn: 'Orange', color: '#ff7900', logoUrl: '', isActive: false, sortOrder: 3 },
  { _id: 'preview-we', key: 'we', nameAr: 'وي', nameEn: 'WE', color: '#7b4cc9', logoUrl: '', isActive: false, sortOrder: 4 },
];
