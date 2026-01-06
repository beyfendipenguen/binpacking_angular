import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot } from '@angular/router';
import { AppState, selectUser } from '@app/store';
import { Store } from '@ngrx/store';
import { map, filter, take } from 'rxjs/operators';

export const permissionGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const store = inject(Store<AppState>);
  const router = inject(Router);

  const routeData = route.data['permission'] || route.data['permissions'];
  let requiredPermissions: string[] = [];

  if (Array.isArray(routeData)) {
    requiredPermissions = routeData;
  } else if (typeof routeData === 'string') {
    requiredPermissions = [routeData];
  }

  if (requiredPermissions.length === 0) {
    return true;
  }

  return store.select(selectUser).pipe(
    filter(user => user !== null),
    take(1),
    map(user => {
      if (user.is_superuser) return true;

      const hasPermission = requiredPermissions.some(reqPerm =>
        user.permissions.includes(reqPerm)
      );

        if (hasPermission) {
        return true;
      } else {
        return router.createUrlTree(['/unauthorized'], {
          queryParams: {
            missing: requiredPermissions.join(',')
          }
        });
      }
    })
  );
};
