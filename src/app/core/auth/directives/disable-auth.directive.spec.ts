import { ElementRef, Renderer2 } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { TEST_INITIAL_STATE } from '../../../testing/test-providers';
import { DisableAuthDirective } from './disable-auth.directive';

describe('DisableAuthDirective', () => {
  it('should create an instance', () => {
    TestBed.configureTestingModule({
      providers: [
        provideMockStore({ initialState: TEST_INITIAL_STATE }),
        { provide: ElementRef, useValue: new ElementRef(document.createElement('div')) },
        { provide: Renderer2, useValue: {} },
      ],
    });
    const directive = TestBed.runInInjectionContext(() => new DisableAuthDirective());
    expect(directive).toBeTruthy();
  });
});
