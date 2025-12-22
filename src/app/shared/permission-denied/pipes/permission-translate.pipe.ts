// pipes/permission-translate.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Pipe({
  name: 'permissionTranslate',
  standalone: true,
  pure: false
})
export class PermissionTranslatePipe implements PipeTransform {
  constructor(private translate: TranslateService) {}

  transform(permission: string): string {
    if (!permission) return '';

    // Format: app_label.action_model
    const parts = permission.split('.');
    if (parts.length !== 2) return permission;

    const [appLabel, actionModel] = parts;

    // Action ve model'i ayır (add_user -> add, user)
    const match = actionModel.match(/^(view|add|change|delete)_(.+)$/);
    if (!match) return permission;

    const [, action, model] = match;

    // Çeviriyi al
    const actionKey = `PERMISSION.ACTIONS.${action.toUpperCase()}`;
    const modelKey = `PERMISSION.MODELS.${model.toUpperCase()}`;
    const appKey = `PERMISSION.APPS.${appLabel.toUpperCase()}`;

    const actionText = this.translate.instant(actionKey);
    const modelText = this.translate.instant(modelKey);
    const appText = this.translate.instant(appKey);

    return `${appText} - ${actionText} ${modelText}`;
  }
}
