import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FabricSimulationComponent } from './fabric-simulation.component';

describe('FabricSimulationComponent', () => {
  let component: FabricSimulationComponent;
  let fixture: ComponentFixture<FabricSimulationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FabricSimulationComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FabricSimulationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
