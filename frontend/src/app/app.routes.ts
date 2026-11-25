import { Routes } from '@angular/router';
import { adminOnlyGuard, authGuard } from './core/auth';

export const routes: Routes = [
  { path: 'admin/login', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'admin', canActivate: [authGuard], loadComponent: () => import('./admin/layout').then(m => m.AdminLayoutComponent),
    children: [
      { path: 'profile', loadComponent: () => import('./admin/profile').then(m => m.AdminProfileComponent), title: 'ملف الإدارة' },
      { path: '', loadComponent: () => import('./admin/overview').then(m => m.OverviewComponent), title: 'نظرة عامة' },
      { path: 'bookings', loadComponent: () => import('./admin/bookings').then(m => m.AdminBookingsComponent), title: 'الحجوزات' },
      { path: 'transfers', loadComponent: () => import('./admin/transfers').then(m => m.AdminTransfersComponent), title: 'التحويلات' },
      { path: 'customers', loadComponent: () => import('./admin/customers').then(m => m.AdminCustomersComponent), title: 'العملاء' },
      { path: 'packages', canActivate: [adminOnlyGuard], loadComponent: () => import('./admin/packages').then(m => m.AdminPackagesComponent), title: 'الباقات' },
      { path: 'networks', canActivate: [adminOnlyGuard], loadComponent: () => import('./admin/networks').then(m => m.AdminNetworksComponent), title: 'الشبكات' },
      { path: 'whatsapp', canActivate: [adminOnlyGuard], loadComponent: () => import('./admin/whatsapp').then(m => m.AdminWhatsappComponent), title: 'واتساب' },
      { path: 'settings', canActivate: [adminOnlyGuard], loadComponent: () => import('./admin/settings').then(m => m.AdminSettingsComponent), title: 'الإعدادات' },
    ],
  },
  {
    path: '', loadComponent: () => import('./layout/shell').then(m => m.ShellComponent),
    children: [
      { path: '', loadComponent: () => import('./pages/home-discovery').then(m => m.HomeDiscoveryComponent), title: 'تيم النزلاوي' },
      { path: 'networks', loadComponent: () => import('./pages/networks').then(m => m.NetworksComponent), title: 'الشبكات' },
      { path: 'packages', loadComponent: () => import('./pages/packages').then(m => m.PackagesComponent), title: 'الباقات' },
      { path: 'booking', loadComponent: () => import('./pages/booking-request').then(m => m.BookingRequestComponent), title: 'اطلب التجديد' },
      { path: 'orders', loadComponent: () => import('./pages/orders').then(m => m.OrdersComponent), title: 'طلباتي' },
      { path: 'contact', loadComponent: () => import('./pages/contact').then(m => m.ContactComponent), title: 'تواصل معنا' },
      { path: 'login', loadComponent: () => import('./pages/account').then(m => m.AccountLoginComponent), title: 'تسجيل الدخول' },
      { path: 'register', loadComponent: () => import('./pages/account').then(m => m.AccountRegisterComponent), title: 'إنشاء حساب' },
      { path: 'account', loadComponent: () => import('./pages/account').then(m => m.AccountPageComponent), title: 'حسابي' },
    ],
  },
  { path: '**', redirectTo: '' },
];
