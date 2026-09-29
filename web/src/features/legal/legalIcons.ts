import { BookOpen, FileText, Info, Lock, Mail, Map as MapIcon, Search, UserPlus, Wrench } from 'lucide-react';
import type { LegalTitleIcon } from './types';

export const legalTitleIcons: Record<LegalTitleIcon, typeof Info> = {
  book: BookOpen,
  search: Search,
  provider: Wrench,
  userPlus: UserPlus,
  map: MapIcon,
  info: Info,
  terms: FileText,
  privacy: Lock,
  mail: Mail,
};
