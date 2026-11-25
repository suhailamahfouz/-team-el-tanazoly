import { Component, Input } from '@angular/core';
import { AppLucideModule } from './icon.module';
import { ICONS, IconName } from './icon-registry';
export type { IconName } from './icon-registry';

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [AppLucideModule],
  template: `<lucide-angular [img]="iconData()" [size]="size" [strokeWidth]="strokeWidth" class="ui-icon" />`,
  host: { class: 'icon-host', '[attr.aria-hidden]': 'true', '[style.--icon-size.px]': 'size' },
})
export class IconComponent {
  @Input({ required: true }) name!: IconName;
  @Input() size = 20;
  @Input() strokeWidth = 1.9;
  iconData() { return ICONS[this.name] || ICONS.help; }
}
