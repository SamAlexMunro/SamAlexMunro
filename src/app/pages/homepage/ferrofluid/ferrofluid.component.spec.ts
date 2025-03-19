import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FerrofluidComponent } from './ferrofluid.component';

describe('FerrofluidComponent', () => {
  let component: FerrofluidComponent;
  let fixture: ComponentFixture<FerrofluidComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FerrofluidComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FerrofluidComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
