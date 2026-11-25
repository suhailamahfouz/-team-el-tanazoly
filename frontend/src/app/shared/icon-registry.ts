import {
  ArrowLeft, ArrowRight, ArrowUpRight, Banknote, Bell, Building2, CalendarDays,
  ChartNoAxesCombined, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  CircleAlert, CircleCheck, CircleHelp, CircleMinus, CirclePlus, CircleX,
  ClipboardList, Clock, CloudUpload, Copy, FileText, Globe, Headset, House, LogOut,
  Mail, MessageCircle, Moon, Package, PackageSearch, Pencil, Phone, Plus, Radio,
  ReceiptText, RefreshCw, Save, Search, Settings, ShieldCheck, ShoppingBag, Star,
  Sun, Trash2, UserRound, UsersRound, Wallet, Wifi,
} from 'lucide-angular';

export const ICONS = {
  arrowLeft: ArrowLeft, arrowRight: ArrowRight, arrowUpRight: ArrowUpRight,
  banknote: Banknote, bell: Bell, building: Building2, calendar: CalendarDays,
  chart: ChartNoAxesCombined, check: Check, chevronDown: ChevronDown,
  chevronLeft: ChevronLeft, chevronRight: ChevronRight, chevronUp: ChevronUp,
  alert: CircleAlert, circleCheck: CircleCheck, help: CircleHelp,
  circleMinus: CircleMinus, circlePlus: CirclePlus, circleX: CircleX,
  clipboard: ClipboardList, clock: Clock, cloudUpload: CloudUpload, copy: Copy,
  file: FileText, globe: Globe, headset: Headset, house: House, logout: LogOut,
  mail: Mail, message: MessageCircle, moon: Moon, package: Package, packageSearch: PackageSearch,
  pencil: Pencil, phone: Phone, plus: Plus, radio: Radio, receipt: ReceiptText,
  refresh: RefreshCw, save: Save, search: Search, settings: Settings,
  shield: ShieldCheck, shoppingBag: ShoppingBag, star: Star, sun: Sun, trash: Trash2,
  user: UserRound, users: UsersRound, wallet: Wallet, wifi: Wifi,
};

export type IconName = keyof typeof ICONS;
