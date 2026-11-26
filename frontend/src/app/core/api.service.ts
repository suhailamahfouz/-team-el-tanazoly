import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Booking, MyOrder, Network, Page, PaymentMethod, Pkg, Settings, Transfer, WaMessage } from './models';

const clean = (o: Record<string, unknown>) => { let p = new HttpParams(); for (const [k, v] of Object.entries(o)) if (v !== '' && v != null) p = p.set(k, String(v)); return p; };

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  // ---- public
  settings = () => this.http.get<Settings>('/api/public/settings');
  paymentMethods = () => this.http.get<PaymentMethod[]>('/api/public/payment-methods');
  networks = () => this.http.get<Network[]>('/api/networks');
  packages = (q: Record<string, unknown> = {}) => this.http.get<Pkg[]>('/api/packages', { params: clean(q) });
  package = (id: string) => this.http.get<Pkg>(`/api/packages/${id}`);
  createBooking = (body: FormData) => this.http.post<{ bookingId: string; status: string; price: number | null; packageName: string; networkName: string; linkedToAccount: boolean }>('/api/bookings', body);
  track = (bookingId: string, phone: string) => this.http.post<any>('/api/orders/track', { bookingId, phone });
  myOrders = (page = 1) => this.http.get<Page<MyOrder>>('/api/account/orders', { params: clean({ page }) });
  linkOrder = (bookingId: string, phone: string) => this.http.post<{ linked: boolean }>('/api/account/orders/link', { bookingId, phone });
  submitPayment = (fd: FormData) => this.http.post('/api/orders/payment', fd);
  // ---- admin
  login = (email: string, password: string) => this.http.post<{ token: string; admin: any }>('/api/admin/auth/login', { email, password });
  stats = () => this.http.get<any>('/api/admin/stats');
  bookings = (q: Record<string, unknown>) => this.http.get<Page<Booking>>('/api/admin/bookings', { params: clean(q) });
  booking = (id: string) => this.http.get<Booking>(`/api/admin/bookings/${id}`);
  updateBooking = (id: string, body: object) => this.http.put<Booking>(`/api/admin/bookings/${id}`, body);
  receipt = (id: string) => this.http.get(`/api/admin/bookings/${id}/receipt`, { responseType: 'blob' });
  action = (id: string, action: string, body: object = {}) => this.http.post<{ booking: Booking; notification: string | null }>(`/api/admin/bookings/${id}/${action}`, body);
  addNote = (id: string, text: string) => this.http.post(`/api/admin/bookings/${id}/notes`, { text });
  adminPackages = () => this.http.get<Pkg[]>('/api/admin/packages');
  savePackage = (id: string | null, body: object) => id ? this.http.put<Pkg>(`/api/admin/packages/${id}`, body) : this.http.post<Pkg>('/api/admin/packages', body);
  deletePackage = (id: string) => this.http.delete(`/api/admin/packages/${id}`);
  bulkPrice = (body: object) => this.http.post<{ dryRun: boolean; count: number; changes: { id: string; name: string; from: number; to: number }[] }>('/api/admin/packages/bulk-price', body);
  adminNetworks = () => this.http.get<Network[]>('/api/admin/networks');
  saveNetwork = (id: string | null, body: object) => id ? this.http.put<Network>(`/api/admin/networks/${id}`, body) : this.http.post<Network>('/api/admin/networks', body);
  deleteNetwork = (id: string) => this.http.delete(`/api/admin/networks/${id}`);
  uploadImage = (file: File) => { const fd = new FormData(); fd.append('image', file); return this.http.post<{ url: string }>('/api/admin/upload/image', fd); };
  customers = (q: Record<string, unknown>) => this.http.get<Page<any>>('/api/admin/customers', { params: clean(q) });
  customer = (id: string) => this.http.get<{ customer: any; bookings: Booking[] }>(`/api/admin/customers/${id}`);
  waMessages = (q: Record<string, unknown>) => this.http.get<Page<WaMessage>>('/api/admin/whatsapp/messages', { params: clean(q) });
  prepareWhatsApp = (bookingId: string, body: { recipientType: 'customer' | 'renewal'; to: string; body: string; event: 'booking_created' | 'activated' | 'custom' }) => this.http.post<WaMessage>(`/api/admin/bookings/${bookingId}/whatsapp`, body);
  markWhatsAppOpened = (id: string) => this.http.post<WaMessage>(`/api/admin/whatsapp/messages/${id}/opened`, {});
  confirmWhatsAppSent = (id: string) => this.http.post<WaMessage>(`/api/admin/whatsapp/messages/${id}/confirm`, { manuallyConfirmed: true });
  transfers = (q: Record<string, unknown>) => this.http.get<Page<Transfer>>('/api/admin/transfers', { params: clean(q) });
  transferMethods = () => this.http.get<{ key: string; label: string }[]>('/api/admin/transfers/methods');
  createTransfer = (form: FormData) => this.http.post<Transfer>('/api/admin/transfers', form);
  transferReceipt = (id: string) => this.http.get(`/api/admin/transfers/${id}/receipt`, { responseType: 'blob' });
  reviewTransfer = (id: string, status: 'confirmed' | 'rejected', note = '') => this.http.post<Transfer>(`/api/admin/transfers/${id}/review`, { status, note });
  adminSettings = () => this.http.get<Settings>('/api/admin/settings');
  saveSettings = (body: object) => this.http.put<Settings>('/api/admin/settings', body);
}
