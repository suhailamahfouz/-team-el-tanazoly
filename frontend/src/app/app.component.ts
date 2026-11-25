import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastService } from './core/ui';
import { IconComponent } from './shared/icon';
import { ThemeService } from './core/theme';

@Component({
  selector: 'app-root', standalone: true, imports: [RouterOutlet, IconComponent],
  template: `<router-outlet /><div class="toasts">@for (t of toast.items(); track t.id) { <div class="toast" [class]="t.kind"><app-icon [name]="t.kind === 'ok' ? 'circleCheck' : 'circleX'" [size]="18" />{{ t.text }}</div> }</div>`,
})
export class AppComponent { toast = inject(ToastService); private theme = inject(ThemeService); }
