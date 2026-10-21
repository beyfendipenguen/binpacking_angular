import { TestBed } from '@angular/core/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { TEST_INITIAL_STATE } from '../../../testing/test-providers';
import { HasPermissionDirective } from './has-permission.directive';

describe('HasPermissionDirective', () => {
  it('should create an instance', () => {
    TestBed.configureTestingModule({ providers: [provideMockStore({ initialState: TEST_INITIAL_STATE })] });
    const directive = TestBed.runInInjectionContext(
      () => new HasPermissionDirective({} as any, {} as any)
    );
    expect(directive).toBeTruthy();
  });
});
