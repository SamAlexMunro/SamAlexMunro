import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CanvascontrollerComponent } from './canvascontroller.component';

describe('CanvascontrollerComponent', () => {
  let component: CanvascontrollerComponent;
  let fixture: ComponentFixture<CanvascontrollerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CanvascontrollerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CanvascontrollerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
