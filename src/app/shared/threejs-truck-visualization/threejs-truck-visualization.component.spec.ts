import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ThreejsTruckVisualizationComponent } from './threejs-truck-visualization.component';

describe('ThreejsTruckVisualizationComponent', () => {
  let component: ThreejsTruckVisualizationComponent;
  let fixture: ComponentFixture<ThreejsTruckVisualizationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ThreejsTruckVisualizationComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ThreejsTruckVisualizationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
