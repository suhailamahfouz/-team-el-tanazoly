import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { WarmupService } from './warmup';
import { AppComponent } from '../app.component';
import { RouterTestingModule } from '@angular/router/testing';

describe('WarmupService', () => {
  let warmup: WarmupService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    warmup = TestBed.inject(WarmupService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('does not flash the loading screen when the API responds quickly', fakeAsync(() => {
    warmup.start(); tick(0);
    http.expectOne('/api/health').flush({ ok: true });
    expect(warmup.ready()).toBeTrue(); expect(warmup.visible()).toBeFalse();
    tick(400); expect(warmup.visible()).toBeFalse();
  }));

  it('shows the screen while waiting and closes it when the API responds', fakeAsync(() => {
    warmup.start(); tick(0);
    const request = http.expectOne('/api/health');
    tick(350); expect(warmup.visible()).toBeTrue(); expect(warmup.ready()).toBeFalse();
    request.flush({ ok: true });
    expect(warmup.ready()).toBeTrue(); expect(warmup.visible()).toBeFalse();
  }));

  it('releases the page after 90 seconds and reports recovery later', fakeAsync(() => {
    const recovered = jasmine.createSpy('recovered');
    warmup.recovered.subscribe(recovered);
    warmup.start();
    for (let i = 0; i < 15; i++) {
      tick(i === 0 ? 0 : 6000);
      http.expectOne('/api/health').flush({}, { status: 503, statusText: 'Unavailable' });
    }
    expect(warmup.ready()).toBeFalse();
    tick(6000); expect(warmup.ready()).toBeTrue(); expect(warmup.visible()).toBeFalse();
    http.expectOne('/api/health').flush({}, { status: 503, statusText: 'Unavailable' });
    tick(30_000);
    http.expectOne('/api/health').flush({ ok: true });
    expect(recovered).toHaveBeenCalledTimes(1);
  }));
});

describe('warmup screen', () => {
  it('shows the logo and four networks during a slow response, then displays the app', fakeAsync(() => {
    TestBed.configureTestingModule({ imports: [AppComponent, HttpClientTestingModule, RouterTestingModule] });
    const fixture = TestBed.createComponent(AppComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges(); tick(0);
    const request = http.expectOne('/api/health');
    tick(350); fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.warmup-logo')?.getAttribute('src')).toBe('/logos/Logo1.jpeg');
    expect(root.querySelectorAll('.network').length).toBe(4);
    expect(root.querySelector('router-outlet')).toBeNull();
    request.flush({ ok: true }); fixture.detectChanges();
    expect(root.querySelector('.warmup')).toBeNull();
    expect(root.querySelector('router-outlet')).not.toBeNull();
    http.verify(); fixture.destroy();
  }));
});
