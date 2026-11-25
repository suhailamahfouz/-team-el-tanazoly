import { NgModule } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ICONS } from './icon-registry';

@NgModule({ imports: [LucideAngularModule.pick(ICONS)], exports: [LucideAngularModule] })
export class AppLucideModule {}
