import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DisplacementComponent } from './displacement.component';

describe('DisplacementComponent', () => {
  let component: DisplacementComponent;
  let fixture: ComponentFixture<DisplacementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DisplacementComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DisplacementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
